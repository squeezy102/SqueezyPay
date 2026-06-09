"""
Unit tests for AuthService (services/auth_service.py).
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


def test_create_token_missing_secret_raises(db, monkeypatch):
    """
    Scenario: create_token() called when SQUEEZYPAY_SECRET_KEY is absent
    EP class: Invalid partition — missing mandatory env var
    Expected: raises RuntimeError
    """
    from services.auth_service import AuthService

    monkeypatch.delenv("SQUEEZYPAY_SECRET_KEY", raising=False)
    svc = AuthService(db)
    with pytest.raises(RuntimeError):
        svc.create_token()


def test_decode_token_missing_secret_raises(db, monkeypatch):
    """
    Scenario: decode_token() called when SQUEEZYPAY_SECRET_KEY is absent
    EP class: Invalid partition — missing mandatory env var
    Expected: raises RuntimeError
    """
    from services.auth_service import AuthService

    monkeypatch.delenv("SQUEEZYPAY_SECRET_KEY", raising=False)
    svc = AuthService(db)
    with pytest.raises(RuntimeError):
        svc.decode_token("anything")


def test_create_token_valid_secret_returns_string(db, monkeypatch):
    """
    Scenario: create_token() called with SQUEEZYPAY_SECRET_KEY set
    EP class: Valid partition — secret present, payload well-formed
    Expected: returns a non-empty string (JWT)
    """
    from services.auth_service import AuthService

    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "test-secret-key-for-testing-only-32chars!!")
    svc = AuthService(db)
    token = svc.create_token()
    assert isinstance(token, str)
    assert len(token) > 0


def test_change_passphrase_wrong_current_returns_false(db, monkeypatch):
    """
    Scenario: change_passphrase() called with an incorrect current passphrase
    EP class: Invalid partition — wrong current passphrase fails bcrypt verify
    Expected: returns False, passphrase unchanged
    """
    from services.auth_service import AuthService

    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "test-secret-key-for-testing-only-32chars!!")
    svc = AuthService(db)
    svc.setup("correctpass123")

    result = svc.change_passphrase("wrongpass123", "newpass123")
    assert result is False

    # Verify the original passphrase still works
    assert svc.verify("correctpass123") is True


def test_change_passphrase_correct_updates_hash(db, monkeypatch):
    """
    Scenario: change_passphrase() called with the correct current passphrase
    EP class: Valid partition — correct current passphrase, new passphrase meets min_length
    Expected: returns True; new passphrase verifies correctly, old one does not
    """
    from services.auth_service import AuthService

    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "test-secret-key-for-testing-only-32chars!!")
    svc = AuthService(db)
    svc.setup("correctpass123")

    result = svc.change_passphrase("correctpass123", "newpass456")
    assert result is True

    assert svc.verify("newpass456") is True
    assert svc.verify("correctpass123") is False
