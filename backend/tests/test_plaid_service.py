"""Unit tests for PlaidService methods that don't require Plaid API calls."""
import os

import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base, TransactionCategory
from repositories.plaid_repository import (
    PlaidAccountRepository,
    PlaidItemRepository,
    PlaidTransactionRepository,
)
from services.plaid_category_mapper import PLAID_PRIMARY_TO_LOCAL, resolve_category_id
from services.plaid_service import PlaidService


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


def _seed_item_and_account(db, item_id="item-x", account_id="acct-x"):
    item = PlaidItemRepository.create(
        db,
        item_id=item_id,
        access_token_enc="enc-token",
        institution_id=None,
        institution_name="Sandbox Bank",
    )
    account = PlaidAccountRepository.upsert(
        db,
        plaid_item_id=item.id,
        data={
            "account_id": account_id,
            "name": "Checking",
            "official_name": None,
            "type": "depository",
            "subtype": "checking",
            "mask": "9999",
            "current_balance": 1000.0,
            "available_balance": 980.0,
        },
    )
    return item, account


def _seed_transaction(db, account_id: int, tx_id="tx-x", amount=25.0, date="2026-06-01", pending=False):
    tx, _ = PlaidTransactionRepository.upsert(
        db,
        plaid_account_id=account_id,
        data={
            "transaction_id": tx_id,
            "amount": amount,
            "date": date,
            "name": "Test Merchant",
            "merchant_name": "Test Merchant",
            "plaid_category_primary": "FOOD_AND_DRINK",
            "plaid_category_detailed": "RESTAURANTS",
            "category_id": None,
            "payment_channel": "online",
            "pending": pending,
            "logo_url": None,
            "iso_currency_code": "USD",
        },
    )
    return tx


class TestItemToDict:
    def test_access_token_not_in_dict(self, db):
        item = PlaidItemRepository.create(
            db,
            item_id="item-secret",
            access_token_enc="SUPER_SECRET_TOKEN",
            institution_id=None,
            institution_name="My Bank",
        )
        result = PlaidService._item_to_dict(item)
        assert "access_token" not in result
        assert "access_token_enc" not in result
        assert result["item_id"] == "item-secret"

    def test_dict_has_expected_keys(self, db):
        item = PlaidItemRepository.create(
            db,
            item_id="item-001",
            access_token_enc="enc",
            institution_id=None,
            institution_name="Bank",
        )
        result = PlaidService._item_to_dict(item)
        assert set(result.keys()) == {"id", "item_id", "institution_name", "created_at"}


class TestAccountToDict:
    def test_no_sensitive_fields(self, db):
        item, account = _seed_item_and_account(db)
        result = PlaidService._account_to_dict(account, "My Bank")
        assert "access_token" not in result
        assert result["institution_name"] == "My Bank"
        assert result["mask"] == "9999"


class TestTxToDict:
    def test_no_access_token(self, db):
        _, account = _seed_item_and_account(db)
        tx = _seed_transaction(db, account.id)
        result = PlaidService._tx_to_dict(tx)
        assert "access_token" not in result
        assert result["transaction_id"] == "tx-x"
        assert result["amount"] == 25.0

    def test_all_fields_present(self, db):
        _, account = _seed_item_and_account(db)
        tx = _seed_transaction(db, account.id)
        result = PlaidService._tx_to_dict(tx)
        expected_keys = {
            "id", "transaction_id", "plaid_account_id", "amount", "date", "name",
            "merchant_name", "plaid_category_primary", "plaid_category_detailed",
            "category_id", "payment_channel", "pending", "logo_url",
            "iso_currency_code", "created_at",
        }
        assert set(result.keys()) == expected_keys


class TestCategoryMapper:
    def test_known_category_resolves(self, db):
        cat = TransactionCategory(name="Fast Food / Dining Out")
        db.add(cat)
        db.commit()
        db.refresh(cat)
        result = resolve_category_id(db, "FOOD_AND_DRINK")
        assert result == cat.id

    def test_unknown_category_returns_none(self, db):
        result = resolve_category_id(db, "TOTALLY_UNKNOWN_CATEGORY")
        assert result is None

    def test_none_primary_returns_none(self, db):
        result = resolve_category_id(db, None)
        assert result is None

    def test_known_primary_but_no_db_match_returns_none(self, db):
        # Mapping exists in PLAID_PRIMARY_TO_LOCAL but category not seeded
        assert "FOOD_AND_DRINK" in PLAID_PRIMARY_TO_LOCAL
        result = resolve_category_id(db, "FOOD_AND_DRINK")
        assert result is None

    def test_all_mapped_categories_have_string_values(self):
        for k, v in PLAID_PRIMARY_TO_LOCAL.items():
            assert isinstance(k, str)
            assert isinstance(v, str)
            assert len(v) > 0


