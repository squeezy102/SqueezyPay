from sqlalchemy.orm import Session

from core.logging_config import get_logger
from repositories.payment_method_repository import PaymentMethodRepository

logger = get_logger("squeezypay.services.payment_methods")


class PaymentMethodService:
    @staticmethod
    def get_all(db: Session) -> list[dict]:
        return [PaymentMethodService._to_dict(m) for m in PaymentMethodRepository.get_all(db)]

    @staticmethod
    def get_by_id(db: Session, payment_method_id: int) -> dict | None:
        method = PaymentMethodRepository.get_by_id(db, payment_method_id)
        if not method:
            return None
        return PaymentMethodService._to_dict(method)

    @staticmethod
    def create(db: Session, nickname: str, payment_type: str, last_four: str, expiration_date: str | None, notes: str | None) -> dict:
        method = PaymentMethodRepository.create(db, nickname, payment_type, last_four, expiration_date, notes)
        result = PaymentMethodService._to_dict(method)
        logger.info(f"Created payment method id={result['id']} nickname='{nickname}'")
        return result

    @staticmethod
    def update(db: Session, payment_method_id: int, **kwargs) -> dict | None:
        method = PaymentMethodRepository.get_by_id(db, payment_method_id)
        if not method:
            logger.warning(f"Update attempted on non-existent payment method id={payment_method_id}")
            return None
        result = PaymentMethodService._to_dict(PaymentMethodRepository.update(db, method, **kwargs))
        logger.info(f"Updated payment method id={payment_method_id}")
        return result

    @staticmethod
    def delete(db: Session, payment_method_id: int) -> bool:
        method = PaymentMethodRepository.get_by_id(db, payment_method_id)
        if not method:
            logger.warning(f"Delete attempted on non-existent payment method id={payment_method_id}")
            return False
        PaymentMethodRepository.delete(db, method)
        logger.info(f"Deleted payment method id={payment_method_id}")
        return True

    @staticmethod
    def _to_dict(method) -> dict:
        return {
            "id": method.id,
            "nickname": method.nickname,
            "payment_type": method.payment_type,
            "last_four": method.last_four,
            "expiration_date": method.expiration_date,
            "notes": method.notes,
            "created_at": method.created_at,
            "updated_at": method.updated_at,
        }
