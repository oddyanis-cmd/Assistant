"""
Katara Club — Digital Waiver System (standalone app).

A self-contained FastAPI service that runs ONLY the waiver system, with no
dependency on the rest of the assistant (no WhatsApp / LinkedIn / Anthropic).
This is the recommended entry point for deploying inside your company.

Run locally:
    uvicorn waiver_app:app --host 0.0.0.0 --port 8000

Then:
    Reception poster : http://<host>:8000/waiver/qr
    The form         : http://<host>:8000/waiver
    Submissions      : http://<host>:8000/waiver/admin
    System status    : http://<host>:8000/waiver/status
"""
import logging
import os
from datetime import datetime

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from database.db import init_db
from waiver import router as waiver_router

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("waiver")

app = FastAPI(title="Katara Club — Digital Waiver System", version="1.0.0")

_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(_static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")
app.include_router(waiver_router)


@app.on_event("startup")
def _startup():
    init_db()
    logger.info("Katara Club waiver system started.")


@app.get("/")
def root():
    # Send visitors straight to the form.
    return RedirectResponse("/waiver")


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}
