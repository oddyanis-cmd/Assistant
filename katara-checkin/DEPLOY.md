# Deploy the kiosk to a free HTTPS link (for phone/tablet testing)

Goal: a public **https://** address you can open on any phone or tablet, allow the
camera, and test face check-in for real. We use **Hugging Face Spaces** because its
free tier has enough memory for the ArcFace model (16 GB RAM, no card required).

Because this repo is public, the Space needs **only one file** — a `Dockerfile`
that pulls the app and runs it. You don't download or upload any code.

---

## Steps (about 10 minutes, most of it waiting for the build)

1. Go to **https://huggingface.co/join** and create a free account (skip if you have one).
2. Go to **https://huggingface.co/new-space** (or click your avatar → *New Space*).
3. Fill in:
   - **Owner**: you · **Space name**: `katara-checkin` (anything)
   - **License**: any (e.g. MIT)
   - **Select the Space SDK**: **Docker** → **Blank**
   - **Hardware**: *CPU basic · free*
   - **Visibility**: Public *(a public Space gives a link anyone can open; see the security note below)*
4. Click **Create Space**. You'll land on an almost-empty Space.
5. Open the **Files** tab → **+ Add file** → **Create a new file**.
6. **Filename:** `Dockerfile`  · paste the block below as the contents → **Commit new file to main**.
7. The Space switches to **Building** (watch the logs). First build pulls the model
   and takes ~8–10 minutes. When the top badge turns to **Running**, open the Space
   URL — on your phone, allow camera access, then **Enroll** your face and **Check-In**.

> The link looks like `https://<your-name>-katara-checkin.hf.space`. Share it with
> staff devices for a multi-tablet trial.

---

## The one file to paste (`Dockerfile`)

```dockerfile
FROM python:3.11-slim

# System libraries needed by OpenCV / onnxruntime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git libglib2.0-0 libgl1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run as a non-root user (uid 1000).
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONPATH=/home/user/app
WORKDIR /home/user/app

# Pull the standalone check-in module from the public repo.
RUN git clone --depth 1 --branch claude/peaceful-meitner-51gq83 \
        https://github.com/oddyanis-cmd/Assistant.git /tmp/repo \
    && cp -r /tmp/repo/katara-checkin/. . \
    && rm -rf /tmp/repo

RUN pip install --no-cache-dir --user -r requirements.txt -r requirements-face.txt

# Pre-download the ArcFace model (~280 MB) so the first scan is instant.
RUN python -c "from insightface.app import FaceAnalysis; a=FaceAnalysis(name='buffalo_l', allowed_modules=['detection','recognition']); a.prepare(ctx_id=-1, det_size=(640,640))"

# Frictionless first demo. Set to "true" (Space → Settings → Variables) to test anti-spoofing.
ENV KATARA_REQUIRE_LIVENESS=false
EXPOSE 7860
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
```

---

## Good to know

- **Test anti-spoofing:** in the Space, go to **Settings → Variables and secrets →
  New variable**, add `KATARA_REQUIRE_LIVENESS` = `true`, and restart. Now a held-up
  photo should be refused while your live (slightly moving) face is accepted.
- **Tune strictness:** add `KATARA_ACCEPT_THRESHOLD` (e.g. `0.5`) the same way.
- **Data is not persistent on the free tier.** Enrolled faces and the check-in log
  reset when the Space rebuilds or sleeps. That's fine for testing. For a real
  pilot, attach persistent storage or point it at a database.
- **Security / privacy:** a public Space is reachable by anyone with the link. **Use
  only test faces — do not enroll real members' biometric data on the public demo.**
  Ask me to add a password gate (and persistent, encrypted storage) before any real
  pilot, and review consent under Qatar's PDPPL. See the production checklist in
  `README.md`.
- **If you later merge this branch**, update the `--branch` line in the Dockerfile to
  match (e.g. `main`), then *Factory reboot* the Space to rebuild.

---

## Alternative: run it with Docker anywhere (your own server / laptop)

```bash
git clone -b claude/peaceful-meitner-51gq83 https://github.com/oddyanis-cmd/Assistant.git
cd Assistant/katara-checkin
docker build -t katara-checkin .
docker run -p 8000:8000 katara-checkin
# open http://localhost:8000
```
