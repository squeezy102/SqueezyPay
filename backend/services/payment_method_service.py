from sqlalchemy.orm import Session
from repositories.payment_method_repository import PaymentMethodRepository
from core.logging_config import get_logger

logger = get_logger("squeezypay.services.payment_methods")


class PaymentMethodService:
    def __init__(self, db: Session):
        self.repo = PaymentMethodRepository(db)

    def get_all(self) -> list[dict]:
        return [self._to_dict(m) for m in self.repo.get_all()]

    def get_by_id(self, payment_method_id: int) -> dict | None:
        method = self.repo.get_by_id(payment_method_id)
        if not method:
            return None
        return self._to_dict(method)

    def create(self, nickname: str, payment_type: str, last_four: str, expiration_date: str | None, notes: str | None) -> dict:
        method = self.repo.create(nickname, payment_type, last_four, expiration_date, notes)
        result = self._to_dict(method)
        logger.info(f"Created payment method id={result['id']} nickname='{nickname}'")
        return result

    def update(self, payment_method_id: int, **kwargs) -> dict | None:
        method = self.repo.get_by_id(payment_method_id)
        if not method:
            logger.warning(f"Update attempted on non-existent payment method id={payment_method_id}")
            return None
        result = self._to_dict(self.repo.update(method, **kwargs))
        logger.info(f"Updated payment method id={payment_method_id}")
        return result

    def delete(self, payment_method_id: int) -> bool:
        method = self.repo.get_by_id(payment_method_id)
        if not method:
            logger.warning(f"Delete attempted on non-existent payment method id={payment_method_id}")
            return False
        self.repo.delete(method)
        logger.info(f"Deleted payment method id={payment_method_id}")
        return True

    def _to_dict(self, method) -> dict:
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
