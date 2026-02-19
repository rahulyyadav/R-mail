"""
Gmail API Service Module
Handles all Gmail operations: fetch inbox/sent, send emails, manage labels.
Uses OAuth2 refresh token for server-side authentication.
"""

import os
import base64
import logging
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime, timezone

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
]


def is_gmail_configured() -> bool:
    """Check if Gmail credentials are available."""
    return bool(
        os.environ.get('GMAIL_CLIENT_ID')
        and os.environ.get('GMAIL_CLIENT_SECRET')
        and os.environ.get('GMAIL_REFRESH_TOKEN')
    )


def get_gmail_service():
    """Build authenticated Gmail API service using refresh token."""
    creds = Credentials(
        token=None,
        refresh_token=os.environ['GMAIL_REFRESH_TOKEN'],
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ['GMAIL_CLIENT_ID'],
        client_secret=os.environ['GMAIL_CLIENT_SECRET'],
        scopes=SCOPES,
    )
    service = build('gmail', 'v1', credentials=creds)
    return service


def get_user_profile() -> dict:
    """Get the authenticated user's Gmail profile."""
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId='me').execute()
        return {
            'email': profile.get('emailAddress', ''),
            'total_messages': profile.get('messagesTotal', 0),
            'total_threads': profile.get('threadsTotal', 0),
        }
    except Exception as e:
        logger.error(f"Failed to get user profile: {e}")
        return {'email': '', 'total_messages': 0, 'total_threads': 0}


def _parse_email_headers(headers: list) -> dict:
    """Extract common headers from Gmail message headers."""
    result = {}
    for header in headers:
        name = header['name'].lower()
        if name in ('from', 'to', 'subject', 'date', 'message-id', 'in-reply-to', 'references'):
            result[name] = header['value']
    return result


def _parse_name_email(raw: str) -> tuple:
    """Parse 'Name <email@example.com>' format into (name, email)."""
    if not raw:
        return ('', '')
    if '<' in raw and '>' in raw:
        name = raw[:raw.index('<')].strip().strip('"').strip("'")
        email_addr = raw[raw.index('<') + 1:raw.index('>')].strip()
        return (name or email_addr.split('@')[0], email_addr)
    return (raw.split('@')[0], raw.strip())


def _get_email_body(payload: dict) -> tuple:
    """Extract text and HTML body from a Gmail message payload.
    Returns (text_body, html_body)."""
    import re
    text_body = ''
    html_body = ''

    if payload.get('mimeType') == 'text/plain' and payload.get('body', {}).get('data'):
        text_body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='replace')
    elif payload.get('mimeType') == 'text/html' and payload.get('body', {}).get('data'):
        html_body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='replace')
        text_body = re.sub(r'<br\s*/?>', '\n', html_body)
        text_body = re.sub(r'<[^>]+>', '', text_body).strip()
    elif payload.get('parts'):
        for part in payload['parts']:
            mime = part.get('mimeType', '')
            if mime == 'text/plain' and part.get('body', {}).get('data'):
                text_body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='replace')
            elif mime == 'text/html' and part.get('body', {}).get('data'):
                html_body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='replace')
            elif mime.startswith('multipart/') and part.get('parts'):
                nested_text, nested_html = _get_email_body(part)
                if nested_text and not text_body:
                    text_body = nested_text
                if nested_html and not html_body:
                    html_body = nested_html

        # If only HTML, derive text from it
        if html_body and not text_body:
            text_body = re.sub(r'<br\s*/?>', '\n', html_body)
            text_body = re.sub(r'<[^>]+>', '', text_body).strip()

    return (text_body.strip(), html_body.strip())


def _parse_gmail_date(date_str: str) -> str:
    """Parse Gmail date header to ISO format."""
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(date_str)
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _gmail_msg_to_dict(msg: dict, user_email: str = '') -> dict:
    """Convert a Gmail API message to our email dict format."""
    headers = _parse_email_headers(msg.get('payload', {}).get('headers', []))
    label_ids = msg.get('labelIds', [])

    from_name, from_email_addr = _parse_name_email(headers.get('from', ''))
    to_name, to_email_addr = _parse_name_email(headers.get('to', ''))

    body, body_html = _get_email_body(msg.get('payload', {}))
    preview = body[:150].replace('\n', ' ').strip() if body else headers.get('subject', '')[:100]

    # Determine folder
    if 'SENT' in label_ids:
        folder = 'sent'
    else:
        folder = 'inbox'

    is_read = 'UNREAD' not in label_ids
    starred = 'STARRED' in label_ids

    return {
        'id': msg['id'],
        'gmail_id': msg['id'],
        'thread_id': msg.get('threadId', ''),
        'from_email': from_email_addr,
        'from_name': from_name,
        'to_email': to_email_addr,
        'to_name': to_name,
        'subject': headers.get('subject', '(no subject)'),
        'body': body,
        'body_html': body_html,
        'preview': preview,
        'date': _parse_gmail_date(headers.get('date', '')),
        'is_read': is_read,
        'folder': folder,
        'starred': starred,
        'message_id': headers.get('message-id', ''),
        'in_reply_to': headers.get('in-reply-to', ''),
        'references': headers.get('references', ''),
    }


