"""
Background scheduler — checks for due tasks every minute and sends
a WhatsApp reminder to the owner.
"""
import logging
from datetime import datetime

import httpx
from apscheduler.schedulers.background import BackgroundScheduler

from config import settings
from database.db import SessionLocal
from database.models import Task

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def _send_whatsapp(phone: str, text: str):
    """Send a plain text WhatsApp message to a phone number (E.164 without +)."""
    url = f"{GRAPH_BASE}/{settings.whatsapp_phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": text},
    }
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client() as client:
            resp = client.post(url, json=payload, headers=headers, timeout=15)
            resp.raise_for_status()
    except Exception as e:
        logger.error("Failed to send WhatsApp reminder: %s", e)


def check_reminders():
    """Run every minute. Send WhatsApp messages for tasks that are due."""
    if not settings.whatsapp_owner_phone:
        return

    now = datetime.utcnow()
    db = SessionLocal()
    try:
        due_tasks = (
            db.query(Task)
            .filter(
                Task.due_datetime <= now,
                Task.completed == False,
                Task.reminded == False,
            )
            .all()
        )
        for task in due_tasks:
            priority_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(task.priority, "")
            msg = (
                f"⏰ *Reminder* {priority_emoji}\n"
                f"*{task.title}*"
                + (f"\n{task.description}" if task.description else "")
                + f"\n\n_Due: {task.due_datetime.strftime('%d %b %Y %H:%M')} UTC_"
                + f"\nReply with \"done task {task.id}\" to mark it complete."
            )
            _send_whatsapp(settings.whatsapp_owner_phone, msg)
            task.reminded = True
            logger.info("Sent reminder for task %d: %s", task.id, task.title)

        if due_tasks:
            db.commit()
    except Exception as e:
        logger.error("Reminder check failed: %s", e)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_reminders, "interval", minutes=1, id="reminders")
    scheduler.start()
    logger.info("Scheduler started — checking reminders every minute.")
    return scheduler
