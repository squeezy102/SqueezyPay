"""Repository-level tests for Plaid — hit in-memory SQLite directly."""
from datetime import UTC, datetime

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base, PlaidAccount, PlaidItem, PlaidTransaction, TransactionCategory
from repositories.plaid_repository import (
    PlaidAccountRepository,
    PlaidItemRepository,
    PlaidTransactionRepository,
)


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


def _make_item(db, item_id="item-001", institution_name="Test Bank"):
    return PlaidItemRepository.create(
        db,
        item_id=item_id,
        access_token_enc="enc-token",
        institution_id=None,
        institution_name=institution_name,
    )


def _make_account(db, item_id: int, account_id="acct-001"):
    return PlaidAccountRepository.upsert(
        db,
        plaid_item_id=item_id,
        data={
            "account_id": account_id,
            "name": "Checking",
            "official_name": "Primary Checking",
            "type": "depository",
            "subtype": "checking",
            "mask": "1234",
            "current_balance": 500.0,
            "available_balance": 480.0,
        },
    )


def _make_tx(db, account_id: int, transaction_id="tx-001"):
    tx, created = PlaidTransactionRepository.upsert(
        db,
        plaid_account_id=account_id,
        data={
            "transaction_id": transaction_id,
            "amount": 12.50,
            "date": "2026-06-01",
            "name": "Coffee Shop",
            "merchant_name": "Starbucks",
            "plaid_category_primary": "FOOD_AND_DRINK",
            "plaid_category_detailed": "COFFEE_SHOPS",
            "category_id": None,
            "payment_channel": "in store",
            "pending": False,
            "logo_url": None,
            "iso_currency_code": "USD",
        },
    )
    return tx, created


class TestPlaidItemRepository:
    def test_create_and_get_by_id(self, db):
        item = _make_item(db)
        assert item.id is not None
        fetched = PlaidItemRepository.get_by_id(db, item.id)
        assert fetched.item_id == "item-001"
        assert fetched.institution_name == "Test Bank"

    def test_get_by_plaid_id(self, db):
        _make_item(db)
        found = PlaidItemRepository.get_by_plaid_id(db, "item-001")
        assert found is not None
        assert found.item_id == "item-001"

    def test_get_by_plaid_id_missing(self, db):
        assert PlaidItemRepository.get_by_plaid_id(db, "nope") is None

    def test_get_all_empty(self, db):
        assert PlaidItemRepository.get_all(db) == []

    def test_get_all_returns_items(self, db):
        _make_item(db, "item-001")
        _make_item(db, "item-002")
        assert len(PlaidItemRepository.get_all(db)) == 2

    def test_delete_removes_item(self, db):
        item = _make_item(db)
        PlaidItemRepository.delete(db, item)
        assert PlaidItemRepository.get_by_id(db, item.id) is None

    def test_access_token_stored(self, db):
        item = _make_item(db)
        assert item.access_token_enc == "enc-token"

    def test_get_by_id_missing(self, db):
        assert PlaidItemRepository.get_by_id(db, 9999) is None


