"""Katara Members — shared web app (logins, owners, history, dashboard).

Staff sign in, add members, assign owners, move them between Pending / Approved
/ Paid, search & filter, see who changed what, restore deleted members, run
bulk actions, view a charts dashboard, and download PowerPoint / Excel.
Data is stored in a local SQLite file so it persists.

Run locally:   python webapp/app.py   (logins seeded: see STAFF_USERS)
Deploy:        see webapp/DEPLOY_PYTHONANYWHERE.md (wsgi.py is the entry point).
"""

from __future__ import annotations

import datetime
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
from webapp.models import (STATUSES, Activity, Member, User,    # noqa: E402
                           make_session)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("KATARA_DATA", HERE)
MEDIA_DIR = os.path.join(DATA_DIR, "media")
DB_PATH = os.path.join(DATA_DIR, "katara.db")
SEED_CSV = os.path.join(HERE, "seed_data.csv")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
ALLOWED_IMG = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

STAFF_USERS = ["Angelina", "Anis", "Imad", "Hilal", "Asma", "Ines", "Rihem",
               "Maria", "Madha"]
DEFAULT_PASSWORD = "Katara@2026"

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)
Session = make_session(DB_PATH)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024


def _secret_key() -> bytes:
    path = os.path.join(DATA_DIR, "secret.key")
    if os.path.exists(path):
        return open(path, "rb").read()
    key = os.urandom(32)
    with open(path, "wb") as fh:
        fh.write(key)
    return key


app.secret_key = _secret_key()
app.permanent_session_lifetime = datetime.timedelta(days=30)


# --------------------------------------------------------------- auth helpers
PUBLIC_ENDPOINTS = {"login", "static"}


@app.before_request
def require_login():
    if request.endpoint in PUBLIC_ENDPOINTS:
        return
    if session.get("uid"):
        return
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


def _user() -> str:
    return session.get("uname", "")


def _log(s, action, member, detail=""):
    s.add(Activity(user=_user(), action=action,
                   member_id=member.id or 0, member_name=member.name or "",
                   detail=detail))


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
            session["uname_login"] = u.username
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


def _daily_backup() -> None:
    """Copy the DB to backups/ once per day."""
    try:
        if not os.path.exists(DB_PATH):
            return
        stamp = datetime.date.today().isoformat()
        dest = os.path.join(BACKUP_DIR, "katara_%s.db" % stamp)
        if not os.path.exists(dest):
            import shutil
            shutil.copy2(DB_PATH, dest)
            # keep the 14 most recent
            files = sorted(os.listdir(BACKUP_DIR))
            for old in files[:-14]:
                os.remove(os.path.join(BACKUP_DIR, old))
    except Exception:
        pass


# ------------------------------------------------------------------ page + API
@app.route("/")
def index():
    return render_template("index.html", statuses=STATUSES,
                           uname=session.get("uname", ""),
                           ulogin=session.get("uname_login", ""),
                           is_admin=session.get("is_admin", False))


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", uname=session.get("uname", ""))


@app.route("/api/members")
def list_members():
    s = Session()
    try:
        rows = s.query(Member).filter(Member.deleted == 0).order_by(
            Member.status, Member.position, Member.id).all()
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
        if not m.cec:
            m.cec = session.get("uname_login", "")
        m.updated_by = _user()
        m.position = (s.query(Member).count() or 0) + 1
        if m.status == "Approved":
            m.approved_at = datetime.datetime.utcnow()
        if m.status == "Paid":
            m.paid_at = datetime.datetime.utcnow()
        s.add(m)
        s.flush()
        _log(s, "created", m, "added member")
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
        old_status = m.status
        m.apply(data)
        m.updated_by = _user()
        if m.status != old_status:
            now = datetime.datetime.utcnow()
            if m.status == "Approved" and not m.approved_at:
                m.approved_at = now
            if m.status == "Paid" and not m.paid_at:
                m.paid_at = now
            _log(s, "moved", m, "%s → %s" % (old_status, m.status))
        else:
            _log(s, "edited", m, "edited details")
        s.commit()
        return jsonify(m.to_dict())
    finally:
        s.close()


@app.route("/api/members/bulk", methods=["POST"])
def bulk_members():
    data = request.get_json(force=True, silent=True) or {}
    ids = data.get("ids") or []
    action = data.get("action")
    s = Session()
    try:
        n = 0
        for mid in ids:
            m = s.get(Member, int(mid))
            if not m:
                continue
            if action == "status":
                new = data.get("status")
                if new in STATUSES and new != m.status:
                    old = m.status
                    m.status = new
                    m.updated_by = _user()
                    now = datetime.datetime.utcnow()
                    if new == "Approved" and not m.approved_at:
                        m.approved_at = now
                    if new == "Paid" and not m.paid_at:
                        m.paid_at = now
                    _log(s, "moved", m, "%s → %s (bulk)" % (old, new))
                    n += 1
            elif action == "delete":
                m.deleted = 1
                _log(s, "deleted", m, "moved to recycle bin (bulk)")
                n += 1
        s.commit()
        return jsonify({"updated": n})
    finally:
        s.close()


@app.route("/api/members/<int:mid>", methods=["DELETE"])
def delete_member(mid):
    s = Session()
    try:
        m = s.get(Member, mid)
        if m:
            m.deleted = 1
            _log(s, "deleted", m, "moved to recycle bin")
            s.commit()
        return jsonify({"ok": True})
    finally:
        s.close()


