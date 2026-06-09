"""Katara Members — shared web app.

A small, mobile-friendly board: staff add members, drag/select them between
Pending / Approved / Paid, click a card to open a detail popup, and download the
PowerPoint / Excel any time. Data lives in a local SQLite file so it persists.

Run locally:   python webapp/app.py
Deploy:        see webapp/DEPLOY_PYTHONANYWHERE.md (wsgi.py is the entry point).
"""

from __future__ import annotations

import io
import os
import sys
import tempfile

from flask import (Flask, abort, jsonify, request, send_file,
                   send_from_directory, render_template)
from werkzeug.utils import secure_filename

# Make the repo root importable so we can reuse the katara_tracker generators.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from katara_tracker.excel_builder import build_workbook        # noqa: E402
from katara_tracker.pptx_builder import build_pptx             # noqa: E402
from katara_tracker.render import render_slide                 # noqa: E402
from webapp.models import STATUSES, Member, make_session       # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("KATARA_DATA", HERE)
MEDIA_DIR = os.path.join(DATA_DIR, "media")
DB_PATH = os.path.join(DATA_DIR, "katara.db")
SEED_CSV = os.path.join(HERE, "seed_data.csv")
ALLOWED_IMG = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

os.makedirs(MEDIA_DIR, exist_ok=True)
Session = make_session(DB_PATH)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25 MB uploads


# --------------------------------------------------------------------- seeding
def seed_if_empty() -> None:
    s = Session()
    try:
        if s.query(Member).count() > 0 or not os.path.exists(SEED_CSV):
            return
        from katara_tracker.table_io import read_table

        for i, c in enumerate(read_table(SEED_CSV), start=1):
            m = Member(position=i)
            m.apply({
                "name": c.name, "app_id": c.app_id, "status": c.status,
                "application_type": c.application_type,
                "application_date": c.application_date, "age": c.age,
                "occupation": c.occupation, "company": c.company,
                "membership_plan": c.membership_plan,
                "rate_amount": c.rate_amount, "tag": c.tag, "cec": c.cec,
                "mobile": c.mobile, "special_request": c.special_request,
                "photo": os.path.basename(c.photo) if c.photo else "",
            })
            s.add(m)
        s.commit()
    finally:
        s.close()


# ------------------------------------------------------------------ page + API
@app.route("/")
def index():
    return render_template("index.html", statuses=STATUSES)


@app.route("/api/members")
def list_members():
    s = Session()
    try:
        rows = s.query(Member).order_by(Member.status, Member.position,
                                        Member.id).all()
        return jsonify([m.to_dict() for m in rows])
    finally:
        s.close()


@app.route("/api/members", methods=["POST"])
def create_member():
    data = request.get_json(force=True, silent=True) or request.form.to_dict()
    s = Session()
    try:
        m = Member()
        m.apply(data)
        if not m.app_id:
            m.app_id = "MEM-APP-NEW-%03d" % ((s.query(Member).count() or 0) + 1)
        m.position = (s.query(Member).count() or 0) + 1
        s.add(m)
        s.commit()
        return jsonify(m.to_dict()), 201
    finally:
        s.close()


@app.route("/api/members/<int:mid>", methods=["PATCH", "PUT"])
def update_member(mid):
    data = request.get_json(force=True, silent=True) or request.form.to_dict()
    s = Session()
    try:
        m = s.get(Member, mid)
        if not m:
            abort(404)
        m.apply(data)
        s.commit()
        return jsonify(m.to_dict())
    finally:
        s.close()


@app.route("/api/members/<int:mid>", methods=["DELETE"])
def delete_member(mid):
    s = Session()
    try:
        m = s.get(Member, mid)
        if m:
            s.delete(m)
            s.commit()
        return jsonify({"ok": True})
    finally:
        s.close()


@app.route("/api/members/<int:mid>/photo", methods=["POST"])
def upload_photo(mid):
    s = Session()
    try:
        m = s.get(Member, mid)
        if not m:
            abort(404)
        f = request.files.get("photo")
        if not f or not f.filename:
            abort(400, "no file")
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_IMG:
            abort(400, "unsupported image type")
        fname = secure_filename("m%d_%s" % (mid, f.filename))
        f.save(os.path.join(MEDIA_DIR, fname))
        m.photo = fname
        s.commit()
        return jsonify(m.to_dict())
    finally:
        s.close()


@app.route("/media/<path:fname>")
def media(fname):
    return send_from_directory(MEDIA_DIR, fname)


@app.route("/api/members/<int:mid>/slide.png")
def slide_png(mid):
    s = Session()
    try:
        m = s.get(Member, mid)
        if not m:
            abort(404)
        out = os.path.join(tempfile.gettempdir(), "slide_%d.png" % mid)
        render_slide(m.to_client(), out, MEDIA_DIR)
        return send_file(out, mimetype="image/png")
    finally:
        s.close()


@app.route("/api/stats")
def stats():
    s = Session()
    try:
        rows = s.query(Member).all()
        paid = [m for m in rows if m.status == "Paid"]
        return jsonify({
            "total": len(rows),
            "by_status": {st: sum(1 for m in rows if m.status == st)
                          for st in STATUSES},
            "total_paid": sum(m.rate_amount or 0 for m in paid),
            "pipeline": sum(m.rate_amount or 0 for m in rows),
        })
    finally:
        s.close()


# ---------------------------------------------------------------- downloads
def _all_clients():
    s = Session()
    try:
        return [m.to_client() for m in
                s.query(Member).order_by(Member.status, Member.position).all()]
    finally:
        s.close()


@app.route("/export/xlsx")
def export_xlsx():
    out = os.path.join(tempfile.gettempdir(), "Katara_Tracker.xlsx")
    build_workbook(_all_clients(), MEDIA_DIR, out)
    return send_file(out, as_attachment=True, download_name="Katara_Tracker.xlsx")


@app.route("/export/pptx")
def export_pptx():
    out = os.path.join(tempfile.gettempdir(), "Katara_Profiles.pptx")
    build_pptx(_all_clients(), MEDIA_DIR, out)
    return send_file(out, as_attachment=True,
                     download_name="Katara_Profiles.pptx")


seed_if_empty()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), debug=True)
