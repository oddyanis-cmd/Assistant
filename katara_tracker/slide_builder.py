"""Regenerate a Katara member-profile ODP deck from client records.

Design fidelity is achieved by reusing the *original* deck as a template:
existing members keep their original slide (only the green status note is
updated to match their workflow status), and new members are produced by
cloning a template slide and substituting the text fields + portrait. Slides
are then ordered by workflow status (Pending → Approved → Paid) so a status
change visibly moves a member's slide within the deck.
"""

from __future__ import annotations

import copy
import os
import zipfile

from lxml import etree

from .odp_parser import (
    NS,
    Client,
    _q,
    _shapes_with_text,
    _to_inches,
    LABEL_MAP,
)

GREEN_FILL = "#00b050"


def _fill_map(root) -> dict:
    out = {}
    for st in root.iter(_q("style:style")):
        nm = st.get(_q("style:name"))
        gp = st.find(_q("style:graphic-properties"))
        if gp is not None:
            fc = gp.get(_q("draw:fill-color"))
            if fc:
                out[nm] = fc.lower()
    return out


def _green_note_frames(page, fills: dict):
    """Yield frame elements that render the green Approved/Paid note."""
    for el in page.iter():
        if etree.QName(el).localname not in ("frame", "custom-shape", "rect"):
            continue
        sn = el.get(_q("draw:style-name"))
        txt = " ".join(
            "".join(p.itertext()).strip() for p in el.iter(_q("text:p"))
        ).strip().lower()
        if fills.get(sn) == GREEN_FILL and txt in ("approved", "paid"):
            yield el


def _set_shape_text(shape, value: str) -> None:
    """Replace the visible text of a shape, preserving the first run's style."""
    ps = list(shape.iter(_q("text:p")))
    if not ps:
        return
    first = ps[0]
    spans = list(first.iter(_q("text:span")))
    if spans:
        spans[0].text = value
        for extra in spans[1:]:
            extra.getparent().remove(extra)
        first.text = None
    else:
        # clear any inline children then set text
        for ch in list(first):
            first.remove(ch)
        first.text = value
    # Drop additional paragraphs (multi-line values collapse to one line).
    for extra in ps[1:]:
        extra.getparent().remove(extra)


def _label_value_pairs(page):
    """Return [(attr, value_shape_element)] by pairing label shapes with the
    value shape to their right on the same row. Mirrors odp_parser geometry."""
    # Build (element, y, x, text) for positioned text shapes.
    items = []
    for el in page.iter():
        x = el.get(_q("svg:x"))
        y = el.get(_q("svg:y"))
        if x is None and y is None:
            continue
        parts = [
            "".join(p.itertext()).strip()
            for p in el.iter(_q("text:p"))
            if "".join(p.itertext()).strip()
        ]
        if parts:
            items.append((el, _to_inches(y), _to_inches(x), " ".join(parts)))

    pairs = []
    for el, ly, lx, txt in items:
        key = txt.strip().rstrip(":").strip().lower()
        if key not in LABEL_MAP:
            continue
        attr = LABEL_MAP[key]
        cands = [
            it for it in items
            if it[2] > lx + 0.5 and abs(it[1] - ly) < 0.35
            and it[3].strip().rstrip(":").strip().lower() not in LABEL_MAP
        ]
        if cands:
            cands.sort(key=lambda it: (abs(it[1] - ly), it[2]))
            pairs.append((attr, cands[0][0]))
    return pairs


def _apply_status_note(page, status: str, fills: dict, note_template) -> None:
    """Make the slide's green note match ``status`` (add/update/remove)."""
    existing = list(_green_note_frames(page, fills))
    if status == "Pending approval":
        for f in existing:
            f.getparent().remove(f)
        return
    label = "Approved" if status == "Approved" else "Paid"
    if existing:
        for f in existing:
            _set_shape_text(f, label)
    elif note_template is not None:
        clone = copy.deepcopy(note_template)
        _set_shape_text(clone, label)
        page.append(clone)


def _portrait_frame(page):
    """Return the portrait image frame element (largest non-logo image)."""
    best, best_area = None, 0.0
    for fr in page.iter(_q("draw:frame")):
        img = fr.find(_q("draw:image"))
        if img is None:
            continue
        href = img.get(_q("xlink:href")) or ""
        x = _to_inches(fr.get(_q("svg:x")))
        y = _to_inches(fr.get(_q("svg:y")))
        w = _to_inches(fr.get(_q("svg:width")))
        h = _to_inches(fr.get(_q("svg:height")))
        if href.endswith("image1.png") or (y < 0.8 and x < 0.5):
            continue
        if w * h > best_area:
            best, best_area = fr, w * h
    return best


