"""
Test fixtures.

Key idea: we install a deterministic FAKE face engine so the entire HTTP + DB
pipeline (enroll -> identify -> check-in -> CRM record) is testable WITHOUT the
300 MB InsightFace model. The fake derives a stable embedding from the image
bytes, so the same picture always yields the same vector (similarity 1.0) and a
different picture yields a near-orthogonal one. The real engine is validated
separately by scripts/verify_engine.py against actual face photos.
"""
import base64
import hashlib
import io
import os
import tempfile

import numpy as np
import pytest

# Configure a throwaway DB + test-friendly settings BEFORE importing the app.
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["KATARA_DATABASE_URL"] = f"sqlite:///{_tmp_db.name}"
os.environ["KATARA_REQUIRE_LIVENESS"] = "false"  # toggled on explicitly in liveness tests
os.environ["KATARA_ACCEPT_THRESHOLD"] = "0.45"
os.environ["KATARA_DECISION_MARGIN"] = "0.10"

from app.face.engine import DetectedFace, FaceEngine, set_engine_override  # noqa: E402
from app.face.matcher import l2_normalize  # noqa: E402


class FakeEngine(FaceEngine):
    """Deterministic, dependency-free engine: embedding is a hash of the pixels."""

    name = "fake:test"
    dim = 512

    def detect(self, image_bgr):
        digest = hashlib.blake2b(
            np.ascontiguousarray(image_bgr).tobytes(), digest_size=8
        ).digest()
        rng = np.random.default_rng(int.from_bytes(digest, "little"))
        emb = l2_normalize(rng.standard_normal(self.dim).astype(np.float32))
        return [DetectedFace(bbox=(0, 0, 120, 120), det_score=0.99, embedding=emb, area=14400.0)]


class ConstEngine(FaceEngine):
    """Always returns the SAME embedding regardless of pixels (for liveness tests)."""

    name = "const:test"
    dim = 512

    def __init__(self):
        self._emb = l2_normalize(np.random.default_rng(7).standard_normal(self.dim).astype(np.float32))

    def detect(self, image_bgr):
        return [DetectedFace(bbox=(0, 0, 120, 120), det_score=0.99, embedding=self._emb, area=14400.0)]


def make_image_b64(color=(120, 90, 60), size=160) -> str:
    """A solid-colour PNG as a data URL. Different colours => different 'people'."""
    from PIL import Image

    img = Image.new("RGB", (size, size), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def make_noise_frame(seed: int, size=160) -> str:
    """A random-noise PNG (used to create inter-frame motion for liveness)."""
    from PIL import Image

    rng = np.random.default_rng(seed)
    arr = (rng.random((size, size, 3)) * 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(autouse=True)
def _use_fake_engine():
    set_engine_override(FakeEngine())
    yield
    set_engine_override(None)


@pytest.fixture
def client(_use_fake_engine):
    from fastapi.testclient import TestClient

    from app.database import Base, engine
    from app import models  # noqa: F401  (register tables)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    from app.main import app

    with TestClient(app) as c:
        yield c
