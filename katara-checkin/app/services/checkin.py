"""
Check-in orchestration: liveness -> embed -> identify -> record -> CRM sync.

This is the function the kiosk calls. It is written to FAIL SAFE: any uncertainty
(no face, spoof suspected, low score, ambiguous match) results in a recorded
non-check-in outcome and a clear message, never a wrong-person check-in.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sqlalchemy.orm import Session

from app.config import settings
from app.embedding_store import load_templates
from app.face import engine as face_engine
from app.face import liveness as liveness_mod
from app.face.engine import NoFaceDetected
from app.face.matcher import MatchResult, identify, l2_normalize
from app.models import CheckIn, Client
from app.services import crm


@dataclass
class CheckInOutcome:
    outcome: str                 # checked_in | no_match | rejected | spoof_suspected | no_face
    message: str
    client: Client | None
    match: MatchResult | None
    liveness: dict | None
    checkin_id: int | None
    crm_synced: bool


def _mean_embedding(frames: list[np.ndarray], eng) -> tuple[np.ndarray, float]:
    """Average the embedding across all frames where a face was found (more stable)."""
    embs, scores = [], []
    for fr in frames:
        try:
            face = eng.primary_face(fr, min_det_score=settings.min_det_score)
            embs.append(face.embedding)
            scores.append(face.det_score)
        except NoFaceDetected:
            continue
    if not embs:
        raise NoFaceDetected("No face detected in any frame.")
    mean = l2_normalize(np.mean(np.stack(embs), axis=0))
    return mean, float(np.mean(scores))


def recognize_and_checkin(db: Session, frames: list[np.ndarray]) -> CheckInOutcome:
    eng = face_engine.get_engine()

    # 1) Liveness / anti-spoofing on the burst (if enabled).
    liveness_dict = None
    if settings.require_liveness:
        lv = liveness_mod.evaluate(
            frames,
            eng,
            min_motion=settings.liveness_min_motion,
            min_det_score=settings.min_det_score,
        )
        liveness_dict = lv.to_dict()
        if not lv.passed:
            ci = _record(db, None, None, lv.passed, "spoof_suspected", note=lv.reason)
            return CheckInOutcome(
                "spoof_suspected",
                "Liveness check failed. Please look at the camera and move slightly, "
                "or use your QR code.",
                None, None, liveness_dict, ci.id, False,
            )

    # 2) Embed the subject.
    try:
        probe, _ = _mean_embedding(frames, eng)
    except NoFaceDetected:
        ci = _record(db, None, None, True, "no_face", note="no_face_detected")
        return CheckInOutcome(
            "no_face", "No face detected. Please stand in front of the camera.",
            None, None, liveness_dict, ci.id, False,
        )

    # 3) Identify against enrolled templates.
    templates = load_templates(db)
    match = identify(
        probe,
        templates,
        accept_threshold=settings.accept_threshold,
        decision_margin=settings.decision_margin,
    )

    if not match.accepted:
        outcome = "no_match" if match.client_id is None else "rejected"
        ci = _record(db, None, match.similarity, True, "no_match",
                     note=match.reason, margin=match.margin)
        return CheckInOutcome(
            outcome,
            "Not recognised with enough confidence. Please use your QR code.",
            None, match, liveness_dict, ci.id, False,
        )

    # 4) Recognised — record + push to CRM.
    client = db.query(Client).filter_by(id=match.client_id).first()
    ci = _record(db, client.id if client else None, match.similarity, True,
                 "checked_in", margin=match.margin)
    synced = crm.push_checkin(client, ci) if client else False
    if synced:
        ci.crm_synced = True
        db.commit()

    return CheckInOutcome(
        "checked_in",
        f"Welcome, {client.full_name}! You are checked in.",
        client, match, liveness_dict, ci.id, synced,
    )


def _record(
    db: Session,
    client_id: int | None,
    similarity: float | None,
    liveness_passed: bool,
    outcome: str,
    *,
    note: str | None = None,
    margin: float | None = None,
) -> CheckIn:
    ci = CheckIn(
        client_id=client_id,
        similarity=similarity,
        margin=margin,
        liveness_passed=liveness_passed,
        method="face",
        outcome=outcome,
        note=note,
    )
    db.add(ci)
    db.commit()
    db.refresh(ci)
    return ci
