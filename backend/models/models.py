from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PaymentHistory(Base):
    __tablename__ = "payment_history"

    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    amount_paid = Column(Float, nullable=False)
    payment_method = Column(String(255), nullable=True)
    confirmation_number = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    username = Column(String(255), nullable=False)
    password_encrypted = Column(String(500), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True)
    nickname = Column(String(255), nullable=False)
    payment_type = Column(String(50), nullable=False)
    last_four = Column(String(4), nullable=False)
    expiration_date = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TransactionCategory(Base):
    __tablename__ = "transaction_categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True)
    source_name = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    frequency = Column(String(50), nullable=False)
    next_expected_date = Column(DateTime, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
