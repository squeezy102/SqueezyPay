from sqlalchemy.orm import Session

from core.logging_config import get_logger
from models.models import Bill, Credential, PaymentHistory
from repositories.bill_repository import BillRepository

logger = get_logger("squeezypay.services.bills")


class BillService:
    @staticmethod
    def get_all_bills(db: Session) -> list[dict]:
        bills = BillRepository.get_all(db)
        logger.info(f"Retrieved {len(bills)} bills")
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
        existing = BillRepository.get_by_id(db, bill_id)
        if not existing:
            logger.warning(f"Update attempted on non-existent bill id={bill_id}")
            return None
        changes = {
            k: {"from": getattr(existing, k), "to": v}
            for k, v in bill_data.items()
            if getattr(existing, k) != v
        }
        bill = BillRepository.update(db, bill_id, bill_data)
        if changes:
            changes_str = ", ".join(f"{k}: {c['from']!r} → {c['to']!r}" for k, c in changes.items())
            logger.info(f"Updated bill id={bill_id} name='{existing.name}' — {changes_str}")
        else:
            logger.info(f"Updated bill id={bill_id} name='{existing.name}' (no field changes)")
        return BillService._to_dict(bill)

    @staticmethod
    def delete_bill(db: Session, bill_id: int) -> bool:
        bill = BillRepository.get_by_id(db, bill_id)
        if not bill:
            logger.warning(f"Delete attempted on non-existent bill id={bill_id}")
            return False
        name = bill.name
        # Cascade: remove credentials and payment history before deleting the bill
        cred_count = db.query(Credential).filter(Credential.bill_id == bill_id).delete()
        pay_count = db.query(PaymentHistory).filter(PaymentHistory.bill_id == bill_id).delete()
        if cred_count:
            logger.info(f"Cascade deleted {cred_count} credential(s) for bill id={bill_id}")
        if pay_count:
            logger.info(f"Cascade deleted {pay_count} payment record(s) for bill id={bill_id}")
        result = BillRepository.delete(db, bill_id)
        if result:
            logger.info(f"Deleted bill id={bill_id} name='{name}'")
        return result

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
            "notes": bill.notes,
        }
