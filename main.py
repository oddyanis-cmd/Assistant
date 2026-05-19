"""
FastAPI application — entry point.

Endpoints:
  GET  /health                — health check
  GET  /webhook               — WhatsApp webhook verification
  POST /webhook               — WhatsApp incoming messages
  GET  /auth/gmail            — start Gmail OAuth2 flow
  GET  /auth/gmail/callback   — Gmail OAuth2 callback
  GET  /auth/linkedin         — start LinkedIn OAuth2 flow
  GET  /auth/linkedin/callback — LinkedIn OAuth2 callback
  GET  /auth/status           — show which integrations are connected
"""
import logging
import secrets
from datetime import datetime
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from google_auth_oauthlib.flow import Flow

from agent import process_message
from config import settings
from database.db import init_db, SessionLocal
from database.models import OAuthToken
from scheduler import start_scheduler
from whatsapp import parse_incoming, send_message

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Personal AI Assistant", version="1.0.0")

# Temporary state store for OAuth CSRF tokens (in-memory is fine for a single-user app)
_oauth_state: dict[str, str] = {}

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]

LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"]


@app.on_event("startup")
def on_startup():
    init_db()
    start_scheduler()
    logger.info("Assistant started.")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


# ── WhatsApp webhook ──────────────────────────────────────────────────────────

@app.get("/webhook")
def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        logger.info("WhatsApp webhook verified.")
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()

    # Ignore non-message events (status updates, etc.)
    if body.get("object") != "whatsapp_business_account":
        return JSONResponse({"status": "ignored"})

    messages = parse_incoming(body)
    for msg in messages:
        background_tasks.add_task(_handle_message, msg["from"], msg["text"])

    return JSONResponse({"status": "ok"})


def _handle_message(phone: str, text: str):
    logger.info("Message from %s: %s", phone, text[:80])
    try:
        reply = process_message(phone, text)
        send_message(phone, reply)
    except Exception as e:
        logger.error("Failed to handle message from %s: %s", phone, e)
        send_message(phone, "Sorry, something went wrong. Please try again in a moment.")


# ── Auth status ───────────────────────────────────────────────────────────────

@app.get("/auth/status", response_class=HTMLResponse)
def auth_status():
    db = SessionLocal()
    try:
        gmail_ok = db.query(OAuthToken).filter_by(service="gmail").first() is not None
        linkedin_ok = db.query(OAuthToken).filter_by(service="linkedin").first() is not None
    finally:
        db.close()

    wa_ok = bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id)
    meta_ok = bool(settings.meta_page_access_token and settings.meta_page_id)
    ads_ok = bool(settings.meta_ads_access_token and settings.meta_ads_account_id)

    rows = [
        ("WhatsApp", wa_ok, "Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env"),
        ("Gmail", gmail_ok, f'<a href="/auth/gmail">Connect Gmail</a>'),
        ("Facebook / Instagram", meta_ok, "Set META_PAGE_ACCESS_TOKEN and META_PAGE_ID in .env"),
        ("Meta Ads", ads_ok, "Set META_ADS_ACCESS_TOKEN and META_ADS_ACCOUNT_ID in .env"),
        ("LinkedIn", linkedin_ok, f'<a href="/auth/linkedin">Connect LinkedIn</a>'),
    ]

    html_rows = "".join(
        f"<tr><td>{name}</td><td>{'✅ Connected' if ok else '❌ Not connected'}</td>"
        f"<td>{'—' if ok else hint}</td></tr>"
        for name, ok, hint in rows
    )

    return f"""
    <html><head><title>Assistant Status</title>
    <style>body{{font-family:sans-serif;max-width:700px;margin:40px auto}}
    table{{border-collapse:collapse;width:100%}}td{{padding:10px;border:1px solid #ddd}}</style>
    </head><body>
    <h1>Assistant Integration Status</h1>
    <table><tr><th>Service</th><th>Status</th><th>Action</th></tr>{html_rows}</table>
    </body></html>
    """


# ── Gmail OAuth ───────────────────────────────────────────────────────────────

@app.get("/auth/gmail")
def gmail_auth_start():
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(400, "Google OAuth credentials not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env")

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GMAIL_SCOPES,
        redirect_uri=settings.google_redirect_uri,
    )
    state = secrets.token_urlsafe(16)
    _oauth_state["gmail"] = state
    auth_url, _ = flow.authorization_url(
        access_type="offline", include_granted_scopes="true", prompt="consent", state=state
    )
    return RedirectResponse(auth_url)


@app.get("/auth/gmail/callback")
def gmail_auth_callback(code: str = Query(...), state: str = Query(...)):
    if _oauth_state.get("gmail") != state:
        raise HTTPException(400, "Invalid OAuth state")

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GMAIL_SCOPES,
        redirect_uri=settings.google_redirect_uri,
        state=state,
    )
    flow.fetch_token(code=code)
    creds = flow.credentials

    db = SessionLocal()
    try:
        row = db.query(OAuthToken).filter_by(service="gmail").first()
        if not row:
            row = OAuthToken(service="gmail")
            db.add(row)
        row.access_token = creds.token
        row.refresh_token = creds.refresh_token
        row.token_uri = creds.token_uri
        row.expires_at = creds.expiry
        row.extra_data = {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
        }
        db.commit()
    finally:
        db.close()

    _oauth_state.pop("gmail", None)
    return HTMLResponse("<h2>Gmail connected! You can close this tab.</h2>")


# ── LinkedIn OAuth ────────────────────────────────────────────────────────────

@app.get("/auth/linkedin")
def linkedin_auth_start():
    if not settings.linkedin_client_id or not settings.linkedin_client_secret:
        raise HTTPException(400, "LinkedIn OAuth credentials not configured.")

    state = secrets.token_urlsafe(16)
    _oauth_state["linkedin"] = state

    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "state": state,
        "scope": " ".join(LINKEDIN_SCOPES),
    }
    url = "https://www.linkedin.com/oauth/v2/authorization?" + urlencode(params)
    return RedirectResponse(url)


@app.get("/auth/linkedin/callback")
def linkedin_auth_callback(code: str = Query(...), state: str = Query(...)):
    if _oauth_state.get("linkedin") != state:
        raise HTTPException(400, "Invalid OAuth state")

    with httpx.Client() as client:
        resp = client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.linkedin_redirect_uri,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
            timeout=20,
        )
        resp.raise_for_status()
        token_data = resp.json()

    db = SessionLocal()
    try:
        row = db.query(OAuthToken).filter_by(service="linkedin").first()
        if not row:
            row = OAuthToken(service="linkedin")
            db.add(row)
        row.access_token = token_data["access_token"]
        row.refresh_token = token_data.get("refresh_token")
        db.commit()
    finally:
        db.close()

    _oauth_state.pop("linkedin", None)
    return HTMLResponse("<h2>LinkedIn connected! You can close this tab.</h2>")
