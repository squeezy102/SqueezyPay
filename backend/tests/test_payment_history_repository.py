"""Repository-level tests for PaymentHistoryRepository — hit in-memory SQLite directly."""

from datetime import datetime

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base, Bill, PaymentHistory
from repositories.payment_history_repository import PaymentHistoryRepository


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


def _make_bill(db):
    bill = Bill(
        name="Test",
        category="Utilities",
        url="https://example.com",
        day_of_month=1,
        recurring=True,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


def _make_payment(db, bill_id, amount=100.0, date=None):
    return PaymentHistoryRepository.create(
        db,
        {
            "bill_id": bill_id,
            "payment_date": date or datetime(2026, 6, 1),
            "amount_paid": amount,
        },
    )


def test_get_all_empty(db):
    """
    Scenario: get_all() called on a database with no payment history rows
    EP class: boundary — empty table (count = 0)
    Expected: PaymentHistoryRepository.get_all returns an empty list
    """
    result = PaymentHistoryRepository.get_all(db)
    assert result == []


def test_create_and_get_by_id(db):
    """
    Scenario: create() a payment then retrieve it by primary key
    EP class: valid partition — single existing record; round-trip fidelity
    Expected: returned payment has the correct amount and bill_id
    """
    bill = _make_bill(db)
    payment = _make_payment(db, bill.id, amount=42.50)
    fetched = PaymentHistoryRepository.get_by_id(db, payment.id)
    assert fetched is not None
    assert fetched.amount_paid == 42.50
    assert fetched.bill_id == bill.id


def test_get_by_id_not_found(db):
    """
    Scenario: get_by_id() called with a primary key that does not exist
    EP class: invalid partition — non-existent primary key
    Expected: PaymentHistoryRepository.get_by_id returns None
    """
    result = PaymentHistoryRepository.get_by_id(db, 9999)
    assert result is None


def test_get_by_bill(db):
    """
    Scenario: two payments belong to the same bill; get_by_bill filters correctly
    EP class: valid partition — multiple rows for one bill_id
    Expected: get_by_bill returns exactly 2 items for that bill
    """
    bill = _make_bill(db)
    _make_payment(db, bill.id, amount=10.0)
    _make_payment(db, bill.id, amount=20.0)
    result = PaymentHistoryRepository.get_by_bill(db, bill.id)
    assert len(result) == 2


def test_get_by_bill_empty(db):
    """
    Scenario: get_by_bill() called for a bill_id with no associated payments
    EP class: invalid partition — non-existent bill_id (or bill with 0 payments)
    Expected: returns an empty list
    """
    result = PaymentHistoryRepository.get_by_bill(db, 9999)
    assert result == []


def test_delete_success(db):
    """
    Scenario: create a payment then delete it; confirm it is no longer retrievable
    EP class: valid partition — delete existing record
    Expected: get_by_id returns None after deletion
    """
    bill = _make_bill(db)
    payment = _make_payment(db, bill.id)
    deleted = PaymentHistoryRepository.delete(db, payment.id)
    assert deleted is True
    assert PaymentHistoryRepository.get_by_id(db, payment.id) is None


def test_delete_not_found(db):
    """
    Scenario: delete() called for a payment_id that does not exist
    EP class: invalid partition — non-existent primary key
    Expected: PaymentHistoryRepository.delete returns False without raising
    """
    result = PaymentHistoryRepository.delete(db, 9999)
    assert result is False


def test_get_all_returns_all_payments(db):
    """
    Scenario: 3 payments created across 2 bills; get_all() must surface all 3
    EP class: valid partition — multiple rows across multiple FK references
    Expected: PaymentHistoryRepository.get_all returns exactly 3 items
    """
    bill1 = _make_bill(db)
    bill2 = _make_bill(db)
    _make_payment(db, bill1.id, amount=10.0)
    _make_payment(db, bill1.id, amount=20.0)
    _make_payment(db, bill2.id, amount=30.0)
    result = PaymentHistoryRepository.get_all(db)
    assert len(result) == 3
