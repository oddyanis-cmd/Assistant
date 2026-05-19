import json
from typing import Optional

import httpx

from config import settings

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def _ads_get(path: str, params: dict) -> dict:
    params["access_token"] = settings.meta_ads_access_token
    with httpx.Client() as client:
        resp = client.get(f"{GRAPH_BASE}{path}", params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()


def _ads_post(path: str, data: dict) -> dict:
    data["access_token"] = settings.meta_ads_access_token
    with httpx.Client() as client:
        resp = client.post(f"{GRAPH_BASE}{path}", data=data, timeout=30)
        resp.raise_for_status()
        return resp.json()


def get_account_overview(date_preset: str = "last_7d") -> str:
    """
    Get top-level spend, impressions, clicks, and ROAS for the whole ad account.
    date_preset: today | yesterday | last_7d | last_30d | this_month | last_month
    """
    try:
        data = _ads_get(
            f"/{settings.meta_ads_account_id}/insights",
            {
                "fields": "spend,impressions,clicks,ctr,cpc,cpp,reach,actions,action_values",
                "date_preset": date_preset,
                "level": "account",
            },
        )
        rows = data.get("data", [])
        if not rows:
            return json.dumps({"message": "No data for this period."})
        row = rows[0]

        # Parse purchase ROAS from actions/action_values
        purchase_value = 0.0
        spend = float(row.get("spend", 0))
        for av in row.get("action_values", []):
            if av.get("action_type") == "purchase":
                purchase_value = float(av.get("value", 0))
        roas = round(purchase_value / spend, 2) if spend > 0 else 0

        return json.dumps({
            "period": date_preset,
            "spend": row.get("spend"),
            "impressions": row.get("impressions"),
            "clicks": row.get("clicks"),
            "ctr": row.get("ctr"),
            "cpc": row.get("cpc"),
            "reach": row.get("reach"),
            "purchase_value": purchase_value,
            "roas": roas,
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_ad_campaigns(status_filter: str = "ALL") -> str:
    """
    List campaigns in the ad account.
    status_filter: ALL | ACTIVE | PAUSED | ARCHIVED
    """
    try:
        params = {
            "fields": "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
            "limit": 50,
        }
        if status_filter != "ALL":
            params["effective_status"] = f'["{status_filter}"]'

        data = _ads_get(f"/{settings.meta_ads_account_id}/campaigns", params)
        campaigns = []
        for c in data.get("data", []):
            campaigns.append({
                "id": c.get("id"),
                "name": c.get("name"),
                "status": c.get("status"),
                "objective": c.get("objective"),
                "daily_budget": c.get("daily_budget"),
                "lifetime_budget": c.get("lifetime_budget"),
                "start_time": c.get("start_time"),
                "stop_time": c.get("stop_time"),
            })
        return json.dumps({"campaigns": campaigns, "count": len(campaigns)})
    except Exception as e:
        return json.dumps({"error": str(e)})


def get_campaign_insights(campaign_id: str, date_preset: str = "last_7d") -> str:
    """
    Get detailed performance metrics for a specific campaign.
    """
    try:
        data = _ads_get(
            f"/{campaign_id}/insights",
            {
                "fields": "campaign_name,spend,impressions,clicks,ctr,cpc,reach,frequency,actions,action_values,cost_per_action_type",
                "date_preset": date_preset,
                "level": "campaign",
            },
        )
        rows = data.get("data", [])
        if not rows:
            return json.dumps({"message": "No data for this period.", "campaign_id": campaign_id})

        row = rows[0]
        purchase_actions = next(
            (a for a in row.get("actions", []) if a.get("action_type") == "purchase"), {}
        )
        purchase_value = next(
            (float(a.get("value", 0)) for a in row.get("action_values", []) if a.get("action_type") == "purchase"), 0.0
        )
        spend = float(row.get("spend", 0))
        roas = round(purchase_value / spend, 2) if spend > 0 else 0

        return json.dumps({
            "campaign_id": campaign_id,
            "campaign_name": row.get("campaign_name"),
            "period": date_preset,
            "spend": row.get("spend"),
            "impressions": row.get("impressions"),
            "clicks": row.get("clicks"),
            "ctr": row.get("ctr"),
            "cpc": row.get("cpc"),
            "reach": row.get("reach"),
            "frequency": row.get("frequency"),
            "purchases": purchase_actions.get("value", 0),
            "purchase_value": purchase_value,
            "roas": roas,
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


def get_adsets_insights(campaign_id: str, date_preset: str = "last_7d") -> str:
    """Get performance broken down by ad sets within a campaign."""
    try:
        data = _ads_get(
            f"/{campaign_id}/insights",
            {
                "fields": "adset_name,spend,impressions,clicks,ctr,cpc,reach,actions",
                "date_preset": date_preset,
                "level": "adset",
            },
        )
        rows = data.get("data", [])
        return json.dumps({"adsets": rows, "campaign_id": campaign_id, "period": date_preset})
    except Exception as e:
        return json.dumps({"error": str(e)})


def update_campaign_status(campaign_id: str, status: str) -> str:
    """
    Pause or activate a campaign.
    status: ACTIVE | PAUSED
    """
    try:
        if status not in ("ACTIVE", "PAUSED"):
            return json.dumps({"error": "status must be ACTIVE or PAUSED"})
        data = _ads_post(f"/{campaign_id}", {"status": status})
        return json.dumps({"success": True, "campaign_id": campaign_id, "new_status": status, "result": data})
    except Exception as e:
        return json.dumps({"error": str(e)})


def update_campaign_budget(campaign_id: str, daily_budget_cents: Optional[int] = None, lifetime_budget_cents: Optional[int] = None) -> str:
    """
    Update campaign budget. Amounts are in cents of the account currency
    (e.g., 1000 = $10.00 or €10.00).
    Provide either daily_budget_cents or lifetime_budget_cents, not both.
    """
    try:
        payload: dict = {}
        if daily_budget_cents is not None:
            payload["daily_budget"] = daily_budget_cents
        if lifetime_budget_cents is not None:
            payload["lifetime_budget"] = lifetime_budget_cents
        if not payload:
            return json.dumps({"error": "Provide daily_budget_cents or lifetime_budget_cents"})

        data = _ads_post(f"/{campaign_id}", payload)
        return json.dumps({"success": True, "campaign_id": campaign_id, "updated": payload, "result": data})
    except Exception as e:
        return json.dumps({"error": str(e)})


def list_ads(adset_id: str) -> str:
    """List individual ads within an ad set with their status and creative info."""
    try:
        data = _ads_get(
            f"/{adset_id}/ads",
            {"fields": "id,name,status,creative{title,body,thumbnail_url}"},
        )
        return json.dumps({"ads": data.get("data", []), "adset_id": adset_id})
    except Exception as e:
        return json.dumps({"error": str(e)})
