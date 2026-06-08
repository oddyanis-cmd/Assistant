"""Render a member-profile slide to a PNG preview using Pillow.

This reproduces the Katara slide design (maroon header band, portrait, the
two-column label/value list and the green status note) directly from a parsed
``Client`` record. It is a convenience preview — the authoritative, fully
styled slide is the one produced in the ODP deck by ``slide_builder`` — but it
is handy for a quick visual without opening the presentation.
"""

from __future__ import annotations

import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

from .odp_parser import Client
from .theme import GREEN, MAROON, RED, STATUS_COLORS

# Slide canvas: 13.333in x 7.5in (16:9) at 100 px/in.
PXIN = 100
W, H = int(13.333 * PXIN), int(7.5 * PXIN)

FONT_DIR = "/usr/share/fonts/truetype/liberation"


def _hex(c: str):
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _font(size: int, bold: bool = False):
    name = "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf"
    path = os.path.join(FONT_DIR, name)
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


# Field rows shown on the right, in slide order: (label, attr).
ROWS = [
    ("Application Date :", "application_date"),
    ("Name :", "name"),
    ("Age :", "age"),
    ("Occupation :", "occupation"),
    ("Company :", "company"),
    ("Membership Plan :", "membership_plan"),
    ("Rate :", "rate"),
    ("Tag :", "tag"),
    ("Special Request :", "special_request"),
    ("CEC :", "cec"),
]


def render_slide(client: Client, out_png: str, media_dir: str = "") -> str:
    maroon = _hex(MAROON)
    green = _hex(GREEN)
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    # --- Header band ---------------------------------------------------------
    band_h = int(1.0 * PXIN)
    d.rectangle([0, 0, W, band_h], fill=maroon)
    d.text((int(0.3 * PXIN), int(0.28 * PXIN)), "KATARA", font=_font(34, True),
           fill="white")
    title = "MEMBER PROFILE"
    tf = _font(34, True)
    d.text((int(2.75 * PXIN), int(0.28 * PXIN)), title, font=tf, fill="white")
    if client.app_id:
        af = _font(20, True)
        aw = d.textlength(client.app_id, font=af)
        d.text((W - aw - int(0.3 * PXIN), int(0.36 * PXIN)), client.app_id,
               font=af, fill="white")

    # --- Application type chip ----------------------------------------------
    if client.application_type:
        d.text((int(0.35 * PXIN), int(1.15 * PXIN)),
               "Application Type: %s" % client.application_type,
               font=_font(20, True), fill=maroon)

    # --- Status note (green) -------------------------------------------------
    if client.status in ("Approved", "Paid"):
        label = client.status
        nf = _font(22, True)
        pad = 12
        nw = d.textlength(label, font=nf)
        x1 = int(6.95 * PXIN)
        d.rounded_rectangle(
            [x1, int(0.30 * PXIN), x1 + nw + 2 * pad, int(0.30 * PXIN) + 44],
            radius=10, fill=green)
        d.text((x1 + pad, int(0.30 * PXIN) + 8), label, font=nf, fill="white")

    # --- Portrait ------------------------------------------------------------
    box = [int(0.6 * PXIN), int(1.75 * PXIN), int(3.3 * PXIN), int(4.4 * PXIN)]
    photo_path = ""
    if client.photo:
        cand = client.photo
        if not os.path.exists(cand) and media_dir:
            cand = os.path.join(media_dir, os.path.basename(client.photo))
        if os.path.exists(cand):
            photo_path = cand
    if photo_path:
        try:
            p = Image.open(photo_path).convert("RGB")
            p = p.resize((box[2] - box[0], box[3] - box[1]))
            img.paste(p, (box[0], box[1]))
        except Exception:
            photo_path = ""
    if not photo_path:
        d.rectangle(box, fill=(238, 232, 236), outline=maroon, width=2)
        d.text((box[0] + 60, (box[1] + box[3]) // 2 - 10), "No photo",
               font=_font(20), fill=maroon)

    # --- Name + mobile under the portrait -----------------------------------
    d.text((int(0.6 * PXIN), int(4.55 * PXIN)), client.name,
           font=_font(24, True), fill=maroon)
    if client.mobile:
        d.text((int(0.6 * PXIN), int(4.95 * PXIN)),
               "Mobile Number : %s" % client.mobile, font=_font(18), fill="black")

    # --- Two-column field list ----------------------------------------------
    lx, vx = int(3.7 * PXIN), int(5.6 * PXIN)
    y = int(1.78 * PXIN)
    step = int(0.49 * PXIN)
    lbf, vlf = _font(18, True), _font(18)
    for label, attr in ROWS:
        val = getattr(client, attr, "") or "—"
        d.text((lx, y), label, font=lbf, fill=maroon)
        if attr == "special_request":
            wrapped = textwrap.fill(str(val), width=60)
            color = _hex(RED) if val and val != "—" else "black"
            d.multiline_text((vx, y), wrapped, font=_font(15), fill=color,
                             spacing=4)
            y += step + 30
        else:
            d.text((vx, y), str(val), font=vlf, fill="black")
            y += step

    # --- Footer accent -------------------------------------------------------
    d.rectangle([0, H - 12, W, H], fill=_hex(STATUS_COLORS.get(client.status, MAROON)))

    img.save(out_png)
    return out_png
