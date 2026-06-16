"""Kiosk API: recognise a member from a camera burst and check them in."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.face.engine import FaceEngineError
from app.face.imaging import ImageDecodeError, decode_image
from app.models import CheckIn
from app.routers.clients import _to_out
from app.schemas import CheckInRequest, CheckInResponse, CheckInRow
from app.services import checkin as checkin_service

router = APIRouter(prefix="/api", tags=["checkin"])


@router.post("/checkin", response_model=CheckInResponse)
def checkin(req: CheckInRequest, db: Session = Depends(get_db)):
    try:
        frames = [decode_image(f) for f in req.frames]
    except ImageDecodeError as e:
        raise HTTPException(400, f"Could not read a frame: {e}")

    try:
        result = checkin_service.recognize_and_checkin(db, frames)
    except FaceEngineError as e:
        raise HTTPException(503, str(e))

    return CheckInResponse(
        outcome=result.outcome,
        message=result.message,
        checkin_id=result.checkin_id,
        client=_to_out(result.client) if result.client else None,
        similarity=result.match.similarity if result.match else None,
        margin=result.match.margin if result.match else None,
        liveness=result.liveness,
        crm_synced=result.crm_synced,
        match_detail=result.match.to_dict() if result.match else None,
    )


@router.get("/checkins", response_model=list[CheckInRow])
def recent_checkins(limit: int = 25, db: Session = Depends(get_db)):
    rows = db.query(CheckIn).order_by(CheckIn.created_at.desc()).limit(limit).all()
    return [
        CheckInRow(
            id=r.id,
            client_id=r.client_id,
            client_name=r.client.full_name if r.client else None,
            similarity=r.similarity,
            outcome=r.outcome,
            liveness_passed=r.liveness_passed,
            crm_synced=r.crm_synced,
            created_at=r.created_at,
        )
        for r in rows
    ]
