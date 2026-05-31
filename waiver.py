"""
Digital Waiver & Consent form for Katara Club.

Members scan a QR code at reception, fill and sign the form on their phone, and
on submission the backend:
  1. renders a signed PDF that mirrors the original Katara Club design,
  2. stores it (DB row + PDF file on disk / mounted cloud volume),
  3. emails the signed PDF to the reception inbox.

Endpoints (mounted in main.py):
  GET  /waiver           — the bilingual web form (served from static/waiver.html)
  POST /api/waiver       — accept a signed submission (JSON)
  GET  /waiver/qr        — printable reception page with the QR code
  GET  /waiver/qr.png    — the QR code image
  GET  /waiver/admin     — list of submitted waivers (+ links to PDFs)
  GET  /waiver/pdf/{ref} — download a stored signed PDF
"""
import base64
import io
import logging
import os
import smtplib
from datetime import datetime
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import secrets

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from config import settings
from database.db import SessionLocal
from database.models import WaiverSubmission
from forms import DEFAULT_FORM_ID, FORMS, get_form

logger = logging.getLogger(__name__)
router = APIRouter()

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
LOGO_PATH = os.path.join(STATIC_DIR, "katara-logo.png")

# Brand palette (matches the original form)
ROSE = (0.627, 0.431, 0.392)        # #a06e64
ROSE_DARK = (0.541, 0.353, 0.314)   # #8a5a50
LINE = (0.890, 0.824, 0.800)        # #e3d2cc
INK = (0.290, 0.290, 0.290)
OK = (0.247, 0.561, 0.435)
NO_COL = (0.761, 0.380, 0.310)

def _font(name: str) -> str:
    """Prefer the font bundled with the app; fall back to a system path."""
    bundled = os.path.join(STATIC_DIR, "fonts", name)
    if os.path.exists(bundled):
        return bundled
    return os.path.join("/usr/share/fonts/truetype/noto", name)


ARABIC_FONT_PATH = _font("NotoNaskhArabic-Regular.ttf")
ARABIC_FONT_BOLD = _font("NotoNaskhArabic-Bold.ttf")


_basic = HTTPBasic(auto_error=False)


def require_admin(credentials: HTTPBasicCredentials = Depends(_basic)):
    """
    Protect the management pages with HTTP Basic auth.

    If ADMIN_PASSWORD is not set, the pages stay open (handy for a quick demo);
    once it's set, /waiver/admin, /waiver/status, /waiver/pdf and /waiver/selftest
    require the configured user + password. The member-facing form is never gated.
    """
    if not settings.admin_password:
        return  # protection disabled
    ok = (
        credentials is not None
        and secrets.compare_digest(credentials.username, settings.admin_user)
        and secrets.compare_digest(credentials.password, settings.admin_password)
    )
    if not ok:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Basic"},
        )


def _ensure_storage() -> str:
    path = settings.waiver_storage_dir
    os.makedirs(path, exist_ok=True)
    return path


def _reference() -> str:
    return "KC-" + datetime.utcnow().strftime("%Y%m%d-%H%M%S")


# ── Arabic shaping ──────────────────────────────────────────────────────────────

def _shape_ar(text: str) -> str:
    """Reshape + reorder Arabic text for correct visual rendering in the PDF."""
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(text))
    except Exception:
        return text


# ── PDF generation ──────────────────────────────────────────────────────────────

