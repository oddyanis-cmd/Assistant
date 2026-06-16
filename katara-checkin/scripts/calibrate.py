#!/usr/bin/env python3
"""
Calibrate the accept threshold from labelled photos.

Layout (one folder per person, 2+ photos each):

    dataset/
      aisha/   img1.jpg img2.jpg ...
      omar/    img1.jpg img2.jpg ...

Usage:
    python scripts/calibrate.py dataset/

Computes genuine vs impostor similarity distributions and suggests:
  * a threshold at the Equal Error Rate (EER), and
  * a stricter threshold giving ~0 false accepts on this set (recommended for
    access control, where a wrong check-in is the costly error).
"""
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402

from app.face.engine import NoFaceDetected, get_engine  # noqa: E402
from app.face.imaging import decode_image  # noqa: E402
from app.face.matcher import cosine_similarity  # noqa: E402


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    root = argv[0]
    eng = get_engine()
    print(f"Engine: {eng.name}")

    people = {}
    for person in sorted(os.listdir(root)):
        pdir = os.path.join(root, person)
        if not os.path.isdir(pdir):
            continue
        embs = []
        for p in sorted(glob.glob(os.path.join(pdir, "*"))):
            try:
                with open(p, "rb") as fh:
                    face = eng.primary_face(decode_image(fh.read()), min_det_score=0.5)
                embs.append(face.embedding)
            except (NoFaceDetected, Exception):  # noqa: BLE001
                continue
        if embs:
            people[person] = embs

    genuine, impostor = [], []
    names = list(people)
    for a in names:
        ea = people[a]
        for i in range(len(ea)):
            for j in range(i + 1, len(ea)):
                genuine.append(cosine_similarity(ea[i], ea[j]))
        for b in names:
            if b <= a:
                continue
            for x in ea:
                for y in people[b]:
                    impostor.append(cosine_similarity(x, y))

    if not genuine or not impostor:
        print("Need at least one person with 2+ photos AND two distinct people.")
        return 1

    g = np.array(genuine)
    im = np.array(impostor)
    print(f"\n  genuine  : n={len(g):4d}  mean={g.mean():.3f}  min={g.min():.3f}")
    print(f"  impostor : n={len(im):4d}  mean={im.mean():.3f}  max={im.max():.3f}")

    # Sweep thresholds for EER and a zero-false-accept point.
    grid = np.linspace(0.0, 1.0, 201)
    best_eer, eer_t = 1.0, 0.5
    zero_fa_t = None
    for t in grid:
        far = float((im >= t).mean())          # false accept rate
        frr = float((g < t).mean())             # false reject rate
        if abs(far - frr) < abs(best_eer):
            best_eer, eer_t = far - frr, t
        if far == 0.0 and zero_fa_t is None:
            zero_fa_t = t

    print(f"\n  Suggested EER threshold        : {eer_t:.2f}")
    if zero_fa_t is not None:
        frr_at_zero = float((g < zero_fa_t).mean())
        print(f"  Suggested zero-false-accept    : {zero_fa_t:.2f} "
              f"(rejects {frr_at_zero*100:.1f}% of genuine -> they use QR fallback)")
    print("\n  Set KATARA_ACCEPT_THRESHOLD to the zero-false-accept value for the "
          "safest access control.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
