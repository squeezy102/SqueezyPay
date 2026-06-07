from sqlalchemy.orm import Session

from models.models import PaymentMethod


class PaymentMethodRepository:
    @staticmethod
    def get_all(db: Session) -> list[PaymentMethod]:
        return db.query(PaymentMethod).all()

    @staticmethod
    def get_by_id(db: Session, payment_method_id: int) -> PaymentMethod | None:
        return db.query(PaymentMethod).filter(PaymentMethod.id == payment_method_id).first()

    @staticmethod
    def create(db: Session, nickname: str, payment_type: str, last_four: str, expiration_date: str | None, notes: str | None) -> PaymentMethod:
        method = PaymentMethod(
            nickname=nickname,
            payment_type=payment_type,
            last_four=last_four,
            expiration_date=expiration_date,
            notes=notes,
        )
        db.add(method)
        db.commit()
        db.refresh(method)
        return method

    @staticmethod
    def update(db: Session, method: PaymentMethod, **kwargs) -> PaymentMethod:
        for key, value in kwargs.items():
            setattr(method, key, value)
        db.commit()
        db.refresh(method)
        return method

    @staticmethod
    def delete(db: Session, method: PaymentMethod) -> None:
        db.delete(method)
        db.commit()
