"""
Database models for the Katara Club check-in module.

Design notes
------------
* A `Client` is a member profile. In production the `crm_id` links this row to
  the member's record in your CRM; here it is also used by the check-in webhook.
* A client can have MANY `FaceTemplate` rows. Enrolling several shots (different
  angles / lighting) materially improves recognition robustness, so we keep them
  all and match against the best one.
* We store the face *embedding* (a 512-d ArcFace vector) — NOT the photo — as the
  biometric identifier. The raw enrollment image is optional and only kept as a
  small thumbnail for the admin UI. This is the privacy-respecting approach.
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    # Link to the member's record in the external CRM (optional in test mode).
    crm_id = Column(String, index=True, nullable=True)
    full_name = Column(String, nullable=False)
    membership_no = Column(String, index=True, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    templates = relationship("FaceTemplate", back_populates="client", cascade="all, delete-orphan")
    checkins = relationship("CheckIn", back_populates="client", cascade="all, delete-orphan")


class FaceTemplate(Base):
    __tablename__ = "face_templates"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), index=True, nullable=False)
    # The biometric vector, stored as a JSON array of floats. Always L2-normalised.
    embedding = Column(Text, nullable=False)
    dim = Column(Integer, nullable=False)
    engine = Column(String, nullable=False)        # e.g. "insightface:buffalo_l"
    det_score = Column(Float, nullable=True)        # detector confidence at enroll
    thumbnail_path = Column(String, nullable=True)  # optional, admin UI only
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="templates")


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), index=True, nullable=True)
    similarity = Column(Float, nullable=True)        # cosine score of the match
    margin = Column(Float, nullable=True)            # best - runner_up
    liveness_passed = Column(Boolean, default=True)
    method = Column(String, default="face")          # face | manual | qr
    outcome = Column(String, default="checked_in")   # checked_in | rejected | no_match
    crm_synced = Column(Boolean, default=False)
    note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="checkins")
