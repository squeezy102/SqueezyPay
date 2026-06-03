from datetime import datetime
from sqlalchemy.orm import Session
from models.models import Income
from repositories.income_repository import IncomeRepository
from core.logging_config import get_logger

logger = get_logger("squeezypay.services.income")

_MONTHLY_MULTIPLIERS = {
    "weekly": 52 / 12,        # 52 weeks per year
    "bi-weekly": 26 / 12,     # 26 fortnights per year
    "semi-monthly": 2,
    "monthly": 1,
}


class IncomeService:
    @staticmethod
    def get_all(db: Session, include_inactive: bool = False) -> list[dict]:
        records = IncomeRepository.get_all(db, include_inactive=include_inactive)
        return [IncomeService._to_dict(r) for r in records]

    @staticmethod
    def get_by_id(db: Session, income_id: int) -> dict | None:
        record = IncomeRepository.get_by_id(db, income_id)
        if not record:
            logger.warning(f"Income record not found id={income_id}")
            return None
        return IncomeService._to_dict(record)

    @staticmethod
    def create(db: Session, data: dict) -> dict:
        if isinstance(data.get("next_expected_date"), str):
            data["next_expected_date"] = datetime.fromisoformat(data["next_expected_date"])
        record = IncomeRepository.create(db, data)
        logger.info(f"Income created id={record.id} source='{record.source_name}' amount={record.amount}")
        return IncomeService._to_dict(record)

    @staticmethod
    def update(db: Session, income_id: int, data: dict) -> dict | None:
        if isinstance(data.get("next_expected_date"), str):
            data["next_expected_date"] = datetime.fromisoformat(data["next_expected_date"])
        record = IncomeRepository.update(db, income_id, data)
        if not record:
            logger.warning(f"Update attempted on non-existent income id={income_id}")
            return None
        logger.info(f"Income updated id={income_id}")
        return IncomeService._to_dict(record)

    @staticmethod
    def deactivate(db: Session, income_id: int) -> bool:
        deactivated = IncomeRepository.deactivate(db, income_id)
        if deactivated:
            logger.info(f"Income deactivated id={income_id}")
        else:
            logger.warning(f"Deactivate attempted on non-existent income id={income_id}")
        return deactivated

    @staticmethod
    def reactivate(db: Session, income_id: int) -> bool:
        reactivated = IncomeRepository.reactivate(db, income_id)
        if reactivated:
            logger.info(f"Income reactivated id={income_id}")
        else:
            logger.warning(f"Reactivate attempted on non-existent income id={income_id}")
        return reactivated

    @staticmethod
    def get_monthly_total(db: Session) -> float:
        records = IncomeRepository.get_all(db, include_inactive=False)
        total = 0.0
        for record in records:
            multiplier = _MONTHLY_MULTIPLIERS.get(record.frequency, 1)
            total += record.amount * multiplier
        logger.info(f"Monthly income total computed: {total:.2f} across {len(records)} active source(s)")
        return total

    @staticmethod
    def _to_dict(record: Income) -> dict:
        return {
            "id": record.id,
            "source_name": record.source_name,
            "amount": record.amount,
            "frequency": record.frequency,
            "next_expected_date": record.next_expected_date.isoformat() if record.next_expected_date else None,
            "active": record.active,
        }
