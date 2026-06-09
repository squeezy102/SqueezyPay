"""
Unit tests for seed.py — seed_bills() function.
"""
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base, Bill
from seed import HARDCODED_BILLS, seed_bills


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


def test_seed_inserts_bills_into_empty_db(db):
    """
    Scenario: seed_bills() called on an empty database
    EP class: Valid partition — no existing bills, all HARDCODED_BILLS should be inserted
    Expected: bill count equals len(HARDCODED_BILLS)
    """
    seed_bills(db)
    assert db.query(Bill).count() == len(HARDCODED_BILLS)


def test_seed_skips_if_bills_exist(db):
    """
    Scenario: seed_bills() called twice on the same database
    EP class: Invalid partition — bills already exist, second call is a no-op
    Expected: bill count is still len(HARDCODED_BILLS), not doubled
    """
    seed_bills(db)
    seed_bills(db)
    assert db.query(Bill).count() == len(HARDCODED_BILLS)


def test_seeded_bills_have_valid_fields(db):
    """
    Scenario: Inspect field values of all seeded bills
    EP class: Valid partition — all bills in HARDCODED_BILLS are valid by definition
    Expected: every bill has a non-empty name, non-empty url, and day_of_month in [1..31]
    """
    seed_bills(db)
    bills = db.query(Bill).all()
    for bill in bills:
        assert bill.name and bill.name.strip(), f"Bill id={bill.id} has blank name"
        assert bill.url and bill.url.strip(), f"Bill id={bill.id} has blank url"
        assert 1 <= bill.day_of_month <= 31, (
            f"Bill id={bill.id} has invalid day_of_month={bill.day_of_month}"
        )
