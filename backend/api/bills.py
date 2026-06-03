from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.db import get_db
from services.bill_service import BillService

router = APIRouter(prefix="/api/bills", tags=["bills"])


class BillCreate(BaseModel):
    name: str
    category: str
    expected_amount: float | None = None
    day_of_month: int
    url: str
    recurring: bool = True
    notes: str | None = None


class BillUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    expected_amount: float | None = None
    day_of_month: int | None = None
    url: str | None = None
    recurring: bool | None = None
    notes: str | None = None


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
