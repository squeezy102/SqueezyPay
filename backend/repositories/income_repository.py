from sqlalchemy.orm import Session
from models.models import Income
from core.logging_config import get_logger

logger = get_logger("squeezypay.repositories.income")


class IncomeRepository:
    @staticmethod
    def get_all(db: Session, include_inactive: bool = False) -> list[Income]:
        query = db.query(Income)
        if not include_inactive:
            query = query.filter(Income.active.is_(True))
        return query.order_by(Income.source_name).all()

    @staticmethod
    def get_by_id(db: Session, income_id: int) -> Income | None:
        return db.query(Income).filter(Income.id == income_id).first()

    @staticmethod
    def create(db: Session, data: dict) -> Income:
        income = Income(**data)
        db.add(income)
        db.commit()
        db.refresh(income)
        return income

    @staticmethod
    def update(db: Session, income_id: int, data: dict) -> Income | None:
        income = db.query(Income).filter(Income.id == income_id).first()
        if not income:
            return None
        for key, value in data.items():
            setattr(income, key, value)
        db.commit()
        db.refresh(income)
        return income

    @staticmethod
    def deactivate(db: Session, income_id: int) -> bool:
        income = db.query(Income).filter(Income.id == income_id).first()
        if not income:
            return False
        income.active = False
        db.commit()
        return True

    @staticmethod
    def reactivate(db: Session, income_id: int) -> bool:
        income = db.query(Income).filter(Income.id == income_id).first()
        if not income:
            return False
        income.active = True
        db.commit()
        return True
