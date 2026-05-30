# Katara Club — Digital Waiver & Consent Form

A QR-driven, bilingual (English / Arabic) digital version of the **K11 Air Select
Machine User Waiver & Consent Form**. Members scan a QR code at reception, fill
and sign the form on their phone, and the signed copy is automatically turned
into a PDF, stored, and emailed to reception.

It reproduces the exact look of the printed form — the Katara Club rose‑gold
logo, the bilingual two‑column layout, the Yes/No acknowledgements, and a
signature.

## How it works

```
   ┌──────────────┐    scan     ┌────────────────────┐   submit    ┌──────────────────────┐
   │  QR at desk  │ ──────────▶ │  Phone web form    │ ──────────▶ │  Backend (FastAPI)   │
   │ /waiver/qr   │             │  /waiver           │   JSON      │  POST /api/waiver    │
   └──────────────┘             └────────────────────┘             └──────────┬───────────┘
                                                                              │
                                              ┌───────────────────────────────┼───────────────────────────────┐
                                              ▼                               ▼                               ▼
                                     Signed PDF generated          Stored: DB row +            Emailed to Reception@Katara.club
                                     (mirrors original design)     waiver_storage/*.pdf        (Gmail OAuth or SMTP, PDF attached)
```

## Endpoints

| Method & path             | Purpose                                                        |
|---------------------------|----------------------------------------------------------------|
| `GET /waiver`             | The bilingual web form (mobile‑first, with signature pad).     |
| `POST /api/waiver`        | Accepts the signed submission, generates the PDF, stores, emails. |
| `GET /api/forms`          | List available waiver forms (id + bilingual title).            |
| `GET /api/forms/{id}`     | A single form definition (titles, clauses) the web form renders. |
| `GET /waiver/qr`          | Printable **"Scan to Sign"** reception poster.                 |
| `GET /waiver/qr.png`      | The QR image (points to `APP_BASE_URL/waiver`).                |
| `GET /waiver/admin`       | Dashboard listing every submitted waiver + PDF links.          |
| `GET /waiver/pdf/{ref}`   | Download a stored signed PDF.                                  |

## Language toggle

The form opens in **bilingual (EN / عربي)** mode by default. A toggle at the top
lets the member switch to **English‑only** or **العربية‑only** — the Arabic view
flips the whole layout to right‑to‑left. The signed PDF always keeps the full
bilingual record regardless of the on‑screen choice.

## Multiple waiver types

All form content lives in **`forms.py`** as a single source of truth, read by both
the web form and the PDF generator. To add another waiver (sauna, gym, pool, spa…):

1. Append an entry to `FORMS` in `forms.py` with its `title`, `subtitle`,
   `section`, `note`, and `clauses` (each bilingual).
2. Link to it with `…/waiver?form=YOUR_ID`, and print its poster at
   `…/waiver/qr?form=YOUR_ID`.

No HTML or PDF code changes are needed.

> **Deploying this for your company?** See **[DEPLOYMENT.md](DEPLOYMENT.md)** for
> a step-by-step guide (Microsoft 365 setup + Docker). The waiver system can run
> **standalone** via `waiver_app.py` — no AI-assistant parts required.

## Storage & delivery

Every submission produces three records:

1. **PDF on disk** — `waiver_storage/Katara_Waiver_<ref>.pdf`.
2. **Database row** — `waiver_submissions` table (name, phone, answers,
   reference, email + cloud status, PDF path).
3. **Email + cloud archive** — the signed PDF is sent to
   `WAIVER_RECIPIENT_EMAIL` (default `Reception@katara.club`) **and** saved into
   your Microsoft 365.

Delivery preference, handled automatically:

1. **Microsoft 365 (Graph API)** — *recommended.* One Azure app registration
   both emails reception (`Mail.Send`) and saves a copy into OneDrive/SharePoint
   (`Files.ReadWrite.All` / `Sites.ReadWrite.All`). Works with modern auth, so it
   keeps working even when legacy SMTP AUTH is disabled on the tenant.
2. **Gmail OAuth** — if the assistant's Gmail is connected.
3. **SMTP** — if `SMTP_HOST` is set.

If none are configured, the PDF is still stored on disk and the dashboard flags
delivery as pending. Check **`/waiver/status`** to confirm what's wired up.

## Configuration (`.env`)

```env
APP_BASE_URL=https://your-domain.com        # used to build the QR target
WAIVER_RECIPIENT_EMAIL=Reception@Katara.club
WAIVER_STORAGE_DIR=./waiver_storage          # or a mounted cloud folder

# Optional SMTP fallback (only needed if Gmail OAuth is not connected)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email
SMTP_PASSWORD=app-password
SMTP_FROM=Katara Club <noreply@katara.club>
```

To use Gmail delivery, connect the inbox once at `/auth/gmail` (already part of
the app).

## Running locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload
# Reception poster:  http://localhost:8000/waiver/qr
# The form:          http://localhost:8000/waiver
# Submissions:       http://localhost:8000/waiver/admin
```

## Notes

- The Arabic text in the PDF is shaped/ordered with `arabic-reshaper` +
  `python-bidi` and rendered with **Noto Naskh Arabic**. If that font is not
  present on the host, the PDF gracefully falls back to the English layout.
- The brand logo lives at `static/katara-logo.png` and is extracted from the
  original form; replace it with an official asset any time.
- Signatures are captured on an HTML canvas and embedded as a PNG inside the PDF.
