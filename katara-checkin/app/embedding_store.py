"""
Helpers to (de)serialise embeddings and load them from the DB into the matcher.

Embeddings are stored as JSON arrays of floats (portable + inspectable). For a
single club this in-memory scan over all templates is plenty fast. If you ever
hold tens of thousands of members, swap this for a vector index (FAISS / pgvector)
behind the same `load_templates()` call — nothing else needs to change.
"""
from __future__ import annotations

import json

import numpy as np
from sqlalchemy.orm import Session

from app.face.matcher import Template, l2_normalize
from app.models import Client, FaceTemplate


def embedding_to_json(vec: np.ndarray) -> str:
    return json.dumps([round(float(x), 7) for x in l2_normalize(vec).tolist()])


def embedding_from_json(text: str) -> np.ndarray:
    return np.asarray(json.loads(text), dtype=np.float32)


def load_templates(db: Session) -> list[Template]:
    """All enrolled templates for ACTIVE clients, ready for matcher.identify()."""
    rows = (
        db.query(FaceTemplate)
        .join(Client, Client.id == FaceTemplate.client_id)
        .filter(Client.active.is_(True))
        .all()
    )
    return [
        Template(client_id=r.client_id, embedding=embedding_from_json(r.embedding))
        for r in rows
    ]
