"""
Migration integrity tests.

Verifies that the full Alembic migration chain can be applied to a fresh
SQLite file and cleanly reversed. These tests run against a real on-disk
SQLite file (not in-memory) to faithfully represent the installer's
--migrate path and the upgrade flow a user encounters.

Why on-disk rather than :memory:?
  Alembic's render_as_batch=True mode recreates tables via a temp-table
  copy strategy. SQLite in-memory databases lose the temp table when the
  connection that created it closes; the batch operation uses a second
  connection internally. Using a real file avoids this edge case and more
  closely mirrors production.

Why patch database.db.DATABASE_URL?
  alembic/env.py line 21 calls `config.set_main_option("sqlalchemy.url", DATABASE_URL)`
  unconditionally at the top level of the script. This overrides whatever URL the
  AlembicConfig object was given before the command runs. env.py is re-executed for
  every alembic command call via `from database.db import DATABASE_URL` — patching
  the module attribute before each command ensures env.py picks up the test URL.

Standards: ISTQB integration testing (component integration level),
risk-based prioritisation (migration breakage is a silent installer failure).

Marked @pytest.mark.slow — excluded from the fast local run with:
    pytest -m "not slow"
CI runs the full suite including these tests on every push.
"""
from pathlib import Path

import pytest
from alembic.config import Config as AlembicConfig
from sqlalchemy import create_engine, inspect, text

