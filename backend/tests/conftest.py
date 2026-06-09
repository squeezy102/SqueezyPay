import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("SQUEEZYPAY_ENCRYPTION_KEY", "dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXJlc3Q=")
os.environ.setdefault("SQUEEZYPAY_SECRET_KEY", "test-secret-key-for-testing-only-32chars!!")
os.environ.setdefault("SQUEEZYPAY_PLAID_CLIENTID", "test-plaid-client-id")
os.environ.setdefault("SQUEEZYPAY_PLAID_SECRET", "test-plaid-secret")
os.environ["SQUEEZYPAY_TESTING"] = "1"

import database.db as db_module
from models.models import Base


@pytest.fixture()
def db():
    """Standalone in-memory DB session for repository-layer tests."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_fk(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture()
def client():
    """
    Each test gets a fresh in-memory database. StaticPool forces all
    connections on this engine to share the same underlying SQLite connection,
    which is the only way to make :memory: databases visible across threads
    (the FastAPI TestClient runs requests in a worker thread).
    """
    from core.auth import require_auth
    from database.db import get_db
    from main import app

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    original_engine = db_module.engine
    original_session_local = db_module.SessionLocal
    db_module.engine = engine
    db_module.SessionLocal = TestSession

    session = TestSession()

    def override_get_db():
        yield session

    def override_require_auth():
        pass  # no-op for tests

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[require_auth] = override_require_auth

    import uuid
    # Each test gets a unique rate-limit bucket so tests never share quotas.
    # The key function in main.py reads X-Test-Rate-Key when present.
    test_rate_key = str(uuid.uuid4())

    with TestClient(app, headers={"X-Test-Rate-Key": test_rate_key}) as c:
        yield c

    app.dependency_overrides.clear()
    session.close()
    db_module.engine = original_engine
    db_module.SessionLocal = original_session_local
    engine.dispose()
