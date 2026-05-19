import json
from typing import Optional

import httpx

from config import settings
from database.db import SessionLocal
from database.models import OAuthToken

GRAPH_BASE = "https://graph.facebook.com/v19.0"


# ── Facebook ──────────────────────────────────────────────────────────────────

def create_facebook_post(message: str, image_url: Optional[str] = None, link: Optional[str] = None) -> str:
    """Publish a post to the configured Facebook Page."""
    try:
        if image_url:
            endpoint = f"{GRAPH_BASE}/{settings.meta_page_id}/photos"
            payload = {
                "url": image_url,
                "caption": message,
                "access_token": settings.meta_page_access_token,
            }
        else:
            endpoint = f"{GRAPH_BASE}/{settings.meta_page_id}/feed"
            payload = {
                "message": message,
                "access_token": settings.meta_page_access_token,
            }
            if link:
                payload["link"] = link

        with httpx.Client() as client:
            resp = client.post(endpoint, data=payload, timeout=30)
            resp.raise_for_status()
            data = resp.json()

        return json.dumps({"success": True, "post_id": data.get("id"), "platform": "facebook"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def get_facebook_page_insights(metric: str = "page_impressions,page_engaged_users,page_fans", date_preset: str = "last_7d") -> str:
    """Get Facebook Page insights for reach, engagement, and followers."""
    try:
        url = f"{GRAPH_BASE}/{settings.meta_page_id}/insights"
        params = {
            "metric": metric,
            "date_preset": date_preset,
            "access_token": settings.meta_page_access_token,
        }
        with httpx.Client() as client:
            resp = client.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("data", []):
            latest = item.get("values", [{}])[-1] if item.get("values") else {}
            results.append({
                "metric": item.get("name"),
                "value": latest.get("value"),
                "end_time": latest.get("end_time"),
            })

        return json.dumps({"insights": results, "page_id": settings.meta_page_id})
    except Exception as e:
        return json.dumps({"error": str(e)})


def get_facebook_posts(limit: int = 10) -> str:
    """Get recent posts from the Facebook Page including likes and comments count."""
    try:
        url = f"{GRAPH_BASE}/{settings.meta_page_id}/posts"
        params = {
            "fields": "id,message,created_time,likes.summary(true),comments.summary(true),shares",
            "limit": limit,
            "access_token": settings.meta_page_access_token,
        }
        with httpx.Client() as client:
            resp = client.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

        posts = []
        for p in data.get("data", []):
            posts.append({
                "id": p.get("id"),
                "message": (p.get("message") or "")[:200],
                "created_time": p.get("created_time"),
                "likes": p.get("likes", {}).get("summary", {}).get("total_count", 0),
                "comments": p.get("comments", {}).get("summary", {}).get("total_count", 0),
                "shares": p.get("shares", {}).get("count", 0),
            })
        return json.dumps({"posts": posts})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Instagram ─────────────────────────────────────────────────────────────────

def create_instagram_post(caption: str, image_url: str) -> str:
    """
    Publish a photo post to Instagram Business via the Content Publishing API.
    image_url must be a publicly accessible URL.
    """
    try:
        ig_id = settings.meta_instagram_account_id
        token = settings.meta_page_access_token

        # Step 1: create media container
        with httpx.Client() as client:
            container_resp = client.post(
                f"{GRAPH_BASE}/{ig_id}/media",
                data={"image_url": image_url, "caption": caption, "access_token": token},
                timeout=30,
            )
            container_resp.raise_for_status()
            container_id = container_resp.json().get("id")

            # Step 2: publish the container
            publish_resp = client.post(
                f"{GRAPH_BASE}/{ig_id}/media_publish",
                data={"creation_id": container_id, "access_token": token},
                timeout=30,
            )
            publish_resp.raise_for_status()
            post_id = publish_resp.json().get("id")

        return json.dumps({"success": True, "post_id": post_id, "platform": "instagram"})
    except Exception as e:
        return json.dumps({"error": str(e)})


def get_instagram_insights(metric: str = "impressions,reach,profile_views", date_preset: str = "last_7d") -> str:
    """Get Instagram Business account insights."""
    try:
        ig_id = settings.meta_instagram_account_id
        token = settings.meta_page_access_token

        url = f"{GRAPH_BASE}/{ig_id}/insights"
        params = {
            "metric": metric,
            "period": "day",
            "since": _preset_to_unix(date_preset)[0],
            "until": _preset_to_unix(date_preset)[1],
            "access_token": token,
        }
        with httpx.Client() as client:
            resp = client.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("data", []):
            total = sum(v.get("value", 0) for v in item.get("values", []))
            results.append({"metric": item.get("name"), "total": total})

        return json.dumps({"insights": results, "account_id": ig_id})
    except Exception as e:
        return json.dumps({"error": str(e)})


def get_instagram_posts(limit: int = 10) -> str:
    """Get recent Instagram posts with engagement metrics."""
    try:
        ig_id = settings.meta_instagram_account_id
        token = settings.meta_page_access_token

        url = f"{GRAPH_BASE}/{ig_id}/media"
        params = {
            "fields": "id,caption,media_type,timestamp,like_count,comments_count,permalink",
            "limit": limit,
            "access_token": token,
        }
        with httpx.Client() as client:
            resp = client.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

        posts = []
        for p in data.get("data", []):
            posts.append({
                "id": p.get("id"),
                "caption": (p.get("caption") or "")[:200],
                "type": p.get("media_type"),
                "timestamp": p.get("timestamp"),
                "likes": p.get("like_count", 0),
                "comments": p.get("comments_count", 0),
                "url": p.get("permalink"),
            })
        return json.dumps({"posts": posts})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── LinkedIn ──────────────────────────────────────────────────────────────────

def _get_linkedin_token() -> str:
    db = SessionLocal()
    try:
        row = db.query(OAuthToken).filter_by(service="linkedin").first()
        if not row:
            raise RuntimeError("LinkedIn not connected. Visit /auth/linkedin to authorize.")
        return row.access_token
    finally:
        db.close()


def _get_linkedin_author_urn() -> str:
    token = _get_linkedin_token()
    with httpx.Client() as client:
        resp = client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    return f"urn:li:person:{data['sub']}"


def create_linkedin_post(text: str, image_url: Optional[str] = None) -> str:
    """Publish a post to LinkedIn as the authenticated user."""
    try:
        token = _get_linkedin_token()
        author_urn = _get_linkedin_author_urn()

        post_body: dict = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        if image_url:
            post_body["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
            post_body["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
                {
                    "status": "READY",
                    "description": {"text": ""},
                    "media": image_url,
                    "title": {"text": ""},
                }
            ]

        with httpx.Client() as client:
            resp = client.post(
                "https://api.linkedin.com/v2/ugcPosts",
                json=post_body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
                timeout=30,
            )
            resp.raise_for_status()
            post_id = resp.headers.get("x-restli-id", resp.json().get("id", ""))

        return json.dumps({"success": True, "post_id": post_id, "platform": "linkedin"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _preset_to_unix(preset: str):
    """Convert date preset string to (since, until) unix timestamps."""
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    presets = {
        "today": 0,
        "yesterday": 1,
        "last_7d": 7,
        "last_30d": 30,
        "this_month": now.day - 1,
    }
    days = presets.get(preset, 7)
    since = int((now - timedelta(days=days)).timestamp())
    until = int(now.timestamp())
    return since, until