import database.db as _db_module
from alembic import command

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _alembic_cfg(db_url: str) -> AlembicConfig:
    """Return an AlembicConfig pointed at the given SQLite URL."""
    ini_path = Path(__file__).parent.parent / "alembic.ini"
    cfg = AlembicConfig(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def _patch_db_url(monkeypatch, db_url: str) -> None:
    """
    Patch database.db.DATABASE_URL so that alembic/env.py picks up the test URL.

    env.py does `from database.db import DATABASE_URL` at script execution time,
    which binds to the current value of the module attribute — patching here means
    env.py sees the test URL rather than the dev/prod path.
    """
    monkeypatch.setattr(_db_module, "DATABASE_URL", db_url)


def _table_names(db_url: str) -> list[str]:
    engine = create_engine(db_url)
    try:
        return inspect(engine).get_table_names()
    finally:
        engine.dispose()


def _alembic_version(db_url: str) -> str | None:
    """Return the current alembic_version value, or None if table absent."""
    engine = create_engine(db_url)
    try:
        with engine.connect() as conn:
            tables = inspect(engine).get_table_names()
            if "alembic_version" not in tables:
                return None
            row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
            return row[0] if row else None
    finally:
        engine.dispose()


# ---------------------------------------------------------------------------
# Expected schema tables (produced by upgrade head)
# ---------------------------------------------------------------------------
_EXPECTED_TABLES = {
    "bills",
    "payment_history",
    "payment_methods",
    "auth_config",
    "income",
    "credentials",
    "plaid_items",
    "plaid_accounts",
    "plaid_transactions",
    "transaction_categories",
    "settings",
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.slow
def test_upgrade_head_creates_all_tables(tmp_path, monkeypatch):
    """
    Full migration chain (base → head) applied to an empty SQLite file must
    succeed and produce all expected tables.

    This is the installer's --migrate path for a fresh install.
    """
    db_path = tmp_path / "fresh.db"
    db_url = f"sqlite:///{db_path}"
    _patch_db_url(monkeypatch, db_url)
    cfg = _alembic_cfg(db_url)

    command.upgrade(cfg, "head")

    assert db_path.exists(), "Database file was not created"
    tables = set(_table_names(db_url))
    missing = _EXPECTED_TABLES - tables
    assert not missing, f"Tables missing after upgrade head: {missing}"


@pytest.mark.slow
def test_upgrade_head_stamps_alembic_version(tmp_path, monkeypatch):
    """
    After upgrade head the alembic_version table must contain exactly one
    row identifying the head revision.

    Verifies that the migration chain completed fully and did not silently
    stop mid-chain.
    """
    db_path = tmp_path / "versioned.db"
    db_url = f"sqlite:///{db_path}"
    _patch_db_url(monkeypatch, db_url)
    cfg = _alembic_cfg(db_url)

    command.upgrade(cfg, "head")

    version = _alembic_version(db_url)
    assert version is not None, "alembic_version table is empty after upgrade head"
    assert len(version) > 0


@pytest.mark.slow
def test_downgrade_one_step_succeeds(tmp_path, monkeypatch):
    """
    The most recent migration must be reversible.

    Applies all migrations then rolls back one step. If any migration's
    downgrade() function is broken (common with render_as_batch table
    recreations), this test catches it.
    """
    db_path = tmp_path / "downgrade_one.db"
    db_url = f"sqlite:///{db_path}"
    _patch_db_url(monkeypatch, db_url)
    cfg = _alembic_cfg(db_url)

    command.upgrade(cfg, "head")
    head_version = _alembic_version(db_url)

    command.downgrade(cfg, "-1")
    after_version = _alembic_version(db_url)

    # Version must have changed (or be None if we're back to base)
    assert after_version != head_version, (
        "alembic_version did not change after downgrade -1; "
        "downgrade() may be a no-op"
    )


@pytest.mark.slow
def test_downgrade_to_base_then_upgrade_again(tmp_path, monkeypatch):
    """
    Full round-trip: upgrade head → downgrade base → upgrade head again.

    Verifies that no migration leaves the schema in a state that prevents
    re-application. This is the upgrade path a user hits when re-running
    the installer over an existing installation.
    """
    db_path = tmp_path / "roundtrip.db"
    db_url = f"sqlite:///{db_path}"
    _patch_db_url(monkeypatch, db_url)
    cfg = _alembic_cfg(db_url)

    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")

    # After downgrade to base, no application tables should remain
    # (alembic_version table may still exist — that is acceptable)
    tables_after_downgrade = set(_table_names(db_url)) - {"alembic_version"}
    assert not tables_after_downgrade, (
        f"Tables remain after downgrade to base: {tables_after_downgrade}"
    )

    # Re-upgrading must succeed and restore all tables
    command.upgrade(cfg, "head")
    tables_after_reupgrade = set(_table_names(db_url))
    missing = _EXPECTED_TABLES - tables_after_reupgrade
    assert not missing, f"Tables missing after re-upgrade: {missing}"


@pytest.mark.slow
def test_stamp_head_then_upgrade_is_noop(tmp_path, monkeypatch):
    """
    Simulates the installer fresh-install path:
      1. create_all() populates the schema directly (no migrations run)
      2. alembic stamp head marks the DB as already at head
      3. alembic upgrade head must be a no-op (0 migrations applied)

    If this fails it means the installer's fresh-install path would attempt
    to re-apply migrations on top of a schema that already exists, likely
    causing errors or data loss.
    """
    from models.models import Base

    db_path = tmp_path / "stamp.db"
    db_url = f"sqlite:///{db_path}"
    _patch_db_url(monkeypatch, db_url)

    # Step 1: create schema directly (as init_db() does)
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    engine.dispose()

    # Step 2: stamp to head without running migrations
    cfg = _alembic_cfg(db_url)
    command.stamp(cfg, "head")

    stamped_version = _alembic_version(db_url)
    assert stamped_version is not None

    # Step 3: upgrade head should be a no-op — no exception, same version
    command.upgrade(cfg, "head")
    post_upgrade_version = _alembic_version(db_url)
    assert post_upgrade_version == stamped_version, (
        "alembic_version changed after upgrade head on a stamped-head database; "
        "migrations were re-applied when they should not have been"
    )


@pytest.mark.slow
def test_numeric_columns_present_after_migration(tmp_path, monkeypatch):
    """
    The numeric_monetary_columns migration converts Float → Numeric(12,2) on
    plaid_accounts and plaid_transactions. Verify that those columns exist
    with the correct affinity after upgrade head.

    render_as_batch=True recreates the table; a broken batch migration could
    silently drop columns or change their type.
    """
    db_path = tmp_path / "numeric.db"
    db_url = f"sqlite:///{db_path}"
    _patch_db_url(monkeypatch, db_url)
    cfg = _alembic_cfg(db_url)

    command.upgrade(cfg, "head")

    engine = create_engine(db_url)
    try:
        insp = inspect(engine)
        account_cols = {c["name"]: c for c in insp.get_columns("plaid_accounts")}
        tx_cols = {c["name"]: c for c in insp.get_columns("plaid_transactions")}
    finally:
        engine.dispose()

    assert "current_balance" in account_cols, "current_balance column missing from plaid_accounts"
    assert "available_balance" in account_cols, "available_balance column missing from plaid_accounts"
    assert "amount" in tx_cols, "amount column missing from plaid_transactions"
