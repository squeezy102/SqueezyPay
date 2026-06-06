from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from database.db import get_db
from services.bill_service import BillService

router = APIRouter(prefix="/api/bills", tags=["bills"])


class BillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    expected_amount: float | None = Field(None, gt=0)
    day_of_month: int = Field(..., ge=1, le=31)
    url: str = Field(..., min_length=1, max_length=500)
    recurring: bool = True
    notes: str | None = None

    @field_validator("name", "category", "url")
    @classmethod
    def strip_and_require(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("field cannot be blank")
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class BillUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = Field(None, min_length=1, max_length=100)
    expected_amount: float | None = Field(None, gt=0)
    day_of_month: int | None = Field(None, ge=1, le=31)
    url: str | None = Field(None, min_length=1, max_length=500)
    recurring: bool | None = None
    notes: str | None = None

    @field_validator("name", "category", "url")
    @classmethod
    def strip_and_require(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("field cannot be blank")
        return v

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


@router.get("/")
def get_bills(db: Session = Depends(get_db)):
    return BillService.get_all_bills(db)


@router.get("/{bill_id}")
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = BillService.get_bill(db, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@router.post("/", status_code=201)
def create_bill(payload: BillCreate, db: Session = Depends(get_db)):
    return BillService.create_bill(db, payload.model_dump())


@router.put("/{bill_id}")
def update_bill(bill_id: int, payload: BillUpdate, db: Session = Depends(get_db)):
    result = BillService.update_bill(db, bill_id, payload.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="Bill not found")
    return result


@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    if not BillService.delete_bill(db, bill_id):
        raise HTTPException(status_code=404, detail="Bill not found")
