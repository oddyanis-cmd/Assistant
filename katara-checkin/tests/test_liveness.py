"""
Liveness / anti-spoofing tests.

We use a constant-embedding engine so identity stays consistent across frames,
isolating the motion + presence logic.
"""
import numpy as np

from app.face import liveness as liveness_mod
from app.face.imaging import decode_image
from tests.conftest import ConstEngine, make_image_b64, make_noise_frame

ENGINE = ConstEngine()


def _frames(b64_list):
    return [decode_image(b) for b in b64_list]


def test_static_photo_fails_liveness():
    """A single image repeated (a held-up photo) has no motion -> rejected."""
    still = make_image_b64(color=(100, 100, 100))
    frames = _frames([still, still, still, still])
    res = liveness_mod.evaluate(frames, ENGINE, min_motion=6.0, min_det_score=0.5)
    assert not res.passed
    assert "static" in res.reason


def test_moving_live_subject_passes():
    """Distinct frames (natural motion) with a consistent identity -> live."""
    frames = _frames([make_noise_frame(i) for i in range(5)])
    res = liveness_mod.evaluate(frames, ENGINE, min_motion=6.0, min_det_score=0.5)
    assert res.passed
    assert res.reason == "live"


def test_single_frame_cannot_prove_liveness():
    res = liveness_mod.evaluate(_frames([make_image_b64()]), ENGINE,
                                min_motion=6.0, min_det_score=0.5)
    assert not res.passed
    assert res.reason == "need_multiple_frames"


def test_identity_swap_mid_burst_is_rejected():
    """If the face vector changes mid-capture, fail (photo swapped in)."""
    from app.face.engine import DetectedFace, FaceEngine
    from app.face.matcher import l2_normalize

    class SwapEngine(FaceEngine):
        name = "swap"; dim = 512

        def __init__(self):
            self.a = l2_normalize(np.random.default_rng(1).standard_normal(512).astype(np.float32))
            self.b = l2_normalize(np.random.default_rng(2).standard_normal(512).astype(np.float32))
            self.n = 0

        def detect(self, image_bgr):
            emb = self.a if self.n < 2 else self.b
            self.n += 1
            return [DetectedFace((0, 0, 50, 50), 0.99, emb, 2500.0)]

    frames = _frames([make_noise_frame(i) for i in range(4)])
    res = liveness_mod.evaluate(frames, SwapEngine(), min_motion=6.0, min_det_score=0.5)
    assert not res.passed
    assert res.reason == "identity_changed_during_capture"
