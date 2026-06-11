from datetime import UTC, datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def _utcnow():
    return datetime.now(UTC)


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    expected_amount = Column(Float, nullable=True)
    day_of_month = Column(Integer, nullable=False)
    url = Column(String(500), nullable=False)
    recurring = Column(Boolean, default=True)
    active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class PaymentHistory(Base):
    __tablename__ = "payment_history"

    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    amount_paid = Column(Float, nullable=False)
    payment_method = Column(String(255), nullable=True)
    confirmation_number = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    username = Column(String(255), nullable=False)
    password_encrypted = Column(String(500), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True)
    nickname = Column(String(255), nullable=False)
    payment_type = Column(String(50), nullable=False)
    last_four = Column(String(4), nullable=False)
    expiration_date = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class TransactionCategory(Base):
    __tablename__ = "transaction_categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=_utcnow)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=False)


class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True)
    source_name = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    frequency = Column(String(50), nullable=False)
    next_expected_date = Column(DateTime, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class AuthConfig(Base):
    __tablename__ = "auth_config"

    id = Column(Integer, primary_key=True)
    passphrase_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    id = Column(Integer, primary_key=True)
    item_id = Column(String(255), unique=True, nullable=False)
    access_token_enc = Column(String(1000), nullable=False)
    institution_id = Column(String(100), nullable=True)
    institution_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    accounts = relationship("PlaidAccount", back_populates="item", cascade="all, delete-orphan")


class PlaidAccount(Base):
    __tablename__ = "plaid_accounts"

    id = Column(Integer, primary_key=True)
    plaid_item_id = Column(Integer, ForeignKey("plaid_items.id"), nullable=False)
    account_id = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    official_name = Column(String(255), nullable=True)
    type = Column(String(50), nullable=False)
    subtype = Column(String(50), nullable=True)
    mask = Column(String(10), nullable=True)
    current_balance = Column(Numeric(precision=12, scale=2), nullable=True)
    available_balance = Column(Numeric(precision=12, scale=2), nullable=True)
    balance_synced_at = Column(DateTime, nullable=True)

    item = relationship("PlaidItem", back_populates="accounts")
    transactions = relationship("PlaidTransaction", back_populates="account", cascade="all, delete-orphan")


class PlaidTransaction(Base):
    __tablename__ = "plaid_transactions"
    __table_args__ = (UniqueConstraint("transaction_id", name="uq_plaid_transaction_id"),)

    id = Column(Integer, primary_key=True)
    plaid_account_id = Column(Integer, ForeignKey("plaid_accounts.id"), nullable=False)
    transaction_id = Column(String(255), nullable=False)
    amount = Column(Numeric(precision=12, scale=2), nullable=False)
    date = Column(String(10), nullable=False)
    name = Column(String(500), nullable=False)
    merchant_name = Column(String(255), nullable=True)
    plaid_category_primary = Column(String(255), nullable=True)
    plaid_category_detailed = Column(String(255), nullable=True)
    category_id = Column(Integer, ForeignKey("transaction_categories.id"), nullable=True)
    payment_channel = Column(String(50), nullable=True)
    pending = Column(Boolean, default=False)
    logo_url = Column(String(500), nullable=True)
    iso_currency_code = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    account = relationship("PlaidAccount", back_populates="transactions")
