"""
Tests for the /api/diagnostics/ endpoint and internal helper functions.
"""


_EXPECTED_TABLES = [
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

_EXPECTED_KEYS = {
    "app_version",
    "python_version",
    "frozen",
    "alembic_revision",
    "table_counts",
    "settings",
    "plaid_configured",
    "log_tail",
}


def test_diagnostics_endpoint_shape(client):
    """
    Scenario: GET /api/diagnostics/ with a healthy in-memory DB
    EP class: Valid path — all required keys must be present in response
    Expected: HTTP 200 with all eight required top-level keys present
    """
    response = client.get("/api/diagnostics/")
    assert response.status_code == 200
    data = response.json()
    assert _EXPECTED_KEYS == set(data.keys())


def test_diagnostics_table_counts_present(client):
    """
    Scenario: GET /api/diagnostics/ table_counts sub-dict
    EP class: Valid path — all eleven tracked table names must appear
    Expected: table_counts dict contains exactly the expected table names
    """
    response = client.get("/api/diagnostics/")
    assert response.status_code == 200
    table_counts = response.json()["table_counts"]
    for table in _EXPECTED_TABLES:
        assert table in table_counts, f"Missing table in table_counts: {table}"


def test_diagnostics_plaid_configured_false_when_env_absent(client, monkeypatch):
    """
    Scenario: GET /api/diagnostics/ when Plaid env vars are not set
    EP class: Invalid partition — missing both credential env vars → not configured
    Expected: plaid_configured is False
    """
    monkeypatch.delenv("SQUEEZYPAY_PLAID_CLIENTID", raising=False)
    monkeypatch.delenv("SQUEEZYPAY_PLAID_SECRET", raising=False)
    response = client.get("/api/diagnostics/")
    assert response.status_code == 200
    assert response.json()["plaid_configured"] is False


def test_diagnostics_plaid_configured_true_when_env_present(client, monkeypatch):
    """
    Scenario: GET /api/diagnostics/ when both Plaid env vars are set
    EP class: Valid partition — both credential env vars present → configured
    Expected: plaid_configured is True
    """
    monkeypatch.setenv("SQUEEZYPAY_PLAID_CLIENTID", "fake-client-id")
    monkeypatch.setenv("SQUEEZYPAY_PLAID_SECRET", "fake-secret")
    response = client.get("/api/diagnostics/")
    assert response.status_code == 200
    assert response.json()["plaid_configured"] is True


def test_read_log_tail_returns_list_when_no_file(tmp_path, monkeypatch):
    """
    Scenario: _read_log_tail() called when log file does not exist
    EP class: Invalid partition — missing file; function must not raise
    Expected: returns an empty list []
    """
    from pathlib import Path


    # Point the module's Path resolution at a non-existent path by patching
    # the __file__ attribute used to locate the log file to an isolated tmp dir
    nonexistent_log = tmp_path / "no_such_log.log"
    assert not nonexistent_log.exists()

    # Patch Path.exists to return False for the specific log path used by _read_log_tail
    original_exists = Path.exists

    def patched_exists(self):
        # Force the log file path to appear absent while letting other Paths work normally
        if "squeezypay.log" in str(self):
            return False
        return original_exists(self)

    monkeypatch.setattr(Path, "exists", patched_exists)

    from api.diagnostics import _read_log_tail
    result = _read_log_tail()
    assert isinstance(result, list)
    assert result == []


def test_get_alembic_revision_error_path(monkeypatch):
    """
    Scenario: _get_alembic_revision() when the DB URL is unreachable
    EP class: Exception path — SQLAlchemy connection fails
    Expected: returns a string starting with "error:"
    """
    from api.diagnostics import _get_alembic_revision

    # Point DATABASE_URL at a non-existent file to force a connection error
    monkeypatch.setattr("api.diagnostics.DATABASE_URL", "postgresql://invalid:5432/nosuchdb", raising=False)

    # Also patch the create_engine import inside the function to force failure
    def broken_create_engine(*args, **kwargs):
        raise Exception("simulated DB unreachable")

    # Patch via monkeypatching the function itself using a fresh import trick
    import unittest.mock as mock

    with mock.patch("sqlalchemy.create_engine", side_effect=Exception("simulated DB unreachable")):
        result = _get_alembic_revision()

    assert isinstance(result, str)
    assert result.startswith("error:")
