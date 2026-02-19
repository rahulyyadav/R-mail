from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import certifi
import logging
import json
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
# Also load root project .env (where user may place API keys)
load_dotenv(ROOT_DIR.parent / '.env', override=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ── Models ──────────────────────────────────────────────

class Email(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    gmail_id: str = ""
    thread_id: str = ""
    from_email: str
    from_name: str
    to_email: str
    to_name: str
    subject: str
    body: str
    preview: str = ""
    date: str
    is_read: bool = False
    folder: str = "inbox"
    starred: bool = False
    reply_to: Optional[str] = None
    message_id: str = ""
    in_reply_to: str = ""
    references: str = ""


class EmailSend(BaseModel):
    to_email: str
    to_name: str = ""
    subject: str
    body: str
    reply_to_message_id: str = ""
    thread_id: str = ""


class ChatRequest(BaseModel):
    message: str
    context: dict = {}


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: str
    content: str
    actions: list = []
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── WebSocket Manager ───────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                disconnected.append(conn)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


# ── Gmail Integration ───────────────────────────────────

from gmail_service import (
    is_gmail_configured, get_gmail_service, get_user_profile,
    fetch_emails as gmail_fetch_emails, send_gmail,
    mark_as_read_gmail, toggle_star_gmail, fetch_thread,
    check_new_emails,
)
from google_auth_oauthlib.flow import Flow

# Track Gmail history ID for real-time polling
gmail_history_id = None
user_profile_cache = None

# OAuth scopes
OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
]

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8001')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7

# ── JWT Auth Helpers ────────────────────────────────────

security = HTTPBearer(auto_error=False)


def create_jwt_token(email: str) -> str:
    """Create a JWT token for the given user email."""
    payload = {
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """FastAPI dependency: validate JWT and return user email."""
    if not credentials:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get('email')
        if not email:
            raise HTTPException(status_code=401, detail='Invalid token')
        # Check if token is blacklisted
        blacklisted = await db.jwt_blacklist.find_one({'token': credentials.credentials})
        if blacklisted:
            raise HTTPException(status_code=401, detail='Token has been revoked')
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token has expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')


def _get_oauth_flow(redirect_uri: str = None):
    """Create an OAuth flow from env credentials."""
    client_id = os.environ.get('GMAIL_CLIENT_ID', '')
    client_secret = os.environ.get('GMAIL_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        return None
    # Must match the redirect URI registered in Google Cloud Console
    redir = redirect_uri or FRONTEND_URL
    client_config = {
        'web': {
            'client_id': client_id,
            'client_secret': client_secret,
            'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
            'token_uri': 'https://oauth2.googleapis.com/token',
            'redirect_uris': [redir],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=OAUTH_SCOPES)
    flow.redirect_uri = redir
    return flow


async def load_tokens_from_db():
    """Load stored OAuth tokens from MongoDB."""
    doc = await db.auth_tokens.find_one({'_id': 'gmail_tokens'})
    if doc:
        os.environ['GMAIL_REFRESH_TOKEN'] = doc.get('refresh_token', '')
    return doc


async def store_tokens_to_db(refresh_token: str, email: str):
    """Store OAuth tokens to MongoDB."""
    await db.auth_tokens.update_one(
        {'_id': 'gmail_tokens'},
        {'$set': {'refresh_token': refresh_token, 'email': email, 'updated_at': datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    os.environ['GMAIL_REFRESH_TOKEN'] = refresh_token


async def sync_gmail_to_db(folder: str = 'inbox', max_results: int = 50):
    """Sync Gmail emails to MongoDB for fast access."""
    global gmail_history_id
    try:
        emails = gmail_fetch_emails(folder=folder, max_results=max_results)
        if not emails:
            return 0

        count = 0
        for email_data in emails:
            # Upsert by gmail_id to avoid duplicates
            existing = await db.emails.find_one({"gmail_id": email_data['gmail_id']})
            if existing:
                # Update read/starred status
                await db.emails.update_one(
                    {"gmail_id": email_data['gmail_id']},
                    {"$set": {
                        "is_read": email_data['is_read'],
                        "starred": email_data['starred'],
                    }}
                )
            else:
                await db.emails.insert_one(email_data)
                count += 1

        # Get the latest history ID for polling
        service = get_gmail_service()
        profile = service.users().getProfile(userId='me').execute()
        gmail_history_id = profile.get('historyId')

        logger.info(f"Synced {count} new emails from Gmail ({folder})")
        return count
    except Exception as e:
        logger.error(f"Gmail sync error: {e}")
        return 0


async def poll_gmail_for_new_emails():
    """Background task that polls Gmail for new emails every 30 seconds."""
    global gmail_history_id

    # Wait a bit before starting polling
    await asyncio.sleep(10)

    while True:
        try:
            if gmail_history_id and is_gmail_configured():
                new_emails, new_history_id = check_new_emails(gmail_history_id)
                gmail_history_id = new_history_id

                for email_data in new_emails:
                    # Check if already in DB
                    existing = await db.emails.find_one({"gmail_id": email_data['gmail_id']})
                    if not existing:
                        await db.emails.insert_one(email_data)
                        safe_doc = {k: v for k, v in email_data.items() if k != "_id"}
                        await manager.broadcast({"type": "new_email", "email": safe_doc})
                        logger.info(f"New Gmail email from {email_data.get('from_name', 'Unknown')}")
        except Exception as e:
            logger.error(f"Gmail polling error: {e}")

        await asyncio.sleep(30)  # Poll every 30 seconds


# ── AI Assistant ────────────────────────────────────────

# Store conversation history in memory for context
ai_conversation_history = []


async def process_ai_message(message: str, context: dict):
    """Process AI chat messages using Google Gemini API directly."""
    from google import genai

    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {"message": "AI assistant is not configured. Please add your GEMINI_API_KEY to the backend .env file.", "actions": []}

    emails_cursor = db.emails.find(
        {},
        {"_id": 0, "id": 1, "gmail_id": 1, "thread_id": 1, "from_name": 1, "from_email": 1,
         "to_email": 1, "to_name": 1, "subject": 1, "date": 1, "is_read": 1, "folder": 1,
         "preview": 1, "starred": 1, "message_id": 1}
    ).sort("date", -1)
    emails_list = await emails_cursor.to_list(50)
    email_context = json.dumps(emails_list, indent=2)

    current_view = context.get('currentView', 'inbox')
    selected_email_id = context.get('selectedEmailId', 'none')
    selected_email_subject = context.get('selectedEmailSubject', '')

    # Get user's email for context
    user_email = "the user"
    if user_profile_cache:
        user_email = user_profile_cache.get('email', 'the user')

    system_prompt = f"""You are an AI email assistant that controls a mail application UI. You help users manage their REAL emails by executing actions on the interface. The user's email is {user_email}.

AVAILABLE EMAILS IN THE SYSTEM:
{email_context}

CURRENT UI STATE:
- Current view: {current_view}
- Selected email ID: {selected_email_id}
- Selected email subject: {selected_email_subject}

You MUST respond with valid JSON only. No markdown code blocks, no extra text. Just raw JSON:
{{
  "message": "A friendly message explaining what you're doing",
  "actions": [
    {{
      "type": "action_type",
      ...params
    }}
  ]
}}

AVAILABLE ACTIONS:
1. Navigate to a view: {{"type": "navigate", "view": "inbox" | "sent" | "compose"}}
2. Compose/draft an email: {{"type": "compose", "to": "email@example.com", "subject": "Subject line", "body": "Email body text"}}
3. Open/read a specific email: {{"type": "open_email", "email_id": "the-email-id"}}
4. Filter/search emails: {{"type": "filter", "sender": "", "keyword": "", "date_from": "", "date_to": "", "unread_only": false}}
5. Reply to an email (thread reply): {{"type": "reply", "email_id": "id-of-email", "body": "Reply text"}}
6. Send the composed email: {{"type": "send"}}
7. Clear all filters: {{"type": "clear_filters"}}

RULES:
- These are REAL emails. Be careful and accurate.
- When composing: use "compose" action. The UI will show compose form with fields filled in.
- When user says "send email to X about Y", use compose action to fill the form. The user will confirm before sending.
- When user says "reply to this email" while viewing an email, use "reply" action with the selected email's ID and compose a helpful reply body.
- When searching/filtering: use "filter" action with relevant params.
- When user wants to open/read an email: use "open_email" with the matching email id (use the "id" field or "gmail_id" field).
- Always be friendly and explain what you're doing.
- For date filters, use ISO format dates.
- When user says "show me unread" or "only unread", set unread_only to true.
- When user wants to see all emails again, use clear_filters.
- If user asks something that doesn't require an action (like "how many emails do I have?"), just answer in the message with no actions.
"""

    try:
        client = genai.Client(api_key=api_key)

        # Build conversation contents with history
        contents = []
        for hist_msg in ai_conversation_history[-10:]:
            contents.append(genai.types.Content(
                role=hist_msg["role"],
                parts=[genai.types.Part(text=hist_msg["text"])]
            ))
        contents.append(genai.types.Content(
            role="user",
            parts=[genai.types.Part(text=message)]
        ))

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.3,
            ),
        )

        response_text = response.text.strip()

        # Store in conversation history
        ai_conversation_history.append({"role": "user", "text": message})
        ai_conversation_history.append({"role": "model", "text": response_text})

        # Strip markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split("\n")
            start = 1
            end = len(lines) - 1
            for i, line in enumerate(lines):
                if i == 0:
                    continue
                if line.strip().startswith("```"):
                    end = i
                    break
            response_text = "\n".join(lines[start:end])

        parsed = json.loads(response_text)
        return parsed
    except json.JSONDecodeError:
        return {"message": response_text, "actions": []}
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return {"message": f"Sorry, I encountered an error with the AI service. Please check your GEMINI_API_KEY.", "actions": []}


# ── API Routes ──────────────────────────────────────────

# Root health-check (on the app itself, not the /api router)
# This ensures uptime monitors hitting "/" get a 200 OK.
@app.get("/")
async def health_check():
    return {"status": "ok", "message": "R-Mail Backend is running"}


@api_router.get("/")
async def root():
    return {"message": "AI Mail App API"}


@api_router.get("/auth/status")
async def auth_status(user_email: str = Depends(get_current_user)):
    """Return authentication status and user profile (requires valid JWT)."""
    gmail_configured = is_gmail_configured()
    profile = user_profile_cache if user_profile_cache else {}
    return {
        "gmail_configured": gmail_configured,
        "email": user_email,
        "mode": "gmail" if gmail_configured else "disconnected",
        "can_login": bool(os.environ.get('GMAIL_CLIENT_ID')),
    }


@api_router.get("/auth/login")
async def auth_login():
    """Generate Google OAuth URL and redirect user."""
    flow = _get_oauth_flow()
    if not flow:
        return {"error": "Gmail client credentials not configured"}
    auth_url, _ = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
    )
    return {"auth_url": auth_url}


@api_router.get("/auth/callback")
async def auth_callback(code: str):
    """Handle OAuth callback — frontend forwards the code here via AJAX."""
    global user_profile_cache, gmail_history_id
    try:
        flow = _get_oauth_flow()
        if not flow:
            return {"success": False, "error": "Gmail client credentials not configured"}
        flow.fetch_token(code=code)
        creds = flow.credentials
        if not creds.refresh_token:
            return {"success": False, "error": "No refresh token received. Please revoke app access and try again."}

        # Store tokens
        os.environ['GMAIL_REFRESH_TOKEN'] = creds.refresh_token
        profile = get_user_profile()
        user_profile_cache = profile
        await store_tokens_to_db(creds.refresh_token, profile.get('email', ''))

        # Sync emails
        await db.emails.delete_many({})
        inbox_count = await sync_gmail_to_db('inbox', 50)
        sent_count = await sync_gmail_to_db('sent', 30)
        asyncio.create_task(poll_gmail_for_new_emails())

        # Generate JWT session token
        user_email = profile.get('email', '')
        token = create_jwt_token(user_email)

        logger.info(f"OAuth login successful: {user_email} ({inbox_count} inbox + {sent_count} sent)")
        return {"success": True, "token": token, "email": user_email, "inbox_count": inbox_count, "sent_count": sent_count}
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return {"success": False, "error": str(e)}


@api_router.post("/auth/logout")
async def auth_logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Clear stored tokens, blacklist JWT, and reset state."""
    global user_profile_cache, gmail_history_id
    # Blacklist the current JWT so it can't be reused
    if credentials:
        await db.jwt_blacklist.insert_one({
            'token': credentials.credentials,
            'blacklisted_at': datetime.now(timezone.utc).isoformat(),
        })
    await db.auth_tokens.delete_many({})
    await db.emails.delete_many({})
    await db.chat_messages.delete_many({})
    user_profile_cache = None
    gmail_history_id = None
    os.environ.pop('GMAIL_REFRESH_TOKEN', None)
    logger.info("User logged out, tokens cleared")
    return {"success": True}


@api_router.get("/emails")
async def get_emails(
    folder: str = "inbox",
    sender: str = "",
    keyword: str = "",
    unread_only: bool = False,
    date_from: str = "",
    date_to: str = "",
    user_email: str = Depends(get_current_user),
):
    query = {"folder": folder}
    conditions = []

    if sender:
        conditions.append({
            "$or": [
                {"from_name": {"$regex": sender, "$options": "i"}},
                {"from_email": {"$regex": sender, "$options": "i"}},
            ]
        })
    if keyword:
        conditions.append({
            "$or": [
                {"subject": {"$regex": keyword, "$options": "i"}},
                {"body": {"$regex": keyword, "$options": "i"}},
                {"preview": {"$regex": keyword, "$options": "i"}},
            ]
        })
    if unread_only:
        conditions.append({"is_read": False})
    if date_from:
        conditions.append({"date": {"$gte": date_from}})
    if date_to:
        conditions.append({"date": {"$lte": date_to}})

    if conditions:
        query["$and"] = conditions

    emails = await db.emails.find(query, {"_id": 0}).sort("date", -1).to_list(200)
    return emails


@api_router.get("/emails/{email_id}")
async def get_email(email_id: str, user_email: str = Depends(get_current_user)):
    # Try by id first, then by gmail_id
    email = await db.emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        email = await db.emails.find_one({"gmail_id": email_id}, {"_id": 0})
    if not email:
        return {"error": "Email not found"}
    return email


@api_router.put("/emails/{email_id}/read")
async def mark_as_read(email_id: str, user_email: str = Depends(get_current_user)):
    # Update in DB
    result = await db.emails.update_one({"id": email_id}, {"$set": {"is_read": True}})
    if result.modified_count == 0:
        await db.emails.update_one({"gmail_id": email_id}, {"$set": {"is_read": True}})

    # Also mark as read in Gmail
    email = await db.emails.find_one({"$or": [{"id": email_id}, {"gmail_id": email_id}]})
    if email and email.get("gmail_id") and is_gmail_configured():
        try:
            mark_as_read_gmail(email["gmail_id"])
        except Exception as e:
            logger.error(f"Failed to mark as read in Gmail: {e}")

    return {"success": True}


@api_router.put("/emails/{email_id}/star")
async def toggle_star(email_id: str, user_email: str = Depends(get_current_user)):
    email = await db.emails.find_one(
        {"$or": [{"id": email_id}, {"gmail_id": email_id}]},
        {"_id": 0}
    )
    if email:
        new_val = not email.get("starred", False)
        await db.emails.update_one(
            {"$or": [{"id": email_id}, {"gmail_id": email_id}]},
            {"$set": {"starred": new_val}}
        )

        # Sync star to Gmail
        if email.get("gmail_id") and is_gmail_configured():
            try:
                toggle_star_gmail(email["gmail_id"], new_val)
            except Exception as e:
                logger.error(f"Failed to toggle star in Gmail: {e}")

        return {"success": True, "starred": new_val}
    return {"error": "Email not found"}


@api_router.post("/emails/send")
async def send_email(email_data: EmailSend, user_email: str = Depends(get_current_user)):
    """Send a real email via Gmail API."""
    if is_gmail_configured():
        try:
            # Send via Gmail
            sent_email = send_gmail(
                to_email=email_data.to_email,
                subject=email_data.subject,
                body=email_data.body,
                reply_to_message_id=email_data.reply_to_message_id or None,
                thread_id=email_data.thread_id or None,
            )
            sent_email['folder'] = 'sent'
            sent_email['is_read'] = True

            # Save to DB
            await db.emails.insert_one(sent_email)
            safe_doc = {k: v for k, v in sent_email.items() if k != "_id"}
            await manager.broadcast({"type": "email_sent", "email": safe_doc})
            logger.info(f"Real email sent to {email_data.to_email}")
            return safe_doc
        except Exception as e:
            logger.error(f"Failed to send email via Gmail: {e}")
            return {"error": f"Failed to send email: {str(e)}"}
    else:
        # Fallback: simulated send
        profile = user_profile_cache or {}
        user_email = profile.get('email', 'you@mailapp.com')
        email = Email(
            from_email=user_email,
            from_name="You",
            to_email=email_data.to_email,
            to_name=email_data.to_name or email_data.to_email.split("@")[0],
            subject=email_data.subject,
            body=email_data.body,
            preview=email_data.body[:100],
            date=datetime.now(timezone.utc).isoformat(),
            is_read=True,
            folder="sent",
        )
        doc = email.model_dump()
        await db.emails.insert_one(doc)
        safe_doc = {k: v for k, v in doc.items() if k != "_id"}
        await manager.broadcast({"type": "email_sent", "email": safe_doc})
        return safe_doc


@api_router.get("/emails/{email_id}/thread")
async def get_email_thread(email_id: str, user_email: str = Depends(get_current_user)):
    """Fetch all messages in a thread."""
    email = await db.emails.find_one(
        {"$or": [{"id": email_id}, {"gmail_id": email_id}]},
        {"_id": 0}
    )
    if not email or not email.get("thread_id"):
        return []

    if is_gmail_configured():
        try:
            thread_msgs = fetch_thread(email["thread_id"])
            return thread_msgs
        except Exception as e:
            logger.error(f"Error fetching thread: {e}")

    # Fallback: get from DB by thread_id
    msgs = await db.emails.find(
        {"thread_id": email.get("thread_id")}, {"_id": 0}
    ).sort("date", 1).to_list(50)
    return msgs


@api_router.post("/gmail/sync")
async def gmail_sync(user_email: str = Depends(get_current_user)):
    """Manually trigger a Gmail sync."""
    if not is_gmail_configured():
        return {"error": "Gmail is not configured"}

    # Clear old emails and re-sync
    await db.emails.delete_many({})
    inbox_count = await sync_gmail_to_db('inbox', 50)
    sent_count = await sync_gmail_to_db('sent', 30)
    return {"synced": {"inbox": inbox_count, "sent": sent_count}}


@api_router.post("/ai/chat")
async def ai_chat(request: ChatRequest, user_email: str = Depends(get_current_user)):
    try:
        result = await process_ai_message(request.message, request.context)

        user_msg = ChatMessage(role="user", content=request.message)
        assistant_msg = ChatMessage(
            role="assistant",
            content=result.get("message", ""),
            actions=result.get("actions", []),
        )
        await db.chat_messages.insert_one(user_msg.model_dump())
        await db.chat_messages.insert_one(assistant_msg.model_dump())

        return result
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        return {"message": f"Sorry, I encountered an error. Please try again.", "actions": []}


@api_router.get("/chat/history")
async def get_chat_history(user_email: str = Depends(get_current_user)):
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    return messages


@api_router.delete("/chat/history")
async def clear_chat_history(user_email: str = Depends(get_current_user)):
    await db.chat_messages.delete_many({})
    return {"success": True}


# ── WebSocket ───────────────────────────────────────────

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# ── App Setup ───────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    global user_profile_cache

    # Try loading tokens from DB first
    try:
        await load_tokens_from_db()
    except Exception as e:
        logger.error(f"Failed to load tokens from DB at startup: {e}")
        logger.warning("MongoDB connection might be down or blocked. App will start but auth may fail.")

    # Run startup sync in BACKGROUND so we don't block the port binding
    asyncio.create_task(background_startup_sync())


async def background_startup_sync():
    """Perform heavy startup tasks in background."""
    global user_profile_cache
    if is_gmail_configured():
        logger.info("Gmail is configured — syncing real emails (background)...")
        try:
            # Add a small delay to let server start up
            await asyncio.sleep(2)
            
            user_profile_cache = get_user_profile()
            logger.info(f"Authenticated as: {user_profile_cache.get('email', 'unknown')}")

            # Clear old data and sync fresh
            await db.emails.delete_many({})
            inbox_count = await sync_gmail_to_db('inbox', 50)
            sent_count = await sync_gmail_to_db('sent', 30)
            logger.info(f"Synced {inbox_count} inbox + {sent_count} sent emails from Gmail")

            # Start real-time polling
            asyncio.create_task(poll_gmail_for_new_emails())
        except Exception as e:
            logger.error(f"Gmail startup error: {e}")
            logger.info("Falling back to empty inbox. Please check your Gmail credentials.")
    else:
        logger.info("Gmail not configured. Login via the app or set credentials in .env")


@app.on_event("shutdown")
async def shutdown():
    client.close()
