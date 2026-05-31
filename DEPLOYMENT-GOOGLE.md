# Katara Club Waiver System — Google Drive + Cloud Run

This is the **no-server-to-manage** setup: Google Cloud Run hosts the app
(scales to zero, ~free at a club's volume), every signed PDF is saved to a
**Google Drive** folder, and reception is emailed via **Gmail**. You keep the
exact branded bilingual form, signature, and PDF.

---

## Part 1 — Google setup (one-time, ~10 min)

### 1. Project + APIs
1. Go to **console.cloud.google.com**, create a project (e.g. `katara-waiver`).
2. **APIs & Services → Enable APIs** → enable **Google Drive API** and
   **Gmail API**.

### 2. Service account + key
1. **IAM & Admin → Service accounts → Create service account**
   (e.g. `waiver-bot`).
2. Open it → **Keys → Add key → Create new key → JSON**. Download the JSON file
   and keep it safe — this is the app's credential.
3. Copy the service account's **email** (looks like
   `waiver-bot@katara-waiver.iam.gserviceaccount.com`).

### 3. A Drive folder the app can write to  ← important
Service accounts have **no personal Drive storage**, so use a **Shared Drive**:
1. In Google Drive, create a **Shared Drive** (e.g. "Katara Waivers").
2. **Add the service account email** as a member with **Content manager**.
3. Open the target folder and copy its **folder ID** from the URL
   (`https://drive.google.com/drive/folders/THIS_IS_THE_ID`).

### 4. (For email) let the app send as reception
Gmail sending needs the service account to act as a Workspace user:
1. On the service account, note its **Client ID** (Details → Unique ID).
2. **Workspace Admin console** (admin.google.com) → **Security → Access and data
   control → API controls → Domain-wide delegation → Add new**.
3. Client ID = the service account's Client ID; OAuth scope =
   `https://www.googleapis.com/auth/gmail.send`. Save.
4. Set `GOOGLE_DELEGATED_SENDER=Reception@katara.club`.

> Skipping step 4 is fine — Drive saving still works and you can email via SMTP
> instead. But with it, one service account does both Drive + Gmail.

---

## Part 2 — Configure

Set these as environment variables (and as Cloud Run variables/secrets below):

```env
APP_BASE_URL=https://<your-cloud-run-url>     # filled in after first deploy
WAIVER_RECIPIENT_EMAIL=Reception@katara.club
ADMIN_USER=reception
ADMIN_PASSWORD=<a strong password>

# Google
GOOGLE_DRIVE_FOLDER_ID=<the Shared Drive folder ID>
GOOGLE_DELEGATED_SENDER=Reception@katara.club
GOOGLE_SAVE_TO_DRIVE=true
GOOGLE_SEND_EMAIL=true
# The service-account key — inline JSON is easiest on Cloud Run (see below).
GOOGLE_SERVICE_ACCOUNT_JSON=<paste the whole JSON key on one line>
```

---

## Part 3 — Deploy to Cloud Run (no server to manage)

From the project folder (with `gcloud` installed and `gcloud init` done):

```bash
# Store the service-account key as a secret (recommended)
gcloud secrets create waiver-sa-key --data-file=path/to/key.json

gcloud run deploy katara-waiver \
  --source . \
  --region me-central1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --set-env-vars "WAIVER_RECIPIENT_EMAIL=Reception@katara.club,GOOGLE_DRIVE_FOLDER_ID=<folder-id>,GOOGLE_DELEGATED_SENDER=Reception@katara.club,ADMIN_USER=reception,ADMIN_PASSWORD=<strong-pass>" \
  --set-secrets "GOOGLE_SERVICE_ACCOUNT_JSON=waiver-sa-key:latest"
```

`--source .` builds the container from `Dockerfile.waiver` automatically. When it
finishes it prints a URL like `https://katara-waiver-xxxx.run.app`.

Finally set `APP_BASE_URL` to that URL so the QR codes point to it:

```bash
gcloud run services update katara-waiver --region me-central1 \
  --update-env-vars APP_BASE_URL=https://katara-waiver-xxxx.run.app
```

(Optional: map a custom domain like `waiver.katara.club` in Cloud Run → Manage
custom domains.)

---

## Part 4 — Verify & go live

1. Open `https://<your-url>/waiver/status` (log in with the admin password).
   The **Google Drive archive** and **Gmail email** rows should show ✅ Ready.
2. Click **"Send a test delivery"** — confirm a PDF appears in the Shared Drive
   folder and an email reaches `Reception@katara.club`.
3. Open `https://<your-url>/waiver/forms`, print the QR posters, place them at
   reception. Done.

---

## Honest note on data persistence (please read)

Cloud Run instances are **ephemeral** — local disk does not survive restarts.
That's fine because:

- **Every signed PDF is stored in Google Drive** (durable) and emailed — that's
  your real archive.
- The local SQLite database that powers the `/waiver/admin` *dashboard list* is
  **not** persistent on Cloud Run. You won't lose any waivers (they're in Drive
  + email), but the on-screen "submitted list" may reset when the instance
  recycles.

If you want a persistent searchable dashboard too, either:
- run on a small VM instead (see `DEPLOYMENT.md`, same app, Drive storage still
  works), or
- attach a managed database (Cloud SQL) — ask and I'll wire it up.

For most clubs, **Google Drive + email is the system of record** and this is a
non-issue.
