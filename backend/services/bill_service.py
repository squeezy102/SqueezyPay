from sqlalchemy.orm import Session
from models.models import Bill
from core.logging_config import get_logger

logger = get_logger("squeezypay.services.bills")


class BillService:
    @staticmethod
    def get_all_bills(db: Session, include_inactive: bool = False) -> list[dict]:
        query = db.query(Bill) if include_inactive else db.query(Bill).filter(Bill.active == True)
        bills = query.all()
        logger.info(f"Retrieved {len(bills)} bills (include_inactive={include_inactive})")
        return [BillService._to_dict(b) for b in bills]

    @staticmethod
    def get_bill(db: Session, bill_id: int) -> dict | None:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            return None
        return BillService._to_dict(bill)

    @staticmethod
    def create_bill(db: Session, bill_data: dict) -> dict:
        bill = Bill(**bill_data)
        db.add(bill)
        db.commit()
        db.refresh(bill)
        logger.info(f"Created bill id={bill.id} name='{bill.name}'")
        return BillService._to_dict(bill)

    @staticmethod
    def update_bill(db: Session, bill_id: int, bill_data: dict) -> dict | None:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            logger.warning(f"Update attempted on non-existent bill id={bill_id}")
            return None
        for key, value in bill_data.items():
            setattr(bill, key, value)
        db.commit()
        db.refresh(bill)
        logger.info(f"Updated bill id={bill.id}")
        return BillService._to_dict(bill)

    @staticmethod
    def deactivate_bill(db: Session, bill_id: int) -> dict | None:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            logger.warning(f"Deactivate attempted on non-existent bill id={bill_id}")
            return None
        bill.active = False
        db.commit()
        db.refresh(bill)
        logger.info(f"Deactivated bill id={bill.id} name='{bill.name}'")
        return BillService._to_dict(bill)

    @staticmethod
    def _to_dict(bill: Bill) -> dict:
        return {
            "id": bill.id,
            "name": bill.name,
            "category": bill.category,
            "expected_amount": bill.expected_amount,
            "day_of_month": bill.day_of_month,
            "url": bill.url,
            "recurring": bill.recurring,
            "active": bill.active,
            "notes": bill.notes,
        }
