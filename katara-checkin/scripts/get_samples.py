#!/usr/bin/env python3
"""
Download a few public sample faces into sample_faces/ so you can try the engine
verification and the HTTP demo without supplying your own photos.

    python scripts/get_samples.py

These are widely-used public test images (two photos of one person + one of a
different person), perfect for a same/different check. Replace them with your own
members' photos for a realistic trial.
"""
import os
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/ageitgey/face_recognition/master/tests/test_images/"
FILES = ["obama.jpg", "obama2.jpg", "biden.jpg"]


def main():
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample_faces")
    os.makedirs(out, exist_ok=True)
    ok = 0
    for f in FILES:
        dest = os.path.join(out, f)
        if os.path.exists(dest):
            print(f"  already have {f}")
            ok += 1
            continue
        try:
            req = urllib.request.Request(BASE + f, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=30).read()
            with open(dest, "wb") as fh:
                fh.write(data)
            print(f"  downloaded {f} ({len(data)} bytes)")
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED {f}: {e}")
    print(f"\n{ok}/{len(FILES)} sample faces in {out}")
    return 0 if ok == len(FILES) else 1


if __name__ == "__main__":
    raise SystemExit(main())
