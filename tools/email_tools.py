import base64
import json
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from database.db import SessionLocal
from database.models import OAuthToken


SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]


def _get_gmail_service():
    db = SessionLocal()
    try:
        token_row = db.query(OAuthToken).filter_by(service="gmail").first()
        if not token_row:
            raise RuntimeError("Gmail not connected. Visit /auth/gmail to authorize.")

        creds = Credentials(
            token=token_row.access_token,
            refresh_token=token_row.refresh_token,
            token_uri=token_row.token_uri or "https://oauth2.googleapis.com/token",
            client_id=(token_row.extra_data or {}).get("client_id"),
            client_secret=(token_row.extra_data or {}).get("client_secret"),
            scopes=SCOPES,
        )

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            token_row.access_token = creds.token
            token_row.expires_at = creds.expiry
            db.commit()

        return build("gmail", "v1", credentials=creds)
    finally:
        db.close()


def _parse_message(msg: dict) -> dict:
    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
    snippet = msg.get("snippet", "")

    body = ""
    payload = msg.get("payload", {})
    if payload.get("body", {}).get("data"):
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
    elif payload.get("parts"):
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                break

    return {
        "id": msg["id"],
        "thread_id": msg.get("threadId"),
        "from": headers.get("from", ""),
        "to": headers.get("to", ""),
        "subject": headers.get("subject", "(no subject)"),
        "date": headers.get("date", ""),
        "snippet": snippet,
        "body": body[:2000] if body else snippet,
        "labels": msg.get("labelIds", []),
    }


def search_emails(query: str = "is:unread", max_results: int = 10) -> str:
    """Search Gmail inbox. Returns a JSON list of emails."""
    try:
        service = _get_gmail_service()
        result = service.users().messages().list(
            userId="me", q=query, maxResults=max_results
        ).execute()

        messages = result.get("messages", [])
        if not messages:
            return json.dumps({"emails": [], "count": 0})

        emails = []
        for m in messages:
            full = service.users().messages().get(
                userId="me", id=m["id"], format="full"
            ).execute()
            emails.append(_parse_message(full))

        return json.dumps({"emails": emails, "count": len(emails)})
    except Exception as e:
        return json.dumps({"error": str(e)})


def read_email(email_id: str) -> str:
    """Read a specific email by its ID. Returns full body."""
    try:
        service = _get_gmail_service()
        msg = service.users().messages().get(
            userId="me", id=email_id, format="full"
        ).execute()
        return json.dumps(_parse_message(msg))
    except Exception as e:
        return json.dumps({"error": str(e)})


def send_email(to: str, subject: str, body: str, cc: Optional[str] = None) -> str:
    """Send an email via Gmail."""
    try:
        service = _get_gmail_service()
        msg = MIMEMultipart()
        msg["to"] = to
        msg["subject"] = subject
        if cc:
            msg["cc"] = cc
        msg.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        return json.dumps({"success": True, "to": to, "subject": subject})
    except Exception as e:
        return json.dumps({"error": str(e)})


def reply_to_email(thread_id: str, to: str, subject: str, body: str) -> str:
    """Reply to an existing email thread."""
    try:
        service = _get_gmail_service()
        msg = MIMEText(body, "plain")
        msg["to"] = to
        msg["subject"] = f"Re: {subject}" if not subject.startswith("Re:") else subject

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(
            userId="me", body={"raw": raw, "threadId": thread_id}
        ).execute()
        return json.dumps({"success": True, "thread_id": thread_id})
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_labels() -> str:
    """List all Gmail labels."""
    try:
        service = _get_gmail_service()
        result = service.users().labels().list(userId="me").execute()
        labels = [{"id": l["id"], "name": l["name"]} for l in result.get("labels", [])]
        return json.dumps({"labels": labels})
    except Exception as e:
        return json.dumps({"error": str(e)})