def build_pdf(submission: dict, reference: str) -> bytes:
    """Render a signed PDF that mirrors the original Katara Club waiver design."""
    form_def = get_form(submission.get("form_id"))
    clauses = [(c["en"], c["ar"]) for c in form_def["clauses"]]
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas as pdfcanvas
    from reportlab.lib.utils import ImageReader

    # Register fonts
    base_font, bold_font = "Helvetica", "Helvetica-Bold"
    ar_font = None
    try:
        if os.path.exists(ARABIC_FONT_PATH):
            pdfmetrics.registerFont(TTFont("NotoAr", ARABIC_FONT_PATH))
            ar_font = "NotoAr"
        if os.path.exists(ARABIC_FONT_BOLD):
            pdfmetrics.registerFont(TTFont("NotoArB", ARABIC_FONT_BOLD))
    except Exception as e:  # pragma: no cover
        logger.warning("Arabic font registration failed: %s", e)

    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    W, H = A4
    L, R = 18 * mm, W - 18 * mm
    y = H - 16 * mm

    def ar(text):
        return _shape_ar(text)

    def draw_ar_right(text, x_right, yy, size=8.2, color=INK, font=None):
        if not ar_font:
            return
        c.setFont(font or "NotoAr", size)
        c.setFillColorRGB(*color)
        c.drawRightString(x_right, yy, ar(text))

    # ── Header: logo ──
    try:
        logo = ImageReader(LOGO_PATH)
        iw, ih = logo.getSize()
        disp_w = 58 * mm
        disp_h = disp_w * ih / iw
        c.drawImage(logo, (W - disp_w) / 2, y - disp_h, disp_w, disp_h,
                    mask="auto", preserveAspectRatio=True)
        y -= disp_h + 6 * mm
    except Exception as e:
        logger.warning("logo draw failed: %s", e)
        y -= 10 * mm

    c.setStrokeColorRGB(*LINE)
    c.setLineWidth(1.2)
    c.line(L, y, R, y)
    y -= 7 * mm

    # ── Title bar ──
    c.setFont(bold_font, 11.5)
    c.setFillColorRGB(*ROSE)
    c.drawString(L, y, form_def["title"]["en"])
    draw_ar_right(form_def["title"]["ar"], R, y, size=11, color=ROSE, font="NotoArB" if ar_font else None)
    y -= 5.5 * mm
    c.setFont(base_font, 7.6)
    c.setFillColorRGB(*ROSE_DARK)
    c.drawString(L, y, form_def["subtitle"]["en"])
    draw_ar_right(form_def["subtitle"]["ar"], R, y, size=7.6, color=ROSE_DARK)
    y -= 7 * mm

    c.setFont(bold_font, 10.5)
    c.setFillColorRGB(*ROSE)
    c.drawCentredString(W / 2, y, form_def["section"]["en"] + "  /  " + (ar(form_def["section"]["ar"]) if ar_font else ""))
    y -= 7 * mm

    # ── Clauses ──
    answers = submission.get("answers", {}) or {}

    def wrap(text, font, size, max_w):
        words = text.split()
        lines, cur = [], ""
        for w in words:
            t = (cur + " " + w).strip()
            if pdfmetrics.stringWidth(t, font, size) <= max_w:
                cur = t
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    en_w = 86 * mm
    ans_x = L + en_w + 8 * mm
    ar_x_right = R
    ar_w = 70 * mm

    for i, (en, ar_txt) in enumerate(clauses):
        a = (answers.get(str(i)) or answers.get(i) or {})
        ans = (a.get("answer") or "").lower()

        en_lines = wrap(en, base_font, 8, en_w)
        # Arabic wrapping (rough, by character width)
        ar_lines = _wrap_ar(ar_txt, ar_font, 8.4, ar_w) if ar_font else [""]
        rows = max(len(en_lines), len(ar_lines))
        block_h = rows * 4.2 * mm + 3 * mm

        if y - block_h < 30 * mm:
            c.showPage()
            y = H - 20 * mm

        top = y
        # English
        c.setFont(base_font, 8)
        c.setFillColorRGB(*INK)
        ly = top
        for ln in en_lines:
            c.drawString(L, ly, ln)
            ly -= 4.2 * mm
        # Arabic
        if ar_font:
            ay = top
            for ln in ar_lines:
                c.setFont("NotoAr", 8.4)
                c.setFillColorRGB(*INK)
                c.drawRightString(ar_x_right, ay, ln)
                ay -= 4.2 * mm

        # Answer chip
        mid = top - (rows - 1) * 2.1 * mm
        _chip(c, ans_x, mid, "YES", ans == "yes", OK)
        _chip(c, ans_x + 19 * mm, mid, "NO", ans == "no", NO_COL)

        y = top - block_h
        c.setStrokeColorRGB(*LINE)
        c.setLineWidth(0.5)
        c.line(L, y + 1.5 * mm, R, y + 1.5 * mm)

    y -= 2 * mm
    # Reserve-the-right note
    c.setFillColorRGB(0.969, 0.937, 0.925)
    c.rect(L, y - 9 * mm, R - L, 9 * mm, fill=1, stroke=0)
    c.setFont(base_font, 6.6)
    c.setFillColorRGB(*ROSE_DARK)
    c.drawString(L + 3 * mm, y - 5.5 * mm, form_def["note"]["en"])
    if ar_font:
        draw_ar_right(form_def["note"]["ar"], R - 3 * mm, y - 5.5 * mm, size=6.8, color=ROSE_DARK)
    y -= 16 * mm

    # ── Member details ──
    def field(label, ar_label, value, x, yy, w):
        c.setFont(bold_font, 8)
        c.setFillColorRGB(*ROSE_DARK)
        c.drawString(x, yy, label)
        if ar_font:
            c.setFont("NotoAr", 8)
            c.setFillColorRGB(*ROSE)
            c.drawRightString(x + w, yy, ar(ar_label))
        c.setFont(base_font, 9.5)
        c.setFillColorRGB(*INK)
        c.drawString(x, yy - 5 * mm, value or "—")
        c.setStrokeColorRGB(*LINE)
        c.setLineWidth(0.7)
        c.line(x, yy - 6.5 * mm, x + w, yy - 6.5 * mm)

    col_w = (R - L - 8 * mm) / 2
    field("Full Name", "الاسم الكامل", submission.get("full_name", ""), L, y, R - L)
    y -= 12 * mm
    field("Phone", "الهاتف", submission.get("phone", ""), L, y, col_w)
    field("Date", "التاريخ", submission.get("date", ""), L + col_w + 8 * mm, y, col_w)
    y -= 12 * mm
    field("Membership / ID", "رقم العضوية", submission.get("membership_id", ""), L, y, col_w)
    field("Staff Name", "اسم الموظف", submission.get("staff_name", ""), L + col_w + 8 * mm, y, col_w)
    y -= 14 * mm

    # ── Signature ──
    c.setFont(bold_font, 8)
    c.setFillColorRGB(*ROSE_DARK)
    c.drawString(L, y, "Member Signature")
    if ar_font:
        c.setFont("NotoAr", 8)
        c.setFillColorRGB(*ROSE)
        c.drawRightString(L + col_w, y, ar("توقيع العضو"))
    sig_b64 = submission.get("signature", "")
    if sig_b64 and "," in sig_b64:
        try:
            raw = base64.b64decode(sig_b64.split(",", 1)[1])
            sig_img = ImageReader(io.BytesIO(raw))
            c.drawImage(sig_img, L, y - 24 * mm, col_w, 22 * mm,
                        mask="auto", preserveAspectRatio=True, anchor="sw")
        except Exception as e:
            logger.warning("signature draw failed: %s", e)
    c.setStrokeColorRGB(*LINE)
    c.line(L, y - 25 * mm, L + col_w, y - 25 * mm)

    # Stamp / reference
    c.setFont(base_font, 7)
    c.setFillColorRGB(*ROSE)
    c.drawString(L + col_w + 8 * mm, y - 18 * mm,
                 f"Digitally signed & verified")
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.drawString(L + col_w + 8 * mm, y - 22 * mm, f"Reference: {reference}")
    c.drawString(L + col_w + 8 * mm, y - 26 * mm,
                 "Timestamp (UTC): " + submission.get("submitted_at", datetime.utcnow().isoformat()))

    c.setFont(base_font, 6.5)
    c.setFillColorRGB(0.72, 0.66, 0.64)
    c.drawCentredString(W / 2, 10 * mm,
                        "This document was completed and signed electronically via the Katara Club digital waiver system.")

    c.showPage()
    c.save()
    return buf.getvalue()


