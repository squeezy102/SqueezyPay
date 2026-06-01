from sqlalchemy.orm import Session
from models.models import PaymentMethod


class PaymentMethodRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[PaymentMethod]:
        return self.db.query(PaymentMethod).all()

    def get_by_id(self, payment_method_id: int) -> PaymentMethod | None:
        return self.db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()

    def create(self, nickname: str, payment_type: str, last_four: str, expiration_date: str | None, notes: str | None) -> PaymentMethod:
        method = PaymentMethod(
            nickname=nickname,
            payment_type=payment_type,
            last_four=last_four,
            expiration_date=expiration_date,
            notes=notes,
        )
        self.db.add(method)
        self.db.commit()
        self.db.refresh(method)
        return method

    def update(self, method: PaymentMethod, **kwargs) -> PaymentMethod:
        for key, value in kwargs.items():
            setattr(method, key, value)
        self.db.commit()
        self.db.refresh(method)
        return method

    def delete(self, method: PaymentMethod) -> None:
        self.db.delete(method)
        self.db.commit()
