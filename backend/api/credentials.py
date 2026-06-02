from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.db import get_db
from services.credential_service import CredentialService

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


class CredentialCreate(BaseModel):
    bill_id: int
    username: str
    password: str
    notes: str | None = None


class CredentialUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    notes: str | None = None


@router.get("/")
def list_credentials(db: Session = Depends(get_db)):
    return CredentialService.get_all(db)


@router.get("/{credential_id}")
def get_credential(credential_id: int, db: Session = Depends(get_db)):
    result = CredentialService.get_by_id(db, credential_id)
    if not result:
        raise HTTPException(status_code=404, detail="Credential not found")
    return result


@router.get("/by-bill/{bill_id}")
def get_credential_by_bill(bill_id: int, db: Session = Depends(get_db)):
    result = CredentialService.get_by_bill_id(db, bill_id)
    if not result:
        raise HTTPException(status_code=404, detail="No credential found for this bill")
    return result


@router.post("/", status_code=201)
def create_credential(payload: CredentialCreate, db: Session = Depends(get_db)):
    return CredentialService.create(
        db,
        bill_id=payload.bill_id,
        username=payload.username,
        password=payload.password,
        notes=payload.notes,
    )


@router.put("/{credential_id}")
def update_credential(credential_id: int, payload: CredentialUpdate, db: Session = Depends(get_db)):
    updates = payload.model_dump(exclude_none=True)
    result = CredentialService.update(db, credential_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Credential not found")
    return result


@router.delete("/{credential_id}", status_code=204)
def delete_credential(credential_id: int, db: Session = Depends(get_db)):
    deleted = CredentialService.delete(db, credential_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Credential not found")
