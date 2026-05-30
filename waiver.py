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

import qrcode
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

from config import settings
from database.db import SessionLocal
from database.models import WaiverSubmission

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

ARABIC_FONT_PATH = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf"
ARABIC_FONT_BOLD = "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf"


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

CLAUSES = [
    ("I confirm that I am 18+ and have no medical condition preventing UV exposure.",
     "أؤكد أن عمري ١٨ سنة أو أكثر ولا أعاني من حالة صحية تمنع التعرض للأشعة فوق البنفسجية"),
    ("If female: I confirm that I am not pregnant and understand that this treatment is strictly prohibited during pregnancy.",
     "إذا كنتِ أنثى، أؤكد أنني لست حاملاً، وأدرك أن هذا العلاج محظور تماماً أثناء فترة الحمل"),
    ("I voluntarily choose to use the tanning machine, understanding the risks.",
     "أستخدم الجهاز بمحض إرادتي وبعد فهم كامل للمخاطر المحتملة"),
    ("I am not using medication increasing UV sensitivity and have not been advised to avoid tanning.",
     "لا أستخدم أدوية أو منتجات تزيد حساسية الجلد للأشعة ولم يتم نصحي طبياً بتجنب التسمير"),
    ("I understand UV exposure may cause skin and eye burns, irritation, or increase skin health risks.",
     "أقر بأن جهاز التسمير يعرض الجلد والعينين للأشعة فوق البنفسجية وقد يسبب حروقاً أو تهيجاً أو يزيد خطر مشاكل الجلد"),
    ("I agree to follow staff instructions and wear protective eyewear during the session.",
     "ألتزم باتباع تعليمات موظفي النادي واستخدام نظارات حماية العين طوال الجلسة"),
    ("I agree to follow recommended exposure time and use the equipment safely.",
     "ألتزم بالمدة المحددة للجلسة واستخدام الجهاز بطريقة آمنة ومسؤولة"),
    ("I confirm that I will avoid using the sauna, facial, ice plunge, and sun exposure for at least 24 hours "
     "following my session, in accordance with Katara Club safety guidelines.",
     "أؤكد أنني سأمتنع عن استخدام الساونا، فيشل، حوض الثلج، والتعرض المباشر لأشعة الشمس لمدة لا تقل عن ٢٤ ساعة بعد الجلسة، وفقاً لإرشادات السلامة الخاصة بنادي كتارا"),
    ("I accept full responsibility and acknowledge Katara Club is not liable when safety instructions are not followed.",
     "أتحمل المسؤولية الكاملة عن استخدام الجهاز وأقر بعدم مسؤولية نادي كتارا عن أي آثار ناتجة عن الاستخدام عند عدم الالتزام بالتعليمات"),
    ("I confirm that I have read, understood, and agreed to all terms above.",
     "أؤكد أنني قرأت وفهمت جميع البنود وأوافق عليها بالكامل"),
]


def build_pdf(submission: dict, reference: str) -> bytes:
    """Render a signed PDF that mirrors the original Katara Club waiver design."""
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
    c.drawString(L, y, "11 Air Select Machine User Waiver & Consent Form")
    draw_ar_right("نموذج إقرار وموافقة الاستخدام", R, y, size=11, color=ROSE, font="NotoArB" if ar_font else None)
    y -= 5.5 * mm
    c.setFont(base_font, 7.6)
    c.setFillColorRGB(*ROSE_DARK)
    c.drawString(L, y, "This waiver applies to all members using the K11 Air Select Machine.")
    draw_ar_right("يطبق هذا الإقرار على جميع المستخدمين (الأعضاء) لجهاز العناية الضوئية", R, y, size=7.6, color=ROSE_DARK)
    y -= 7 * mm

    c.setFont(bold_font, 10.5)
    c.setFillColorRGB(*ROSE)
    c.drawCentredString(W / 2, y, "Acknowledgment & Consent  /  " + (ar("الإقرار والموافقة") if ar_font else ""))
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

    for i, (en, ar_txt) in enumerate(CLAUSES):
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
    c.drawString(L + 3 * mm, y - 5.5 * mm,
                 "Katara Club reserves the right to refuse equipment use if safety requirements are not met.")
    if ar_font:
        draw_ar_right("يحتفظ نادي كتارا بالحق في منع استخدام الجهاز في حال عدم الالتزام بإرشادات السلامة",
                      R - 3 * mm, y - 5.5 * mm, size=6.8, color=ROSE_DARK)
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


# ── Email delivery ──────────────────────────────────────────────────────────────

