"""Endpoint-level integration tests for /api/plaid/* routes.

All external Plaid API calls are mocked. The in-memory SQLite DB is seeded
directly via PlaidItemRepository/PlaidAccountRepository for read-path tests.
"""
from unittest.mock import MagicMock, patch

import pytest

from repositories.plaid_repository import (
    PlaidAccountRepository,
    PlaidItemRepository,
    PlaidTransactionRepository,
)
from services.encryption_service import encryption_service


def _mock_plaid_client():
    mock = MagicMock()
    mock.link_token_create.return_value = {"link_token": "link-sandbox-test-abc"}
    mock.item_public_token_exchange.return_value = {
        "access_token": "access-sandbox-fake-token",
        "item_id": "plaid-item-id-001",
    }
    mock.accounts_get.return_value = {
        "accounts": [
            {
                "account_id": "acct-plaid-001",
                "name": "Plaid Checking",
                "official_name": "Primary Checking Account",
                "type": "depository",
                "subtype": "checking",
                "mask": "1234",
                "balances": {
                    "current": 1500.00,
                    "available": 1450.00,
                },
            }
        ]
    }
    mock.transactions_get.return_value = {
        "transactions": [
            {
                "transaction_id": "tx-plaid-001",
                "account_id": "acct-plaid-001",
                "amount": 12.50,
                "date": "2026-06-01",
                "name": "Coffee Shop",
                "merchant_name": "Starbucks",
                "personal_finance_category": {"primary": "FOOD_AND_DRINK", "detailed": "COFFEE_SHOPS"},
                "payment_channel": "in store",
                "pending": False,
                "logo_url": None,
                "iso_currency_code": "USD",
            }
        ],
        "total_transactions": 1,
    }
    mock.item_remove.return_value = {"request_id": "req-001"}
    return mock


PATCH_TARGET = "services.plaid_service._get_plaid_client"


