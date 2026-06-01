from sqlalchemy.orm import Session
from models.models import PaymentHistory


class PaymentHistoryRepository:
    @staticmethod
    def get_by_bill(db: Session, bill_id: int) -> list[PaymentHistory]:
        return (
            db.query(PaymentHistory)
            .filter(PaymentHistory.bill_id == bill_id)
            .order_by(PaymentHistory.payment_date.desc())
            .all()
        )

    @staticmethod
    def get_all(db: Session) -> list[PaymentHistory]:
        return db.query(PaymentHistory).order_by(PaymentHistory.payment_date.desc()).all()

    @staticmethod
    def get_by_id(db: Session, payment_id: int) -> PaymentHistory | None:
        return db.query(PaymentHistory).filter(PaymentHistory.id == payment_id).first()

    @staticmethod
    def create(db: Session, data: dict) -> PaymentHistory:
        payment = PaymentHistory(**data)
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

    @staticmethod
    def delete(db: Session, payment_id: int) -> bool:
        payment = db.query(PaymentHistory).filter(PaymentHistory.id == payment_id).first()
        if not payment:
            return False
        db.delete(payment)
        db.commit()
        return True