def _fill_new_slide(page, client: Client, extra_media: dict) -> None:
    """Substitute a cloned template slide with a new member's data."""
    for attr, vshape in _label_value_pairs(page):
        val = getattr(client, attr, "")
        if attr == "rate" and not val and client.rate_amount:
            val = "QAR %s" % format(client.rate_amount, ",")
        _set_shape_text(vshape, str(val) if val else "")

    # Header pieces that aren't simple label/value pairs.
    APP_ID_RE = __import__("re").compile(r"MEM-APP-\d{4}-\d+")
    for el in page.iter():
        if el.get(_q("svg:x")) is None and el.get(_q("svg:y")) is None:
            continue
        txt = " ".join(
            "".join(p.itertext()).strip() for p in el.iter(_q("text:p"))
        ).strip()
        if APP_ID_RE.fullmatch(txt) and client.app_id:
            _set_shape_text(el, client.app_id)
        elif txt.lower().startswith("application type") and client.application_type:
            _set_shape_text(el, "Application Type: %s" % client.application_type)
        elif txt.lower().startswith("mobile number"):
            _set_shape_text(el, "Mobile Number :%s" % client.mobile)

    # Portrait: point the frame at the new image and register its bytes.
    if client.photo and os.path.exists(client.photo):
        frame = _portrait_frame(page)
        if frame is not None:
            img = frame.find(_q("draw:image"))
            base = os.path.basename(client.photo)
            target = "media/%s" % base
            img.set(_q("xlink:href"), target)
            extra_media[target] = client.photo


def build_deck(
    template_odp: str,
    clients: list[Client],
    new_clients: list[Client],
    out_odp: str,
) -> None:
    """Write ``out_odp`` from the template, one slide per client, grouped by
    status. ``clients`` reuse their original slide (matched by App ID);
    ``new_clients`` are cloned from a template slide."""
    with zipfile.ZipFile(template_odp) as z:
        names = z.namelist()
        content = z.read("content.xml")
        other = {n: z.read(n) for n in names if n != "content.xml"}

    root = etree.fromstring(content)
    fills = _fill_map(root)
    pages = root.findall(".//" + _q("draw:page"))
    by_appid = {}
    for pg in pages:
        txt = " ".join(
            "".join(p.itertext()) for p in pg.iter(_q("text:p"))
        )
        m = __import__("re").search(r"MEM-APP-\d{4}-\d+", txt)
        if m:
            by_appid[m.group(0)] = pg

    # Templates for cloning: a note frame and a base slide (one with a photo).
    note_template = None
    for pg in pages:
        notes = list(_green_note_frames(pg, fills))
        if notes:
            note_template = copy.deepcopy(notes[0])
            break
    base_slide = next(iter(by_appid.values())) if by_appid else pages[0]

    parent = pages[0].getparent()
    for pg in pages:
        parent.remove(pg)

    extra_media: dict = {}
    order = {"Pending approval": 0, "Approved": 1, "Paid": 2}
    ordered = sorted(clients, key=lambda c: (order.get(c.status, 0), c.slide_index))

    for client in ordered:
        src = by_appid.get(client.app_id)
        slide = copy.deepcopy(src) if src is not None else copy.deepcopy(base_slide)
        _apply_status_note(slide, client.status, fills, note_template)
        parent.append(slide)

    for client in new_clients:
        slide = copy.deepcopy(base_slide)
        _fill_new_slide(slide, client, extra_media)
        _apply_status_note(slide, client.status, fills, note_template)
        parent.append(slide)

    new_content = etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", standalone=True
    )

    with zipfile.ZipFile(out_odp, "w", zipfile.ZIP_DEFLATED) as z:
        # mimetype must be first and stored (uncompressed) for a valid ODF.
        if "mimetype" in other:
            zi = zipfile.ZipInfo("mimetype")
            zi.compress_type = zipfile.ZIP_STORED
            z.writestr(zi, other.pop("mimetype"))
        z.writestr("content.xml", new_content)
        for name, data in other.items():
            z.writestr(name, data)
        for target, srcpath in extra_media.items():
            if target not in other:
                with open(srcpath, "rb") as fh:
                    z.writestr(target, fh.read())
