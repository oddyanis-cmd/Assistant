"""
Liveness / anti-spoofing check (presentation-attack detection).

Why this matters: without it, anyone could check a member in by holding up a photo
of their face on a phone. A check-in burst sends SEVERAL frames; we use them to
look for evidence that a real, moving person is present:

  1. A face is found in the majority of frames.
  2. There is natural inter-frame motion (a printed/secondary-screen photo held to
     the camera tends to be unnaturally static, or it jitters as a rigid whole).
  3. The SAME identity is present across the whole burst (embedding consistency) —
     this prevents swapping a photo in halfway through.

IMPORTANT — read before production use
--------------------------------------
This is a lightweight *heuristic* gate, not certified anti-spoofing. A determined
attacker with a moving high-res video could pass it. For a true "bullet-proof"
deployment, plug a trained passive PAD model (e.g. MiniFASNet / Silent-Face) or use
a depth/IR-capable tablet camera into `evaluate()` — the interface stays the same.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.face.engine import FaceEngine, NoFaceDetected
from app.face.matcher import cosine_similarity


@dataclass
class LivenessResult:
    passed: bool
    score: float
    reason: str

    def to_dict(self) -> dict:
        return {"passed": self.passed, "score": round(self.score, 3), "reason": self.reason}


def _frame_motion(frames: list[np.ndarray]) -> float:
    """Mean absolute luminance difference between consecutive frames (0..255)."""
    if len(frames) < 2:
        return 0.0
    grays = []
    for f in frames:
        g = f.astype(np.float32)
        grays.append(g.mean(axis=2) if g.ndim == 3 else g)
    diffs = [np.abs(grays[i] - grays[i - 1]).mean() for i in range(1, len(grays))]
    return float(np.mean(diffs)) if diffs else 0.0


def evaluate(
    frames: list[np.ndarray],
    engine: FaceEngine,
    *,
    min_motion: float,
    min_det_score: float,
) -> LivenessResult:
    if not frames:
        return LivenessResult(False, 0.0, "no_frames")

    if len(frames) < 2:
        # Single still frame can't be checked for liveness — fail safe.
        return LivenessResult(False, 0.0, "need_multiple_frames")

    # 1) Face present in most frames + collect embeddings for consistency.
    embeddings = []
    faces_found = 0
    for fr in frames:
        try:
            face = engine.primary_face(fr, min_det_score=min_det_score)
            embeddings.append(face.embedding)
            faces_found += 1
        except NoFaceDetected:
            continue

    if faces_found < max(2, len(frames) // 2):
        return LivenessResult(False, 0.0, "face_not_consistently_present")

    # 2) Natural motion between frames.
    motion = _frame_motion(frames)
    if motion < min_motion:
        return LivenessResult(
            False, motion, f"too_static (motion {motion:.2f} < {min_motion:.2f}) — possible photo"
        )

    # 3) Same identity throughout the burst (no mid-burst swap).
    consistency = 1.0
    for i in range(1, len(embeddings)):
        consistency = min(consistency, cosine_similarity(embeddings[0], embeddings[i]))
    if consistency < 0.5:
        return LivenessResult(False, consistency, "identity_changed_during_capture")

    return LivenessResult(True, min(1.0, motion / (min_motion * 2)), "live")
