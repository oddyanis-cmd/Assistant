"""
Google Workspace integration for the Katara Club waiver system.

Uses a single Google **service account** to, with no interactive login:

  • save the signed PDF into a Google Drive folder      (Drive API)
  • email the signed PDF to Reception@katara.club        (Gmail API, via
                                                          domain-wide delegation)

Recommended setup (see DEPLOYMENT-GOOGLE.md for the click-by-click guide):
  1. Google Cloud Console → create a project → enable the Drive API and Gmail API.
  2. Create a service account and download its JSON key.
  3. Create a **Shared Drive**, add the service account's email as a member
     (Content manager), and copy the target folder's ID into GOOGLE_DRIVE_FOLDER_ID.
     (A Shared Drive is required — service accounts have no personal Drive quota.)
  4. For Gmail sending, grant the service account **domain-wide delegation** for
     the scope https://www.googleapis.com/auth/gmail.send in the Workspace Admin
     console, and set GOOGLE_DELEGATED_SENDER=Reception@katara.club.
     (If you skip this, Drive storage still works and email falls back to SMTP.)

If Google is not configured the module reports "not configured" and the caller
falls back to other channels / local storage.
"""
import base64
import io
import json
import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings

logger = logging.getLogger(__name__)

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def is_configured() -> bool:
    return bool(settings.google_service_account_file or settings.google_service_account_json)


def _key_info() -> dict | None:
    if settings.google_service_account_json:
        return json.loads(settings.google_service_account_json)
    return None


def _credentials(scopes, subject: str | None = None):
    from google.oauth2 import service_account
    info = _key_info()
    if info:
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    else:
        creds = service_account.Credentials.from_service_account_file(
            settings.google_service_account_file, scopes=scopes)
    if subject:
        creds = creds.with_subject(subject)
    return creds


def save_to_drive(pdf_bytes: bytes, filename: str) -> str:
    """Upload the signed PDF into the configured Drive folder; return its link."""
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload

    if not settings.google_drive_folder_id:
        raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is not set")

    creds = _credentials(DRIVE_SCOPES)
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    meta = {"name": filename, "parents": [settings.google_drive_folder_id]}
    media = MediaIoBaseUpload(io.BytesIO(pdf_bytes), mimetype="application/pdf", resumable=False)
    f = service.files().create(
        body=meta, media_body=media,
        fields="id,webViewLink",
        supportsAllDrives=True,
    ).execute()
    return f.get("webViewLink", "")


def send_mail(to: str, subject: str, body: str, pdf_bytes: bytes, filename: str) -> None:
    """Email the signed PDF via Gmail, sending as the delegated Workspace user."""
    from googleapiclient.discovery import build

    sender = settings.google_delegated_sender
    if not sender:
        raise RuntimeError("GOOGLE_DELEGATED_SENDER is not set (domain-wide delegation required for Gmail send)")

    creds = _credentials(GMAIL_SCOPES, subject=sender)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)

    msg = MIMEMultipart()
    msg["to"] = to
    msg["from"] = sender
    msg["subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    part = MIMEApplication(pdf_bytes, _subtype="pdf")
    part.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(part)

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