class TestGetAllItems:
    def test_empty(self, db):
        assert PlaidService.get_all_items(db) == []

    def test_returns_items_without_token(self, db):
        PlaidItemRepository.create(db, "item-1", "enc-1", None, "Bank A")
        PlaidItemRepository.create(db, "item-2", "enc-2", None, "Bank B")
        results = PlaidService.get_all_items(db)
        assert len(results) == 2
        for r in results:
            assert "access_token" not in r
            assert "access_token_enc" not in r


class TestGetAccounts:
    def test_empty(self, db):
        assert PlaidService.get_accounts(db) == []

    def test_returns_accounts_with_institution(self, db):
        _seed_item_and_account(db)
        accounts = PlaidService.get_accounts(db)
        assert len(accounts) == 1
        assert accounts[0]["institution_name"] == "Sandbox Bank"


class TestGetTransactions:
    def test_empty(self, db):
        result = PlaidService.get_transactions(db)
        assert result["transactions"] == []
        assert result["total"] == 0

    def test_returns_transactions(self, db):
        _, account = _seed_item_and_account(db)
        _seed_transaction(db, account.id, "tx-1")
        _seed_transaction(db, account.id, "tx-2", amount=10.0)
        result = PlaidService.get_transactions(db)
        assert result["total"] == 2
        assert len(result["transactions"]) == 2

    def test_pagination(self, db):
        _, account = _seed_item_and_account(db)
        for i in range(5):
            _seed_transaction(db, account.id, f"tx-{i:03d}", amount=float(i))
        result = PlaidService.get_transactions(db, limit=2, offset=0)
        assert result["total"] == 5
        assert len(result["transactions"]) == 2


class TestAssignCategory:
    def test_assigns_category(self, db):
        _, account = _seed_item_and_account(db)
        tx = _seed_transaction(db, account.id)
        cat = TransactionCategory(name="Dining")
        db.add(cat)
        db.commit()
        db.refresh(cat)
        result = PlaidService.assign_category(db, tx.id, cat.id)
        assert result is not None
        assert result["category_id"] == cat.id

    def test_missing_tx_returns_none(self, db):
        result = PlaidService.assign_category(db, 9999, 1)
        assert result is None


class TestBlameData:
    def test_structure(self, db):
        _, account = _seed_item_and_account(db)
        _seed_transaction(db, account.id, "tx-1", amount=100.0, date="2026-06-01")
        _seed_transaction(db, account.id, "tx-2", amount=50.0, date="2026-06-01")
        result = PlaidService.get_blame_data(db, days_back=365)
        assert "period_start" in result
        assert "period_end" in result
        assert "total_spending" in result
        assert "by_category" in result
        assert "by_account" in result

    def test_excludes_pending(self, db):
        _, account = _seed_item_and_account(db)
        _seed_transaction(db, account.id, "tx-pending", amount=500.0, date="2026-06-01", pending=True)
        result = PlaidService.get_blame_data(db, days_back=365)
        assert result["total_spending"] == 0.0

    def test_excludes_credits(self, db):
        _, account = _seed_item_and_account(db)
        # Negative amounts are credits/refunds — should not count as spending
        _seed_transaction(db, account.id, "tx-refund", amount=-25.0, date="2026-06-01")
        result = PlaidService.get_blame_data(db, days_back=365)
        assert result["total_spending"] == 0.0

    def test_pct_sums_to_100(self, db):
        _, account = _seed_item_and_account(db)
        _seed_transaction(db, account.id, "tx-1", amount=75.0, date="2026-06-01")
        _seed_transaction(db, account.id, "tx-2", amount=25.0, date="2026-06-01")
        result = PlaidService.get_blame_data(db, days_back=365)
        total_pct = sum(r["pct"] for r in result["by_category"])
        assert abs(total_pct - 100.0) < 1.0  # floating point tolerance

    def test_empty_data(self, db):
        result = PlaidService.get_blame_data(db, days_back=30)
        assert result["total_spending"] == 0.0
        assert result["by_category"] == []
        assert result["by_account"] == []


class TestPlaidClientMissingEnv:
    def test_raises_if_client_id_missing(self, monkeypatch):
        monkeypatch.delenv("SQUEEZYPAY_PLAID_CLIENTID", raising=False)
        monkeypatch.delenv("SQUEEZYPAY_PLAID_SECRET", raising=False)
        from services.plaid_service import _get_plaid_client
        with pytest.raises(RuntimeError, match="SQUEEZYPAY_PLAID_CLIENTID"):
            _get_plaid_client()
