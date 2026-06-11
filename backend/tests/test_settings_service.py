"""
Unit tests for SettingsService (services/settings_service.py).
Uses a local in-memory SQLite fixture — no HTTP layer.
"""
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


def test_update_settings_unknown_key_is_ignored(db):
    """
    Scenario: update_settings() receives a key that is not in _DEFAULTS
    EP class: Invalid partition — unknown keys are silently skipped
    Expected: does not raise; returned dict does not contain the unknown key
    """
    from services.settings_service import SettingsService

    result = SettingsService.update_settings(db, {"unknown_key": "value"})
    assert "unknown_key" not in result


def test_update_settings_invalid_value_raises(db):
    """
    Scenario: update_settings() receives a known key with a non-convertible value
    EP class: Invalid partition — "not-a-number" cannot be cast to int
    Expected: raises ValueError
    """
    from services.settings_service import SettingsService

    with pytest.raises(ValueError):
        SettingsService.update_settings(db, {"due_soon_days": "not-a-number"})


def test_update_settings_valid_returns_dict(db):
    """
    Scenario: update_settings() receives valid key/value pairs
    EP class: Valid partition — integer value for due_soon_days
    Expected: returns dict with due_soon_days == 7
    """
    from services.settings_service import SettingsService

    result = SettingsService.update_settings(db, {"due_soon_days": 7})
    assert isinstance(result, dict)
    assert result["due_soon_days"] == 7


def test_get_settings_returns_defaults_when_db_empty(db):
    """
    Scenario: get_settings() on a fresh empty DB
    EP class: Valid partition — no rows in settings table, defaults must be returned
    Expected: returned dict contains due_soon_days and large_payment_threshold keys
    """
    from services.settings_service import SettingsService

    result = SettingsService.get_settings(db)
    assert isinstance(result, dict)
    assert "due_soon_days" in result
    assert "large_payment_threshold" in result
