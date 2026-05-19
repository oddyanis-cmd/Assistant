"""
Core AI agent — agentic loop powered by Claude with tool use.
Maintains per-user conversation history in the database.
"""
import json
from datetime import datetime
from typing import Any

import anthropic

from config import settings
from database.db import SessionLocal
from database.models import Conversation, Message
import tools.email_tools as email
import tools.social_tools as social
import tools.ads_tools as ads
import tools.task_tools as tasks

# ── Tool definitions (schema sent to Claude) ──────────────────────────────────

TOOLS: list[dict] = [
    # Email
    {
        "name": "search_emails",
        "description": "Search Gmail inbox. Use Gmail search syntax (e.g. 'is:unread', 'from:boss@example.com subject:invoice'). Returns a list of emails with sender, subject, date, and body snippet.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Gmail search query. Default: 'is:unread'"},
                "max_results": {"type": "integer", "description": "Max emails to return (default 10, max 50)"},
            },
        },
    },
    {
        "name": "read_email",
        "description": "Read the full body of a specific email by its ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email_id": {"type": "string", "description": "The email message ID returned by search_emails"},
            },
            "required": ["email_id"],
        },
    },
    {
        "name": "send_email",
        "description": "Send an email via Gmail.",
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "Recipient email address"},
                "subject": {"type": "string"},
                "body": {"type": "string", "description": "Plain-text email body"},
                "cc": {"type": "string", "description": "Optional CC email address(es)"},
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "reply_to_email",
        "description": "Reply to an existing email thread.",
        "input_schema": {
            "type": "object",
            "properties": {
                "thread_id": {"type": "string"},
                "to": {"type": "string", "description": "Email address to reply to"},
                "subject": {"type": "string", "description": "Original subject (Re: will be added automatically)"},
                "body": {"type": "string"},
            },
            "required": ["thread_id", "to", "subject", "body"],
        },
    },
    {
        "name": "list_gmail_labels",
        "description": "List all Gmail labels (inbox folders). Useful for understanding how the inbox is organised.",
        "input_schema": {"type": "object", "properties": {}},
    },
    # Facebook
    {
        "name": "create_facebook_post",
        "description": "Publish a post to the connected Facebook Page. Optionally attach an image or link.",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "Post text content"},
                "image_url": {"type": "string", "description": "Optional public URL of image to attach"},
                "link": {"type": "string", "description": "Optional URL to attach as a link preview"},
            },
            "required": ["message"],
        },
    },
    {
        "name": "get_facebook_page_insights",
        "description": "Get Facebook Page metrics: reach, engagement, new followers.",
        "input_schema": {
            "type": "object",
            "properties": {
                "metric": {"type": "string", "description": "Comma-separated metrics. Default: page_impressions,page_engaged_users,page_fans"},
                "date_preset": {"type": "string", "enum": ["today", "yesterday", "last_7d", "last_30d", "this_month"], "description": "Time period"},
            },
        },
    },
    {
        "name": "get_facebook_posts",
        "description": "Get recent Facebook Page posts with likes, comments, and shares counts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of posts to retrieve (default 10)"},
            },
        },
    },
    # Instagram
    {
        "name": "create_instagram_post",
        "description": "Publish a photo post to the connected Instagram Business account. The image_url must be publicly accessible.",
        "input_schema": {
            "type": "object",
            "properties": {
                "caption": {"type": "string"},
                "image_url": {"type": "string", "description": "Publicly accessible image URL"},
            },
            "required": ["caption", "image_url"],
        },
    },
    {
        "name": "get_instagram_insights",
        "description": "Get Instagram Business account metrics: impressions, reach, profile views.",
        "input_schema": {
            "type": "object",
            "properties": {
                "metric": {"type": "string", "description": "Comma-separated metrics. Default: impressions,reach,profile_views"},
                "date_preset": {"type": "string", "enum": ["today", "yesterday", "last_7d", "last_30d", "this_month"]},
            },
        },
    },
    {
        "name": "get_instagram_posts",
        "description": "Get recent Instagram posts with like and comment counts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Number of posts to retrieve (default 10)"},
            },
        },
    },
    # LinkedIn
    {
        "name": "create_linkedin_post",
        "description": "Publish a post to LinkedIn as the authenticated user.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Post text content"},
                "image_url": {"type": "string", "description": "Optional public URL of image to attach"},
            },
            "required": ["text"],
        },
    },
    # Meta Ads
    {
        "name": "get_account_overview",
        "description": "Get top-level Meta Ads account summary: total spend, impressions, clicks, CTR, CPC, and ROAS for a given period.",
        "input_schema": {
            "type": "object",
            "properties": {
                "date_preset": {"type": "string", "enum": ["today", "yesterday", "last_7d", "last_30d", "this_month", "last_month"]},
            },
        },
    },
    {
        "name": "list_ad_campaigns",
        "description": "List Meta Ads campaigns with their status, objective, and budget.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status_filter": {"type": "string", "enum": ["ALL", "ACTIVE", "PAUSED", "ARCHIVED"], "description": "Filter by campaign status"},
            },
        },
    },
    {
        "name": "get_campaign_insights",
        "description": "Get detailed performance metrics for a specific campaign: spend, ROAS, purchases, CTR, CPC, reach.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string"},
                "date_preset": {"type": "string", "enum": ["today", "yesterday", "last_7d", "last_30d", "this_month", "last_month"]},
            },
            "required": ["campaign_id"],
        },
    },
    {
        "name": "get_adsets_insights",
        "description": "Get performance breakdown by ad sets within a campaign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string"},
                "date_preset": {"type": "string", "enum": ["today", "yesterday", "last_7d", "last_30d", "this_month"]},
            },
            "required": ["campaign_id"],
        },
    },
    {
        "name": "update_campaign_status",
        "description": "Pause or reactivate a Meta Ads campaign.",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string"},
                "status": {"type": "string", "enum": ["ACTIVE", "PAUSED"]},
            },
            "required": ["campaign_id", "status"],
        },
    },
    {
        "name": "update_campaign_budget",
        "description": "Change the daily or lifetime budget of a campaign. Amounts are in cents (e.g. 5000 = €50.00).",
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string"},
                "daily_budget_cents": {"type": "integer", "description": "New daily budget in cents"},
                "lifetime_budget_cents": {"type": "integer", "description": "New lifetime budget in cents"},
            },
            "required": ["campaign_id"],
        },
    },
    # Tasks / Reminders
    {
        "name": "create_task",
        "description": "Create a task or reminder. The assistant will send a WhatsApp message when it's due.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "due_datetime": {"type": "string", "description": "ISO datetime, e.g. '2025-12-31T09:00:00'"},
                "description": {"type": "string", "description": "Optional details"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
            },
            "required": ["title", "due_datetime"],
        },
    },
    {
        "name": "list_tasks",
        "description": "List tasks and reminders.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filter": {"type": "string", "enum": ["all", "today", "upcoming", "overdue", "completed"]},
            },
        },
    },
    {
        "name": "complete_task",
        "description": "Mark a task as completed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "integer"},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "update_task",
        "description": "Edit an existing task (change title, due date, priority, or description).",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "integer"},
                "title": {"type": "string"},
                "due_datetime": {"type": "string"},
                "description": {"type": "string"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
            },
            "required": ["task_id"],
        },
    },
    {
        "name": "delete_task",
        "description": "Permanently delete a task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {"type": "integer"},
            },
            "required": ["task_id"],
        },
    },
]

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a powerful personal AI assistant. You run 24/7 and help your owner manage their digital life across Meta Ads, Gmail, Facebook, Instagram, LinkedIn, and personal tasks.