@app.route("/api/members/<int:mid>/restore", methods=["POST"])
def restore_member(mid):
    s = Session()
    try:
        m = s.get(Member, mid)
        if m:
            m.deleted = 0
            _log(s, "restored", m, "restored from recycle bin")
            s.commit()
        return jsonify({"ok": True})
    finally:
        s.close()


@app.route("/api/members/<int:mid>/purge", methods=["DELETE"])
@admin_only
def purge_member(mid):
    s = Session()
    try:
        m = s.get(Member, mid)
        if m:
            _log(s, "purged", m, "deleted permanently")
            s.delete(m)
            s.commit()
        return jsonify({"ok": True})
    finally:
        s.close()


@app.route("/api/recyclebin")
def recyclebin():
    s = Session()
    try:
        rows = s.query(Member).filter(Member.deleted == 1).order_by(
            Member.updated_at.desc()).all()
        return jsonify([m.to_dict() for m in rows])
    finally:
        s.close()


@app.route("/api/members/<int:mid>/history")
def member_history(mid):
    s = Session()
    try:
        rows = s.query(Activity).filter(Activity.member_id == mid).order_by(
            Activity.ts.desc()).limit(100).all()
        return jsonify([a.to_dict() for a in rows])
    finally:
        s.close()


@app.route("/api/activity")
def activity_feed():
    s = Session()
    try:
        rows = s.query(Activity).order_by(Activity.ts.desc()).limit(200).all()
        return jsonify([a.to_dict() for a in rows])
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
        m.updated_by = _user()
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


# ------------------------------------------------------------------ analytics
@app.route("/api/stats")
def stats():
    s = Session()
    try:
        rows = s.query(Member).filter(Member.deleted == 0).all()
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


@app.route("/api/analytics")
def analytics():
    from collections import defaultdict
    s = Session()
    try:
        rows = s.query(Member).filter(Member.deleted == 0).all()
        by_status = {st: 0 for st in STATUSES}
        by_type = defaultdict(lambda: {"n": 0, "amt": 0})
        by_cec = defaultdict(int)
        monthly = defaultdict(lambda: {"joiners": 0, "collected": 0})
        collected = pipeline = 0
        for m in rows:
            by_status[m.status] = by_status.get(m.status, 0) + 1
            t = m.membership_plan or "(unspecified)"
            by_type[t]["n"] += 1
            by_type[t]["amt"] += m.rate_amount or 0
            by_cec[(m.cec or "(none)")] += 1
            pipeline += m.rate_amount or 0
            if m.status == "Paid":
                collected += m.rate_amount or 0
            key = _month_key(m.application_date)
            if key:
                monthly[key]["joiners"] += 1
                if m.status == "Paid":
                    monthly[key]["collected"] += m.rate_amount or 0
        months = sorted(monthly.keys())
        return jsonify({
            "collected": collected, "pipeline": pipeline,
            "by_status": by_status,
            "by_type": {k: v for k, v in sorted(
                by_type.items(), key=lambda kv: -kv[1]["n"])},
            "by_cec": dict(sorted(by_cec.items(), key=lambda kv: -kv[1])),
            "months": months,
            "monthly_joiners": [monthly[k]["joiners"] for k in months],
            "monthly_collected": [monthly[k]["collected"] for k in months],
        })
    finally:
        s.close()


def _month_key(date_str: str):
    """Turn 'DD/MM/YYYY' (or similar) into 'YYYY-MM' for the trend chart."""
    if not date_str:
        return None
    import re
    m = re.search(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})", date_str)
    if not m:
        return None
    _d, mo, y = m.groups()
    if len(y) == 2:
        y = "20" + y
    try:
        return "%s-%02d" % (y, int(mo))
    except ValueError:
        return None


# ------------------------------------------------------------- staff + account
@app.route("/api/staff_names")
def staff_names():
    """All staff (for owner dropdown / filters) — any logged-in user."""
    s = Session()
    try:
        return jsonify([{"username": u.username,
                         "display_name": u.display_name or u.username}
                        for u in s.query(User).order_by(User.username)])
    finally:
        s.close()


@app.route("/api/me/password", methods=["POST"])
def change_my_password():
    data = request.get_json(force=True, silent=True) or {}
    cur = data.get("current") or ""
    new = data.get("new") or ""
    if len(new) < 4:
        abort(400, "new password too short")
    s = Session()
    try:
        u = s.get(User, session["uid"])
        if not u or not u.check_password(cur):
            abort(400, "current password is wrong")
        u.set_password(new)
        s.commit()
        return jsonify({"ok": True})
    finally:
        s.close()


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
def _all_clients(only_ids=None):
    s = Session()
    try:
        q = s.query(Member).filter(Member.deleted == 0)
        rows = q.order_by(Member.status, Member.position).all()
        if only_ids:
            ids = set(int(i) for i in only_ids)
            rows = [m for m in rows if m.id in ids]
        return [m.to_client() for m in rows]
    finally:
        s.close()


@app.route("/export/xlsx")
def export_xlsx():
    ids = request.args.get("ids")
    only = ids.split(",") if ids else None
    out = os.path.join(tempfile.gettempdir(), "Katara_Tracker.xlsx")
    build_workbook(_all_clients(only), MEDIA_DIR, out)
    return send_file(out, as_attachment=True, download_name="Katara_Tracker.xlsx")


@app.route("/export/pptx")
def export_pptx():
    ids = request.args.get("ids")
    only = ids.split(",") if ids else None
    out = os.path.join(tempfile.gettempdir(), "Katara_Profiles.pptx")
    build_pptx(_all_clients(only), MEDIA_DIR, out)
    return send_file(out, as_attachment=True,
                     download_name="Katara_Profiles.pptx")


seed_if_empty()
_daily_backup()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), debug=True)
