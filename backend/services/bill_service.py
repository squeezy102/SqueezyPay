from sqlalchemy.orm import Session
from models.models import Bill
from repositories.bill_repository import BillRepository
from core.logging_config import get_logger

logger = get_logger("squeezypay.services.bills")


class BillService:
    @staticmethod
    def get_all_bills(db: Session, include_inactive: bool = False) -> list[dict]:
        bills = BillRepository.get_all(db, include_inactive=include_inactive)
        logger.info(f"Retrieved {len(bills)} bills (include_inactive={include_inactive})")
        return [BillService._to_dict(b) for b in bills]

    @staticmethod
    def get_bill(db: Session, bill_id: int) -> dict | None:
        bill = BillRepository.get_by_id(db, bill_id)
        if not bill:
            return None
        return BillService._to_dict(bill)

    @staticmethod
    def create_bill(db: Session, bill_data: dict) -> dict:
        bill = BillRepository.create(db, bill_data)
        logger.info(f"Created bill id={bill.id} name='{bill.name}'")
        return BillService._to_dict(bill)

    @staticmethod
    def update_bill(db: Session, bill_id: int, bill_data: dict) -> dict | None:
        bill = BillRepository.update(db, bill_id, bill_data)
        if not bill:
            logger.warning(f"Update attempted on non-existent bill id={bill_id}")
            return None
        logger.info(f"Updated bill id={bill.id}")
        return BillService._to_dict(bill)

    @staticmethod
    def deactivate_bill(db: Session, bill_id: int) -> dict | None:
        bill = BillRepository.deactivate(db, bill_id)
        if not bill:
            logger.warning(f"Deactivate attempted on non-existent bill id={bill_id}")
            return None
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
