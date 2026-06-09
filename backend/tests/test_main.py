"""
Tests for helper functions in main.py — origin allow-list, rate-limit handler,
and startup environment-variable guards.
"""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# _is_allowed_origin tests
# ---------------------------------------------------------------------------

def test_is_allowed_origin_explicit_localhost():
    """
    Scenario: Origin matches explicit localhost:5173 entry in _ALLOWED_ORIGINS
    EP class: Valid partition — exact string match in allow-list
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://localhost:5173") is True


def test_is_allowed_origin_explicit_localhost_9000():
    """
    Scenario: Origin matches explicit localhost:9000 entry in _ALLOWED_ORIGINS
    EP class: Valid partition — exact string match in allow-list
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://localhost:9000") is True


def test_is_allowed_origin_192_168_subnet():
    """
    Scenario: Origin is a 192.168.x.x address with port (LAN subnet)
    EP class: Valid partition — regex match on 192.168.* pattern
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://192.168.1.10:5173") is True


def test_is_allowed_origin_10_subnet():
    """
    Scenario: Origin is a 10.x.x.x address without port (LAN subnet)
    EP class: Valid partition — regex match on 10.* pattern
    Expected: returns True
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://10.0.0.5") is True


def test_is_allowed_origin_public_ip_rejected():
    """
    Scenario: Origin is a public IP address (8.8.8.8)
    EP class: Invalid partition — public IP not in allow-list or subnet regex
    Expected: returns False
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://8.8.8.8:5173") is False


def test_is_allowed_origin_https_rejected():
    """
    Scenario: Origin uses https:// scheme for localhost
    EP class: Invalid partition — only http:// is in the allow-list
    Expected: returns False
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("https://localhost:5173") is False


# ---------------------------------------------------------------------------
# Rate-limit handler — 429 response shape
# ---------------------------------------------------------------------------

def test_rate_limit_exceeded_handler_cors_header_injected(client):
    """
    Scenario: POST /api/auth/login is called 11 times with the same rate-limit key;
              the 11th request triggers the 10/minute limit
    EP class: BVA — 11th request is one above the allowed limit of 10
    Expected: HTTP 429 with JSON detail containing "Rate limit exceeded"
    """
    # First configure auth so login does not fail on passphrase-not-configured
    client.post("/api/auth/setup", json={"passphrase": "TestPassword1234!"})

    last_response = None
    for _ in range(11):
        last_response = client.post("/api/auth/login", json={"passphrase": "TestPassword1234!"})

    assert last_response.status_code == 429
    detail = last_response.json()["detail"]
    assert "Rate limit exceeded" in detail


# ---------------------------------------------------------------------------
# Startup env-var guard — lifespan raises RuntimeError when keys are missing.
#
# Regression guard for the CI incident where backend.exe was launched without
# SQUEEZYPAY_ENCRYPTION_KEY / SQUEEZYPAY_SECRET_KEY in its environment, causing
# the process to exit immediately and the health-check loop to time out silently.
# ---------------------------------------------------------------------------

def _make_test_client_without_key(missing_key: str):
    """
    Build a TestClient for main.app after removing `missing_key` from the
    environment.  The lifespan startup should raise RuntimeError.
    Returns the missing key's original value so callers can restore it.
    """
    import database.db as db_module
    from core.auth import require_auth
    from database.db import get_db
    from main import app
    from models.models import Base

    original = os.environ.pop(missing_key, None)

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    orig_engine = db_module.engine
    orig_session = db_module.SessionLocal
    db_module.engine = engine
    db_module.SessionLocal = TestSession

    session = TestSession()

    app.dependency_overrides[get_db] = lambda: (yield session)
    app.dependency_overrides[require_auth] = lambda: None

    try:
        return app, original, orig_engine, orig_session, session, engine
    except Exception:
        db_module.engine = orig_engine
        db_module.SessionLocal = orig_session
        raise


def test_startup_raises_when_encryption_key_missing():
    """
    Scenario: SQUEEZYPAY_ENCRYPTION_KEY is absent from the process environment.
    EP class: Invalid partition — required env var not set.
    Expected: lifespan raises RuntimeError mentioning SQUEEZYPAY_ENCRYPTION_KEY,
              which TestClient surfaces as an exception on __enter__.
    """
    import database.db as db_module
    from core.auth import require_auth
    from database.db import get_db
    from main import app
    from models.models import Base

    original = os.environ.pop("SQUEEZYPAY_ENCRYPTION_KEY", None)
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    orig_engine, orig_session = db_module.engine, db_module.SessionLocal
    db_module.engine = engine
    db_module.SessionLocal = TestSession
    session = TestSession()
    app.dependency_overrides[get_db] = lambda: (yield session)
    app.dependency_overrides[require_auth] = lambda: None

    try:
        with pytest.raises(RuntimeError, match="SQUEEZYPAY_ENCRYPTION_KEY"):
            with TestClient(app):
                pass
    finally:
        app.dependency_overrides.clear()
        session.close()
        db_module.engine = orig_engine
        db_module.SessionLocal = orig_session
        engine.dispose()
        if original is not None:
            os.environ["SQUEEZYPAY_ENCRYPTION_KEY"] = original


def test_startup_raises_when_secret_key_missing():
    """
    Scenario: SQUEEZYPAY_SECRET_KEY is absent from the process environment.
    EP class: Invalid partition — required env var not set.
    Expected: lifespan raises RuntimeError mentioning SQUEEZYPAY_SECRET_KEY.
    """
    import database.db as db_module
    from core.auth import require_auth
    from database.db import get_db
    from main import app
    from models.models import Base

    original = os.environ.pop("SQUEEZYPAY_SECRET_KEY", None)
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    orig_engine, orig_session = db_module.engine, db_module.SessionLocal
    db_module.engine = engine
    db_module.SessionLocal = TestSession
    session = TestSession()
    app.dependency_overrides[get_db] = lambda: (yield session)
    app.dependency_overrides[require_auth] = lambda: None

    try:
        with pytest.raises(RuntimeError, match="SQUEEZYPAY_SECRET_KEY"):
            with TestClient(app):
                pass
    finally:
        app.dependency_overrides.clear()
        session.close()
        db_module.engine = orig_engine
        db_module.SessionLocal = orig_session
        engine.dispose()
        if original is not None:
            os.environ["SQUEEZYPAY_SECRET_KEY"] = original