class TestPlaidAccountRepository:
    def test_upsert_creates_new(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        assert account.id is not None
        assert account.name == "Checking"
        assert account.current_balance == 500.0

    def test_upsert_updates_existing(self, db):
        item = _make_item(db)
        _make_account(db, item.id)
        updated = PlaidAccountRepository.upsert(
            db,
            plaid_item_id=item.id,
            data={
                "account_id": "acct-001",
                "name": "Checking",
                "official_name": None,
                "type": "depository",
                "subtype": "checking",
                "mask": "1234",
                "current_balance": 999.0,
                "available_balance": 990.0,
            },
        )
        assert updated.current_balance == 999.0
        assert PlaidAccountRepository.get_all(db).__len__() == 1

    def test_get_by_item(self, db):
        item = _make_item(db)
        _make_account(db, item.id, "acct-001")
        _make_account(db, item.id, "acct-002")
        accounts = PlaidAccountRepository.get_by_item(db, item.id)
        assert len(accounts) == 2

    def test_get_all(self, db):
        item = _make_item(db)
        _make_account(db, item.id)
        assert len(PlaidAccountRepository.get_all(db)) == 1

    def test_get_by_plaid_account_id(self, db):
        item = _make_item(db)
        _make_account(db, item.id, "acct-abc")
        found = PlaidAccountRepository.get_by_plaid_account_id(db, "acct-abc")
        assert found is not None

    def test_get_by_plaid_account_id_missing(self, db):
        assert PlaidAccountRepository.get_by_plaid_account_id(db, "nope") is None

    def test_cascade_delete_with_item(self, db):
        item = _make_item(db)
        _make_account(db, item.id)
        PlaidItemRepository.delete(db, item)
        assert PlaidAccountRepository.get_all(db) == []


class TestPlaidTransactionRepository:
    def test_upsert_creates_new(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        tx, created = _make_tx(db, account.id)
        assert created is True
        assert tx.transaction_id == "tx-001"
        assert tx.amount == 12.50

    def test_upsert_is_idempotent(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        _make_tx(db, account.id)
        _, created2 = _make_tx(db, account.id)
        assert created2 is False
        txs, total = PlaidTransactionRepository.get_all(db)
        assert total == 1

    def test_upsert_updates_amount(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        _make_tx(db, account.id)
        tx, _ = PlaidTransactionRepository.upsert(
            db,
            plaid_account_id=account.id,
            data={
                "transaction_id": "tx-001",
                "amount": 99.0,
                "date": "2026-06-01",
                "name": "Coffee Shop",
                "merchant_name": None,
                "plaid_category_primary": None,
                "plaid_category_detailed": None,
                "category_id": None,
                "payment_channel": None,
                "pending": False,
                "logo_url": None,
                "iso_currency_code": "USD",
            },
        )
        assert tx.amount == 99.0

    def test_get_all_with_pagination(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        for i in range(5):
            _make_tx(db, account.id, f"tx-{i:03d}")
        txs, total = PlaidTransactionRepository.get_all(db, limit=2, offset=0)
        assert total == 5
        assert len(txs) == 2

    def test_get_all_filters_by_account(self, db):
        item = _make_item(db)
        acct1 = _make_account(db, item.id, "acct-001")
        acct2 = _make_account(db, item.id, "acct-002")
        _make_tx(db, acct1.id, "tx-001")
        _make_tx(db, acct2.id, "tx-002")
        txs, total = PlaidTransactionRepository.get_all(db, plaid_account_id=acct1.id)
        assert total == 1
        assert txs[0].transaction_id == "tx-001"

    def test_get_by_date_range(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        _make_tx(db, account.id, "tx-001")  # date 2026-06-01
        txs = PlaidTransactionRepository.get_by_date_range(db, "2026-06-01", "2026-06-30")
        assert len(txs) == 1

    def test_get_by_date_range_excludes_pending(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        PlaidTransactionRepository.upsert(
            db,
            plaid_account_id=account.id,
            data={
                "transaction_id": "tx-pending",
                "amount": 5.0,
                "date": "2026-06-01",
                "name": "Pending item",
                "merchant_name": None,
                "plaid_category_primary": None,
                "plaid_category_detailed": None,
                "category_id": None,
                "payment_channel": None,
                "pending": True,
                "logo_url": None,
                "iso_currency_code": "USD",
            },
        )
        txs = PlaidTransactionRepository.get_by_date_range(db, "2026-06-01", "2026-06-30", exclude_pending=True)
        assert len(txs) == 0

    def test_assign_category(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        tx, _ = _make_tx(db, account.id)
        cat = TransactionCategory(name="Food")
        db.add(cat)
        db.commit()
        db.refresh(cat)
        updated = PlaidTransactionRepository.assign_category(db, tx, cat.id)
        assert updated.category_id == cat.id

    def test_get_by_id(self, db):
        item = _make_item(db)
        account = _make_account(db, item.id)
        tx, _ = _make_tx(db, account.id)
        found = PlaidTransactionRepository.get_by_id(db, tx.id)
        assert found is not None

    def test_get_by_id_missing(self, db):
        assert PlaidTransactionRepository.get_by_id(db, 9999) is None
