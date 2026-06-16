# Katara Club — Face Check-In Module

A **standalone, testable** face-recognition check-in system for the Katara Club
reception tablet. A member stands at the desk, the tablet camera scans their face,
the system recognises them and checks them in — the same outcome as your current
QR-code flow, but with nothing to take out of their pocket.

> This project is **completely independent**. It has its own database, its own
> dependencies and its own configuration, and shares no code with anything else.

---

## 1. Is this feasible? (Honest answer)

**Yes — and it's a well-trodden path.** This module already does it end-to-end with
a state-of-the-art open model (InsightFace / ArcFace). On two different real photos
of the same person it scores **0.78 similarity**; on two different people it scores
**≈ −0.04**. That is a huge, safe separation.

**But "zero mistakes" deserves a straight answer:** no biometric system on earth is
literally 100% perfect — lighting, camera angle, ageing, heavy beards/sunglasses,
identical twins, and spoofing attempts all introduce risk. Anyone who promises
"zero errors" is overselling. What a *professional* system does instead is make the
**costly** error — checking in the **wrong** person — vanishingly rare, and treat a
**harmless** error — "sorry, not recognised, please use your QR code" — as the safe
fallback. This module is deliberately engineered that way:

| Risk | How this module handles it |
|------|----------------------------|
| Wrong person checked in (false accept) | Strict similarity **threshold** + a **margin rule** (the top match must clearly beat the runner-up) → it refuses to guess. |
| Photo / phone-screen spoof | **Liveness check** over a multi-frame burst (motion + identity consistency). Pluggable for a certified anti-spoofing model. |
| Member not recognised (false reject) | Falls back to your **existing QR / manual** check-in. No one is ever stuck. |
| Look-alikes / siblings | Margin rule rejects ambiguous matches rather than picking one. |
| Two people in frame at enrollment | Enrollment **refuses** multi-face frames so a profile is never bound to the wrong face. |

So: **feasible and reliable, with an honest fail-safe** — not magic.

---

## 2. What's in the box

```
katara-checkin/
├── app/
│   ├── main.py               FastAPI app (API + serves the tablet UI)
│   ├── config.py             All tunables (env-driven, KATARA_* prefix)
│   ├── models.py             Client, FaceTemplate, CheckIn  (SQLite)
│   ├── face/
│   │   ├── engine.py         Face engine abstraction + InsightFace (ArcFace) impl
│   │   ├── matcher.py        The decision core: threshold + margin (fully unit-tested)
│   │   ├── liveness.py       Anti-spoofing (multi-frame heuristic, pluggable)
│   │   └── imaging.py        Image decoding (OpenCV/Pillow)
│   ├── services/             enrollment, checkin orchestration, CRM webhook
│   ├── routers/              /api/clients, /api/checkin
│   └── web/                  The tablet UI (camera capture, kiosk + enroll + admin)
├── scripts/
│   ├── verify_engine.py      Prove the REAL engine on real photos (similarity matrix)
│   ├── calibrate.py          Pick the best threshold from your own labelled photos
│   └── demo_http.py          Full enroll→recognise demo over the API
├── tests/                    pytest suite (runs without the 300 MB model)
├── requirements*.txt         core / face-ML / dev dependency sets
└── .env.example
```