def _email_pdf(reference: str, submission: dict, pdf_bytes: bytes) -> tuple[bool, str]:
    """Send the signed PDF to reception. Tries Gmail (OAuth) first, then SMTP."""
    to_addr = settings.waiver_recipient_email
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
    filename = f"Katara_Waiver_{reference}.pdf"

    # 1) Gmail via existing OAuth integration
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
        return True, "gmail"
    except Exception as e:
        gmail_err = str(e)
        logger.info("Gmail send unavailable (%s); trying SMTP.", gmail_err)

    # 2) SMTP fallback
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
            return True, "smtp"
        except Exception as e:
            return False, f"smtp_failed: {e}"

    return False, "no_email_channel_configured (PDF stored on disk)"


# ── Routes ──────────────────────────────────────────────────────────────────────

@router.get("/waiver", response_class=HTMLResponse)
def waiver_form():
    with open(os.path.join(STATIC_DIR, "waiver.html"), encoding="utf-8") as f:
        return HTMLResponse(f.read())


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

    # Email to reception
    emailed, channel = _email_pdf(reference, data, pdf_bytes)

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
            emailed=emailed,
            email_error=None if emailed else channel,
        )
        db.add(row)
        db.commit()
    finally:
        db.close()

    logger.info("Waiver %s stored (%s); email=%s via %s",
                reference, pdf_path, emailed, channel)

    return JSONResponse({
        "ok": True,
        "reference": reference,
        "stored": True,
        "emailed": emailed,
        "channel": channel,
    })


@router.get("/waiver/qr.png")
def waiver_qr_png(request: Request):
    target = f"{settings.app_base_url.rstrip('/')}/waiver"
    qr = qrcode.QRCode(box_size=12, border=2,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(target)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#8a5a50", back_color="white")
    bio = io.BytesIO()
    img.save(bio, format="PNG")
    return Response(content=bio.getvalue(), media_type="image/png")


@router.get("/waiver/qr", response_class=HTMLResponse)
def waiver_qr_page():
    target = f"{settings.app_base_url.rstrip('/')}/waiver"
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
        <div class="qr"><img src="/waiver/qr.png" alt="QR code"></div>
        <p>Scan this code with your phone camera to open and sign the<br>
           <strong>K11 Air Select Machine Waiver &amp; Consent Form</strong>.</p>
        <div class="url">{target}</div>
      </div>
    </body></html>
    """


@router.get("/waiver/admin", response_class=HTMLResponse)
def waiver_admin():
    db = SessionLocal()
    try:
        rows = db.query(WaiverSubmission).order_by(WaiverSubmission.id.desc()).all()
        items = "".join(
            f"<tr><td>{r.reference}</td><td>{r.full_name}</td><td>{r.phone or ''}</td>"
            f"<td>{r.form_date or ''}</td><td>{r.staff_name or ''}</td>"
            f"<td>{'✅' if r.emailed else '⚠️ '+(r.email_error or '')}</td>"
            f"<td><a href='/waiver/pdf/{r.reference}'>PDF</a></td></tr>"
            for r in rows
        ) or "<tr><td colspan=7 style='text-align:center;color:#aaa'>No waivers yet</td></tr>"
    finally:
        db.close()
    return f"""
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>Waivers — Katara Club</title>
    <style>body{{font-family:'Segoe UI',sans-serif;max-width:1000px;margin:30px auto;padding:0 16px;color:#4a4a4a;}}
    h1{{color:#a06e64;}}img{{max-width:200px;margin-bottom:10px;}}
    table{{border-collapse:collapse;width:100%;font-size:.9rem;}}
    th{{background:#f7efec;color:#8a5a50;}}td,th{{padding:9px 10px;border:1px solid #e3d2cc;text-align:left;}}
    a{{color:#a06e64;}}</style></head><body>
    <img src="/static/katara-logo.png"><h1>Submitted Waivers</h1>
    <table><tr><th>Reference</th><th>Name</th><th>Phone</th><th>Date</th><th>Staff</th><th>Emailed</th><th>File</th></tr>
    {items}</table></body></html>
    """


@router.get("/waiver/pdf/{reference}")
def waiver_pdf(reference: str):
    db = SessionLocal()
    try:
        row = db.query(WaiverSubmission).filter_by(reference=reference).first()
    finally:
        db.close()
    if not row or not row.pdf_path or not os.path.exists(row.pdf_path):
        raise HTTPException(404, "Waiver PDF not found.")
    return FileResponse(row.pdf_path, media_type="application/pdf",
                        filename=os.path.basename(row.pdf_path))
