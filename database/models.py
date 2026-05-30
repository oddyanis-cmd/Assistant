from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Message(Base):
    """Stores the raw API message objects (role + content) for conversation history."""

    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, index=True, nullable=False)
    role = Column(String, nullable=False)   # "user" | "assistant"
    content = Column(JSON, nullable=False)  # raw content block list or string
    created_at = Column(DateTime, default=datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_datetime = Column(DateTime, nullable=False)
    priority = Column(String, default="medium")  # low | medium | high
    completed = Column(Boolean, default=False)
    reminded = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class WaiverSubmission(Base):
    """A digitally signed waiver/consent form submitted by a member."""

    __tablename__ = "waiver_submissions"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String, unique=True, index=True, nullable=False)
    form_id = Column(String, default="K11-AIR-SELECT")
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    membership_id = Column(String, nullable=True)
    staff_name = Column(String, nullable=True)
    form_date = Column(String, nullable=True)        # date as entered on the form
    answers = Column(JSON, nullable=True)            # per-clause Yes/No + text
    pdf_path = Column(String, nullable=True)         # stored signed PDF (local)
    emailed = Column(Boolean, default=False)
    email_error = Column(Text, nullable=True)
    cloud_saved = Column(Boolean, default=False)     # archived into Microsoft 365
    cloud_url = Column(String, nullable=True)        # web URL of the 365 copy
    delivery_channel = Column(String, nullable=True) # graph | smtp | gmail | local
    created_at = Column(DateTime, default=datetime.utcnow)


class OAuthToken(Base):
    """Stores OAuth2 tokens for Gmail and LinkedIn after the one-time auth flow."""

    __tablename__ = "oauth_tokens"

    id = Column(Integer, primary_key=True, index=True)
    service = Column(String, unique=True, nullable=False)  # "gmail" | "linkedin"
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_uri = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    extra_data = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
