"""Generate a tiny synthetic Katara-style ODP deck for tests, so the suite
never depends on the (large, private) real presentation."""

from __future__ import annotations

import zipfile

_HEAD = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<office:document-content '
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
    'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
    'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" '
    'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" '
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
    'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" '
    'xmlns:xlink="http://www.w3.org/1999/xlink">'
    '<office:automatic-styles>'
    '<style:style style:name="green" style:family="graphic">'
    '<style:graphic-properties draw:fill-color="#00b050"/></style:style>'
    '</office:automatic-styles>'
    '<office:body><office:presentation>'
)
_FOOT = "</office:presentation></office:body></office:document-content>"

# Vertical position for each label/value row.
_ROWS = [
    ("Application Date :", "application_date", 1.79),
    ("Name :", "name", 2.28),
    ("Age :", "age", 2.77),
    ("Occupation :", "occupation", 3.26),
    ("Company :", "company", 3.75),
    ("Membership Plan :", "membership_plan", 4.24),
    ("Rate :", "rate", 4.73),
    ("Tag :", "tag", 5.22),
    ("Special Request :", "special_request", 5.71),
    ("CEC :", "cec", 6.19),
]


def _shape(x, y, text):
    return (
        '<draw:custom-shape svg:x="%.2fin" svg:y="%.2fin">'
        "<text:p>%s</text:p></draw:custom-shape>" % (x, y, text)
    )


def _slide(member: dict) -> str:
    parts = ['<draw:page draw:name="Slide">']
    parts.append(_shape(2.75, 0.0, "MEMBER PROFILE"))
    parts.append(_shape(9.8, 0.0, member["app_id"]))
    parts.append(_shape(0.35, 1.15, "Application Type: %s" % member.get("type", "New")))
    for label, key, y in _ROWS:
        parts.append(_shape(3.73, y, label))
        parts.append(_shape(5.58, y, str(member.get(key, ""))))
    parts.append(_shape(1.08, 4.84, "Mobile Number :%s" % member.get("mobile", "")))
    # portrait + logo frames
    parts.append(
        '<draw:frame svg:x="0.18in" svg:y="0.15in" svg:width="1.97in" '
        'svg:height="0.64in"><draw:image xlink:href="media/image1.png"/>'
        "</draw:frame>"
    )
    if member.get("photo"):
        parts.append(
            '<draw:frame svg:x="0.6in" svg:y="1.8in" svg:width="2.6in" '
            'svg:height="2.6in"><draw:image xlink:href="%s"/></draw:frame>'
            % member["photo"]
        )
    status = member.get("status", "Pending approval")
    if status in ("Approved", "Paid"):
        parts.append(
            '<draw:frame draw:style-name="green" svg:x="6.9in" svg:y="0.46in">'
            "<draw:text-box><text:p>%s</text:p></draw:text-box></draw:frame>"
            % status
        )
    parts.append("</draw:page>")
    return "".join(parts)


def make_sample_odp(path: str, members: list[dict]) -> None:
    content = _HEAD + "".join(_slide(m) for m in members) + _FOOT
    # 1x1 PNG bytes for media.
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        zi = zipfile.ZipInfo("mimetype")
        zi.compress_type = zipfile.ZIP_STORED
        z.writestr(zi, "application/vnd.oasis.opendocument.presentation")
        z.writestr("content.xml", content)
        z.writestr("styles.xml", "<x/>")
        z.writestr("media/image1.png", png)
        for m in members:
            if m.get("photo"):
                z.writestr(m["photo"], png)
