#!/usr/bin/env python3
"""
End-to-end demo over the real HTTP API with the real ArcFace engine.

Enrolls one photo of a person, then checks in with a DIFFERENT photo of the same
person (should succeed) and with a different person (should be refused) — exactly
the reception-desk scenario, exercised through the actual endpoints.

    python scripts/demo_http.py
"""
import base64
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Use a throwaway DB and disable liveness so a single still photo can be used
# (the live kiosk sends a multi-frame burst; here we only have stills).
os.environ.setdefault("KATARA_DATABASE_URL", f"sqlite:///{tempfile.mktemp(suffix='.db')}")
os.environ["KATARA_REQUIRE_LIVENESS"] = "false"


def b64(path: str) -> str:
    with open(path, "rb") as fh:
        return "data:image/jpeg;base64," + base64.b64encode(fh.read()).decode()


def main():
    from fastapi.testclient import TestClient
    from app.main import app

    enroll_img = "sample_faces/obama.jpg"
    same_person = "sample_faces/obama2.jpg"
    other_person = "sample_faces/biden.jpg"
    for p in (enroll_img, same_person, other_person):
        if not os.path.exists(p):
            print(f"Missing {p}. Run:  python scripts/get_samples.py")
            return 1

    with TestClient(app) as c:
        print("1) Enrolling 'Barack' from obama.jpg ...")
        r = c.post("/api/clients", json={"full_name": "Barack", "image": b64(enroll_img),
                                         "membership_no": "KC-OBAMA"})
        r.raise_for_status()
        cid = r.json()["id"]
        print(f"   -> client id={cid}, templates={r.json()['template_count']}")

        print("\n2) Check-in with obama2.jpg (SAME person, different photo) ...")
        r = c.post("/api/checkin", json={"frames": [b64(same_person)]})
        body = r.json()
        print(f"   -> outcome={body['outcome']}  client={body['client'] and body['client']['full_name']}"
              f"  similarity={body['similarity']}")
        assert body["outcome"] == "checked_in" and body["client"]["id"] == cid

        print("\n3) Check-in with biden.jpg (DIFFERENT person) ...")
        r = c.post("/api/checkin", json={"frames": [b64(other_person)]})
        body = r.json()
        print(f"   -> outcome={body['outcome']}  client={body['client']}"
              f"  best_similarity={body['similarity']}")
        assert body["outcome"] == "no_match" and body["client"] is None

        print("\n4) Check-in log:")
        for row in c.get("/api/checkins").json():
            print(f"   {row['created_at']}  {row['outcome']:<12} "
                  f"member={row['client_name']}  sim={row['similarity']}")

    print("\n✅ End-to-end demo passed: same person recognised, different person refused.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
