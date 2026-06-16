"""Pydantic request/response models for the JSON API."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Enrollment ──────────────────────────────────────────────────────────────────

class EnrollRequest(BaseModel):
    full_name: str = Field(..., min_length=1)
    image: str = Field(..., description="data: URL or base64 JPEG/PNG of the face")
    crm_id: Optional[str] = None
    membership_no: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class AddFaceRequest(BaseModel):
    image: str = Field(..., description="Another face capture for this client")


class ClientOut(BaseModel):
    id: int
    full_name: str
    crm_id: Optional[str] = None
    membership_no: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    active: bool
    template_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Check-in ────────────────────────────────────────────────────────────────────

class CheckInRequest(BaseModel):
    # A short burst of frames enables liveness detection. A single frame also works
    # if KATARA_REQUIRE_LIVENESS=false.
    frames: list[str] = Field(..., min_length=1, description="base64/data-URL frames")


class CheckInResponse(BaseModel):
    outcome: str
    message: str
    checkin_id: Optional[int] = None
    client: Optional[ClientOut] = None
    similarity: Optional[float] = None
    margin: Optional[float] = None
    liveness: Optional[dict] = None
    crm_synced: bool = False
    match_detail: Optional[dict] = None


class CheckInRow(BaseModel):
    id: int
    client_id: Optional[int]
    client_name: Optional[str]
    similarity: Optional[float]
    outcome: str
    liveness_passed: bool
    crm_synced: bool
    created_at: datetime
