"""Admin API: enroll clients and manage their face templates."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.face.engine import FaceEngineError, MultipleFacesDetected, NoFaceDetected
from app.face.imaging import ImageDecodeError, decode_image
from app.models import Client
from app.schemas import AddFaceRequest, ClientOut, EnrollRequest
from app.services import enrollment

router = APIRouter(prefix="/api/clients", tags=["clients"])


def _to_out(client: Client) -> ClientOut:
    return ClientOut(
        id=client.id,
        full_name=client.full_name,
        crm_id=client.crm_id,
        membership_no=client.membership_no,
        email=client.email,
        phone=client.phone,
        active=client.active,
        template_count=len(client.templates),
        created_at=client.created_at,
    )


def _decode_or_400(image: str):
    try:
        return decode_image(image)
    except ImageDecodeError as e:
        raise HTTPException(400, f"Could not read image: {e}")


def _handle_face_errors(fn):
    try:
        return fn()
    except NoFaceDetected as e:
        raise HTTPException(422, str(e))
    except MultipleFacesDetected as e:
        raise HTTPException(422, str(e))
    except FaceEngineError as e:
        raise HTTPException(503, str(e))


@router.post("", response_model=ClientOut, status_code=201)
def enroll_client(req: EnrollRequest, db: Session = Depends(get_db)):
    img = _decode_or_400(req.image)
    client = _handle_face_errors(
        lambda: enrollment.create_client_with_face(
            db,
            full_name=req.full_name,
            image_bgr=img,
            crm_id=req.crm_id,
            membership_no=req.membership_no,
            email=req.email,
            phone=req.phone,
        )
    )
    return _to_out(client)


@router.get("", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db)):
    return [_to_out(c) for c in db.query(Client).order_by(Client.created_at.desc()).all()]


@router.get("/{client_id}", response_model=ClientOut)
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter_by(id=client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    return _to_out(client)


@router.post("/{client_id}/faces", response_model=ClientOut)
def add_face(client_id: int, req: AddFaceRequest, db: Session = Depends(get_db)):
    client = db.query(Client).filter_by(id=client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    img = _decode_or_400(req.image)
    _handle_face_errors(lambda: enrollment.add_face_to_client(db, client, img))
    db.refresh(client)
    return _to_out(client)


@router.delete("/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter_by(id=client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    db.delete(client)
    db.commit()
