from sqlalchemy.orm import Session
from models.models import TransactionCategory
from core.logging_config import get_logger

logger = get_logger("squeezypay.repositories.categories")


class CategoryRepository:
    @staticmethod
    def get_all(db: Session) -> list[TransactionCategory]:
        return db.query(TransactionCategory).order_by(TransactionCategory.name).all()

    @staticmethod
    def get_by_id(db: Session, category_id: int) -> TransactionCategory | None:
        return db.query(TransactionCategory).filter(TransactionCategory.id == category_id).first()

    @staticmethod
    def get_by_name(db: Session, name: str) -> TransactionCategory | None:
        return db.query(TransactionCategory).filter(TransactionCategory.name == name).first()

    @staticmethod
    def create(db: Session, name: str) -> TransactionCategory:
        category = TransactionCategory(name=name)
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def update(db: Session, category_id: int, name: str) -> TransactionCategory | None:
        category = db.query(TransactionCategory).filter(TransactionCategory.id == category_id).first()
        if not category:
            return None
        category.name = name
        db.commit()
        db.refresh(category)
        return category
