"""Database models for the Katara member web app (SQLite via SQLAlchemy)."""

from __future__ import annotations

import datetime

from sqlalchemy import (Column, DateTime, Integer, String, Text, create_engine)
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

STATUSES = ["Pending approval", "Approved", "Paid"]


def _now():
    return datetime.datetime.utcnow()


def _iso(dt):
    return dt.isoformat() if dt else ""


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), default="")
    app_id = Column(String(80), default="")
    status = Column(String(40), default="Pending approval")
    application_type = Column(String(40), default="")
    application_date = Column(String(40), default="")
    age = Column(String(40), default="")
    occupation = Column(String(120), default="")
    company = Column(String(160), default="")
    membership_plan = Column(String(120), default="")
    rate_amount = Column(Integer, default=0)
    tag = Column(String(40), default="")
    cec = Column(String(80), default="")
    mobile = Column(String(60), default="")
    special_request = Column(Text, default="")
    photo = Column(String(200), default="")
    owner = Column(String(80), default="")            # staff username (assignee)
    position = Column(Integer, default=0)

    # bookkeeping
    updated_by = Column(String(80), default="")
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    approved_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    deleted = Column(Integer, default=0)              # 1 = in recycle bin

    EDITABLE = [
        "name", "app_id", "status", "application_type", "application_date",
        "age", "occupation", "company", "membership_plan", "rate_amount", "tag",
        "cec", "mobile", "special_request", "photo", "owner", "position",
    ]

    def to_dict(self) -> dict:
        d = {f: getattr(self, f) for f in self.EDITABLE}
        d["id"] = self.id
        d["updated_by"] = self.updated_by
        d["created_at"] = _iso(self.created_at)
        d["updated_at"] = _iso(self.updated_at)
        d["approved_at"] = _iso(self.approved_at)
        d["paid_at"] = _iso(self.paid_at)
        d["deleted"] = bool(self.deleted)
        return d

    def apply(self, data: dict) -> None:
        for f in self.EDITABLE:
            if f not in data:
                continue
            val = data[f]
            if f in ("rate_amount", "position"):
                val = _to_int(val)
            setattr(self, f, val if val is not None else "")
        if self.status not in STATUSES:
            self.status = "Pending approval"

    def to_client(self):
        from katara_tracker.odp_parser import Client

        c = Client(
            slide_index=self.id or 0, name=self.name or "",
            app_id=self.app_id or "", status=self.status or "Pending approval",
            application_type=self.application_type or "",
            application_date=self.application_date or "", age=self.age or "",
            occupation=self.occupation or "", company=self.company or "",
            membership_plan=self.membership_plan or "",
            rate_amount=self.rate_amount or 0, tag=self.tag or "",
            cec=self.cec or "", mobile=self.mobile or "",
            special_request=self.special_request or "", photo=self.photo or "",
        )
        c.rate = "QAR %s" % format(c.rate_amount, ",") if c.rate_amount else ""
        return c


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, index=True)
    display_name = Column(String(120), default="")
    password_hash = Column(String(255), default="")
    is_admin = Column(Integer, default=0)

    def set_password(self, raw: str) -> None:
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        from werkzeug.security import check_password_hash
        return bool(self.password_hash) and check_password_hash(
            self.password_hash, raw)

    def to_dict(self) -> dict:
        return {"id": self.id, "username": self.username,
                "display_name": self.display_name,
                "is_admin": bool(self.is_admin)}


class Activity(Base):
    """An audit log entry: who did what to which member, when."""

    __tablename__ = "activity"

    id = Column(Integer, primary_key=True)
    ts = Column(DateTime, default=_now)
    user = Column(String(80), default="")
    action = Column(String(40), default="")       # created / edited / moved / deleted ...
    member_id = Column(Integer, default=0)
    member_name = Column(String(200), default="")
    detail = Column(Text, default="")

    def to_dict(self) -> dict:
        return {"id": self.id, "ts": _iso(self.ts), "user": self.user,
                "action": self.action, "member_id": self.member_id,
                "member_name": self.member_name, "detail": self.detail}


def _to_int(v) -> int:
    if v in (None, ""):
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        s = "".join(ch for ch in str(v) if ch.isdigit())
        return int(s) if s else 0


def _migrate(engine) -> None:
    """Add any columns introduced in newer versions to an existing 'members'
    table (SQLite create_all does not alter existing tables). Idempotent."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if not insp.has_table("members"):
        return
    existing = {c["name"] for c in insp.get_columns("members")}
    adds = [
        ("owner", "TEXT DEFAULT ''"),
        ("updated_by", "TEXT DEFAULT ''"),
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
        ("approved_at", "DATETIME"),
        ("paid_at", "DATETIME"),
        ("deleted", "INTEGER DEFAULT 0"),
    ]
    with engine.begin() as conn:
        for name, ddl in adds:
            if name not in existing:
                conn.execute(text("ALTER TABLE members ADD COLUMN %s %s"
                                  % (name, ddl)))


def make_session(db_path: str):
    engine = create_engine("sqlite:///%s" % db_path, future=True,
                           connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    _migrate(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)
