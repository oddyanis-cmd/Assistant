# Katara Club — Digital Waiver System · Deployment Guide

A complete, self-contained system. Members scan a QR code at reception, fill and
sign the waiver on their phone, and every signed form is:

- **emailed to `Reception@katara.club`** with the signed PDF attached, and
- **saved into your Microsoft 365** (OneDrive or SharePoint), and
- kept as a local copy on the server (searchable dashboard).

It reproduces the exact look of the printed form (logo, bilingual layout,
Yes/No acknowledgements, signature). The form supports **English / Arabic /
bilingual** views.

---

## What you'll end up with

| Page | URL | Who uses it |
|------|-----|-------------|
| Reception poster (QR) | `https://your-domain/waiver/qr` | Print & place at the desk |
| The form | `https://your-domain/waiver` | Members (via the QR) |
| Submissions dashboard | `https://your-domain/waiver/admin` | Reception / management |
| System status | `https://your-domain/waiver/status` | IT — verify config |

---

## Recommended hosting

**The simplest reliable option: Docker on a small Linux VM** (1 vCPU / 1 GB RAM
is plenty). This runs anywhere — Azure, AWS, DigitalOcean, or an on-prem server —
and the included `docker-compose.yml` keeps it running and persists data.

> Since you're a Microsoft 365 shop, **Azure** is a natural home: an *Azure VM*
> (Ubuntu) with Docker, or *Azure App Service for Containers*. Either works; the
> steps below are for a Docker host and apply to all of them.

You'll also want a **public HTTPS URL** so members' phones can open the form.
Put the container behind a reverse proxy (Caddy/Nginx) or your cloud's HTTPS
load balancer, and point a DNS record like `waiver.katara.club` at it.

---

## Step 1 — Microsoft 365 setup (5 minutes, one-time)

This creates an app identity so the server can email reception **and** save PDFs
into your 365 without storing any mailbox passwords.

1. Go to **portal.azure.com → Microsoft Entra ID → App registrations → New
   registration**.
   - Name: `Katara Waiver System`
   - Supported account types: *Single tenant*
   - Click **Register**.
2. On the app's **Overview**, copy the **Application (client) ID** and
   **Directory (tenant) ID**.
3. **Certificates & secrets → New client secret** → copy the secret **Value**
   (you can't see it again later).
4. **API permissions → Add a permission → Microsoft Graph → Application
   permissions**, add:
   - `Mail.Send` — to email reception
   - `Files.ReadWrite.All` — to save to OneDrive
   - `Sites.ReadWrite.All` — only if you'll save to a SharePoint site
   Then click **Grant admin consent for <your org>** (a Global Admin does this).

> **Scoping the mailbox (optional, recommended by security teams):** `Mail.Send`
> as an application permission can send as any mailbox. To restrict it to only
> `Reception@katara.club`, apply an *Application Access Policy* in Exchange
> Online (`New-ApplicationAccessPolicy`). Ask IT security if this is required.

---

## Step 2 — Configure

```bash
cp .env.waiver.example .env
```

Edit `.env` and fill in:

```env
APP_BASE_URL=https://waiver.katara.club        # your public HTTPS URL
WAIVER_RECIPIENT_EMAIL=Reception@katara.club

# Protect the management pages (admin/status/PDF downloads) — REQUIRED before
# go-live, since those pages show members' personal data and signatures.
ADMIN_USER=reception
ADMIN_PASSWORD=<a strong password>

MS365_TENANT_ID=<Directory (tenant) ID>
MS365_CLIENT_ID=<Application (client) ID>
MS365_CLIENT_SECRET=<the secret Value>
MS365_SENDER=Reception@katara.club             # send & save from this mailbox/OneDrive

MS365_SEND_EMAIL=true
MS365_SAVE_TO_DRIVE=true
MS365_SAVE_FOLDER=Katara Club Waivers
# To save into a shared SharePoint library instead of OneDrive:
# MS365_SHAREPOINT_SITE=katara.sharepoint.com/sites/Reception
```

---

## Step 3 — Run

```bash
docker compose up -d --build
```

That's it. Check it's healthy:

```bash
curl http://localhost:8000/health
```

Open **`/waiver/status`** in a browser (it'll ask for the admin login) — the
Microsoft 365 rows should show **✅ Ready**. Click **"Send a test delivery →"**:
this fires the real email + cloud-save path and reports the result, so you can
confirm everything works **without** filling out a form. Then check:
- an email with the PDF arrived at `Reception@katara.club`, and
- a copy appeared in the **Katara Club Waivers** folder in OneDrive/SharePoint.

> **Security note:** the form at `/waiver` is public (members need it), but
> `/waiver/admin`, `/waiver/status`, and PDF downloads are gated by
> `ADMIN_PASSWORD`. The status page warns you in red if it's left unset.

---

## Step 4 — Put up the QR poster

Open **`/waiver/qr`**, print it, and place it at reception. Members scan it with
their phone camera to open and sign the form. (When you add more waivers, each
gets its own poster at `/waiver/qr?form=<id>`.)

---

## Running without Docker (alternative)

```bash
pip install -r requirements-waiver.txt
cp .env.waiver.example .env        # fill in values
uvicorn waiver_app:app --host 0.0.0.0 --port 8000
```

Use a process manager (systemd / supervisor) to keep it running, and a reverse
proxy for HTTPS.

---

## Data, backups & retention

- **Local copies:** `/data/waivers/*.pdf` inside the container (the
  `katara_data` Docker volume). Signed records are also in the SQLite database
  at `/data/assistant.db`.
- **Cloud copies:** every PDF is also in your Microsoft 365, so the cloud is
  your durable archive even if the server is rebuilt.
- Back up the `katara_data` volume if you want a server-side history too.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `/waiver/status` shows MS365 *Not configured* | Check the three `MS365_*` IDs/secret in `.env`, then `docker compose up -d`. |
| Email not arriving | Confirm **admin consent** was granted for `Mail.Send`; check the dashboard's *Emailed* column / container logs for the Graph error. |
| `ErrorAccessDenied` on save | Grant `Files.ReadWrite.All` (OneDrive) or `Sites.ReadWrite.All` (SharePoint) and re-consent. |
| QR opens but phone can't load it | `APP_BASE_URL` must be a public HTTPS address reachable from mobile data, not `localhost`. |
| Arabic looks wrong in the PDF | The font ships in `static/fonts/`; ensure that folder is included in the image (it is, by default). |

---

## Adding more waivers later

All form text lives in **`forms.py`**. To add a sauna/gym/pool waiver, append an
entry with its bilingual `title`, `subtitle`, `section`, `note`, and `clauses` —
no other code changes. It's instantly available at `/waiver?form=<id>` with its
own poster at `/waiver/qr?form=<id>`.
