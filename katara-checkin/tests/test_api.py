"""End-to-end HTTP tests: enroll a client, then check in (match / no-match)."""
from tests.conftest import make_image_b64


def test_health_reports_engine(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["engine"]["available"] is True


def test_enroll_then_checkin_same_face(client):
    face = make_image_b64(color=(130, 90, 60))

    r = client.post("/api/clients", json={"full_name": "Aisha Al Thani", "image": face,
                                          "membership_no": "KC-1", "crm_id": "CRM-1"})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    assert r.json()["template_count"] == 1

    # Same face -> recognised.
    r = client.post("/api/checkin", json={"frames": [face]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["outcome"] == "checked_in"
    assert body["client"]["id"] == cid
    assert body["similarity"] > 0.99
    # No CRM configured in tests -> recorded locally only.
    assert body["crm_synced"] is False

    # It shows up in the log.
    log = client.get("/api/checkins").json()
    assert any(row["outcome"] == "checked_in" and row["client_id"] == cid for row in log)


def test_unknown_face_is_not_checked_in(client):
    enrolled = make_image_b64(color=(130, 90, 60))
    stranger = make_image_b64(color=(20, 200, 120))  # different pixels -> different vector

    client.post("/api/clients", json={"full_name": "Known Member", "image": enrolled})

    r = client.post("/api/checkin", json={"frames": [stranger]})
    assert r.status_code == 200
    body = r.json()
    assert body["outcome"] == "no_match"
    assert body["client"] is None


def test_add_second_face_to_client(client):
    a = make_image_b64(color=(130, 90, 60))
    b = make_image_b64(color=(131, 91, 61))
    cid = client.post("/api/clients", json={"full_name": "Multi Shot", "image": a}).json()["id"]
    r = client.post(f"/api/clients/{cid}/faces", json={"image": b})
    assert r.status_code == 200
    assert r.json()["template_count"] == 2


def test_enroll_rejects_multiple_faces(client):
    """Enrollment must refuse a frame containing two people."""
    from app.face.engine import DetectedFace, FaceEngine, set_engine_override
    from app.face.matcher import l2_normalize
    import numpy as np

    class TwoFaceEngine(FaceEngine):
        name = "two:test"
        dim = 512

        def detect(self, image_bgr):
            e = l2_normalize(np.ones(self.dim, dtype=np.float32))
            return [
                DetectedFace((0, 0, 50, 50), 0.99, e, 2500.0),
                DetectedFace((60, 0, 110, 50), 0.98, e, 2500.0),
            ]

    set_engine_override(TwoFaceEngine())
    try:
        r = client.post("/api/clients", json={"full_name": "Crowd", "image": make_image_b64()})
        assert r.status_code == 422
        assert "one person" in r.text.lower()
    finally:
        set_engine_override(None)


def test_delete_client(client):
    cid = client.post("/api/clients",
                      json={"full_name": "Temp", "image": make_image_b64()}).json()["id"]
    assert client.delete(f"/api/clients/{cid}").status_code == 204
    assert client.get(f"/api/clients/{cid}").status_code == 404
