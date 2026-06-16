#!/usr/bin/env python3
"""
Generate a visual demo image showing the engine's decisions on the sample faces:
one face is "enrolled", then two faces are "scanned" — the same person (checked in)
and a different person (refused). Saves a montage you can show to anyone.

    python scripts/visual_demo.py            # writes media/visual_demo.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cv2  # noqa: E402
import numpy as np  # noqa: E402

from app.config import settings  # noqa: E402
from app.face.engine import get_engine  # noqa: E402
from app.face.imaging import decode_image  # noqa: E402
from app.face.matcher import cosine_similarity  # noqa: E402

GREEN = (75, 175, 80)
RED = (45, 45, 210)
GOLD = (40, 150, 200)
DARK = (35, 30, 28)


def load(path):
    with open(path, "rb") as fh:
        return decode_image(fh.read())


def panel(img, face, title, sub, color, h=360):
    img = img.copy()
    x1, y1, x2, y2 = (int(v) for v in face.bbox)
    cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
    w = int(img.shape[1] * h / img.shape[0])
    img = cv2.resize(img, (w, h))
    bar = np.full((78, w, 3), DARK, np.uint8)
    cv2.putText(bar, title, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.72, color, 2, cv2.LINE_AA)
    cv2.putText(bar, sub, (12, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (225, 225, 225), 1, cv2.LINE_AA)
    return np.vstack([bar, img])


def main():
    needed = ["obama", "obama2", "biden"]
    paths = {k: f"sample_faces/{k}.jpg" for k in needed}
    for p in paths.values():
        if not os.path.exists(p):
            print(f"Missing {p}. Run:  python scripts/get_samples.py")
            return 1

    eng = get_engine()
    faces = {k: eng.primary_face(load(p), min_det_score=0.5) for k, p in paths.items()}
    enrolled = faces["obama"].embedding
    s_same = cosine_similarity(enrolled, faces["obama2"].embedding)
    s_diff = cosine_similarity(enrolled, faces["biden"].embedding)
    thr = settings.accept_threshold

    p0 = panel(load(paths["obama"]), faces["obama"], "ENROLLED: Barack",
               "reference face linked to profile", GOLD)
    p1 = panel(load(paths["obama2"]), faces["obama2"],
               f"SCAN -> CHECKED IN  ({s_same:.2f})",
               f"same person, different photo  >=  {thr:.2f}", GREEN)
    p2 = panel(load(paths["biden"]), faces["biden"],
               f"SCAN -> NOT RECOGNISED  ({s_diff:.2f})",
               f"different person  <  {thr:.2f}  -> use QR", RED)

    sep = np.full((p0.shape[0], 10, 3), 255, np.uint8)
    body = np.hstack([p0, sep, p1, sep, p2])
    title = np.full((54, body.shape[1], 3), DARK, np.uint8)
    cv2.putText(title, "Katara Club - Face Check-In  (ArcFace / InsightFace)",
                (14, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (230, 220, 200), 2, cv2.LINE_AA)
    montage = np.vstack([title, body])

    os.makedirs(settings.media_dir, exist_ok=True)
    out = os.path.join(settings.media_dir, "visual_demo.png")
    cv2.imwrite(out, montage)
    print(f"Wrote {out}  (same={s_same:.3f}, diff={s_diff:.3f}, threshold={thr})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
