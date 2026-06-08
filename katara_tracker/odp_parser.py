"""Parse a Katara member-profile ODP presentation into structured client
records.

Each slide is one "MEMBER PROFILE". Fields are laid out as paired shapes:
a label shape (e.g. ``Name :``) in the label column and a value shape in the
value column, sharing the same vertical position. The workflow status is
derived from a small green note ("Approved" / "Paid") at the top-right of the
slide; slides with no such note are "Pending approval".

The parser is deliberately tolerant: it pairs labels to values by geometry
rather than relying on a fixed shape order, so it survives small layout
differences between slides.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field, asdict
from typing import Optional

from lxml import etree

# ODF namespaces we care about.
NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "style": "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
    "draw": "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
    "svg": "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    "fo": "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
    "xlink": "http://www.w3.org/1999/xlink",
}


def _q(prefix_tag: str) -> str:
    pre, tag = prefix_tag.split(":")
    return "{%s}%s" % (NS[pre], tag)


def _to_inches(val: Optional[str]) -> float:
    """Convert an ODF length string ('1.97in', '2.5cm', '180pt') to inches."""
    if not val:
        return 0.0
    m = re.match(r"^(-?[0-9.]+)\s*([a-z]*)$", val.strip())
    if not m:
        return 0.0
    num, unit = float(m.group(1)), m.group(2)
    if unit in ("in", ""):
        return num
    if unit == "cm":
        return num / 2.54
    if unit == "mm":
        return num / 25.4
    if unit in ("pt",):
        return num / 72.0
    return num


# Field labels we expect on each slide. Maps the on-slide label (lower-cased,
# colon stripped) to the record attribute name.
LABEL_MAP = {
    "application date": "application_date",
    "name": "name",
    "age": "age",
    "occupation": "occupation",
    "company": "company",
    "membership plan": "membership_plan",
    "rate": "rate",
    "tag": "tag",
    "special request": "special_request",
    "special note": "special_request",
    "cec": "cec",
}

APP_ID_RE = re.compile(r"MEM-APP-\d{4}-\d+")
APP_TYPE_RE = re.compile(r"Application Type\s*:\s*(.+)", re.I)
MOBILE_RE = re.compile(r"Mobile Number\s*:?\s*([0-9\s]+)", re.I)
RATE_NUM_RE = re.compile(r"([\d][\d,\.]*)")
LEADING_DATE_RE = re.compile(r"^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s+(.*)$")
DIGITS_RE = re.compile(r"^\d{6,10}$")


@dataclass
class Client:
    """A single member profile (one slide)."""

    slide_index: int = 0           # 1-based position in the source deck
    app_id: str = ""
    application_type: str = ""
    name: str = ""
    application_date: str = ""
    age: str = ""
    occupation: str = ""
    company: str = ""
    membership_plan: str = ""
    rate: str = ""                 # raw text, e.g. "QAR 17,000"
    rate_amount: int = 0           # parsed integer, e.g. 17000
    tag: str = ""
    special_request: str = ""
    cec: str = ""
    mobile: str = ""
    status: str = "Pending approval"
    photo: str = ""                # media path inside the ODP, e.g. media/image3.jpeg

    def as_row(self) -> dict:
        return asdict(self)


@dataclass
class _Shape:
    y: float
    x: float
    text: str


def _shapes_with_text(page) -> list[_Shape]:
    """Return every positioned shape on a slide that carries text, with its
    top-left coordinate in inches."""
    shapes = []
    for el in page.iter():
        x = el.get(_q("svg:x"))
        y = el.get(_q("svg:y"))
        if x is None and y is None:
            continue
        parts = []
        for p in el.iter(_q("text:p")):
            t = "".join(p.itertext()).strip()
            if t:
                parts.append(t)
        if not parts:
            continue
        shapes.append(_Shape(_to_inches(y), _to_inches(x), " ".join(parts)))
    return shapes


def _fill_colors(root) -> dict:
    """Map automatic graphic style-name -> fill colour (lower hex)."""
    out = {}
    for st in root.iter(_q("style:style")):
        nm = st.get(_q("style:name"))
        gp = st.find(_q("style:graphic-properties"))
        if gp is not None:
            fc = gp.get(_q("draw:fill-color"))
            if fc:
                out[nm] = fc.lower()
    return out


def _detect_status(page, fills: dict) -> str:
    """Derive workflow status from the green note shapes near the top."""
    has_paid = has_approved = False
    for el in page.iter():
        tag = etree.QName(el).localname
        if tag not in ("frame", "custom-shape", "rect", "text-box"):
            continue
        sn = el.get(_q("draw:style-name"))
        txt = " ".join(
            "".join(p.itertext()).strip() for p in el.iter(_q("text:p"))
        ).strip().lower()
        if not txt:
            continue
        is_green = fills.get(sn) == "#00b050"
        # The status note sits at the top of the slide; accept either an
        # explicit green fill or the bare word in a short shape.
        if txt == "paid" and (is_green or len(txt) <= 8):
            has_paid = True
        elif txt == "approved" and (is_green or len(txt) <= 12):
            has_approved = True
    if has_paid:
        return "Paid"
    if has_approved:
        return "Approved"
    return "Pending approval"


def _primary_photo(page) -> str:
    """Pick the client portrait: the largest non-logo image on the slide."""
    best = None
    best_area = 0.0
    for fr in page.iter(_q("draw:frame")):
        img = fr.find(_q("draw:image"))
        if img is None:
            continue
        href = img.get(_q("xlink:href")) or ""
        # The shared KC logo is image1.png at the very top-left corner.
        x = _to_inches(fr.get(_q("svg:x")))
        y = _to_inches(fr.get(_q("svg:y")))
        w = _to_inches(fr.get(_q("svg:width")))
        h = _to_inches(fr.get(_q("svg:height")))
        if href.endswith("image1.png") or (y < 0.8 and x < 0.5):
            continue  # logo / header decoration
        area = w * h
        if area > best_area:
            best_area, best = area, href
    return best or ""


def _pair_fields(client: Client, shapes: list[_Shape]) -> None:
    """Populate field attributes by pairing label shapes with value shapes."""
    # Index label shapes by their canonical name.
    labels = []
    for s in shapes:
        key = s.text.strip().rstrip(":").strip().lower()
        if key in LABEL_MAP:
            labels.append((s, LABEL_MAP[key]))

    for label_shape, attr in labels:
        # The value lives to the right of the label on (roughly) the same row.
        candidates = [
            s
            for s in shapes
            if s.x > label_shape.x + 0.5
            and abs(s.y - label_shape.y) < 0.35
            and s.text.strip().rstrip(":").strip().lower() not in LABEL_MAP
        ]
        if not candidates:
            continue
        # Closest row first, then left-most value column.
        candidates.sort(key=lambda s: (abs(s.y - label_shape.y), s.x))
        value = candidates[0].text.strip()
        # Only set if empty or this is a better (closer) match — first wins.
        if not getattr(client, attr):
            setattr(client, attr, value)


def parse_client(page, page_index: int, fills: dict) -> Client:
    shapes = _shapes_with_text(page)
    client = Client(slide_index=page_index)

    # Header-style fields that are not simple label/value pairs.
    for s in shapes:
        if not client.app_id:
            m = APP_ID_RE.search(s.text)
            if m:
                client.app_id = m.group(0)
        if not client.application_type:
            m = APP_TYPE_RE.search(s.text)
            if m:
                client.application_type = m.group(1).strip()
        if not client.mobile:
            m = MOBILE_RE.search(s.text)
            if m:
                client.mobile = re.sub(r"\s+", "", m.group(1))

    _pair_fields(client, shapes)

    # Newer slides merge the date into the name value, e.g.
    # "16/05/2026 Essa Khamis ...". Split a leading date out of the name.
    if not client.application_date and client.name:
        m = LEADING_DATE_RE.match(client.name)
        if m:
            client.application_date = m.group(1)
            client.name = m.group(2).strip()

    # Mobile fallback: some slides keep "Mobile Number :" and the digits in
    # two separate shapes. Find a nearby digits-only shape.
    if not client.mobile:
        for s in shapes:
            if s.text.strip().lower().startswith("mobile number"):
                near = [
                    o for o in shapes
                    if abs(o.y - s.y) < 0.4 and DIGITS_RE.match(o.text.strip())
                ]
                if near:
                    client.mobile = near[0].text.strip()
                break

    # Parse the numeric rate amount from the rate text.
    if client.rate:
        m = RATE_NUM_RE.search(client.rate.replace(" ", ""))
        if m:
            client.rate_amount = int(m.group(1).replace(",", "").split(".")[0])

    client.status = _detect_status(page, fills)
    client.photo = _primary_photo(page)
    return client


def parse_odp(odp_path: str) -> list[Client]:
    """Parse every slide of an ODP deck into a list of Client records."""
    with zipfile.ZipFile(odp_path) as z:
        content = z.read("content.xml")
    root = etree.fromstring(content)
    fills = _fill_colors(root)
    pages = root.findall(".//" + _q("draw:page"))
    return [parse_client(pg, i + 1, fills) for i, pg in enumerate(pages)]


def extract_media(odp_path: str, dest_dir: str) -> None:
    """Extract the ODP's media/ folder to ``dest_dir`` (flat filenames)."""
    import os

    os.makedirs(dest_dir, exist_ok=True)
    with zipfile.ZipFile(odp_path) as z:
        for name in z.namelist():
            if name.startswith("media/") and not name.endswith("/"):
                data = z.read(name)
                out = os.path.join(dest_dir, os.path.basename(name))
                with open(out, "wb") as fh:
                    fh.write(data)


if __name__ == "__main__":
    import sys

    clients = parse_odp(sys.argv[1])
    print(f"Parsed {len(clients)} clients")
