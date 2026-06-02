import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("SQUEEZYPAY_ENCRYPTION_KEY", "dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXJlc3Q=")
os.environ.setdefault("SQUEEZYPAY_SECRET_KEY", "test-secret-key-for-testing-only-32chars!!")

import database.db as db_module
from models.models import Base


@pytest.fixture()
def client():
    """
    Each test gets a fresh in-memory database. StaticPool forces all
    connections on this engine to share the same underlying SQLite connection,
    which is the only way to make :memory: databases visible across threads
    (the FastAPI TestClient runs requests in a worker thread).
    """
    from main import app
    from database.db import get_db
    from core.auth import require_auth

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
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

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    session.close()
    db_module.engine = original_engine
    db_module.SessionLocal = original_session_local
    engine.dispose()
