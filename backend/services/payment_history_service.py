from datetime import datetime
from sqlalchemy.orm import Session
from models.models import PaymentHistory, Bill
from repositories.payment_history_repository import PaymentHistoryRepository
from core.logging_config import get_logger

logger = get_logger("squeezypay.services.payment_history")


class PaymentHistoryService:
    @staticmethod
    def get_by_bill(db: Session, bill_id: int) -> list[dict]:
        bill = db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            logger.warning(f"Payment history requested for non-existent bill id={bill_id}")
            return []
        payments = PaymentHistoryRepository.get_by_bill(db, bill_id)
        return [PaymentHistoryService._to_dict(p, bill.name) for p in payments]

    @staticmethod
    def get_all(db: Session) -> list[dict]:
        rows = (
            db.query(PaymentHistory, Bill.name)
            .join(Bill, PaymentHistory.bill_id == Bill.id)
            .order_by(PaymentHistory.payment_date.desc())
            .all()
        )
        return [PaymentHistoryService._to_dict(payment, bill_name) for payment, bill_name in rows]

    @staticmethod
    def log_payment(db: Session, data: dict) -> dict | None:
        bill = db.query(Bill).filter(Bill.id == data["bill_id"]).first()
        if not bill:
            logger.warning(f"Payment log attempted for non-existent bill id={data['bill_id']}")
            return None

        if isinstance(data.get("payment_date"), str):
            data["payment_date"] = datetime.fromisoformat(data["payment_date"])

        payment = PaymentHistoryRepository.create(db, data)
        logger.info(
            f"Payment logged bill_id={payment.bill_id} amount={payment.amount_paid} "
            f"confirmation='{payment.confirmation_number}'"
        )
        return PaymentHistoryService._to_dict(payment, bill.name)

    @staticmethod
    def delete_payment(db: Session, payment_id: int) -> bool:
        deleted = PaymentHistoryRepository.delete(db, payment_id)
        if deleted:
            logger.info(f"Payment record deleted id={payment_id}")
        else:
            logger.warning(f"Delete attempted on non-existent payment id={payment_id}")
        return deleted

    @staticmethod
    def _to_dict(payment: PaymentHistory, bill_name: str) -> dict:
        return {
            "id": payment.id,
            "bill_id": payment.bill_id,
            "bill_name": bill_name,
            "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
            "amount_paid": payment.amount_paid,
            "payment_method": payment.payment_method,
            "confirmation_number": payment.confirmation_number,
            "notes": payment.notes,
            "created_at": payment.created_at.isoformat() if payment.created_at else None,
        }
