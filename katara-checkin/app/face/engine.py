"""
Face engine abstraction.

The rest of the app talks to a `FaceEngine` interface and never imports a specific
ML library directly. The production implementation wraps **InsightFace** (ArcFace
512-d embeddings + SCRFD detector via the `buffalo_l` model pack) — this is one of
the most accurate openly available face-recognition stacks (>99.8% on LFW).

Tests can install a deterministic fake engine via `set_engine_override()` so the
whole HTTP/DB pipeline is testable without the heavy model files.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import numpy as np

from app.config import settings
from app.face.matcher import l2_normalize


@dataclass
class DetectedFace:
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2
    det_score: float
    embedding: np.ndarray                    # L2-normalised float32
    area: float


class FaceEngineError(RuntimeError):
    """Raised when the engine cannot be used (e.g. not installed)."""


class NoFaceDetected(FaceEngineError):
    pass


class MultipleFacesDetected(FaceEngineError):
    pass


class FaceEngine(ABC):
    name: str = "abstract"
    dim: int = 0

    @abstractmethod
    def detect(self, image_bgr: np.ndarray) -> list[DetectedFace]:
        """Return every face found in the image, with embeddings."""

    def primary_face(
        self,
        image_bgr: np.ndarray,
        *,
        min_det_score: float,
        require_single: bool = False,
    ) -> DetectedFace:
        """
        Return the single best face to use.

        For enrollment we set `require_single=True` so we never silently bind the
        wrong person's face to a profile when two people are in frame.
        """
        faces = [f for f in self.detect(image_bgr) if f.det_score >= min_det_score]
        if not faces:
            raise NoFaceDetected("No face detected (or detection confidence too low).")
        if require_single and len(faces) > 1:
            raise MultipleFacesDetected(
                f"{len(faces)} faces in frame — only one person may enroll at a time."
            )
        # The face closest to the camera (largest bbox) is the subject.
        return max(faces, key=lambda f: f.area)


class InsightFaceEngine(FaceEngine):
    def __init__(self, model_name: str, det_size: int):
        try:
            from insightface.app import FaceAnalysis
        except ImportError as e:  # pragma: no cover - exercised via get_engine()
            raise FaceEngineError(
                "InsightFace is not installed. Install the recognition stack with:\n"
                "    pip install -r requirements-face.txt"
            ) from e

        # We only need detection + recognition for check-in.
        self._app = FaceAnalysis(
            name=model_name,
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=-1, det_size=(det_size, det_size))
        self.name = f"insightface:{model_name}"
        self.dim = 512

    def detect(self, image_bgr: np.ndarray) -> list[DetectedFace]:
        out: list[DetectedFace] = []
        for f in self._app.get(image_bgr):
            emb = getattr(f, "normed_embedding", None)
            emb = l2_normalize(emb if emb is not None else f.embedding)
            x1, y1, x2, y2 = (float(v) for v in f.bbox)
            out.append(
                DetectedFace(
                    bbox=(x1, y1, x2, y2),
                    det_score=float(f.det_score),
                    embedding=emb,
                    area=max(0.0, (x2 - x1)) * max(0.0, (y2 - y1)),
                )
            )
        return out


# ── Engine selection (cached singleton + test override) ─────────────────────────

_override: Optional[FaceEngine] = None


def set_engine_override(engine: Optional[FaceEngine]) -> None:
    """Install (or clear) a test engine. Also resets the cached real engine."""
    global _override
    _override = engine
    get_engine.cache_clear()


@lru_cache(maxsize=1)
def _build_engine() -> FaceEngine:
    choice = settings.face_engine.lower()
    if choice in ("auto", "insightface"):
        return InsightFaceEngine(settings.insightface_model, settings.det_size)
    raise FaceEngineError(f"Unknown KATARA_FACE_ENGINE='{settings.face_engine}'.")


def get_engine() -> FaceEngine:
    if _override is not None:
        return _override
    return _build_engine()


# Keep a cache_clear handle on get_engine for the override path.
get_engine.cache_clear = _build_engine.cache_clear  # type: ignore[attr-defined]


def engine_status() -> dict:
    """Non-raising status probe for /health and the UI."""
    try:
        eng = get_engine()
        return {"available": True, "name": eng.name, "dim": eng.dim, "error": None}
    except Exception as e:  # noqa: BLE001 - we want any failure surfaced as status
        return {"available": False, "name": None, "dim": 0, "error": str(e)}
