from sqlalchemy.orm import Session
from models.models import Bill
from core.logging_config import get_logger

logger = get_logger("squeezypay.repositories.bills")


class BillRepository:
    @staticmethod
    def get_all(db: Session, include_inactive: bool = False) -> list[Bill]:
        query = db.query(Bill) if include_inactive else db.query(Bill).filter(Bill.active.is_(True))
        return query.all()

    @staticmethod
    def get_by_id(db: Session, bill_id: int) -> Bill | None:
        return db.query(Bill).filter(Bill.id == bill_id).first()

    @staticmethod
    def create(db: Session, data: dict) -> Bill:
        bill = Bill(**data)
        db.add(bill)
        db.commit()
        db.refresh(bill)
        return bill

    @staticmethod
    def update(db: Session, bill_id: int, data: dict) -> Bill | None:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        for key, value in data.items():
            setattr(bill, key, value)
        db.commit()
        db.refresh(bill)
        return bill

    @staticmethod
    def deactivate(db: Session, bill_id: int) -> Bill | None:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        bill.active = False
        db.commit()
        db.refresh(bill)
        return bill

    @staticmethod
    def reactivate(db: Session, bill_id: int) -> Bill | None:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        bill.active = True
        db.commit()
        db.refresh(bill)
        return bill
