from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.db import get_db
from services.payment_method_service import PaymentMethodService

router = APIRouter(prefix="/api/payment-methods", tags=["payment-methods"])


class PaymentMethodCreate(BaseModel):
    nickname: str
    payment_type: str
    last_four: str
    expiration_date: str | None = None
    notes: str | None = None


class PaymentMethodUpdate(BaseModel):
    nickname: str | None = None
    payment_type: str | None = None
    last_four: str | None = None
    expiration_date: str | None = None
    notes: str | None = None


@router.get("/")
def list_payment_methods(db: Session = Depends(get_db)):
    return PaymentMethodService(db).get_all()


@router.get("/{payment_method_id}")
def get_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    result = PaymentMethodService(db).get_by_id(payment_method_id)
    if not result:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return result


@router.post("/", status_code=201)
def create_payment_method(payload: PaymentMethodCreate, db: Session = Depends(get_db)):
    return PaymentMethodService(db).create(
        nickname=payload.nickname,
        payment_type=payload.payment_type,
        last_four=payload.last_four,
        expiration_date=payload.expiration_date,
        notes=payload.notes,
    )


@router.put("/{payment_method_id}")
def update_payment_method(payment_method_id: int, payload: PaymentMethodUpdate, db: Session = Depends(get_db)):
    updates = payload.model_dump(exclude_none=True)
    result = PaymentMethodService(db).update(payment_method_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return result


@router.delete("/{payment_method_id}", status_code=204)
def delete_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    deleted = PaymentMethodService(db).delete(payment_method_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Payment method not found")