def _wrap_ar(text, font, size, max_w):
    from reportlab.pdfbase import pdfmetrics
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        shaped = _shape_ar(t)
        try:
            width = pdfmetrics.stringWidth(shaped, font, size)
        except Exception:
            width = len(t) * size * 0.5
        if width <= max_w:
            cur = t
        else:
            if cur:
                lines.append(_shape_ar(cur))
            cur = w
    if cur:
        lines.append(_shape_ar(cur))
    return lines


def _chip(c, x, y_mid, text, active, color):
    from reportlab.lib.units import mm
    w, h = 16 * mm, 6 * mm
    yb = y_mid - h / 2
    if active:
        c.setFillColorRGB(*color)
        c.setStrokeColorRGB(*color)
        c.roundRect(x, yb, w, h, 1.5 * mm, fill=1, stroke=1)
        c.setFillColorRGB(1, 1, 1)
    else:
        c.setFillColorRGB(1, 1, 1)
        c.setStrokeColorRGB(*LINE)
        c.roundRect(x, yb, w, h, 1.5 * mm, fill=1, stroke=1)
        c.setFillColorRGB(0.7, 0.7, 0.7)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(x + w / 2, y_mid - 2.2, text)


# ── Delivery (email + cloud archive) ─────────────────────────────────────────────

