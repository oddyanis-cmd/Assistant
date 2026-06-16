"""
CRM integration point.

Your tablets already check members in to your CRM after a QR scan. Face check-in
reuses the exact same idea: once a member is recognised, we POST the event to your
CRM webhook. Configure it with KATARA_CRM_WEBHOOK_URL (and optional KATARA_CRM_API_KEY).

If no webhook is configured we run in *local test mode* — check-ins are recorded in
the local DB only, so you can trial the whole flow before wiring it to production.
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.models import CheckIn, Client

logger = logging.getLogger(__name__)


def push_checkin(client: Client, checkin: CheckIn) -> bool:
    """
    Send a recognised check-in to the CRM. Returns True if accepted.

    Never raises — a CRM hiccup must not crash the kiosk. The local record is the
    source of truth and can be re-synced later.
    """
    if not settings.crm_webhook_url:
        logger.info("CRM webhook not configured; check-in %s kept locally only.", checkin.id)
        return False

    payload = {
        "event": "member.checkin",
        "source": "face_kiosk",
        "crm_id": client.crm_id,
        "membership_no": client.membership_no,
        "client_name": client.full_name,
        "similarity": checkin.similarity,
        "liveness_passed": checkin.liveness_passed,
        "checked_in_at": checkin.created_at.isoformat() if checkin.created_at else None,
        "local_checkin_id": checkin.id,
    }
    headers = {"Content-Type": "application/json"}
    if settings.crm_api_key:
        headers["Authorization"] = f"Bearer {settings.crm_api_key}"

    try:
        resp = httpx.post(
            settings.crm_webhook_url,
            json=payload,
            headers=headers,
            timeout=settings.crm_timeout_seconds,
        )
        resp.raise_for_status()
        return True
    except Exception as e:  # noqa: BLE001 - resilience over strictness at the kiosk
        logger.warning("CRM sync failed for check-in %s: %s", checkin.id, e)
        return False
