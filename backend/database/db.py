import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.models import Base

DATABASE_URL = "sqlite:///./squeezypay.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _seed_default_categories()


def _seed_default_categories():
    from models.models import TransactionCategory
    db = SessionLocal()
    try:
        if db.query(TransactionCategory).count() == 0:
            categories = [
                "Housing",
                "Utilities",
                "Internet / Phone",
                "Groceries",
                "Fast Food / Dining Out",
                "Convenience / Gas Station",
                "Online Shopping",
                "Subscriptions / Streaming",
                "Healthcare / Medical",
                "Insurance",
                "Loans / Debt",
                "Education",
                "Entertainment",
                "Travel",
                "Personal Care",
                "Kids",
                "Miscellaneous",
            ]
            for cat_name in categories:
                db.add(TransactionCategory(name=cat_name))
            db.commit()
    finally:
        db.close()