Today is {date}.

## Your capabilities
- **Email**: Search inbox, read emails, send and reply to emails (Gmail)
- **Facebook**: Post content, read page insights and recent posts
- **Instagram**: Post photos, read account insights and recent posts
- **LinkedIn**: Publish posts
- **Meta Ads**: View account overview, list campaigns, analyse performance (spend, ROAS, CTR, CPC), pause/activate campaigns, change budgets
- **Tasks & Reminders**: Create, list, update, complete, and delete tasks — you will automatically send a WhatsApp reminder when a task is due

## Behaviour
- Be proactive: if you notice something actionable (e.g. a campaign burning spend with low ROAS, or overdue tasks), mention it.
- Keep responses concise — you communicate over WhatsApp, so use short paragraphs and emoji sparingly.
- When performing an action (sending email, posting, changing a budget), always confirm what you did and any key details.
- If something requires information you don't have, ask a single focused question.
- Format numbers clearly (€ or $ with 2 decimal places, percentages with 1 decimal place).
- Never make up data — use tool results only.
"""


# ── Tool dispatcher ───────────────────────────────────────────────────────────

def _execute_tool(name: str, tool_input: dict) -> str:
    dispatch: dict[str, Any] = {
        # Email
        "search_emails": lambda i: email.search_emails(i.get("query", "is:unread"), i.get("max_results", 10)),
        "read_email": lambda i: email.read_email(i["email_id"]),
        "send_email": lambda i: email.send_email(i["to"], i["subject"], i["body"], i.get("cc")),
        "reply_to_email": lambda i: email.reply_to_email(i["thread_id"], i["to"], i["subject"], i["body"]),
        "list_gmail_labels": lambda i: email.list_labels(),
        # Facebook
        "create_facebook_post": lambda i: social.create_facebook_post(i["message"], i.get("image_url"), i.get("link")),
        "get_facebook_page_insights": lambda i: social.get_facebook_page_insights(
            i.get("metric", "page_impressions,page_engaged_users,page_fans"),
            i.get("date_preset", "last_7d"),
        ),
        "get_facebook_posts": lambda i: social.get_facebook_posts(i.get("limit", 10)),
        # Instagram
        "create_instagram_post": lambda i: social.create_instagram_post(i["caption"], i["image_url"]),
        "get_instagram_insights": lambda i: social.get_instagram_insights(
            i.get("metric", "impressions,reach,profile_views"),
            i.get("date_preset", "last_7d"),
        ),
        "get_instagram_posts": lambda i: social.get_instagram_posts(i.get("limit", 10)),
        # LinkedIn
        "create_linkedin_post": lambda i: social.create_linkedin_post(i["text"], i.get("image_url")),
        # Meta Ads
        "get_account_overview": lambda i: ads.get_account_overview(i.get("date_preset", "last_7d")),
        "list_ad_campaigns": lambda i: ads.list_ad_campaigns(i.get("status_filter", "ALL")),
        "get_campaign_insights": lambda i: ads.get_campaign_insights(i["campaign_id"], i.get("date_preset", "last_7d")),
        "get_adsets_insights": lambda i: ads.get_adsets_insights(i["campaign_id"], i.get("date_preset", "last_7d")),
        "update_campaign_status": lambda i: ads.update_campaign_status(i["campaign_id"], i["status"]),
        "update_campaign_budget": lambda i: ads.update_campaign_budget(
            i["campaign_id"],
            i.get("daily_budget_cents"),
            i.get("lifetime_budget_cents"),
        ),
        # Tasks
        "create_task": lambda i: tasks.create_task(i["title"], i["due_datetime"], i.get("description"), i.get("priority", "medium")),
        "list_tasks": lambda i: tasks.list_tasks(i.get("filter", "upcoming")),
        "complete_task": lambda i: tasks.complete_task(i["task_id"]),
        "update_task": lambda i: tasks.update_task(i["task_id"], i.get("title"), i.get("due_datetime"), i.get("description"), i.get("priority")),
        "delete_task": lambda i: tasks.delete_task(i["task_id"]),
    }

    fn = dispatch.get(name)
    if fn is None:
        return json.dumps({"error": f"Unknown tool: {name}"})
    try:
        return fn(tool_input)
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Conversation history helpers ──────────────────────────────────────────────

MAX_HISTORY_MESSAGES = 40  # keep last 40 messages per conversation


def _get_or_create_conversation(phone: str, db) -> Conversation:
    conv = db.query(Conversation).filter_by(phone_number=phone).first()
    if not conv:
        conv = Conversation(phone_number=phone)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


def _load_history(conv_id: int, db) -> list[dict]:
    msgs = (
        db.query(Message)
        .filter_by(conversation_id=conv_id)
        .order_by(Message.id.desc())
        .limit(MAX_HISTORY_MESSAGES)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in reversed(msgs)]


def _save_messages(conv_id: int, new_messages: list[dict], db):
    for m in new_messages:
        db.add(Message(conversation_id=conv_id, role=m["role"], content=m["content"]))
    db.commit()


# ── Main entry point ──────────────────────────────────────────────────────────

def process_message(phone: str, user_text: str) -> str:
    """
    Run the agentic loop for a WhatsApp message.
    Returns the final text reply to send back to the user.
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    db = SessionLocal()
    try:
        conv = _get_or_create_conversation(phone, db)
        history = _load_history(conv.id, db)

        # Append the new user message
        history.append({"role": "user", "content": user_text})
        new_messages: list[dict] = [{"role": "user", "content": user_text}]

        system = SYSTEM_PROMPT.format(date=datetime.utcnow().strftime("%A, %d %B %Y %H:%M UTC"))

        # Agentic loop
        while True:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=system,
                tools=TOOLS,
                messages=history,
            )

            # Add assistant turn to history
            assistant_msg = {"role": "assistant", "content": response.content}
            history.append(assistant_msg)
            new_messages.append(assistant_msg)

            if response.stop_reason == "end_turn":
                # Extract final text block
                text = next(
                    (b.text for b in response.content if hasattr(b, "text")),
                    "(no response)",
                )
                _save_messages(conv.id, new_messages, db)
                return text

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = _execute_tool(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })

                tool_msg = {"role": "user", "content": tool_results}
                history.append(tool_msg)
                new_messages.append(tool_msg)
                continue

            # Unexpected stop reason
            break

        _save_messages(conv.id, new_messages, db)
        return "Sorry, something went wrong. Please try again."

    except Exception as e:
        return f"Error: {e}"
    finally:
        db.close()
