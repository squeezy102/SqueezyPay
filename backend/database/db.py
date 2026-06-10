import os
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base


def _resolve_db_path() -> Path:
    if getattr(sys, "frozen", False):
        # Running as a PyInstaller bundle — store data in %APPDATA%\SqueezyPay.
        # Fall back to a temp path when APPDATA is absent (e.g. --generate-key
        # invoked by the installer before env vars are written to the registry).
        appdata = os.environ.get("APPDATA") or os.environ.get("TEMP") or os.path.expanduser("~")
        data_dir = Path(appdata) / "SqueezyPay"
    else:
        # Dev mode — keep the database next to the backend directory
        data_dir = Path(__file__).resolve().parent.parent
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "squeezypay.db"


DB_PATH = _resolve_db_path()
DATABASE_URL = f"sqlite:///{DB_PATH}"

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
    _seed_default_settings()


def _seed_default_settings():
    from core.constants import DEFAULT_DUE_SOON_DAYS, DEFAULT_LARGE_PAYMENT_THRESHOLD
    from models.models import Setting
    db = SessionLocal()
    try:
        defaults = {
            "due_soon_days": str(DEFAULT_DUE_SOON_DAYS),
            "large_payment_threshold": str(DEFAULT_LARGE_PAYMENT_THRESHOLD),
        }
        for key, value in defaults.items():
            if not db.query(Setting).filter(Setting.key == key).first():
                db.add(Setting(key=key, value=value))
        db.commit()
    finally:
        db.close()


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
                "Income",
                "Transfer",
                "Bank Fees",
            ]
            for cat_name in categories:
                db.add(TransactionCategory(name=cat_name))
            db.commit()
    finally:
        db.close()
