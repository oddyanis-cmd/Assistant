#!/usr/bin/env python3
"""
Validate the REAL face engine (InsightFace/ArcFace) on actual photos.

Usage:
    python scripts/verify_engine.py                 # use everything in sample_faces/
    python scripts/verify_engine.py a.jpg b.jpg ... # specific files

It prints a pairwise cosine-similarity matrix and, using the configured
KATARA_ACCEPT_THRESHOLD, labels each pair SAME / DIFFERENT. Genuine pairs (two
photos of one person) should sit well above the threshold; impostor pairs well
below it. The gap between them is your safety margin.
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402

from app.config import settings  # noqa: E402
from app.face.engine import NoFaceDetected, get_engine  # noqa: E402
from app.face.imaging import decode_image  # noqa: E402
from app.face.matcher import cosine_similarity  # noqa: E402


def identity_of(path: str) -> str:
    """Guess identity from filename: 'obama2.jpg' -> 'obama'."""
    base = os.path.splitext(os.path.basename(path))[0]
    return re.sub(r"[\W_]*\d+$", "", base).lower()


def main(argv):
    paths = argv or sorted(
        glob.glob(os.path.join("sample_faces", "*.jpg"))
        + glob.glob(os.path.join("sample_faces", "*.jpeg"))
        + glob.glob(os.path.join("sample_faces", "*.png"))
    )
    if not paths:
        print("No images found. Put face photos in sample_faces/ or pass paths.")
        return 1

    eng = get_engine()
    print(f"Engine: {eng.name} (dim={eng.dim})")
    print(f"Accept threshold: {settings.accept_threshold}\n")

    names, embs = [], []
    for p in paths:
        with open(p, "rb") as fh:
            img = decode_image(fh.read())
        try:
            face = eng.primary_face(img, min_det_score=settings.min_det_score)
        except NoFaceDetected:
            print(f"  ! no face detected in {p} — skipping")
            continue
        names.append(os.path.basename(p))
        embs.append(face.embedding)
        print(f"  detected face in {os.path.basename(p):<18} (det_score={face.det_score:.3f})")

    n = len(embs)
    if n < 2:
        print("\nNeed at least two detectable faces to compare.")
        return 1

    print("\nPairwise cosine similarity:\n")
    header = " " * 20 + "".join(f"{nm[:10]:>12}" for nm in names)
    print(header)
    genuine, impostor = [], []
    for i in range(n):
        row = f"{names[i][:18]:<20}"
        for j in range(n):
            s = cosine_similarity(embs[i], embs[j])
            row += f"{s:>12.3f}"
            if i < j:
                same_person = identity_of(paths[i]) == identity_of(paths[j])
                (genuine if same_person else impostor).append(s)
        print(row)

    print("\nPair verdicts (threshold = %.2f):" % settings.accept_threshold)
    for i in range(n):
        for j in range(i + 1, n):
            s = cosine_similarity(embs[i], embs[j])
            verdict = "SAME ✅" if s >= settings.accept_threshold else "DIFFERENT ❌"
            truth = "(genuine)" if identity_of(paths[i]) == identity_of(paths[j]) else "(impostor)"
            print(f"  {names[i]:<16} vs {names[j]:<16} {s:6.3f}  -> {verdict:<12} {truth}")

    if genuine and impostor:
        print(f"\n  genuine  pairs: min={min(genuine):.3f}  mean={np.mean(genuine):.3f}")
        print(f"  impostor pairs: max={max(impostor):.3f}  mean={np.mean(impostor):.3f}")
        gap = min(genuine) - max(impostor)
        print(f"  separation gap (min genuine - max impostor): {gap:.3f} "
              + ("✅ healthy" if gap > 0 else "⚠ overlap — tune threshold/lighting"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