def _message(reference: str, submission: dict) -> tuple[str, str]:
    subject = f"New Signed Waiver — {submission.get('full_name','')} [{reference}]"
    body = (
        f"A new digital waiver has been submitted and signed.\n\n"
        f"Reference : {reference}\n"
        f"Name      : {submission.get('full_name','')}\n"
        f"Phone     : {submission.get('phone','')}\n"
        f"Date      : {submission.get('date','')}\n"
        f"Staff     : {submission.get('staff_name','') or '—'}\n"
        f"Member ID : {submission.get('membership_id','') or '—'}\n\n"
        f"The signed PDF is attached.\n\n— Katara Club digital waiver system"
    )
    return subject, body


def deliver(reference: str, submission: dict, pdf_bytes: bytes) -> dict:
    """
    Deliver a signed waiver: email it to reception and/or archive it in the cloud.

    Order of preference for email: Microsoft 365 Graph → Gmail OAuth → SMTP.
    Cloud archive: Microsoft 365 (OneDrive/SharePoint) when configured.

    Returns: {emailed, cloud_saved, cloud_url, channel, errors[]}
    """
    to_addr = settings.waiver_recipient_email
    subject, body = _message(reference, submission)
    filename = f"Katara_Waiver_{reference}.pdf"
    result = {"emailed": False, "cloud_saved": False, "cloud_url": None,
              "channel": None, "errors": []}

    # ── Google Workspace (Drive + Gmail) — preferred when configured ──
    try:
        import google_drive as gd
        if gd.is_configured():
            if settings.google_send_email and settings.google_delegated_sender:
                try:
                    gd.send_mail(to_addr, subject, body, pdf_bytes, filename)
                    result["emailed"] = True
                    result["channel"] = "google"
                except Exception as e:
                    result["errors"].append(f"gmail: {e}")
            if settings.google_save_to_drive and settings.google_drive_folder_id:
                try:
                    result["cloud_url"] = gd.save_to_drive(pdf_bytes, filename)
                    result["cloud_saved"] = True
                    result["channel"] = result["channel"] or "google"
                except Exception as e:
                    result["errors"].append(f"drive: {e}")
            if result["emailed"] or result["cloud_saved"]:
                return result
    except Exception as e:
        result["errors"].append(f"google_init: {e}")

    # ── Microsoft 365 (Graph) — covers BOTH email and cloud save ──
    try:
        import microsoft365 as ms
        if ms.is_configured():
            if settings.ms365_send_email:
                try:
                    ms.send_mail(to_addr, subject, body, pdf_bytes, filename)
                    result["emailed"] = True
                    result["channel"] = "graph"
                except Exception as e:
                    result["errors"].append(f"graph_email: {e}")
            if settings.ms365_save_to_drive:
                try:
                    result["cloud_url"] = ms.save_to_drive(pdf_bytes, filename)
                    result["cloud_saved"] = True
                    result["channel"] = result["channel"] or "graph"
                except Exception as e:
                    result["errors"].append(f"graph_drive: {e}")
            if result["emailed"] or result["cloud_saved"]:
                return result
    except Exception as e:
        result["errors"].append(f"graph_init: {e}")

    # ── Gmail OAuth (if the assistant's Gmail is connected) ──
    try:
        from tools.email_tools import _get_gmail_service
        service = _get_gmail_service()
        msg = MIMEMultipart()
        msg["to"] = to_addr
        msg["subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        part = MIMEApplication(pdf_bytes, _subtype="pdf")
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        result["emailed"] = True
        result["channel"] = "gmail"
        return result
    except Exception as e:
        logger.info("Gmail send unavailable (%s); trying SMTP.", e)

    # ── SMTP fallback ──
    if settings.smtp_host:
        try:
            msg = MIMEMultipart()
            msg["From"] = settings.smtp_from or settings.smtp_user
            msg["To"] = to_addr
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            part = MIMEApplication(pdf_bytes, _subtype="pdf")
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as s:
                s.starttls()
                if settings.smtp_user:
                    s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
            result["emailed"] = True
            result["channel"] = "smtp"
            return result
        except Exception as e:
            result["errors"].append(f"smtp: {e}")

    if not result["channel"]:
        result["channel"] = "local"
        result["errors"].append("no delivery channel configured — PDF stored on disk only")
    return result


# ── Routes ──────────────────────────────────────────────────────────────────────

@router.get("/waiver", response_class=HTMLResponse)
def waiver_form():
    with open(os.path.join(STATIC_DIR, "waiver.html"), encoding="utf-8") as f:
        return HTMLResponse(f.read())


@router.get("/waiver/forms", response_class=HTMLResponse)
def waiver_forms_index():
    """Reception landing page listing every available waiver, with links to the
    form and its printable QR poster."""
    cards = ""
    for f in FORMS.values():
        is_default = f["id"] == DEFAULT_FORM_ID
        q = "" if is_default else f"?form={f['id']}"
        cards += f"""
        <div class="card">
          <div class="ttl">{f['title']['en']}</div>
          <div class="ttl ar">{f['title']['ar']}</div>
          <div class="sub">{f['subtitle']['en']}</div>
          <div class="links">
            <a href="/waiver{q}">📝 Open form</a>
            <a href="/waiver/qr{q}">🖨 QR poster</a>
          </div>
        </div>"""
    return f"""
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Waivers — Katara Club</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>body{{font-family:'Segoe UI',sans-serif;background:#faf6f4;color:#4a4a4a;
      max-width:760px;margin:0 auto;padding:36px 18px;}}
    img.logo{{max-width:240px;width:62%;display:block;margin:0 auto 26px;}}
    h1{{color:#a06e64;text-align:center;font-weight:600;margin:0 0 22px;}}
    .card{{background:#fff;border:1px solid #e3d2cc;border-radius:14px;padding:18px 20px;margin-bottom:16px;
      box-shadow:0 6px 20px rgba(138,90,80,.08);}}
    .ttl{{color:#8a5a50;font-weight:600;font-size:1.05rem;}}
    .ttl.ar{{direction:rtl;color:#a06e64;font-weight:600;margin-top:2px;}}
    .sub{{color:#9a8a85;font-size:.85rem;margin:8px 0 14px;}}
    .links a{{display:inline-block;margin-right:10px;padding:8px 16px;border-radius:9px;text-decoration:none;
      background:linear-gradient(135deg,#a06e64,#8a5a50);color:#fff;font-size:.88rem;font-weight:600;}}
    .links a:last-child{{background:#fff;color:#a06e64;border:1px solid #e3d2cc;}}</style>
    </head><body>
    <img class="logo" src="/static/katara-logo.png" alt="Katara Club">
    <h1>Digital Waivers</h1>
    {cards}
    </body></html>
    """


@router.get("/api/forms")
def list_forms():
    """List available waiver forms (id + bilingual title)."""
    return JSONResponse({
        "default": DEFAULT_FORM_ID,
        "forms": [{"id": f["id"], "title": f["title"]} for f in FORMS.values()],
    })


@router.get("/api/forms/{form_id}")
def get_form_def(form_id: str):
    """Return a single form definition for the web form to render."""
    return JSONResponse(get_form(form_id))


@router.post("/api/waiver")
async def submit_waiver(request: Request):
    data = await request.json()

    if not data.get("full_name"):
        raise HTTPException(400, "Full name is required.")
    if not data.get("signature"):
        raise HTTPException(400, "Signature is required.")

    reference = _reference()

    # Render the signed PDF
    try:
        pdf_bytes = build_pdf(data, reference)
    except Exception as e:
        logger.exception("PDF generation failed")
        raise HTTPException(500, f"Could not generate PDF: {e}")

    # Store on disk (this dir can be a mounted cloud volume / bucket sync target)
    storage = _ensure_storage()
    pdf_path = os.path.join(storage, f"Katara_Waiver_{reference}.pdf")
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)

    # Email to reception + archive into the cloud (Microsoft 365)
    delivery = deliver(reference, data, pdf_bytes)
    errors = "; ".join(delivery["errors"]) or None

    # Persist record
    db = SessionLocal()
    try:
        row = WaiverSubmission(
            reference=reference,
            form_id=data.get("form_id", "K11-AIR-SELECT"),
            full_name=data.get("full_name", ""),
            phone=data.get("phone", ""),
            membership_id=data.get("membership_id", ""),
            staff_name=data.get("staff_name", ""),
            form_date=data.get("date", ""),
            answers=data.get("answers", {}),
            pdf_path=pdf_path,
            emailed=delivery["emailed"],
            email_error=errors,
            cloud_saved=delivery["cloud_saved"],
            cloud_url=delivery["cloud_url"],
            delivery_channel=delivery["channel"],
        )
        db.add(row)
        db.commit()
    finally:
        db.close()

    logger.info("Waiver %s stored (%s); emailed=%s cloud=%s via %s %s",
                reference, pdf_path, delivery["emailed"], delivery["cloud_saved"],
                delivery["channel"], f"errors=[{errors}]" if errors else "")

    return JSONResponse({
        "ok": True,
        "reference": reference,
        "stored": True,
        "emailed": delivery["emailed"],
        "cloud_saved": delivery["cloud_saved"],
        "channel": delivery["channel"],
    })