def fetch_emails(folder: str = 'inbox', max_results: int = 50) -> list:
    """Fetch real emails from Gmail."""
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId='me').execute()
        user_email = profile.get('emailAddress', '')

        if folder == 'sent':
            query = 'in:sent'
        else:
            query = 'in:inbox'

        results = service.users().messages().list(
            userId='me', q=query, maxResults=max_results
        ).execute()

        messages = results.get('messages', [])
        emails = []

        for msg_ref in messages:
            try:
                msg = service.users().messages().get(
                    userId='me', id=msg_ref['id'], format='full'
                ).execute()
                email_dict = _gmail_msg_to_dict(msg, user_email)
                email_dict['folder'] = folder
                emails.append(email_dict)
            except HttpError as e:
                logger.error(f"Error fetching message {msg_ref['id']}: {e}")
                continue

        return emails

    except HttpError as e:
        logger.error(f"Gmail API error fetching {folder}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error fetching Gmail {folder}: {e}")
        raise


def send_gmail(to_email: str, subject: str, body: str,
               reply_to_message_id: str = None,
               thread_id: str = None) -> dict:
    """Send a real email via Gmail API."""
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId='me').execute()
        user_email = profile.get('emailAddress', '')

        message = MIMEText(body)
        message['to'] = to_email
        message['from'] = user_email
        message['subject'] = subject

        # Thread support — set headers for replies
        if reply_to_message_id:
            message['In-Reply-To'] = reply_to_message_id
            message['References'] = reply_to_message_id

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')

        send_body = {'raw': raw}
        if thread_id:
            send_body['threadId'] = thread_id

        sent = service.users().messages().send(
            userId='me', body=send_body
        ).execute()

        logger.info(f"Email sent successfully. Message ID: {sent['id']}")

        # Fetch the full sent message to return details
        full_msg = service.users().messages().get(
            userId='me', id=sent['id'], format='full'
        ).execute()

        return _gmail_msg_to_dict(full_msg, user_email)

    except HttpError as e:
        logger.error(f"Gmail API error sending email: {e}")
        raise
    except Exception as e:
        logger.error(f"Error sending Gmail: {e}")
        raise


def mark_as_read_gmail(msg_id: str) -> bool:
    """Mark a Gmail message as read."""
    try:
        service = get_gmail_service()
        service.users().messages().modify(
            userId='me', id=msg_id,
            body={'removeLabelIds': ['UNREAD']}
        ).execute()
        return True
    except Exception as e:
        logger.error(f"Error marking as read: {e}")
        return False


def toggle_star_gmail(msg_id: str, add_star: bool) -> bool:
    """Star or unstar a Gmail message."""
    try:
        service = get_gmail_service()
        if add_star:
            body = {'addLabelIds': ['STARRED']}
        else:
            body = {'removeLabelIds': ['STARRED']}
        service.users().messages().modify(
            userId='me', id=msg_id, body=body
        ).execute()
        return True
    except Exception as e:
        logger.error(f"Error toggling star: {e}")
        return False


def fetch_thread(thread_id: str) -> list:
    """Fetch all messages in a Gmail thread."""
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId='me').execute()
        user_email = profile.get('emailAddress', '')

        thread = service.users().threads().get(
            userId='me', id=thread_id, format='full'
        ).execute()

        messages = []
        for msg in thread.get('messages', []):
            email_dict = _gmail_msg_to_dict(msg, user_email)
            messages.append(email_dict)

        return messages

    except Exception as e:
        logger.error(f"Error fetching thread: {e}")
        return []


def check_new_emails(history_id: str) -> tuple:
    """Check for new emails since a given history ID.
    Returns (new_emails_list, new_history_id)."""
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId='me').execute()
        user_email = profile.get('emailAddress', '')

        results = service.users().history().list(
            userId='me', startHistoryId=history_id,
            historyTypes=['messageAdded'],
            labelId='INBOX'
        ).execute()

        new_history_id = results.get('historyId', history_id)
        history = results.get('history', [])

        new_emails = []
        seen_ids = set()

        for record in history:
            for msg_added in record.get('messagesAdded', []):
                msg_id = msg_added['message']['id']
                if msg_id not in seen_ids:
                    seen_ids.add(msg_id)
                    try:
                        msg = service.users().messages().get(
                            userId='me', id=msg_id, format='full'
                        ).execute()
                        if 'INBOX' in msg.get('labelIds', []):
                            email_dict = _gmail_msg_to_dict(msg, user_email)
                            email_dict['folder'] = 'inbox'
                            new_emails.append(email_dict)
                    except Exception:
                        continue

        return new_emails, new_history_id

    except HttpError as e:
        if e.resp.status == 404:
            # History ID is too old, do a full sync
            logger.warning("History ID expired, returning empty")
            return [], history_id
        raise
    except Exception as e:
        logger.error(f"Error checking new emails: {e}")
        return [], history_id
