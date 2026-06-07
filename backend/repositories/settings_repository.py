from sqlalchemy.orm import Session

from core.logging_config import get_logger
from models.models import Setting

logger = get_logger("squeezypay.repositories.settings")


class SettingsRepository:
    @staticmethod
    def get(db: Session, key: str) -> str | None:
        record = db.query(Setting).filter(Setting.key == key).first()
        return record.value if record else None

    @staticmethod
    def set(db: Session, key: str, value: str) -> Setting:
        record = db.query(Setting).filter(Setting.key == key).first()
        if record:
            record.value = value
        else:
            record = Setting(key=key, value=value)
            db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_all(db: Session) -> dict[str, str]:
        records = db.query(Setting).all()
        return {r.key: r.value for r in records}