def _form_target(form: str | None) -> str:
    base = settings.app_base_url.rstrip("/") + "/waiver"
    if form and form != DEFAULT_FORM_ID:
        base += f"?form={form}"
    return base


@router.get("/waiver/qr.png")
def waiver_qr_png(form: str = DEFAULT_FORM_ID):
    target = _form_target(form)
    qr = qrcode.QRCode(box_size=12, border=2,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(target)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#8a5a50", back_color="white")
    bio = io.BytesIO()
    img.save(bio, format="PNG")
    return Response(content=bio.getvalue(), media_type="image/png")


@router.get("/waiver/qr", response_class=HTMLResponse)
def waiver_qr_page(form: str = DEFAULT_FORM_ID):
    target = _form_target(form)
    qr_src = "/waiver/qr.png" + (f"?form={form}" if form != DEFAULT_FORM_ID else "")
    return f"""
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Katara Club — Scan to Sign Waiver</title>
    <style>
      body{{font-family:'Segoe UI',sans-serif;background:#faf6f4;color:#8a5a50;
            text-align:center;margin:0;padding:60px 20px;}}
      img.logo{{max-width:320px;width:70%;margin-bottom:30px;}}
      .card{{background:#fff;max-width:520px;margin:0 auto;padding:40px;border-radius:20px;
             box-shadow:0 12px 40px rgba(138,90,80,.15);}}
      h1{{color:#a06e64;font-weight:600;margin:0 0 6px;}}
      .ar{{direction:rtl;color:#a06e64;font-size:1.2rem;margin-bottom:24px;}}
      .qr{{padding:18px;background:#fff;border:2px solid #e3d2cc;border-radius:16px;display:inline-block;}}
      .qr img{{width:280px;height:280px;}}
      p{{color:#6a5a55;margin-top:24px;}}
      .url{{color:#a06e64;font-size:.85rem;word-break:break-all;}}
    </style></head><body>
      <div class="card">
        <img class="logo" src="/static/katara-logo.png" alt="Katara Club">
        <h1>Scan to Sign</h1>
        <div class="ar">امسح للتوقيع على نموذج الإقرار</div>
        <div class="qr"><img src="{qr_src}" alt="QR code"></div>
        <p>Scan this code with your phone camera to open and sign the<br>
           <strong>{get_form(form)["title"]["en"]}</strong>.</p>
        <div class="url">{target}</div>
      </div>
    </body></html>
    """


@router.get("/waiver/admin", response_class=HTMLResponse)
def waiver_admin(_: None = Depends(require_admin)):
    db = SessionLocal()
    try:
        rows = db.query(WaiverSubmission).order_by(WaiverSubmission.id.desc()).all()

        def cloud_cell(r):
            if getattr(r, "cloud_saved", False):
                return f"<a href='{r.cloud_url}' target='_blank'>☁︎ 365</a>" if r.cloud_url else "☁︎ 365"
            return "—"

        items = "".join(
            f"<tr><td>{r.reference}</td><td>{r.full_name}</td><td>{r.phone or ''}</td>"
            f"<td>{r.form_date or ''}</td><td>{r.staff_name or ''}</td>"
            f"<td>{'✅' if r.emailed else '⚠️'}</td>"
            f"<td>{cloud_cell(r)}</td>"
            f"<td><a href='/waiver/pdf/{r.reference}'>PDF</a></td></tr>"
            for r in rows
        ) or "<tr><td colspan=8 style='text-align:center;color:#aaa'>No waivers yet</td></tr>"
    finally:
        db.close()
    return f"""
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Waivers — Katara Club</title>
    <style>body{{font-family:'Segoe UI',sans-serif;max-width:1050px;margin:30px auto;padding:0 16px;color:#4a4a4a;}}
    h1{{color:#a06e64;}}img.logo{{max-width:200px;margin-bottom:10px;}}
    table{{border-collapse:collapse;width:100%;font-size:.9rem;}}
    th{{background:#f7efec;color:#8a5a50;}}td,th{{padding:9px 10px;border:1px solid #e3d2cc;text-align:left;}}
    a{{color:#a06e64;}}.bar{{margin:0 0 16px;font-size:.9rem;}}
    .bar a{{display:inline-block;margin-right:14px;padding:6px 12px;border:1px solid #e3d2cc;border-radius:8px;text-decoration:none;}}
    </style></head><body>
    <img class="logo" src="/static/katara-logo.png"><h1>Submitted Waivers</h1>
    <div class="bar"><a href="/waiver/qr">🖨 Reception poster</a><a href="/waiver/status">⚙️ System status</a><a href="/waiver">📝 Open form</a></div>
    <table><tr><th>Reference</th><th>Name</th><th>Phone</th><th>Date</th><th>Staff</th><th>Emailed</th><th>Cloud</th><th>File</th></tr>
    {items}</table></body></html>
    """


@router.get("/waiver/status", response_class=HTMLResponse)
def waiver_status(_: None = Depends(require_admin)):
    """Configuration health page — lets staff verify email/cloud are wired up."""
    try:
        import microsoft365 as ms
        ms_ok = ms.is_configured()
    except Exception:
        ms_ok = False
    try:
        import google_drive as gd
        g_ok = gd.is_configured()
    except Exception:
        g_ok = False
    smtp_ok = bool(settings.smtp_host)
    font_ok = os.path.exists(ARABIC_FONT_PATH)
    storage = _ensure_storage()

    def row(label, ok, detail):
        badge = "✅ Ready" if ok else "⚠️ Not configured"
        return f"<tr><td>{label}</td><td>{badge}</td><td>{detail}</td></tr>"

    admin_protected = bool(settings.admin_password)
    rows = "".join([
        row("Google Drive archive",
            g_ok and settings.google_save_to_drive and bool(settings.google_drive_folder_id),
            f"Folder ID: <b>{settings.google_drive_folder_id or '—'}</b>"),
        row("Gmail email",
            g_ok and settings.google_send_email and bool(settings.google_delegated_sender),
            f"Sends to <b>{settings.waiver_recipient_email}</b> as {settings.google_delegated_sender or '—'}"),
        row("Microsoft 365 email (Graph)",
            ms_ok and settings.ms365_send_email,
            f"Sends to <b>{settings.waiver_recipient_email}</b> as {settings.ms365_sender}"),
        row("Microsoft 365 cloud archive",
            ms_ok and settings.ms365_save_to_drive,
            f"Folder: <b>{settings.ms365_save_folder}</b> "
            + (f"in SharePoint {settings.ms365_sharepoint_site}" if settings.ms365_sharepoint_site else "in OneDrive")),
        row("SMTP fallback", smtp_ok, settings.smtp_host or "—"),
        row("Local PDF storage", True, storage),
        row("Arabic PDF font", font_ok, ARABIC_FONT_PATH),
        row("Public base URL (QR target)", bool(settings.app_base_url), settings.app_base_url),
        row("Admin pages protected", admin_protected,
            "Login required" if admin_protected
            else "⚠️ OPEN — set ADMIN_PASSWORD to protect member data"),
    ])
    return f"""
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>System Status — Katara Club</title>
    <style>body{{font-family:'Segoe UI',sans-serif;max-width:820px;margin:30px auto;padding:0 16px;color:#4a4a4a;}}
    h1{{color:#a06e64;}}img.logo{{max-width:200px;margin-bottom:10px;}}
    table{{border-collapse:collapse;width:100%;}}th{{background:#f7efec;color:#8a5a50;}}
    td,th{{padding:10px;border:1px solid #e3d2cc;text-align:left;}}p{{color:#8a5a50;}}
    .btn{{display:inline-block;margin:18px 0;padding:11px 20px;border:none;border-radius:10px;cursor:pointer;
      background:linear-gradient(135deg,#a06e64,#8a5a50);color:#fff;font-size:.95rem;font-weight:600;}}
    #res{{margin-top:10px;padding:12px 14px;border-radius:10px;font-size:.9rem;display:none;white-space:pre-wrap;}}
    .ok{{background:#e8f3ee;color:#256b4f;}}.bad{{background:#fbeae6;color:#a23b29;}}
    a.back{{color:#a06e64;}}</style>
    </head><body><img class="logo" src="/static/katara-logo.png"><h1>Waiver System Status</h1>
    <p>Use this page after deployment to confirm signed forms will reach reception and your Microsoft 365.</p>
    <table><tr><th>Component</th><th>Status</th><th>Details</th></tr>{rows}</table>
    <button class="btn" id="t">Send a test delivery →</button>
    <div id="res"></div>
    <p><a class="back" href="/waiver/admin">← Back to submissions</a></p>
    <script>
    document.getElementById('t').addEventListener('click', async ()=>{{
      const r=document.getElementById('res'); r.style.display='block'; r.className=''; r.textContent='Sending test…';
      try{{
        const res=await fetch('/waiver/selftest',{{method:'POST'}});
        const d=await res.json();
        if(d.emailed||d.cloud_saved){{
          r.className='ok';
          r.textContent='✅ Test delivered.\\nEmailed: '+d.emailed+'  |  Saved to 365: '+d.cloud_saved+'  |  Channel: '+d.channel
            +'\\nCheck '+ '{settings.waiver_recipient_email}' +' and your 365 folder.';
        }}else{{
          r.className='bad';
          r.textContent='⚠️ Nothing was delivered (stored locally only).\\n'+(d.errors&&d.errors.join('\\n')||'No delivery channel configured.');
        }}
      }}catch(e){{ r.className='bad'; r.textContent='Request failed: '+e.message; }}
    }});
    </script>
    </body></html>
    """


@router.post("/waiver/selftest")
def waiver_selftest(_: None = Depends(require_admin)):
    """Generate a small test PDF and run the real delivery path, so staff can
    confirm email + Microsoft 365 are wired up — without filling out a form."""
    reference = "TEST-" + datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    sample = {
        "full_name": "TEST — Configuration Check",
        "phone": "+974 0000 0000",
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "staff_name": "System",
        "membership_id": "—",
        "form_id": DEFAULT_FORM_ID,
        "answers": {str(i): {"answer": "yes"} for i in range(10)},
        "signature": "",
        "submitted_at": datetime.utcnow().isoformat(),
    }
    pdf = build_pdf(sample, reference)
    result = deliver(reference, sample, pdf)
    return JSONResponse(result)


@router.get("/waiver/pdf/{reference}")
def waiver_pdf(reference: str, _: None = Depends(require_admin)):
    db = SessionLocal()
    try:
        row = db.query(WaiverSubmission).filter_by(reference=reference).first()
    finally:
        db.close()
    if not row or not row.pdf_path or not os.path.exists(row.pdf_path):
        raise HTTPException(404, "Waiver PDF not found.")
    return FileResponse(row.pdf_path, media_type="application/pdf",
                        filename=os.path.basename(row.pdf_path))
