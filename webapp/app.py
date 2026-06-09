"""Katara Members — shared web app (with staff logins).

A small, mobile-friendly board: staff log in, add members, drag/select them
between Pending / Approved / Paid, search, click a card for a detail popup, and
download the PowerPoint / Excel. Data lives in a local SQLite file so it
persists. An admin can manage staff accounts from the "Staff" button.

Run locally:   python webapp/app.py   (first admin: admin / katara2026)
Deploy:        see webapp/DEPLOY_PYTHONANYWHERE.md (wsgi.py is the entry point).
"""

from __future__ import annotations

import functools
import os
import sys
import tempfile

from flask import (Flask, abort, jsonify, redirect, request, session,
                   send_file, send_from_directory, render_template, url_for)
from werkzeug.utils import secure_filename

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from katara_tracker.excel_builder import build_workbook        # noqa: E402
from katara_tracker.pptx_builder import build_pptx             # noqa: E402
from katara_tracker.render import render_slide                 # noqa: E402
from webapp.models import STATUSES, Member, User, make_session  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("KATARA_DATA", HERE)
MEDIA_DIR = os.path.join(DATA_DIR, "media")
DB_PATH = os.path.join(DATA_DIR, "katara.db")
SEED_CSV = os.path.join(HERE, "seed_data.csv")
ALLOWED_IMG = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

# Staff accounts created automatically on first run. Each can also manage staff
# (add/remove logins) via the "Staff" button. Change passwords any time.
STAFF_USERS = ["Angelina", "Anis", "Imad", "Hilal", "Asma", "Ines", "Rihem",
               "Maria", "Madha"]
DEFAULT_PASSWORD = "Katara@2026"

os.makedirs(MEDIA_DIR, exist_ok=True)
Session = make_session(DB_PATH)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024


def _secret_key() -> bytes:
    """Persist a random secret key so logins survive restarts."""
    path = os.path.join(DATA_DIR, "secret.key")
    if os.path.exists(path):
        return open(path, "rb").read()
    key = os.urandom(32)
    with open(path, "wb") as fh:
        fh.write(key)
    return key


app.secret_key = _secret_key()
app.permanent_session_lifetime = __import__("datetime").timedelta(days=30)


# --------------------------------------------------------------- auth helpers
PUBLIC_ENDPOINTS = {"login", "static"}


@app.before_request
def require_login():
    if request.endpoint in PUBLIC_ENDPOINTS:
        return
    if session.get("uid"):
        return
    # Not logged in.
    if request.path.startswith("/api") or request.path.startswith("/export"):
        abort(401)
    return redirect(url_for("login", next=request.path))


def admin_only(fn):
    @functools.wraps(fn)
    def wrap(*a, **k):
        if not session.get("is_admin"):
            abort(403)
        return fn(*a, **k)
    return wrap


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if session.get("uid"):
            return redirect(url_for("index"))
        return render_template("login.html", error=None)
    username = (request.form.get("username") or "").strip()
    password = request.form.get("password") or ""
    s = Session()
    try:
        from sqlalchemy import func

        u = s.query(User).filter(
            func.lower(User.username) == username.lower()).first()
        if u and u.check_password(password):
            session.permanent = True
            session["uid"] = u.id
            session["uname"] = u.display_name or u.username
            session["is_admin"] = bool(u.is_admin)
            return redirect(request.args.get("next") or url_for("index"))
        return render_template("login.html",
                               error="Wrong username or password.")
    finally:
        s.close()


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ------------------------------------------------------------------ seeding
def seed_if_empty() -> None:
    s = Session()
    try:
        if s.query(User).count() == 0:
            for name in STAFF_USERS:
                u = User(username=name, display_name=name, is_admin=1)
                u.set_password(DEFAULT_PASSWORD)
                s.add(u)
            s.commit()
        if s.query(Member).count() == 0 and os.path.exists(SEED_CSV):
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
    return render_template("index.html", statuses=STATUSES,
                           uname=session.get("uname", ""),
                           is_admin=session.get("is_admin", False))


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


# ------------------------------------------------------------- staff (admin)
@app.route("/api/staff")
@admin_only
def list_staff():
    s = Session()
    try:
        return jsonify([u.to_dict() for u in s.query(User).order_by(User.id)])
    finally:
        s.close()


@app.route("/api/staff", methods=["POST"])
@admin_only
def add_staff():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        abort(400, "username and password required")
    s = Session()
    try:
        if s.query(User).filter(User.username == username).first():
            abort(400, "that username already exists")
        u = User(username=username, display_name=data.get("display_name", ""),
                 is_admin=1 if data.get("is_admin") else 0)
        u.set_password(password)
        s.add(u)
        s.commit()
        return jsonify(u.to_dict()), 201
    finally:
        s.close()


@app.route("/api/staff/<int:uid>", methods=["PATCH"])
@admin_only
def edit_staff(uid):
    data = request.get_json(force=True, silent=True) or {}
    s = Session()
    try:
        u = s.get(User, uid)
        if not u:
            abort(404)
        if "display_name" in data:
            u.display_name = data["display_name"]
        if "is_admin" in data:
            u.is_admin = 1 if data["is_admin"] else 0
        if data.get("password"):
            u.set_password(data["password"])
        s.commit()
        return jsonify(u.to_dict())
    finally:
        s.close()


@app.route("/api/staff/<int:uid>", methods=["DELETE"])
@admin_only
def delete_staff(uid):
    if uid == session.get("uid"):
        abort(400, "you cannot delete your own account")
    s = Session()
    try:
        u = s.get(User, uid)
        if u:
            s.delete(u)
            s.commit()
        return jsonify({"ok": True})
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
