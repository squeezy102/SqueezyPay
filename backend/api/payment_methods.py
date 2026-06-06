import re
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from database.db import get_db
from services.payment_method_service import PaymentMethodService

router = APIRouter(prefix="/api/payment-methods", tags=["payment-methods"])


class PaymentType(str, Enum):
    credit_card = "credit_card"
    debit_card = "debit_card"
    bank_account = "bank_account"


class PaymentMethodCreate(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=255)
    payment_type: str = Field(..., min_length=1, max_length=50)
    last_four: str = Field(..., min_length=4, max_length=4)
    expiration_date: str | None = None
    notes: str | None = None

    @field_validator("last_four")
    @classmethod
    def must_be_digits(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}", v):
            raise ValueError("last_four must be exactly 4 digits")
        return v

    @field_validator("nickname")
    @classmethod
    def strip_nickname(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("nickname cannot be blank")
        return v


class PaymentMethodUpdate(BaseModel):
    nickname: str | None = Field(None, min_length=1, max_length=255)
    payment_type: str | None = Field(None, min_length=1, max_length=50)
    last_four: str | None = Field(None, min_length=4, max_length=4)
    expiration_date: str | None = None
    notes: str | None = None

    @field_validator("last_four")
    @classmethod
    def must_be_digits(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.fullmatch(r"\d{4}", v):
            raise ValueError("last_four must be exactly 4 digits")
        return v


@router.get("/")
def list_payment_methods(db: Session = Depends(get_db)):
    return PaymentMethodService.get_all(db)


@router.get("/{payment_method_id}")
def get_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    result = PaymentMethodService.get_by_id(db, payment_method_id)
    if not result:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return result


@router.post("/", status_code=201)
def create_payment_method(payload: PaymentMethodCreate, db: Session = Depends(get_db)):
    return PaymentMethodService.create(
        db,
        nickname=payload.nickname,
        payment_type=payload.payment_type,
        last_four=payload.last_four,
        expiration_date=payload.expiration_date,
        notes=payload.notes,
    )


@router.put("/{payment_method_id}")
def update_payment_method(payment_method_id: int, payload: PaymentMethodUpdate, db: Session = Depends(get_db)):
    updates = payload.model_dump(exclude_none=True)
    result = PaymentMethodService.update(db, payment_method_id, **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return result


@router.delete("/{payment_method_id}", status_code=204)
def delete_payment_method(payment_method_id: int, db: Session = Depends(get_db)):
    deleted = PaymentMethodService.delete(db, payment_method_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Payment method not found")
