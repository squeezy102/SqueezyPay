from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from services.income_service import IncomeService

router = APIRouter(prefix="/api/income", tags=["income"])


class IncomeCreate(BaseModel):
    source_name: str
    amount: float
    frequency: str
    next_expected_date: str | None = None
    active: bool = True


class IncomeUpdate(BaseModel):
    source_name: str | None = None
    amount: float | None = None
    frequency: str | None = None
    next_expected_date: str | None = None
    active: bool | None = None


@router.get("/monthly-total")
def get_monthly_total(db: Session = Depends(get_db)):
    total = IncomeService.get_monthly_total(db)
    return {"monthly_total": total}


@router.get("/")
def get_all_income(include_inactive: bool = Query(False), db: Session = Depends(get_db)):
    return IncomeService.get_all(db, include_inactive=include_inactive)


@router.get("/{income_id}")
def get_income_by_id(income_id: int, db: Session = Depends(get_db)):
    record = IncomeService.get_by_id(db, income_id)
    if not record:
        raise HTTPException(status_code=404, detail="Income record not found")
    return record


@router.post("/", status_code=201)
def create_income(payload: IncomeCreate, db: Session = Depends(get_db)):
    return IncomeService.create(db, payload.model_dump())


@router.put("/{income_id}")
def update_income(income_id: int, payload: IncomeUpdate, db: Session = Depends(get_db)):
    record = IncomeService.update(db, income_id, payload.model_dump(exclude_none=True))
    if not record:
        raise HTTPException(status_code=404, detail="Income record not found")
    return record


@router.delete("/{income_id}", status_code=204)
def deactivate_income(income_id: int, db: Session = Depends(get_db)):
    deactivated = IncomeService.deactivate(db, income_id)
    if not deactivated:
        raise HTTPException(status_code=404, detail="Income record not found")


@router.post("/{income_id}/reactivate")
def reactivate_income(income_id: int, db: Session = Depends(get_db)):
    reactivated = IncomeService.reactivate(db, income_id)
    if not reactivated:
        raise HTTPException(status_code=404, detail="Income record not found")
    return IncomeService.get_by_id(db, income_id)
