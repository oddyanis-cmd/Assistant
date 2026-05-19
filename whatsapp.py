"""
WhatsApp Cloud API helper — send messages and parse incoming webhook payloads.
"""
import httpx
from config import settings

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def send_message(to: str, text: str):
    """Send a plain-text WhatsApp message. `to` is the phone number without leading +."""
    url = f"{GRAPH_BASE}/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text[:4096]},  # WhatsApp text limit
    }
    with httpx.Client() as client:
        resp = client.post(url, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
    return resp.json()


def parse_incoming(body: dict) -> list[dict]:
    """
    Extract all text messages from a WhatsApp webhook payload.
    Returns a list of {"from": phone, "text": message_text, "message_id": id} dicts.
    """
    results = []
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for msg in value.get("messages", []):
                if msg.get("type") == "text":
                    results.append({
                        "from": msg["from"],
                        "text": msg["text"]["body"],
                        "message_id": msg["id"],
                    })
    return results