class TestLinkToken:
    def test_create_link_token_success(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.post("/api/plaid/link-token")
        assert response.status_code == 200
        data = response.json()
        assert "link_token" in data
        assert data["link_token"].startswith("link-")

    def test_create_link_token_missing_env(self, client, monkeypatch):
        monkeypatch.delenv("SQUEEZYPAY_PLAID_CLIENTID", raising=False)
        monkeypatch.delenv("SQUEEZYPAY_PLAID_SECRET", raising=False)
        response = client.post("/api/plaid/link-token")
        assert response.status_code == 503

    def test_create_link_token_plaid_error(self, client):
        mock = MagicMock()
        mock.link_token_create.side_effect = Exception("Plaid API unreachable")
        with patch(PATCH_TARGET, return_value=mock):
            response = client.post("/api/plaid/link-token")
        assert response.status_code == 400


class TestExchangeToken:
    def test_exchange_success_creates_item(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert "item_id" in data
        assert "access_token" not in data
        assert "access_token_enc" not in data

    def test_exchange_empty_public_token_rejected(self, client):
        response = client.post("/api/plaid/exchange-token", json={"public_token": ""})
        assert response.status_code == 422

    def test_exchange_plaid_error_returns_400(self, client):
        mock = MagicMock()
        mock.link_token_create.return_value = {"link_token": "link-test"}
        mock.item_public_token_exchange.side_effect = Exception("bad token")
        mock.accounts_get.return_value = {"accounts": []}
        with patch(PATCH_TARGET, return_value=mock):
            response = client.post("/api/plaid/exchange-token", json={"public_token": "public-bad"})
        assert response.status_code == 400

    def test_access_token_never_in_response(self, client):
        """Critical: access_token must never appear in any response payload."""
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        assert response.status_code == 201
        body = response.text
        assert "access-sandbox-fake-token" not in body
        assert "access_token" not in response.json()


class TestItems:
    def test_list_items_empty(self, client):
        response = client.get("/api/plaid/items")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_items_after_exchange(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        response = client.get("/api/plaid/items")
        assert response.status_code == 200
        items = response.json()
        assert len(items) == 1
        assert "access_token" not in items[0]

    def test_delete_item_success(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            exchange_resp = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        item_id = exchange_resp.json()["id"]
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.delete(f"/api/plaid/items/{item_id}")
        assert response.status_code == 204

    def test_delete_item_missing(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.delete("/api/plaid/items/9999")
        assert response.status_code == 404


class TestAccounts:
    def test_get_accounts_empty(self, client):
        response = client.get("/api/plaid/accounts")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_accounts_after_exchange(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        response = client.get("/api/plaid/accounts")
        assert response.status_code == 200
        accounts = response.json()
        assert len(accounts) == 1
        assert accounts[0]["name"] == "Plaid Checking"
        assert "access_token" not in accounts[0]

    def test_sync_balances_success(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            exchange_resp = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        item_id = exchange_resp.json()["id"]
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.post("/api/plaid/accounts/sync-balances", json={"plaid_item_id": item_id})
        assert response.status_code == 200
        accounts = response.json()
        assert len(accounts) >= 1

    def test_sync_balances_missing_item(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.post("/api/plaid/accounts/sync-balances", json={"plaid_item_id": 9999})
        assert response.status_code == 404


class TestTransactions:
    def test_get_transactions_empty(self, client):
        response = client.get("/api/plaid/transactions")
        assert response.status_code == 200
        data = response.json()
        assert data["transactions"] == []
        assert data["total"] == 0

    def test_sync_transactions_success(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            exchange_resp = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        item_id = exchange_resp.json()["id"]
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.post("/api/plaid/transactions/sync", json={"plaid_item_id": item_id, "days_back": 30})
        assert response.status_code == 200
        data = response.json()
        assert "added" in data
        assert "updated" in data

    def test_sync_transactions_idempotent(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            exchange_resp = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        item_id = exchange_resp.json()["id"]
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            r1 = client.post("/api/plaid/transactions/sync", json={"plaid_item_id": item_id, "days_back": 30})
            r2 = client.post("/api/plaid/transactions/sync", json={"plaid_item_id": item_id, "days_back": 30})
        assert r1.json()["added"] == 1
        assert r2.json()["added"] == 0
        assert r2.json()["updated"] == 1

    def test_sync_transactions_missing_item(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            response = client.post("/api/plaid/transactions/sync", json={"plaid_item_id": 9999, "days_back": 30})
        assert response.status_code == 404

    def test_get_transactions_with_data(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            exchange_resp = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        item_id = exchange_resp.json()["id"]
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            client.post("/api/plaid/transactions/sync", json={"plaid_item_id": item_id, "days_back": 30})
        response = client.get("/api/plaid/transactions")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["transactions"][0]["name"] == "Coffee Shop"

    def test_get_transactions_pagination(self, client):
        response = client.get("/api/plaid/transactions?limit=10&offset=0")
        assert response.status_code == 200

    def test_assign_category_success(self, client):
        from database.db import get_db
        from models.models import TransactionCategory
        # Seed a transaction via sync
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            exchange_resp = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        item_id = exchange_resp.json()["id"]
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            client.post("/api/plaid/transactions/sync", json={"plaid_item_id": item_id, "days_back": 30})
        txs = client.get("/api/plaid/transactions").json()
        tx_id = txs["transactions"][0]["id"]
        # Seed a category
        from main import app
        db = next(app.dependency_overrides[get_db]())
        cat = TransactionCategory(name="Dining Out")
        db.add(cat)
        db.commit()
        db.refresh(cat)
        response = client.put(f"/api/plaid/transactions/{tx_id}/category", json={"category_id": cat.id})
        assert response.status_code == 200
        assert response.json()["category_id"] == cat.id

    def test_assign_category_missing_tx(self, client):
        response = client.put("/api/plaid/transactions/9999/category", json={"category_id": 1})
        assert response.status_code == 404


class TestBlame:
    def test_blame_empty(self, client):
        response = client.get("/api/plaid/blame")
        assert response.status_code == 200
        data = response.json()
        assert data["total_spending"] == 0.0
        assert data["by_category"] == []
        assert data["by_account"] == []

    def test_blame_with_data(self, client):
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            exchange_resp = client.post("/api/plaid/exchange-token", json={"public_token": "public-sandbox-abc"})
        item_id = exchange_resp.json()["id"]
        with patch(PATCH_TARGET, return_value=_mock_plaid_client()):
            client.post("/api/plaid/transactions/sync", json={"plaid_item_id": item_id, "days_back": 365})
        response = client.get("/api/plaid/blame?days_back=365")
        assert response.status_code == 200
        data = response.json()
        assert "total_spending" in data
        assert "period_start" in data
        assert "period_end" in data

    def test_blame_custom_days(self, client):
        response = client.get("/api/plaid/blame?days_back=7")
        assert response.status_code == 200
