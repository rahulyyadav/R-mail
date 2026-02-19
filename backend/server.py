from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
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

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ── Models ──────────────────────────────────────────────

class Email(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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


class EmailSend(BaseModel):
    to_email: str
    to_name: str = ""
    subject: str
    body: str


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


# ── Seed Data ───────────────────────────────────────────

async def seed_emails():
    count = await db.emails.count_documents({})
    if count > 0:
        return

    now = datetime.now(timezone.utc)
    seed = [
        {
            "from_email": "sarah.chen@techcorp.com",
            "from_name": "Sarah Chen",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Q1 Project Review - Action Items",
            "body": "Hi,\n\nHope you're doing well! I wanted to share the Q1 project review highlights:\n\n1. Revenue targets exceeded by 12%\n2. Customer satisfaction score improved to 4.7/5\n3. Three new enterprise clients onboarded\n\nAction items for next quarter:\n- Finalize the product roadmap by Jan 25\n- Schedule stakeholder alignment meeting\n- Review budget allocation for Q2\n\nLet me know if you have any questions. I've attached the detailed report for your reference.\n\nBest regards,\nSarah",
            "preview": "Hope you're doing well! I wanted to share the Q1 project review highlights...",
            "date": (now - timedelta(hours=2)).isoformat(),
            "is_read": False,
            "folder": "inbox",
            "starred": True,
        },
        {
            "from_email": "david.park@designlab.io",
            "from_name": "David Park",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "New UI Mockups Ready for Review",
            "body": "Hey!\n\nThe new dashboard mockups are ready. I've incorporated all the feedback from our last session:\n\n- Simplified navigation structure\n- Updated color palette to match brand guidelines\n- Added dark mode support\n- Improved data visualization components\n\nYou can view them in our Figma workspace. I'd love to get your thoughts before we start the implementation sprint next week.\n\nThanks,\nDavid",
            "preview": "The new dashboard mockups are ready. I've incorporated all the feedback...",
            "date": (now - timedelta(hours=5)).isoformat(),
            "is_read": False,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "emily.r@startup.co",
            "from_name": "Emily Rodriguez",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Investor Meeting Tomorrow at 2 PM",
            "body": "Hi team,\n\nJust a reminder about tomorrow's investor meeting at 2 PM. Here's the agenda:\n\n1. Company overview and traction update (10 min)\n2. Product demo (15 min)\n3. Financial projections (10 min)\n4. Q&A (15 min)\n\nPlease review the pitch deck I shared yesterday and come prepared with any updates to your sections.\n\nThe meeting will be in Conference Room A. Dress code is business casual.\n\nSee you there!\nEmily",
            "preview": "Just a reminder about tomorrow's investor meeting at 2 PM...",
            "date": (now - timedelta(hours=8)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": True,
        },
        {
            "from_email": "james.w@analytics.com",
            "from_name": "James Wilson",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Monthly Analytics Report - December",
            "body": "Hi,\n\nPlease find the December analytics report below:\n\nKey Metrics:\n- Total Users: 45,230 (+18% MoM)\n- Daily Active Users: 12,450 (+22% MoM)\n- Avg. Session Duration: 8.5 min (+1.2 min)\n- Conversion Rate: 3.8% (+0.5%)\n- Churn Rate: 2.1% (-0.3%)\n\nTop Performing Channels:\n1. Organic Search: 38%\n2. Direct: 25%\n3. Social Media: 20%\n4. Email Marketing: 12%\n5. Paid Ads: 5%\n\nNotable Trends:\n- Mobile traffic surpassed desktop for the first time\n- Newsletter open rate improved after subject line A/B testing\n\nFull dashboard link: https://analytics.example.com/dec-report\n\nRegards,\nJames",
            "preview": "Please find the December analytics report below: Key Metrics...",
            "date": (now - timedelta(days=1)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "priya@devteam.io",
            "from_name": "Priya Sharma",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Bug Fix Deployed - Auth Token Issue",
            "body": "Hey,\n\nJust wanted to let you know that the authentication token refresh bug has been fixed and deployed to production.\n\nChanges made:\n- Fixed race condition in token refresh logic\n- Added retry mechanism for failed refresh attempts\n- Updated session timeout handling\n- Added comprehensive logging for auth flows\n\nAll tests are passing and the fix has been verified in staging. No downtime expected.\n\nLet me know if you notice any issues.\n\nCheers,\nPriya",
            "preview": "The authentication token refresh bug has been fixed and deployed to production...",
            "date": (now - timedelta(days=1, hours=6)).isoformat(),
            "is_read": False,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "m.brown@clientco.com",
            "from_name": "Michael Brown",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Contract Renewal Discussion",
            "body": "Dear Team,\n\nI hope this message finds you well. As our current contract is set to expire on February 28th, I'd like to initiate discussions about renewal.\n\nWe've been very pleased with the service so far and are looking to potentially expand our engagement. Specifically, we're interested in:\n\n1. Adding the Enterprise Analytics module\n2. Increasing our user seat allocation from 50 to 100\n3. Discussing priority support options\n\nCould we schedule a call this week to discuss terms? I'm available Tuesday and Thursday afternoons.\n\nBest regards,\nMichael Brown\nVP of Operations, ClientCo",
            "preview": "As our current contract is set to expire on February 28th, I'd like to initiate...",
            "date": (now - timedelta(days=2)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": True,
        },
        {
            "from_email": "lisa.z@marketing.io",
            "from_name": "Lisa Zhang",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Content Calendar for Next Month",
            "body": "Hi!\n\nI've prepared the content calendar for February. Here's a quick overview:\n\nWeek 1:\n- Blog: \"Top 10 Productivity Tools for 2026\"\n- Social: Product feature highlight reel\n- Email: Monthly newsletter\n\nWeek 2:\n- Blog: Customer success story - TechStart Inc.\n- Social: Behind the scenes - engineering team\n- Webinar: \"Scaling Your Business with AI\"\n\nWeek 3:\n- Blog: Industry trends analysis\n- Social: User-generated content campaign\n- Email: Feature announcement\n\nWeek 4:\n- Blog: How-to guide for new features\n- Social: Community spotlight\n- Email: End-of-month wrap-up\n\nPlease review and let me know if any adjustments are needed.\n\nThanks,\nLisa",
            "preview": "I've prepared the content calendar for February. Here's a quick overview...",
            "date": (now - timedelta(days=2, hours=12)).isoformat(),
            "is_read": False,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "alex.t@support.com",
            "from_name": "Alex Turner",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Support Ticket Escalation - Priority Client",
            "body": "Hi,\n\nWe have an escalated support ticket from one of our priority clients (Acme Corp).\n\nTicket #4521:\n- Issue: Data export feature timing out for large datasets\n- Client Impact: Unable to generate monthly compliance reports\n- Duration: Occurring since last Wednesday\n- Previous attempts: Cache cleared, browser updated, different network tested\n\nThe client is getting frustrated as this is blocking their regulatory reporting. Can we get an engineer to look at this ASAP?\n\nI've assigned it to the backend team but wanted to flag it here as well.\n\nThanks,\nAlex",
            "preview": "We have an escalated support ticket from one of our priority clients...",
            "date": (now - timedelta(days=3)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "newsletter@techdigest.com",
            "from_name": "Tech Digest Weekly",
            "to_email": "you@mailapp.com",
            "to_name": "Subscriber",
            "subject": "This Week in Tech: AI Breakthroughs & Industry News",
            "body": "TECH DIGEST WEEKLY\n\nTop Stories This Week:\n\n1. OpenAI Announces GPT-5.2 with Enhanced Reasoning\nThe latest model shows significant improvements in complex problem-solving and code generation capabilities.\n\n2. Google DeepMind's New Protein Folding Discovery\nResearchers have identified 200 million new protein structures using AI.\n\n3. Apple's Vision Pro 2 Launch Date Confirmed\nApple confirms Q2 2026 launch with improved display and longer battery life.\n\n4. EU AI Act Implementation Updates\nNew compliance requirements take effect for high-risk AI systems.\n\n5. Startup Spotlight: AI-Powered Code Review\nA new YC-backed startup is revolutionizing how teams review code.\n\nRead more at techdigest.com\n\nUnsubscribe | Update preferences",
            "preview": "Top Stories This Week: OpenAI Announces GPT-5.2 with Enhanced Reasoning...",
            "date": (now - timedelta(days=4)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "notifications@github.com",
            "from_name": "GitHub",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "[mail-app] Pull Request #47: Add real-time sync",
            "body": "priya-sharma requested your review on pull request #47\n\nAdd real-time sync via WebSocket\n\nChanges:\n- Implemented WebSocket connection manager\n- Added push notification support for new emails\n- Created reconnection logic with exponential backoff\n- Added sync status indicator component\n\nFiles changed: 12\nAdditions: +458\nDeletions: -23\n\nView pull request: https://github.com/org/mail-app/pull/47\n\n---\nYou are receiving this because you were requested to review.\nReply to this email directly or view it on GitHub.",
            "preview": "priya-sharma requested your review on pull request #47: Add real-time sync...",
            "date": (now - timedelta(days=5)).isoformat(),
            "is_read": False,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "sarah.chen@techcorp.com",
            "from_name": "Sarah Chen",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Team Offsite Planning - March 2026",
            "body": "Hi everyone,\n\nExciting news! We're planning a team offsite for March 15-17. Here are the details so far:\n\nLocation: Mountain View retreat center\nDates: March 15-17 (Fri-Sun)\n\nAgenda:\n- Day 1: Strategy sessions and goal setting\n- Day 2: Team building activities and workshops\n- Day 3: Hackathon and presentations\n\nPlease fill out the survey by Friday to confirm your attendance and any dietary restrictions.\n\nSurvey link: https://forms.example.com/offsite-2026\n\nLooking forward to it!\nSarah",
            "preview": "Exciting news! We're planning a team offsite for March 15-17...",
            "date": (now - timedelta(days=6)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "david.park@designlab.io",
            "from_name": "David Park",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Design System v2.0 Release Notes",
            "body": "Hey team,\n\nDesign System v2.0 is now live! Here's what's new:\n\nNew Components:\n- Floating Action Button (FAB)\n- Bottom Sheet / Drawer\n- Toast Notifications (with actions)\n- Data Table with sorting & filtering\n- Timeline component\n\nUpdates:\n- Refreshed color palette with better contrast ratios\n- New spacing scale (4px grid)\n- Updated button styles with hover animations\n- Improved form components\n\nBreaking Changes:\n- Card component API updated (see migration guide)\n- Typography scale adjusted\n\nMigration guide: https://design.example.com/v2-migration\n\nLet me know if you run into any issues!\nDavid",
            "preview": "Design System v2.0 is now live! Here's what's new...",
            "date": (now - timedelta(days=7)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "emily.r@startup.co",
            "from_name": "Emily Rodriguez",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Hiring Update - Frontend Engineer Role",
            "body": "Hi,\n\nQuick update on the Frontend Engineer role we've been hiring for:\n\nCurrent Pipeline:\n- 45 applications received\n- 12 passed initial screening\n- 5 completed technical assessments\n- 3 moving to final interviews next week\n\nTop Candidates:\n1. Candidate A - Strong React/TypeScript, 4 years exp, ex-Google\n2. Candidate B - Full-stack, 6 years exp, great system design\n3. Candidate C - UI specialist, 3 years exp, impressive portfolio\n\nI'd like you to join the final interview panels. Can you block some time next Tuesday and Wednesday?\n\nThanks,\nEmily",
            "preview": "Quick update on the Frontend Engineer role we've been hiring for...",
            "date": (now - timedelta(days=9)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": False,
        },
        {
            "from_email": "noreply@stripe.com",
            "from_name": "Stripe",
            "to_email": "you@mailapp.com",
            "to_name": "You",
            "subject": "Your January Invoice is Ready",
            "body": "Your invoice for January 2026 is ready.\n\nInvoice Summary:\n- Stripe Processing Fees: $1,247.50\n- Subscription: Pro Plan - $79.00\n- Radar (Fraud Protection): $45.00\n\nTotal: $1,371.50\n\nPayment will be automatically processed on February 1st using your card ending in 4242.\n\nView your full invoice at https://dashboard.stripe.com/invoices\n\nQuestions? Contact support@stripe.com\n\n- The Stripe Team",
            "preview": "Your invoice for January 2026 is ready. Invoice Summary...",
            "date": (now - timedelta(days=10)).isoformat(),
            "is_read": True,
            "folder": "inbox",
            "starred": False,
        },
        # Sent emails
        {
            "from_email": "you@mailapp.com",
            "from_name": "You",
            "to_email": "sarah.chen@techcorp.com",
            "to_name": "Sarah Chen",
            "subject": "Re: Q1 Project Review - Action Items",
            "body": "Hi Sarah,\n\nThanks for the comprehensive review! Great to see we exceeded revenue targets.\n\nI'll have the product roadmap draft ready by Jan 23 for your review before the deadline. Also, I've blocked some time on Thursday for the stakeholder alignment meeting - does that work for you?\n\nRegarding the Q2 budget, I have a few proposals I'd like to discuss. Can we set up a 30-minute call this week?\n\nBest,\nMe",
            "preview": "Thanks for the comprehensive review! I'll have the product roadmap draft ready...",
            "date": (now - timedelta(hours=1)).isoformat(),
            "is_read": True,
            "folder": "sent",
            "starred": False,
        },
        {
            "from_email": "you@mailapp.com",
            "from_name": "You",
            "to_email": "m.brown@clientco.com",
            "to_name": "Michael Brown",
            "subject": "Re: Contract Renewal Discussion",
            "body": "Hi Michael,\n\nThank you for reaching out about the renewal. We're thrilled to hear about your satisfaction and interest in expanding!\n\nI'd be happy to discuss all three points. Thursday afternoon works great for me - how about 3 PM EST?\n\nI'll prepare a proposal covering the Enterprise Analytics module, expanded seats, and our priority support tiers.\n\nLooking forward to the conversation.\n\nBest regards,\nMe",
            "preview": "Thank you for reaching out about the renewal. We're thrilled to hear...",
            "date": (now - timedelta(days=1, hours=18)).isoformat(),
            "is_read": True,
            "folder": "sent",
            "starred": False,
        },
        {
            "from_email": "you@mailapp.com",
            "from_name": "You",
            "to_email": "priya@devteam.io",
            "to_name": "Priya Sharma",
            "subject": "Re: Bug Fix Deployed - Auth Token Issue",
            "body": "Great work, Priya! Thanks for the quick turnaround on this.\n\nThe fix looks solid. I'll keep an eye on the monitoring dashboard for the next 24 hours. Can you add a brief post-mortem note to the incident channel?\n\nAlso, I'll review PR #47 for the real-time sync this afternoon.\n\nCheers!",
            "preview": "Great work, Priya! Thanks for the quick turnaround on this...",
            "date": (now - timedelta(days=1, hours=4)).isoformat(),
            "is_read": True,
            "folder": "sent",
            "starred": False,
        },
        {
            "from_email": "you@mailapp.com",
            "from_name": "You",
            "to_email": "alex.t@support.com",
            "to_name": "Alex Turner",
            "subject": "Re: Support Ticket Escalation - Priority Client",
            "body": "Thanks for flagging this, Alex.\n\nI've assigned Priya to look into the data export timeout issue. We should have a root cause analysis by end of day.\n\nIn the meantime, can you offer the client a workaround? They can try exporting in smaller date ranges (monthly instead of quarterly) which should bypass the timeout.\n\nI'll update you as soon as we have a fix.\n\nBest,\nMe",
            "preview": "I've assigned Priya to look into the data export timeout issue...",
            "date": (now - timedelta(days=2, hours=20)).isoformat(),
            "is_read": True,
            "folder": "sent",
            "starred": False,
        },
    ]

    for email_data in seed:
        email_data["id"] = str(uuid.uuid4())
    await db.emails.insert_many(seed)
    logger.info(f"Seeded {len(seed)} emails")


# ── AI Assistant ────────────────────────────────────────

async def process_ai_message(message: str, context: dict):
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        return {"message": "AI assistant is not configured. Please add an API key.", "actions": []}

    emails_cursor = db.emails.find(
        {},
        {"_id": 0, "id": 1, "from_name": 1, "from_email": 1, "to_email": 1, "to_name": 1,
         "subject": 1, "date": 1, "is_read": 1, "folder": 1, "preview": 1, "starred": 1}
    ).sort("date", -1)
    emails_list = await emails_cursor.to_list(50)
    email_context = json.dumps(emails_list, indent=2)

    current_view = context.get('currentView', 'inbox')
    selected_email_id = context.get('selectedEmailId', 'none')
    selected_email_subject = context.get('selectedEmailSubject', '')

    system_prompt = f"""You are an AI email assistant that controls a mail application UI. You help users manage their emails by executing actions on the interface.

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
3. Open/read a specific email: {{"type": "open_email", "email_id": "uuid-of-the-email"}}
4. Filter/search emails: {{"type": "filter", "sender": "", "keyword": "", "date_from": "", "date_to": "", "unread_only": false}}
5. Reply to an email: {{"type": "reply", "email_id": "uuid-of-email-being-replied-to", "body": "Reply text"}}
6. Send the composed email: {{"type": "send"}}
7. Clear all filters: {{"type": "clear_filters"}}

RULES:
- When composing: use "compose" action. The UI will show compose form with fields filled in.
- When user says "send email to X about Y", chain: compose action (fills the form visually). User will confirm send.
- When searching/filtering: use "filter" action with relevant params.
- When user wants to open/read an email: use "open_email" with the matching email_id from the available emails list.
- When user says "reply to this" while viewing an email, use the selected email ID for the reply.
- If user asks to "reply to this" but no email is selected, ask them to open an email first.
- Always be friendly, explain what you're doing, and chain multiple actions if needed.
- For date filters, use ISO format dates.
- When user says "show me unread" or "only unread", set unread_only to true.
- When user wants to see all emails again, use clear_filters.
- If user asks something that doesn't require an action (like "how many emails do I have?"), just answer in the message with no actions.
"""

    session_id = f"mail-assistant"
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_prompt
    ).with_model("gemini", "gemini-2.5-flash")

    user_msg = UserMessage(text=message)
    response = await chat.send_message(user_msg)

    try:
        response_text = response.strip()
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
        return {"message": response, "actions": []}


# ── Simulated New Email Generator ───────────────────────

SIMULATED_SENDERS = [
    {"from_email": "carol.n@workplace.com", "from_name": "Carol Nguyen",
     "subjects": ["Quick question about the deployment", "Meeting notes from today", "Updated timeline"],
     "bodies": [
         "Hi,\n\nI had a quick question about the deployment process. Can we chat for 5 minutes today?\n\nThanks,\nCarol",
         "Hey,\n\nHere are the key takeaways from today's standup:\n\n1. Sprint velocity is on track\n2. No blockers reported\n3. Demo scheduled for Friday at 3 PM\n\nLet me know if I missed anything.\n\nCarol",
         "Hi,\n\nThe timeline has been updated based on our discussion. The new deadline for the MVP is February 15th.\n\nPlease review and confirm.\n\nBest,\nCarol"
     ]},
    {"from_email": "tom.h@partner.co", "from_name": "Tom Harrison",
     "subjects": ["Partnership opportunity", "Follow-up on our call", "API integration docs"],
     "bodies": [
         "Hello,\n\nI'd love to discuss a potential partnership between our companies. We think there's great synergy.\n\nWould you be available for a 30-minute call next week?\n\nBest,\nTom",
         "Hi,\n\nGreat chatting with you yesterday! As discussed, I'm sending over the integration specs.\n\nLet me know once your team has reviewed them.\n\nCheers,\nTom",
         "Hi,\n\nHere are the API docs for the integration we discussed. The endpoint documentation covers authentication, data models, and rate limits.\n\nFeel free to reach out if you have questions.\n\nRegards,\nTom"
     ]},
]

simulated_email_index = 0


async def simulate_new_email():
    global simulated_email_index
    await asyncio.sleep(90)  # first email after 90 seconds

    while True:
        try:
            sender_data = SIMULATED_SENDERS[simulated_email_index % len(SIMULATED_SENDERS)]
            subject_idx = (simulated_email_index // len(SIMULATED_SENDERS)) % len(sender_data["subjects"])

            new_email = Email(
                from_email=sender_data["from_email"],
                from_name=sender_data["from_name"],
                to_email="you@mailapp.com",
                to_name="You",
                subject=sender_data["subjects"][subject_idx],
                body=sender_data["bodies"][subject_idx],
                preview=sender_data["bodies"][subject_idx][:80] + "...",
                date=datetime.now(timezone.utc).isoformat(),
                is_read=False,
                folder="inbox",
            )
            doc = new_email.model_dump()
            await db.emails.insert_one(doc)
            safe_doc = {k: v for k, v in doc.items() if k != "_id"}
            await manager.broadcast({"type": "new_email", "email": safe_doc})
            logger.info(f"Simulated new email from {sender_data['from_name']}")
            simulated_email_index += 1
        except Exception as e:
            logger.error(f"Error simulating email: {e}")

        await asyncio.sleep(120)  # every 2 minutes


# ── API Routes ──────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "AI Mail App API"}


@api_router.get("/emails")
async def get_emails(
    folder: str = "inbox",
    sender: str = "",
    keyword: str = "",
    unread_only: bool = False,
    date_from: str = "",
    date_to: str = "",
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
async def get_email(email_id: str):
    email = await db.emails.find_one({"id": email_id}, {"_id": 0})
    if not email:
        return {"error": "Email not found"}
    return email


@api_router.put("/emails/{email_id}/read")
async def mark_as_read(email_id: str):
    await db.emails.update_one({"id": email_id}, {"$set": {"is_read": True}})
    return {"success": True}


@api_router.put("/emails/{email_id}/star")
async def toggle_star(email_id: str):
    email = await db.emails.find_one({"id": email_id}, {"_id": 0})
    if email:
        new_val = not email.get("starred", False)
        await db.emails.update_one({"id": email_id}, {"$set": {"starred": new_val}})
        return {"success": True, "starred": new_val}
    return {"error": "Email not found"}


@api_router.post("/emails/send")
async def send_email(email_data: EmailSend):
    email = Email(
        from_email="you@mailapp.com",
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


@api_router.post("/ai/chat")
async def ai_chat(request: ChatRequest):
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
async def get_chat_history():
    messages = await db.chat_messages.find({}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    return messages


@api_router.delete("/chat/history")
async def clear_chat_history():
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
    await seed_emails()
    asyncio.create_task(simulate_new_email())


@app.on_event("shutdown")
async def shutdown():
    client.close()
