import os
import sys
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.logging_config import get_logger
from database.db import get_db

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])
logger = get_logger("squeezypay.diagnostics")

_SAFE_TABLE_NAMES = [
    "bills",
    "credentials",
    "payment_methods",
    "payment_history",
    "income",
    "plaid_items",
    "plaid_accounts",
    "plaid_transactions",
    "transaction_categories",
    "settings",
    "auth_config",
]

_SAFE_SETTING_KEYS = {"due_soon_days", "large_payment_threshold"}


def _read_log_tail(n: int = 50) -> list[str]:
    """Return the last n lines from the rotating log file. Never raises."""
    try:
        if getattr(sys, "frozen", False):
            log_path = Path(os.environ.get("APPDATA", "")) / "SqueezyPay" / "logs" / "squeezypay.log"
        else:
            log_path = Path(__file__).resolve().parent.parent / "logs" / "squeezypay.log"
        if not log_path.exists():
            return []
        lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
        return lines[-n:]
    except Exception:
        return []


def _get_alembic_revision() -> str:
    """Return the current Alembic head revision applied to the DB."""
    try:
        from alembic.runtime.migration import MigrationContext
        from sqlalchemy import create_engine

        from database.db import DATABASE_URL

        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            ctx = MigrationContext.configure(conn)
            rev = ctx.get_current_revision()
        return rev or "none"
    except Exception as exc:
        return f"error: {exc}"


@router.get("/")
def get_diagnostics(db: Session = Depends(get_db)):
    table_counts: dict[str, int] = {}
    for table in _SAFE_TABLE_NAMES:
        try:
            result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))  # noqa: S608
            table_counts[table] = result.scalar() or 0
        except Exception:
            table_counts[table] = -1

    safe_settings: dict[str, str] = {}
    try:
        rows = db.execute(text("SELECT key, value FROM settings")).fetchall()
        for key, value in rows:
            if key in _SAFE_SETTING_KEYS:
                safe_settings[key] = value
    except Exception:
        pass

    plaid_configured = bool(
        os.environ.get("SQUEEZYPAY_PLAID_CLIENTID")
        and os.environ.get("SQUEEZYPAY_PLAID_SECRET")
    )

    from main import app  # version lives on the FastAPI instance
    app_version = getattr(app, "version", "unknown")

    return {
        "app_version": app_version,
        "python_version": sys.version,
        "frozen": getattr(sys, "frozen", False),
        "alembic_revision": _get_alembic_revision(),
        "table_counts": table_counts,
        "settings": safe_settings,
        "plaid_configured": plaid_configured,
        "log_tail": _read_log_tail(50),
    }
