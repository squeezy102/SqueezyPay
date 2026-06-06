from datetime import UTC, datetime

from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from models.models import PlaidAccount, PlaidItem, PlaidTransaction


class PlaidItemRepository:
    @staticmethod
    def create(
        db: Session,
        item_id: str,
        access_token_enc: str,
        institution_id: str | None,
        institution_name: str | None,
    ) -> PlaidItem:
        item = PlaidItem(
            item_id=item_id,
            access_token_enc=access_token_enc,
            institution_id=institution_id,
            institution_name=institution_name,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_by_id(db: Session, item_id: int) -> PlaidItem | None:
        return db.query(PlaidItem).filter(PlaidItem.id == item_id).first()

    @staticmethod
    def get_by_plaid_id(db: Session, plaid_item_id: str) -> PlaidItem | None:
        return db.query(PlaidItem).filter(PlaidItem.item_id == plaid_item_id).first()

    @staticmethod
    def get_all(db: Session) -> list[PlaidItem]:
        return db.query(PlaidItem).all()

    @staticmethod
    def delete(db: Session, item: PlaidItem) -> None:
        db.delete(item)
        db.commit()


class PlaidAccountRepository:
    @staticmethod
    def upsert(db: Session, plaid_item_id: int, data: dict) -> PlaidAccount:
        existing = (
            db.query(PlaidAccount)
            .filter(PlaidAccount.account_id == data["account_id"])
            .first()
        )
        if existing:
            for key, value in data.items():
                setattr(existing, key, value)
            existing.balance_synced_at = datetime.now(UTC)
            db.commit()
            db.refresh(existing)
            return existing

        account = PlaidAccount(
            plaid_item_id=plaid_item_id,
            account_id=data["account_id"],
            name=data["name"],
            official_name=data.get("official_name"),
            type=data["type"],
            subtype=data.get("subtype"),
            mask=data.get("mask"),
            current_balance=data.get("current_balance"),
            available_balance=data.get("available_balance"),
            balance_synced_at=datetime.now(UTC),
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return account

    @staticmethod
    def get_by_item(db: Session, plaid_item_id: int) -> list[PlaidAccount]:
        return (
            db.query(PlaidAccount)
            .filter(PlaidAccount.plaid_item_id == plaid_item_id)
            .all()
        )

    @staticmethod
    def get_all(db: Session) -> list[PlaidAccount]:
        return db.query(PlaidAccount).all()

    @staticmethod
    def get_by_plaid_account_id(db: Session, account_id: str) -> PlaidAccount | None:
        return (
            db.query(PlaidAccount)
            .filter(PlaidAccount.account_id == account_id)
            .first()
        )


class PlaidTransactionRepository:
    @staticmethod
    def upsert(db: Session, plaid_account_id: int, data: dict) -> tuple[PlaidTransaction, bool]:
        """Returns (transaction, created). created=True if new, False if updated."""
        existing = (
            db.query(PlaidTransaction)
            .filter(PlaidTransaction.transaction_id == data["transaction_id"])
            .first()
        )
        if existing:
            for key, value in data.items():
                if key != "transaction_id":
                    setattr(existing, key, value)
            db.commit()
            db.refresh(existing)
            return existing, False

        tx = PlaidTransaction(
            plaid_account_id=plaid_account_id,
            transaction_id=data["transaction_id"],
            amount=data["amount"],
            date=data["date"],
            name=data["name"],
            merchant_name=data.get("merchant_name"),
            plaid_category_primary=data.get("plaid_category_primary"),
            plaid_category_detailed=data.get("plaid_category_detailed"),
            category_id=data.get("category_id"),
            payment_channel=data.get("payment_channel"),
            pending=data.get("pending", False),
            logo_url=data.get("logo_url"),
            iso_currency_code=data.get("iso_currency_code"),
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)
        return tx, True

    @staticmethod
    def get_by_account(
        db: Session,
        plaid_account_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> list[PlaidTransaction]:
        return (
            db.query(PlaidTransaction)
            .filter(PlaidTransaction.plaid_account_id == plaid_account_id)
            .order_by(PlaidTransaction.date.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_all(
        db: Session,
        limit: int = 50,
        offset: int = 0,
        start_date: str | None = None,
        end_date: str | None = None,
        plaid_account_id: int | None = None,
    ) -> tuple[list[PlaidTransaction], int]:
        q = db.query(PlaidTransaction)
        if plaid_account_id is not None:
            q = q.filter(PlaidTransaction.plaid_account_id == plaid_account_id)
        if start_date:
            q = q.filter(PlaidTransaction.date >= start_date)
        if end_date:
            q = q.filter(PlaidTransaction.date <= end_date)
        total = q.count()
        transactions = q.order_by(PlaidTransaction.date.desc()).offset(offset).limit(limit).all()
        return transactions, total

    @staticmethod
    def get_by_date_range(
        db: Session,
        start_date: str,
        end_date: str,
        exclude_pending: bool = True,
    ) -> list[PlaidTransaction]:
        q = (
            db.query(PlaidTransaction)
            .filter(PlaidTransaction.date >= start_date)
            .filter(PlaidTransaction.date <= end_date)
        )
        if exclude_pending:
            q = q.filter(PlaidTransaction.pending.is_(False))
        return q.order_by(PlaidTransaction.date.desc()).all()

    @staticmethod
    def get_by_id(db: Session, tx_id: int) -> PlaidTransaction | None:
        return db.query(PlaidTransaction).filter(PlaidTransaction.id == tx_id).first()

    @staticmethod
    def assign_category(db: Session, tx: PlaidTransaction, category_id: int) -> PlaidTransaction:
        tx.category_id = category_id
        db.commit()
        db.refresh(tx)
        return tx
