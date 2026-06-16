"""
Katara Club — Face Check-In (standalone FastAPI app).

Run:
    cd katara-checkin
    pip install -r requirements.txt -r requirements-face.txt
    uvicorn app.main:app --reload --port 8000

Then open http://localhost:8000 on the tablet (or your laptop) — you need to allow
camera access. The page has two tabs: "Enroll" (admin) and "Check-In Kiosk".

API docs are auto-generated at http://localhost:8000/docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.face.engine import engine_status
from app.routers import checkin, clients

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

WEB_DIR = Path(__file__).parent / "web"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    status = engine_status()
    if status["available"]:
        logger.info("Face engine ready: %s (dim=%d)", status["name"], status["dim"])
    else:
        logger.warning("Face engine NOT ready: %s", status["error"])
    logger.info("Katara check-in started. CRM webhook: %s",
                settings.crm_webhook_url or "(local test mode)")
    yield


app = FastAPI(title=settings.app_title, version="1.0.0", lifespan=lifespan)

app.include_router(clients.router)
app.include_router(checkin.router)


@app.get("/health")
def health():
    return {"status": "ok", "engine": engine_status(), "config": {
        "accept_threshold": settings.accept_threshold,
        "decision_margin": settings.decision_margin,
        "require_liveness": settings.require_liveness,
        "crm_configured": bool(settings.crm_webhook_url),
    }}


@app.get("/config")
def public_config():
    """Small bit of config the front-end needs."""
    return JSONResponse({
        "title": settings.app_title,
        "engine": engine_status(),
        "require_liveness": settings.require_liveness,
    })


@app.get("/")
def index():
    return FileResponse(WEB_DIR / "index.html")


# Serve the rest of the front-end (app.js, styles.css).
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")
