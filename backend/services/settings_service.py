from sqlalchemy.orm import Session

from core.constants import DEFAULT_DUE_SOON_DAYS, DEFAULT_LARGE_PAYMENT_THRESHOLD
from core.logging_config import get_logger
from repositories.settings_repository import SettingsRepository

logger = get_logger("squeezypay.services.settings")

_DEFAULTS = {
    "due_soon_days": DEFAULT_DUE_SOON_DAYS,
    "large_payment_threshold": DEFAULT_LARGE_PAYMENT_THRESHOLD,
}

_CONVERTERS = {
    "due_soon_days": int,
    "large_payment_threshold": float,
}


class SettingsService:
    @staticmethod
    def get_settings(db: Session) -> dict:
        raw = SettingsRepository.get_all(db)
        result = {}
        for key, default in _DEFAULTS.items():
            if key in raw:
                result[key] = _CONVERTERS[key](raw[key])
            else:
                result[key] = default
        logger.info("Settings retrieved")
        return result

    @staticmethod
    def update_settings(db: Session, data: dict) -> dict:
        for key, value in data.items():
            if key not in _DEFAULTS:
                logger.warning(f"Ignoring unknown settings key='{key}'")
                continue
            converter = _CONVERTERS[key]
            try:
                converted = converter(value)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"Invalid value for '{key}': {exc}") from exc
            SettingsRepository.set(db, key, str(converted))
            logger.info(f"Setting updated key='{key}' value='{converted}'")
        return SettingsService.get_settings(db)