**The recognition model:** [InsightFace](https://github.com/deepinsight/insightface)
`buffalo_l` — an **ArcFace** embedding network (512-d) with an SCRFD face detector.
It's one of the most accurate openly available stacks (>99.8% on the LFW benchmark)
and runs on CPU. No cloud, no per-scan fees, your members' data stays on your server.

---

## 3. Quick start

```bash
cd katara-checkin
python -m venv .venv && source .venv/bin/activate

# Core app + the face-recognition stack:
pip install -r requirements.txt -r requirements-face.txt

# Run it (the buffalo_l model ~280 MB auto-downloads on first start):
./run.sh                      # or: uvicorn app.main:app --port 8000 --reload
```

Open **http://localhost:8000** on the tablet (or your laptop) and allow camera
access. Interactive API docs are at **http://localhost:8000/docs**.

> **Camera + HTTPS:** browsers only allow the camera on `https://` or `localhost`.
> On a real tablet, serve the app over HTTPS (a reverse proxy with a TLS cert, or
> your existing app's domain).

### The UI has three tabs
1. **🟢 Check-In Kiosk** — what the member sees. Tap *Scan my face* → recognised &
   checked in, or politely asked to use their QR code.
2. **➕ Enroll Client** — reception captures a member's face and links it to their
   profile (name, membership no, CRM id). Add several shots for best accuracy.
3. **📋 Clients & Log** — enrolled members and a live check-in log.

---

## 4. How to test it (the part you asked for)

There are **four** independent ways to test, from "no setup" to "full live":

### a) Automated test suite — no model needed
Uses a deterministic fake engine, so it runs anywhere in seconds.
```bash
pip install -r requirements.txt -r requirements-dev.txt
PYTHONPATH=. pytest -q
```
Covers: the accept/threshold/margin decision logic, enroll→check-in over HTTP,
multi-face rejection, and the liveness gate (static photo rejected, moving subject
accepted, mid-burst identity swap rejected).

### b) Prove the REAL engine on real photos
```bash
python scripts/get_samples.py                       # fetch a few public test faces
PYTHONPATH=. python scripts/verify_engine.py        # uses sample_faces/
```
Prints a similarity matrix + SAME/DIFFERENT verdicts. Example actual output:
```
                       biden.jpg   obama.jpg  obama2.jpg
biden.jpg                  1.000      -0.043      -0.019
obama.jpg                 -0.043       1.000       0.777     <- same person, 2 photos
obama2.jpg                -0.019       0.777       1.000
separation gap (min genuine - max impostor): 0.796 ✅ healthy
```

### c) Full enroll→recognise demo over the API
```bash
PYTHONPATH=. python scripts/demo_http.py
# 1) enrolls one photo  2) same person (different photo) -> checked_in (sim 0.777)
#                       3) different person -> no_match
```

### d) Live, with your own face
Run the server (section 3), open the tablet UI, **Enroll** yourself, then switch to
the **Kiosk** tab and scan. Try to fool it with a photo on your phone — the liveness
check should refuse it.

---

## 5. Tuning for "as close to zero mistakes as possible"

All knobs are environment variables (see `.env.example`). The two that matter most:

| Variable | Default | Meaning |
|----------|---------|---------|
| `KATARA_ACCEPT_THRESHOLD` | `0.45` | Minimum cosine similarity to accept. **Higher = stricter** (fewer wrong check-ins, more "please use QR"). |
| `KATARA_DECISION_MARGIN` | `0.10` | The match must beat the runner-up by this much, else it's rejected as ambiguous. |
| `KATARA_REQUIRE_LIVENESS` | `true` | Require the anti-spoofing burst check. |
| `KATARA_MIN_DET_SCORE` | `0.55` | Minimum face-detector confidence to consider a frame. |

**Calibrate to YOUR camera and lighting** — don't guess. Collect a few photos of a
handful of staff (2+ each), one folder per person, then:
```bash
PYTHONPATH=. python scripts/calibrate.py dataset/
```
It reports the genuine vs impostor score distributions and suggests a
**zero-false-accept** threshold for access control. Put that in `.env`.

> Rule of thumb for a club: tune for **zero false accepts**. It is always better to
> occasionally ask a member for their QR code than to ever check in the wrong person.

---

## 6. Connecting it to your CRM

Your tablets already push QR check-ins to your CRM. Face check-in does the same:
when a member is recognised it `POST`s to your webhook.

```bash
KATARA_CRM_WEBHOOK_URL=https://your-crm.example.com/hooks/checkin
KATARA_CRM_API_KEY=•••••           # sent as: Authorization: Bearer <key>
```
Payload:
```json
{
  "event": "member.checkin", "source": "face_kiosk",
  "crm_id": "CRM-123", "membership_no": "KC-10482", "client_name": "Aisha Al Thani",
  "similarity": 0.83, "liveness_passed": true,
  "checked_in_at": "2026-06-16T14:18:40Z", "local_checkin_id": 42
}
```
Leave `KATARA_CRM_WEBHOOK_URL` blank to run in **local test mode** — check-ins are
stored locally only, so you can trial everything before wiring production. A CRM
outage never crashes the kiosk; the local record is the source of truth and the
`crm_synced` flag lets you re-sync later.

To embed this as a *feature inside your existing Katara Club app* rather than a
standalone page, call the same two endpoints from your app:
`POST /api/clients` (enroll) and `POST /api/checkin` (recognise). The web UI here is
a reference client you can reskin or replace.

---

## 7. Going to production (hardening checklist)

This is a solid, working module. Before it guards your real door, do these:

- [ ] **Liveness:** the built-in check is a *heuristic*. For true anti-spoofing,
      plug in a trained passive PAD model (e.g. MiniFASNet / Silent-Face) or use a
      depth/IR-capable tablet — the `liveness.evaluate()` interface stays the same.
- [ ] **Calibrate thresholds** on-site with `scripts/calibrate.py` (section 5).
- [ ] **HTTPS** for the kiosk (camera requires it; biometrics must be encrypted in transit).
- [ ] **Encrypt embeddings at rest** and lock down DB access. Face vectors are
      biometric personal data.
- [ ] **Consent & privacy (Qatar PDPPL / GDPR-style):** get explicit opt-in at
      enrollment, store a consent record, offer QR as the non-biometric alternative,
      and support deletion (the `DELETE /api/clients/{id}` endpoint wipes a member's
      face data). Keep a retention policy.
- [ ] **Scale:** the current in-memory match is fine for thousands of members. For
      tens of thousands, swap `embedding_store.load_templates()` for a vector index
      (FAISS / pgvector) — nothing else changes.
- [ ] **Multiple enrollment shots** per member (front + slight angles) for robustness.
- [ ] **Move off SQLite** to Postgres for a multi-tablet deployment.
- [ ] **Rate-limit & audit** the enroll endpoints (admin-only).

---

## 8. API reference (essentials)

| Method & path | Purpose |
|---------------|---------|
| `POST /api/clients` | Enroll a new member from one face image |
| `GET  /api/clients` | List members |
| `POST /api/clients/{id}/faces` | Add another face shot to a member |
| `DELETE /api/clients/{id}` | Delete a member + their biometric data |
| `POST /api/checkin` | Recognise a member from a frame burst & check in |
| `GET  /api/checkins` | Recent check-in log |
| `GET  /health` | Engine status + active thresholds |

Images are sent as base64 / `data:` URLs in JSON. Full schema at `/docs`.
