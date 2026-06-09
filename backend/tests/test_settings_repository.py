"""Repository-level tests for SettingsRepository — hit in-memory SQLite directly."""

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base
from repositories.settings_repository import SettingsRepository


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


def test_settings_get_returns_none_when_missing(db):
    """
    Scenario: get() called for a key that has never been stored
    EP class: invalid partition — non-existent key
    Expected: SettingsRepository.get returns None
    """
    result = SettingsRepository.get(db, "nonexistent_key")
    assert result is None


def test_settings_get_returns_value_when_set(db):
    """
    Scenario: get() called after set() for the same key
    EP class: valid partition — key exists with a stored string value
    Expected: SettingsRepository.get returns the exact string that was stored
    """
    SettingsRepository.set(db, "due_soon_days", "5")
    result = SettingsRepository.get(db, "due_soon_days")
    assert result == "5"


def test_settings_set_inserts_new_record(db):
    """
    Scenario: set() called for a key that does not yet exist in the database
    EP class: valid partition — insert path (key absent before call)
    Expected: the key is present in get_all after the call
    """
    SettingsRepository.set(db, "new_key", "new_value")
    all_settings = SettingsRepository.get_all(db)
    assert "new_key" in all_settings
    assert all_settings["new_key"] == "new_value"


def test_settings_set_updates_existing_record(db):
    """
    Scenario: set() called twice for the same key with different values
    EP class: valid partition — update path (key already present before second call)
    Expected: get_all returns only the second value; no duplicate rows
    """
    SettingsRepository.set(db, "theme", "light")
    SettingsRepository.set(db, "theme", "dark")
    all_settings = SettingsRepository.get_all(db)
    # Must have exactly one entry for the key with the latest value
    assert all_settings["theme"] == "dark"
    assert list(all_settings.keys()).count("theme") == 1


def test_settings_get_all_returns_dict(db):
    """
    Scenario: get_all() called after two distinct keys have been stored
    EP class: valid partition — multiple rows; result type and completeness check
    Expected: returned dict contains both key-value pairs
    """
    SettingsRepository.set(db, "key_a", "val_a")
    SettingsRepository.set(db, "key_b", "val_b")
    result = SettingsRepository.get_all(db)
    assert isinstance(result, dict)
    assert result["key_a"] == "val_a"
    assert result["key_b"] == "val_b"


def test_settings_get_all_empty_db(db):
    """
    Scenario: get_all() called on a database with no settings rows
    EP class: boundary — empty table (count = 0)
    Expected: SettingsRepository.get_all returns an empty dict
    """
    result = SettingsRepository.get_all(db)
    assert result == {}
