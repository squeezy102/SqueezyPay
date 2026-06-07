from sqlalchemy.orm import Session

from core.logging_config import get_logger
from models.models import TransactionCategory
from repositories.category_repository import CategoryRepository

logger = get_logger("squeezypay.services.categories")


class CategoryService:
    @staticmethod
    def get_all(db: Session) -> list[dict]:
        records = CategoryRepository.get_all(db)
        return [CategoryService._to_dict(r) for r in records]

    @staticmethod
    def create(db: Session, name: str) -> dict:
        existing = CategoryRepository.get_by_name(db, name)
        if existing:
            logger.warning(f"Duplicate category name='{name}'")
            raise ValueError(f"Category '{name}' already exists")
        record = CategoryRepository.create(db, name)
        logger.info(f"Category created id={record.id} name='{record.name}'")
        return CategoryService._to_dict(record)

    @staticmethod
    def update(db: Session, category_id: int, name: str) -> dict | None:
        existing = CategoryRepository.get_by_name(db, name)
        if existing and existing.id != category_id:
            logger.warning(f"Duplicate category name='{name}' on update id={category_id}")
            raise ValueError(f"Category '{name}' already exists")
        record = CategoryRepository.update(db, category_id, name)
        if not record:
            logger.warning(f"Update attempted on non-existent category id={category_id}")
            return None
        logger.info(f"Category updated id={category_id} name='{name}'")
        return CategoryService._to_dict(record)

    @staticmethod
    def _to_dict(cat: TransactionCategory) -> dict:
        return {
            "id": cat.id,
            "name": cat.name,
        }
