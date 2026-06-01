from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.db import get_db
from services.bill_service import BillService

router = APIRouter(prefix="/api/bills", tags=["bills"])


@router.get("/")
def get_bills(db: Session = Depends(get_db)):
    return BillService.get_all_bills(db)


@router.get("/{bill_id}")
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = BillService.get_bill(db, bill_id)
    if not bill:
        return {"error": "Bill not found"}
    return bill


@router.post("/")
def create_bill(bill_data: dict, db: Session = Depends(get_db)):
    return BillService.create_bill(db, bill_data)


@router.put("/{bill_id}")
def update_bill(bill_id: int, bill_data: dict, db: Session = Depends(get_db)):
    return BillService.update_bill(db, bill_id, bill_data)


@router.delete("/{bill_id}")
def deactivate_bill(bill_id: int, db: Session = Depends(get_db)):
    return BillService.deactivate_bill(db, bill_id)
