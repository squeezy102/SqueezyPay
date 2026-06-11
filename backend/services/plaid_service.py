import os
from datetime import date, timedelta
from decimal import Decimal

import plaid
from plaid.api import plaid_api
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
from plaid.model.item_get_request import ItemGetRequest
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.item_remove_request import ItemRemoveRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
from sqlalchemy.orm import Session

from core.logging_config import get_logger
from repositories.plaid_repository import (
    PlaidAccountRepository,
    PlaidItemRepository,
    PlaidTransactionRepository,
)
from services.encryption_service import encryption_service
from services.plaid_category_mapper import resolve_category_id

logger = get_logger("squeezypay.services.plaid")

_PLAID_ENV_MAP = {
    "sandbox":    plaid.Environment.Sandbox,
    "production": plaid.Environment.Production,
}


def _read_win_user_env(name: str) -> str | None:
    """Read a value from HKCU\\Environment (Windows User env vars) directly.

    Process-inherited os.environ misses vars set after the process started.
    This ensures the backend always sees the current User-scope registry values
    without requiring a full restart of the process tree.
    """
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value, _ = winreg.QueryValueEx(key, name)
            return str(value)
    except Exception:
        return None


def _get_plaid_client() -> plaid_api.PlaidApi:
    client_id = os.environ.get("SQUEEZYPAY_PLAID_CLIENTID") or _read_win_user_env("SQUEEZYPAY_PLAID_CLIENTID")
    secret    = os.environ.get("SQUEEZYPAY_PLAID_SECRET")    or _read_win_user_env("SQUEEZYPAY_PLAID_SECRET")
    env_name  = (os.environ.get("SQUEEZYPAY_PLAID_ENV")      or _read_win_user_env("SQUEEZYPAY_PLAID_ENV") or "sandbox").lower()

    if not client_id or not secret:
        raise RuntimeError(
            "SQUEEZYPAY_PLAID_CLIENTID and SQUEEZYPAY_PLAID_SECRET must be set. "
            "Obtain free keys from https://dashboard.plaid.com/ and set them as "
            "Windows environment variables."
        )

    host = _PLAID_ENV_MAP.get(env_name, plaid.Environment.Sandbox)
    configuration = plaid.Configuration(
        host=host,
        api_key={"clientId": client_id, "secret": secret},
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


class PlaidService:
    # ── Link flow ─────────────────────────────────────────────────────────────

    @staticmethod
    def create_link_token() -> str:
        client = _get_plaid_client()
        request = LinkTokenCreateRequest(
            client_name="SqueezyPay",
            language="en",
            country_codes=[CountryCode("US")],
            user=LinkTokenCreateRequestUser(client_user_id="household"),
            products=[Products("transactions")],
        )
        response = client.link_token_create(request)
        return response["link_token"]

    @staticmethod
    def exchange_public_token(db: Session, public_token: str) -> dict:
        existing = PlaidItemRepository.get_all(db)
        if existing:
            raise ValueError(
                "A financial institution is already connected. "
                "Disconnect it before connecting a new one."
            )

        client = _get_plaid_client()
        request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = client.item_public_token_exchange(request)

        raw_access_token = response["access_token"]
        plaid_item_id = response["item_id"]

        institution_name = PlaidService._fetch_institution_name(client, raw_access_token)

        encrypted = encryption_service.encrypt(raw_access_token)
        del raw_access_token

        item = PlaidItemRepository.create(
            db,
            item_id=plaid_item_id,
            access_token_enc=encrypted,
            institution_id=None,
            institution_name=institution_name,
        )

        PlaidService._sync_accounts_for_item(db, client, item)

        logger.info("Plaid item connected: item_id=%s institution=%s", plaid_item_id, institution_name)
        return PlaidService._item_to_dict(item)

    @staticmethod
    def _fetch_institution_name(client: plaid_api.PlaidApi, access_token: str) -> str | None:
        try:
            item_resp = client.item_get(ItemGetRequest(access_token=access_token))
            institution_id = item_resp["item"].get("institution_id")
            if not institution_id:
                return None
            inst_resp = client.institutions_get_by_id(
                InstitutionsGetByIdRequest(
                    institution_id=institution_id,
                    country_codes=[CountryCode("US")],
                )
            )
            return inst_resp["institution"]["name"]
        except Exception as exc:
            logger.warning("Could not fetch institution name: %s", exc)
            return None

    # ── Account sync ─────────────────────────────────────────────────────────

    @staticmethod
    def sync_balances(db: Session, plaid_item_id: int) -> list[dict]:
        item = PlaidItemRepository.get_by_id(db, plaid_item_id)
        if not item:
            raise ValueError(f"PlaidItem {plaid_item_id} not found")

        raw_token = encryption_service.decrypt(item.access_token_enc)
        try:
            client = _get_plaid_client()
            request = AccountsGetRequest(access_token=raw_token)
            response = client.accounts_get(request)
        finally:
            del raw_token

        for acct in response["accounts"]:
            PlaidAccountRepository.upsert(
                db,
                plaid_item_id=item.id,
                data=PlaidService._map_account(acct),
            )

        accounts = PlaidAccountRepository.get_by_item(db, item.id)
        return [PlaidService._account_to_dict(a, item.institution_name) for a in accounts]

    @staticmethod
    def _sync_accounts_for_item(db: Session, client: plaid_api.PlaidApi, item) -> None:
        raw_token = encryption_service.decrypt(item.access_token_enc)
        try:
            request = AccountsGetRequest(access_token=raw_token)
            response = client.accounts_get(request)
        finally:
            del raw_token

        for acct in response["accounts"]:
            PlaidAccountRepository.upsert(
                db,
                plaid_item_id=item.id,
                data=PlaidService._map_account(acct),
            )

    @staticmethod
    def _map_account(acct) -> dict:
        balances = acct.get("balances", {})
        return {
            "account_id":       acct["account_id"],
            "name":             acct["name"],
            "official_name":    acct.get("official_name"),
            "type":             str(acct["type"]),
            "subtype":          str(acct["subtype"]) if acct.get("subtype") else None,
            "mask":             acct.get("mask"),
            "current_balance":  balances.get("current"),
            "available_balance": balances.get("available"),
        }

    # ── Transaction sync ──────────────────────────────────────────────────────

    @staticmethod
    def sync_transactions(db: Session, plaid_item_id: int, days_back: int = 30) -> dict:
        item = PlaidItemRepository.get_by_id(db, plaid_item_id)
        if not item:
            raise ValueError(f"PlaidItem {plaid_item_id} not found")

        end = date.today()
        start = end - timedelta(days=days_back)

        raw_token = encryption_service.decrypt(item.access_token_enc)
        try:
            client = _get_plaid_client()
            all_transactions = []
            fetch_offset = 0
            while True:
                options = TransactionsGetRequestOptions(count=500, offset=fetch_offset)
                request = TransactionsGetRequest(
                    access_token=raw_token,
                    start_date=start,
                    end_date=end,
                    options=options,
                )
                response = client.transactions_get(request)
                page = response["transactions"]
                all_transactions.extend(page)
                if len(page) < 500:
                    break
                fetch_offset += len(page)
        finally:
            del raw_token

        added = 0
        updated = 0
        for tx in all_transactions:
            account = PlaidAccountRepository.get_by_plaid_account_id(db, tx["account_id"])
            if not account:
                continue

            pf_cat = tx.get("personal_finance_category") or {}
            primary = str(pf_cat.get("primary", "")) if pf_cat else None
            detailed = str(pf_cat.get("detailed", "")) if pf_cat else None

            category_id = resolve_category_id(db, primary, detailed)

            data = {
                "transaction_id":        tx["transaction_id"],
                "amount":                Decimal(str(tx["amount"])),
                "date":                  str(tx["date"]),
                "name":                  tx["name"],
                "merchant_name":         tx.get("merchant_name"),
                "plaid_category_primary":  primary,
                "plaid_category_detailed": detailed,
                "category_id":           category_id,
                "payment_channel":       str(tx["payment_channel"]) if tx.get("payment_channel") else None,
                "pending":               bool(tx.get("pending", False)),
                "logo_url":              tx.get("logo_url"),
                "iso_currency_code":     tx.get("iso_currency_code"),
            }
            _, created = PlaidTransactionRepository.upsert(db, account.id, data)
            if created:
                added += 1
            else:
                updated += 1

        logger.info(
            "Transaction sync complete for item_id=%d: added=%d updated=%d",
            plaid_item_id, added, updated,
        )
        return {"added": added, "updated": updated}

    # ── Read paths ────────────────────────────────────────────────────────────

    @staticmethod
    def get_all_items(db: Session) -> list[dict]:
        return [PlaidService._item_to_dict(i) for i in PlaidItemRepository.get_all(db)]

    @staticmethod
    def get_accounts(db: Session) -> list[dict]:
        items = {i.id: i for i in PlaidItemRepository.get_all(db)}
        accounts = PlaidAccountRepository.get_all(db)
        return [
            PlaidService._account_to_dict(a, items.get(a.plaid_item_id) and items[a.plaid_item_id].institution_name)
            for a in accounts
        ]

    @staticmethod
    def get_transactions(
        db: Session,
        plaid_account_id: int | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort_key: str = "date",
        sort_dir: str = "desc",
    ) -> dict:
        transactions, total = PlaidTransactionRepository.get_all(
            db,
            limit=limit,
            offset=offset,
            start_date=start_date,
            end_date=end_date,
            plaid_account_id=plaid_account_id,
            sort_key=sort_key,
            sort_dir=sort_dir,
        )
        return {
            "transactions": [PlaidService._tx_to_dict(t) for t in transactions],
            "total": total,
        }

    @staticmethod
    def assign_category(db: Session, tx_id: int, category_id: int) -> dict | None:
        tx = PlaidTransactionRepository.get_by_id(db, tx_id)
        if not tx:
            return None
        updated = PlaidTransactionRepository.assign_category(db, tx, category_id)
        return PlaidService._tx_to_dict(updated)

    # ── Disconnect ────────────────────────────────────────────────────────────

    @staticmethod
    def disconnect_item(db: Session, plaid_item_id: int) -> bool:
        item = PlaidItemRepository.get_by_id(db, plaid_item_id)
        if not item:
            return False

        raw_token = encryption_service.decrypt(item.access_token_enc)
        try:
            client = _get_plaid_client()
            request = ItemRemoveRequest(access_token=raw_token)
            client.item_remove(request)
        except Exception as exc:
            logger.warning("Plaid item_remove failed (continuing delete): %s", exc)
        finally:
            del raw_token

        PlaidItemRepository.delete(db, item)
        logger.info("Plaid item disconnected: id=%d", plaid_item_id)
        return True

    # ── Blame graph ───────────────────────────────────────────────────────────

    @staticmethod
    def get_blame_data(db: Session, days_back: int = 30) -> dict:
        end = date.today()
        start = end - timedelta(days=days_back)
        start_str = start.strftime("%Y-%m-%d")
        end_str = end.strftime("%Y-%m-%d")

        transactions = PlaidTransactionRepository.get_by_date_range(db, start_str, end_str, exclude_pending=True)

        # Only include positive amounts (debits/spending). Refunds and credits are negative.
        spending = [t for t in transactions if t.amount > 0]
        total = sum(t.amount for t in spending)

        by_category: dict[str, dict] = {}
        for tx in spending:
            label = tx.plaid_category_primary or "Uncategorized"
            if label not in by_category:
                by_category[label] = {"category": label, "amount": Decimal("0"), "count": 0}
            by_category[label]["amount"] += tx.amount
            by_category[label]["count"] += 1

        by_category_list = sorted(by_category.values(), key=lambda x: x["amount"], reverse=True)
        for row in by_category_list:
            row["pct"] = float(round((row["amount"] / total * 100) if total else 0, 1))
            row["amount"] = float(round(row["amount"], 2))

        # by_account: join through ORM relationship on each transaction
        accounts_map: dict[int, str] = {}
        by_account: dict[int, dict] = {}
        for tx in spending:
            if tx.plaid_account_id not in accounts_map:
                acct_obj = tx.account
                if acct_obj:
                    label = f"{acct_obj.name} (···{acct_obj.mask})" if acct_obj.mask else acct_obj.name
                else:
                    label = f"Account #{tx.plaid_account_id}"
                accounts_map[tx.plaid_account_id] = label
            label = accounts_map[tx.plaid_account_id]
            if tx.plaid_account_id not in by_account:
                by_account[tx.plaid_account_id] = {"account_name": label, "amount": Decimal("0")}
            by_account[tx.plaid_account_id]["amount"] += tx.amount

        by_account_list = sorted(by_account.values(), key=lambda x: x["amount"], reverse=True)
        for row in by_account_list:
            row["pct"] = float(round((row["amount"] / total * 100) if total else 0, 1))
            row["amount"] = float(round(row["amount"], 2))

        return {
            "period_start":    start_str,
            "period_end":      end_str,
            "total_spending":  float(round(total, 2)),
            "by_category":     by_category_list,
            "by_account":      by_account_list,
        }

    # ── Serializers (access_token never included) ─────────────────────────────

    @staticmethod
    def _item_to_dict(item) -> dict:
        return {
            "id":               item.id,
            "item_id":          item.item_id,
            "institution_name": item.institution_name,
            "created_at":       item.created_at.isoformat() if item.created_at else None,
        }

    @staticmethod
    def _account_to_dict(account, institution_name: str | None) -> dict:
        return {
            "id":                account.id,
            "account_id":        account.account_id,
            "name":              account.name,
            "official_name":     account.official_name,
            "type":              account.type,
            "subtype":           account.subtype,
            "mask":              account.mask,
            "current_balance":   account.current_balance,
            "available_balance": account.available_balance,
            "balance_synced_at": account.balance_synced_at.isoformat() if account.balance_synced_at else None,
            "institution_name":  institution_name,
        }

    @staticmethod
    def _tx_to_dict(tx) -> dict:
        return {
            "id":                      tx.id,
            "transaction_id":          tx.transaction_id,
            "plaid_account_id":        tx.plaid_account_id,
            "amount":                  tx.amount,
            "date":                    tx.date,
            "name":                    tx.name,
            "merchant_name":           tx.merchant_name,
            "plaid_category_primary":  tx.plaid_category_primary,
            "plaid_category_detailed": tx.plaid_category_detailed,
            "category_id":             tx.category_id,
            "payment_channel":         tx.payment_channel,
            "pending":                 tx.pending,
            "logo_url":                tx.logo_url,
            "iso_currency_code":       tx.iso_currency_code,
            "created_at":              tx.created_at.isoformat() if tx.created_at else None,
        }
