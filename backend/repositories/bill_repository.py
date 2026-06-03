from sqlalchemy.orm import Session

from core.logging_config import get_logger
from models.models import Bill

logger = get_logger("squeezypay.repositories.bills")


class BillRepository:
    @staticmethod
    def get_all(db: Session) -> list[Bill]:
        return db.query(Bill).all()

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
    def delete(db: Session, bill_id: int) -> bool:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return False
        db.delete(bill)
        db.commit()
        return True
