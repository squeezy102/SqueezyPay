from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from services.payment_history_service import PaymentHistoryService

router = APIRouter(prefix="/api/payment-history", tags=["payment-history"])


class PaymentCreate(BaseModel):
    bill_id: int
    payment_date: str
    amount_paid: float
    payment_method: str | None = None
    confirmation_number: str | None = None
    notes: str | None = None


@router.get("/")
def get_all_payments(db: Session = Depends(get_db)):
    return PaymentHistoryService.get_all(db)


@router.get("/bill/{bill_id}")
def get_payments_by_bill(bill_id: int, db: Session = Depends(get_db)):
    return PaymentHistoryService.get_by_bill(db, bill_id)


@router.post("/", status_code=201)
def log_payment(payload: PaymentCreate, db: Session = Depends(get_db)):
    payment = PaymentHistoryService.log_payment(db, payload.model_dump())
    if not payment:
        raise HTTPException(status_code=404, detail="Bill not found")
    return payment


@router.delete("/{payment_id}", status_code=204)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    deleted = PaymentHistoryService.delete_payment(db, payment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Payment record not found")
