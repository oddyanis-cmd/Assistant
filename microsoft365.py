"""
Microsoft 365 (Graph API) integration for the Katara Club waiver system.

A single Azure AD *app registration* (client-credentials / "application"
permissions) lets the server, with no interactive login and no mailbox
passwords:

  • email the signed PDF to Reception@katara.club        (Mail.Send)
  • save a copy of every signed PDF into your Microsoft 365
    OneDrive or SharePoint                                (Files.ReadWrite.All
                                                           / Sites.ReadWrite.All)

This works with modern authentication, so it keeps functioning even when
legacy SMTP AUTH is disabled on the tenant (Microsoft's default).

Set up (see DEPLOYMENT.md for the click-by-click guide):
  1. Azure Portal → App registrations → New registration.
  2. Certificates & secrets → new client secret.
  3. API permissions → Microsoft Graph → *Application* permissions:
        Mail.Send, Files.ReadWrite.All, Sites.ReadWrite.All → Grant admin consent.
  4. Put the IDs/secret in the environment (see config.py / .env).

If MS365 is not configured the module simply reports "not configured" and the
caller falls back to SMTP / local storage.
"""
import base64
import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

GRAPH = "https://graph.microsoft.com/v1.0"
LOGIN = "https://login.microsoftonline.com"


def is_configured() -> bool:
    return bool(settings.ms365_tenant_id and settings.ms365_client_id
                and settings.ms365_client_secret)


def _get_token() -> str:
    """Acquire an app-only access token via the client-credentials flow."""
    url = f"{LOGIN}/{settings.ms365_tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": settings.ms365_client_id,
        "client_secret": settings.ms365_client_secret,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }
    with httpx.Client(timeout=30) as c:
        r = c.post(url, data=data)
        r.raise_for_status()
        return r.json()["access_token"]


def send_mail(to: str, subject: str, body: str,
              pdf_bytes: bytes, filename: str) -> None:
    """Send an email with the PDF attached, as the configured sender mailbox."""
    token = _get_token()
    sender = settings.ms365_sender or to
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body},
            "toRecipients": [{"emailAddress": {"address": to}}],
            "attachments": [{
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": filename,
                "contentType": "application/pdf",
                "contentBytes": base64.b64encode(pdf_bytes).decode(),
            }],
        },
        "saveToSentItems": True,
    }
    with httpx.Client(timeout=60) as c:
        r = c.post(
            f"{GRAPH}/users/{sender}/sendMail",
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": "application/json"},
            json=payload,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Graph sendMail failed ({r.status_code}): {r.text}")


def save_to_drive(pdf_bytes: bytes, filename: str) -> str:
    """
    Upload the signed PDF into Microsoft 365 and return the web URL.

    Target is chosen by configuration:
      • SharePoint site  — if MS365_SHAREPOINT_SITE is set
      • OneDrive of the  — otherwise, the sender mailbox's OneDrive
        sender mailbox
    Files land in the folder named by MS365_SAVE_FOLDER (default
    "Katara Club Waivers").
    """
    token = _get_token()
    folder = (settings.ms365_save_folder or "Katara Club Waivers").strip("/")
    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=60) as c:
        if settings.ms365_sharepoint_site:
            # Resolve the SharePoint site, then its default document library.
            host, _, path = settings.ms365_sharepoint_site.partition("/")
            site = c.get(f"{GRAPH}/sites/{host}:/{path}", headers=headers)
            site.raise_for_status()
            drive_base = f"{GRAPH}/sites/{site.json()['id']}/drive"
        else:
            sender = settings.ms365_sender
            drive_base = f"{GRAPH}/users/{sender}/drive"

        upload_url = f"{drive_base}/root:/{folder}/{filename}:/content"
        r = c.put(upload_url,
                  headers={**headers, "Content-Type": "application/pdf"},
                  content=pdf_bytes)
        if r.status_code >= 400:
            raise RuntimeError(f"Graph upload failed ({r.status_code}): {r.text}")
        return r.json().get("webUrl", "")
