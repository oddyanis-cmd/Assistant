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

| Method & path           | Purpose                                                        |
|-------------------------|----------------------------------------------------------------|
| `GET /waiver`           | The bilingual web form (mobile‑first, with signature pad).     |
| `POST /api/waiver`      | Accepts the signed submission, generates the PDF, stores, emails. |
| `GET /waiver/qr`        | Printable **"Scan to Sign"** reception poster.                 |
| `GET /waiver/qr.png`    | The QR image (points to `APP_BASE_URL/waiver`).                |
| `GET /waiver/admin`     | Dashboard listing every submitted waiver + PDF links.          |
| `GET /waiver/pdf/{ref}` | Download a stored signed PDF.                                  |

## Storage & delivery

Every submission produces three records:

1. **PDF on disk** — `waiver_storage/Katara_Waiver_<ref>.pdf`. Point
   `WAIVER_STORAGE_DIR` at a mounted cloud volume (S3/GCS fuse mount, Google
   Drive sync folder, etc.) to push copies to the cloud automatically.
2. **Database row** — `waiver_submissions` table (name, phone, answers,
   reference, email status, PDF path).
3. **Email** — the signed PDF is attached and sent to `WAIVER_RECIPIENT_EMAIL`
   (default `Reception@Katara.club`). Delivery uses the app's existing **Gmail
   OAuth** connection if available; otherwise it falls back to **SMTP** if
   `SMTP_HOST` is configured. If neither is set, the PDF is still stored on disk
   and the dashboard flags the email as pending.

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
