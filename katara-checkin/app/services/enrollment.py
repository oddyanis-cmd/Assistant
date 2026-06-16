"""Enrollment: bind one or more face captures to a client profile."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sqlalchemy.orm import Session

from app.config import settings
from app.embedding_store import embedding_to_json
from app.face import engine as face_engine
from app.models import Client, FaceTemplate


@dataclass
class EnrollmentError(Exception):
    message: str

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.message


def _embed_for_enrollment(image_bgr: np.ndarray):
    """Detect exactly one good-quality face and return its embedding + score."""
    eng = face_engine.get_engine()
    face = eng.primary_face(
        image_bgr,
        min_det_score=settings.min_det_score,
        require_single=True,   # enrollment must be unambiguous
    )
    return eng, face


def create_client_with_face(
    db: Session,
    *,
    full_name: str,
    image_bgr: np.ndarray,
    crm_id: str | None = None,
    membership_no: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> Client:
    eng, face = _embed_for_enrollment(image_bgr)

    client = Client(
        full_name=full_name,
        crm_id=crm_id,
        membership_no=membership_no,
        email=email,
        phone=phone,
    )
    db.add(client)
    db.flush()  # assign client.id

    db.add(
        FaceTemplate(
            client_id=client.id,
            embedding=embedding_to_json(face.embedding),
            dim=eng.dim,
            engine=eng.name,
            det_score=face.det_score,
        )
    )
    db.commit()
    db.refresh(client)
    return client


def add_face_to_client(db: Session, client: Client, image_bgr: np.ndarray) -> FaceTemplate:
    """Add another enrollment shot (different angle/lighting) to an existing client."""
    eng, face = _embed_for_enrollment(image_bgr)
    tmpl = FaceTemplate(
        client_id=client.id,
        embedding=embedding_to_json(face.embedding),
        dim=eng.dim,
        engine=eng.name,
        det_score=face.det_score,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl
