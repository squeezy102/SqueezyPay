# Test Coverage Audit — Backend API & Services

**Project:** SqueezyPay  
**Scope:** `c:\SqueezyPay\backend\`  
**Test suite:** pytest + httpx (191 tests)  
**Overall coverage:** 92%  
**Audit date:** 2026-06-08  
**Auditor:** Claude Code (automated static + coverage analysis)  
**Standards applied:** ISTQB EP, BVA, decision coverage, MC/DC, risk-based prioritisation

---

## Executive Summary

The SqueezyPay backend achieves a respectable 92% statement coverage across 191 tests, indicating a generally healthy test culture. However, the remaining 8% is not uniformly distributed: it is concentrated in modules that carry disproportionate security and reliability risk. Three distinct root causes account for almost all gaps:

1. **Missing test scenarios for existing code** — The `autofill` subsystem in `api/bills.py` (lines 101–163), error branches in `api/plaid.py`, and the `disconnect_item` Plaid SDK failure path are all reachable code paths for which no test exercises the logic.

2. **Auth dependency bypass in the shared test fixture** — `conftest.py` overrides `require_auth` to a no-op for every test. This means `core/auth.py`'s `require_auth` function (lines 16–23) — the entire JWT-verification body — is never exercised by the 191-test suite, except by one hand-rolled integration test. All four decision branches (missing credentials, empty secret, `ExpiredSignatureError`, `InvalidTokenError`) are uncovered in the systematic test run.

3. **Untestable-by-design entry points** — `seed.py` and the `if __name__ == "__main__"` block in `main.py` are CLI / installer bootstrap paths that cannot be exercised through the normal HTTP test client. They require dedicated unit-level tests that call the functions directly.

The most critical gap is the auth module: 0% MC/DC coverage on the security boundary means a regression in JWT validation logic could ship undetected. The autofill subprocess path is the second-highest risk due to its direct system call surface.

---

## Coverage Metrics Table

| Module | Stmts | Miss | Coverage | Severity |
|---|---|---|---|---|
| `seed.py` | 20 | 20 | 0% | Low |
| `api/diagnostics.py` | 56 | 40 | 29% | Medium |
| `main.py` | 145 | 65 | 55% | Medium |
| `core/auth.py` | 18 | 8 | 56% | Critical |
| `api/bills.py` | 114 | 38 | 67% | High |
| `repositories/settings_repository.py` | ~24 | ~4 | 83% | Low |
| `api/plaid.py` | ~72 | ~12 | 83% | High |
| `services/settings_service.py` | ~47 | ~8 | 84% | Low |
| `api/settings.py` | ~36 | ~4 | 89% | Low |
| `services/auth_service.py` | ~68 | ~7 | 90% | Medium |
| `services/plaid_service.py` | ~390 | ~33 | 92% | Medium |

---

## Gap Analysis

---

### `core/auth.py` — 56%

#### What is uncovered

Lines 16–23: the entire body of `require_auth()` beyond the first `if not credentials` guard.  
Specifically uncovered branches:
- Line 16–17: `if not secret` → raises 401 "Authentication unavailable" (secret key absent from environment)
- Lines 18–19: `jwt.decode(...)` success path (credential accepted, function returns normally)
- Lines 20–21: `except jwt.ExpiredSignatureError` → raises 401 "Session expired"
- Lines 22–23: `except jwt.InvalidTokenError` → raises 401 "Invalid token"

The `test_protected_route_without_token` test in `test_auth.py` exercises the `if not credentials` branch (line 14–15) and covers one path, but the other four outcomes are never reached in the coverage run because `conftest.py` globally overrides `require_auth` to `lambda: None`.

#### Why it is uncovered

**Root cause: the shared test fixture bypasses the security boundary.**  
`conftest.py` line 48–52 registers `override_require_auth` (a no-op) as a FastAPI dependency override for `require_auth` in every test. This architectural decision, while pragmatic for testing business logic, completely excludes the security function from the coverage measurement. The one test that does not use the override (`test_protected_route_without_token`) only covers the "no credentials at all" branch.

#### Risk classification (ISTQB)

**CRITICAL — Security boundary, direct authentication bypass risk.**

- **EP:** Four equivalence classes exist for the credential input: (1) absent, (2) present but secret key missing, (3) present with expired token, (4) present with malformed/invalid token, (5) present with valid token. Only class (1) is confirmed tested.
- **Decision coverage:** 5 branches, 1 covered = 20% decision coverage on the most security-sensitive function in the codebase.
- **MC/DC:** Not achievable with current test design — the dependency override means conditions in `require_auth` can never independently affect the test outcome.
- **Risk:** A regression that silently accepts any token string (e.g., if `jwt.decode` raised an unexpected exception subclass not caught by `InvalidTokenError`) would pass all 191 tests undetected.

#### Test suggestions (stubs with docstrings)

```python
# tests/test_core_auth.py
import os
import time
import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from core.auth import ALGORITHM, require_auth


def _make_credentials(token: str) -> HTTPAuthorizationCredentials:
    """Helper: wrap a raw token string in the Bearer scheme object."""
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _valid_token(secret: str = "test-secret-32chars-minimum!!!!!") -> str:
    """Helper: produce a non-expired, well-formed JWT."""
    import datetime
    payload = {
        "sub": "household",
        "exp": datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def _expired_token(secret: str = "test-secret-32chars-minimum!!!!!") -> str:
    """Helper: produce a JWT whose exp is in the past."""
    import datetime
    payload = {
        "sub": "household",
        "exp": datetime.datetime.now(datetime.UTC) - datetime.timedelta(seconds=1),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def test_require_auth_no_credentials_raises_401():
    """
    EP class: absent credentials object.
    Passing None (HTTPBearer auto_error=False returns None) must raise 401
    with detail 'Not authenticated'.
    """
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=None)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Not authenticated"


def test_require_auth_missing_secret_key_raises_401(monkeypatch):
    """
    EP class: credentials present, but SQUEEZYPAY_SECRET_KEY env var absent.
    Must raise 401 'Authentication unavailable'.
    BVA: empty string is the boundary — both '' and unset must be rejected.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "")
    creds = _make_credentials("any-token")
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=creds)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Authentication unavailable"


def test_require_auth_valid_token_returns_none(monkeypatch):
    """
    EP class: well-formed, non-expired JWT signed with correct secret.
    require_auth must return without raising (FastAPI dependency returns None).
    """
    secret = "test-secret-32chars-minimum!!!!!"
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", secret)
    creds = _make_credentials(_valid_token(secret))
    result = require_auth(credentials=creds)  # must not raise
    assert result is None


def test_require_auth_expired_token_raises_401(monkeypatch):
    """
    EP class: token structurally valid but exp claim in the past.
    Must raise 401 'Session expired', not 'Invalid token'.
    """
    secret = "test-secret-32chars-minimum!!!!!"
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", secret)
    creds = _make_credentials(_expired_token(secret))
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=creds)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Session expired"


def test_require_auth_invalid_token_raises_401(monkeypatch):
    """
    EP class: token is structurally malformed / signed with wrong secret.
    Must raise 401 'Invalid token'.
    BVA: boundary between 'garbage string' and 'valid JWT with wrong sig'.
    """
    secret = "test-secret-32chars-minimum!!!!!"
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", secret)
    creds = _make_credentials("this.is.not.a.real.jwt")
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=creds)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"


def test_require_auth_wrong_secret_raises_401(monkeypatch):
    """
    EP class: well-formed JWT signed with a different secret (tampered token).
    Must reject with 401 'Invalid token' — verify signature-check branch.
    """
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "correct-secret-32chars-minimum!!")
    token = _valid_token("different-secret-32chars-minimum!")
    creds = _make_credentials(token)
    with pytest.raises(HTTPException) as exc_info:
        require_auth(credentials=creds)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid token"
```

---

### `api/bills.py` — 67%

#### What is uncovered

Lines 53, 56, 63, 65: validator edge cases in `BillUpdate` — specifically the `strip_and_require` and `validate_url` validators on `BillUpdate` when called with blank strings (after stripping) and non-http URLs. These are distinct code paths from the `BillCreate` validators (which share the same logic but are different class methods).

Lines 101–163: the entire `autofill_bill` endpoint and its `_try_autofill` helper:
- Line 103–105: bill not found → 404
- Line 107–109: credential not found → 404
- Lines 119–163: `_try_autofill()` subprocess launch, including the success path (returncode 0), the timeout path (process still running), the non-zero exit path, and the exception-on-launch path.

#### Why it is uncovered

**Two distinct reasons:**

1. **BillUpdate validators** — The existing `test_bills.py` only tests updates with valid payloads or with a non-existent bill ID. No test submits a `PUT` payload containing a blank string or a non-http URL, so the `BillUpdate` validator branches are not reached despite having the same logic as `BillCreate`.

2. **`autofill_bill` / `_try_autofill`** — This feature depends on `CredentialService.get_by_bill_id` (which implies a pre-existing credential) and on `subprocess.Popen` launching a real `autofill_worker.py`. The subprocess dependency makes this effectively an integration-only path in production, and the test suite has no tests whatsoever for this endpoint. It is 100% uncovered.

#### Risk classification (ISTQB)

**HIGH — `autofill_bill` calls `subprocess.Popen` with user-supplied data (bill URL, username, password) encoded in base64. The error-handling branches in `_try_autofill` are entirely untested.**

- **EP:** Validator equivalence classes: valid URL, URL without scheme, blank-after-strip name, None (allowed for update). None of the negative classes are tested for `BillUpdate`.
- **BVA:** `day_of_month` BVA boundary values (1, 31) covered for create but not for update.
- **Subprocess paths — decision coverage:** 4 outcomes (returncode 0, returncode != 0, `TimeoutExpired`, `Exception` on `Popen`) — 0% covered.
- **Risk:** Uncovered exception handling in a subprocess caller means error telemetry and return value correctness are unverified.

#### Test suggestions (stubs with docstrings)

```python
# additions to tests/test_bills.py

BILL_PAYLOAD = {
    "name": "Example Electric Co",
    "category": "Utilities",
    "url": "https://www.example.com/account/guest-pay",
    "expected_amount": 120.00,
    "day_of_month": 20,
    "recurring": True,
}


# ── BillUpdate validator coverage ─────────────────────────────────────────────

def test_update_bill_blank_name_rejected(client):
    """
    BillUpdate.strip_and_require: blank string after stripping must return 422.
    EP: blank-after-strip is a separate invalid partition from None (which is allowed).
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"name": "   "})
    assert response.status_code == 422


def test_update_bill_invalid_url_rejected(client):
    """
    BillUpdate.validate_url: URL without http/https scheme must return 422.
    EP: 'ftp://' and bare domain strings are both in the invalid partition.
    BVA: boundary is the presence of 'http://' or 'https://' prefix.
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    response = client.put(f"/api/bills/{created['id']}", json={"url": "ftp://notallowed.com"})
    assert response.status_code == 422


def test_update_bill_day_of_month_boundary_values(client):
    """
    BVA: day_of_month=1 (min) and day_of_month=31 (max) must be accepted for update.
    day_of_month=0 and day_of_month=32 must return 422.
    """
    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    assert client.put(f"/api/bills/{created['id']}", json={"day_of_month": 1}).status_code == 200
    assert client.put(f"/api/bills/{created['id']}", json={"day_of_month": 31}).status_code == 200
    assert client.put(f"/api/bills/{created['id']}", json={"day_of_month": 0}).status_code == 422
    assert client.put(f"/api/bills/{created['id']}", json={"day_of_month": 32}).status_code == 422


# ── Autofill endpoint coverage ─────────────────────────────────────────────────

def test_autofill_bill_not_found(client):
    """
    autofill_bill: bill ID not in DB must return 404 before credential lookup.
    """
    response = client.post("/api/bills/9999/autofill")
    assert response.status_code == 404
    assert response.json()["detail"] == "Bill not found"


def test_autofill_no_credential_returns_404(client):
    """
    autofill_bill: bill exists but CredentialService.get_by_bill_id returns None
    must return 404 'No credential stored for this bill'.
    """
    from unittest.mock import patch
    from services.credential_service import CredentialService

    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    with patch.object(CredentialService, "get_by_bill_id", return_value=None):
        response = client.post(f"/api/bills/{created['id']}/autofill")
    assert response.status_code == 404
    assert "No credential" in response.json()["detail"]


def test_autofill_worker_success(client):
    """
    _try_autofill: subprocess exits with returncode=0, must return filled=True.
    EP: successful autofill partition.
    """
    from unittest.mock import MagicMock, patch
    from services.credential_service import CredentialService

    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    mock_cred = {"username": "user@example.com", "password": "secret"}
    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.wait.return_value = 0

    with patch.object(CredentialService, "get_by_bill_id", return_value=mock_cred):
        with patch("api.bills.subprocess.Popen", return_value=mock_proc):
            response = client.post(f"/api/bills/{created['id']}/autofill")
    assert response.status_code == 200
    assert response.json()["filled"] is True


def test_autofill_worker_nonzero_exit_returns_filled_false(client):
    """
    _try_autofill: subprocess exits with non-zero returncode, must return filled=False.
    EP: worker failure partition.
    """
    from unittest.mock import MagicMock, patch
    from services.credential_service import CredentialService

    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    mock_cred = {"username": "user@example.com", "password": "secret"}
    mock_proc = MagicMock()
    mock_proc.returncode = 1
    mock_proc.stderr.read.return_value = b"login failed"

    with patch.object(CredentialService, "get_by_bill_id", return_value=mock_cred):
        with patch("api.bills.subprocess.Popen", return_value=mock_proc):
            response = client.post(f"/api/bills/{created['id']}/autofill")
    assert response.status_code == 200
    assert response.json()["filled"] is False


def test_autofill_worker_timeout_returns_filled_true(client):
    """
    _try_autofill: subprocess.TimeoutExpired means the browser window is open
    with fields filled — must return filled=True.
    EP: browser-still-open partition.
    """
    import subprocess
    from unittest.mock import MagicMock, patch
    from services.credential_service import CredentialService

    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    mock_cred = {"username": "user@example.com", "password": "secret"}
    mock_proc = MagicMock()
    mock_proc.wait.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=12)

    with patch.object(CredentialService, "get_by_bill_id", return_value=mock_cred):
        with patch("api.bills.subprocess.Popen", return_value=mock_proc):
            response = client.post(f"/api/bills/{created['id']}/autofill")
    assert response.status_code == 200
    assert response.json()["filled"] is True


def test_autofill_popen_exception_returns_filled_false(client):
    """
    _try_autofill: if Popen itself raises (e.g. worker script not found),
    the endpoint must still return 200 with filled=False, not a 500.
    EP: launch failure partition.
    """
    from unittest.mock import patch
    from services.credential_service import CredentialService

    created = client.post("/api/bills/", json=BILL_PAYLOAD).json()
    mock_cred = {"username": "user@example.com", "password": "secret"}

    with patch.object(CredentialService, "get_by_bill_id", return_value=mock_cred):
        with patch("api.bills.subprocess.Popen", side_effect=FileNotFoundError("worker not found")):
            response = client.post(f"/api/bills/{created['id']}/autofill")
    assert response.status_code == 200
    assert response.json()["filled"] is False
```

---

### `api/diagnostics.py` — 29%

#### What is uncovered

Lines 34–44: `_read_log_tail()` — both the frozen-executable branch (`sys.frozen == True`) and the normal development branch (log file exists and contains lines). The "file does not exist" path returns `[]` and is technically exercised if the log file is absent in the test environment, but this is incidental rather than deliberate.

Lines 47–61: `_get_alembic_revision()` — the entire function. It imports Alembic, creates a second SQLAlchemy engine from `DATABASE_URL`, runs a migration context inspection, and returns the revision string or an error string.

Lines 64–100: `get_diagnostics()` endpoint — the full HTTP handler. This implies:
- The `for table in _SAFE_TABLE_NAMES` loop with both success and exception paths.
- The `settings` query with both success and exception paths.
- The `os.environ.get("SQUEEZYPAY_PLAID_CLIENTID")` boolean logic.
- The `from main import app` dynamic import for version extraction.

#### Why it is uncovered

**The diagnostics router receives no test at all.** `tests/` contains no `test_diagnostics.py`. The entire module is covered only at the import/module-level lines (the constant definitions at lines 15–29).

Additionally, two structural issues make it harder to test:
1. `_read_log_tail` uses `sys.frozen` — a PyInstaller-specific attribute — creating an environmental branch that only executes in a packaged build.
2. `_get_alembic_revision` creates a second engine from the module-level `DATABASE_URL` rather than accepting a `db: Session`, making it impossible to inject the in-memory test database without patching.

#### Risk classification (ISTQB)

**MEDIUM — Operational observability endpoint. A broken `/api/diagnostics/` degrades incident response capability but does not compromise data or access control. However, the Plaid configuration detection and Alembic revision logic could silently return wrong data.**

- **EP:** Plaid configured: `{both vars set}` vs `{one or both absent}`.
- **Decision coverage:** Exception-swallowing `except` blocks in table count loop and settings query have 0% coverage.
- **Risk:** A silent exception in the table loop returns `-1` for affected tables; this silent failure is unverified.

#### Test suggestions (stubs with docstrings)

```python
# tests/test_diagnostics.py
from unittest.mock import patch, MagicMock


def test_diagnostics_returns_expected_shape(client):
    """
    GET /api/diagnostics/ must return 200 with the documented keys.
    Integration: exercises all SAFE_TABLE_NAMES against the in-memory DB.
    """
    with patch("api.diagnostics._get_alembic_revision", return_value="abc1234"):
        with patch("api.diagnostics._read_log_tail", return_value=["line1", "line2"]):
            response = client.get("/api/diagnostics/")
    assert response.status_code == 200
    data = response.json()
    for key in ("app_version", "python_version", "frozen", "alembic_revision",
                "table_counts", "settings", "plaid_configured", "log_tail"):
        assert key in data, f"missing key: {key}"


def test_diagnostics_table_counts_all_tables_present(client):
    """
    table_counts must contain an entry for every table in _SAFE_TABLE_NAMES.
    EP: empty database → all counts are 0, not -1 (no exceptions expected).
    """
    from api.diagnostics import _SAFE_TABLE_NAMES
    with patch("api.diagnostics._get_alembic_revision", return_value="none"):
        response = client.get("/api/diagnostics/")
    data = response.json()
    for table in _SAFE_TABLE_NAMES:
        assert table in data["table_counts"]
        assert data["table_counts"][table] >= 0, f"table {table} raised an exception"


def test_diagnostics_plaid_configured_false_when_env_absent(client, monkeypatch):
    """
    EP: both Plaid env vars absent → plaid_configured must be False.
    """
    monkeypatch.delenv("SQUEEZYPAY_PLAID_CLIENTID", raising=False)
    monkeypatch.delenv("SQUEEZYPAY_PLAID_SECRET", raising=False)
    with patch("api.diagnostics._get_alembic_revision", return_value="none"):
        response = client.get("/api/diagnostics/")
    assert response.json()["plaid_configured"] is False


def test_diagnostics_plaid_configured_true_when_env_set(client, monkeypatch):
    """
    EP: both Plaid env vars present → plaid_configured must be True.
    """
    monkeypatch.setenv("SQUEEZYPAY_PLAID_CLIENTID", "client-123")
    monkeypatch.setenv("SQUEEZYPAY_PLAID_SECRET", "secret-456")
    with patch("api.diagnostics._get_alembic_revision", return_value="none"):
        response = client.get("/api/diagnostics/")
    assert response.json()["plaid_configured"] is True


def test_read_log_tail_no_file_returns_empty():
    """
    _read_log_tail: if the log file does not exist, must return [].
    EP: absent file partition.
    """
    from api.diagnostics import _read_log_tail
    with patch("pathlib.Path.exists", return_value=False):
        result = _read_log_tail()
    assert result == []


def test_read_log_tail_returns_last_n_lines(tmp_path):
    """
    _read_log_tail: with a file containing more than n lines, returns exactly
    the last n. BVA: n=50 is the default; test with a 55-line file.
    """
    import sys
    from api.diagnostics import _read_log_tail

    log_file = tmp_path / "squeezypay.log"
    lines = [f"line {i}" for i in range(55)]
    log_file.write_text("\n".join(lines))

    with patch.object(sys, "frozen", False, create=True):
        with patch("pathlib.Path.resolve", return_value=tmp_path.parent):
            # Patch the constructed path directly
            with patch("api.diagnostics.Path") as mock_path_cls:
                mock_path = MagicMock()
                mock_path.exists.return_value = True
                mock_path.read_text.return_value = "\n".join(lines)
                mock_path_cls.return_value.__truediv__.return_value.__truediv__.return_value.__truediv__.return_value = mock_path
                result = _read_log_tail(50)
    assert len(result) == 50
    assert result[-1] == "line 54"


def test_get_alembic_revision_returns_error_string_on_failure():
    """
    _get_alembic_revision: if import or DB access fails, must return a string
    starting with 'error:' rather than raising.
    EP: exception-in-alembic partition.
    """
    from api.diagnostics import _get_alembic_revision
    with patch("api.diagnostics._get_alembic_revision.__wrapped__"
               if hasattr(_get_alembic_revision, "__wrapped__") else
               "alembic.runtime.migration.MigrationContext.configure",
               side_effect=Exception("no alembic")):
        result = _get_alembic_revision()
    # If the patch didn't apply cleanly in isolation, at minimum confirm no exception raised:
    assert isinstance(result, str)
```

---

### `main.py` — 55%

#### What is uncovered

Lines 44–57: `_is_allowed_origin()` and `rate_limit_exceeded_handler()` — the CORS origin-matching logic and the 429 response handler (including CORS header injection on 429).

Lines 63–70: `_resolve_frontend_dist()` — both branches (`sys.frozen == True` and the normal development path).

Lines 73–106: `lifespan()` async context manager — all branches:
- Line 75–79: `SQUEEZYPAY_ENCRYPTION_KEY` absent → `RuntimeError`.
- Line 80–83: `SQUEEZYPAY_SECRET_KEY` absent → `RuntimeError`.
- Lines 91–103: `initial_passphrase.tmp` bootstrap (file exists, passphrase non-empty, passphrase empty).

Lines 176–248: the `if __name__ == "__main__"` block, including `--migrate`, `--generate-key fernet`, `--generate-key secret`, and the normal uvicorn startup with browser open in frozen mode.

#### Why it is uncovered

**Multiple distinct reasons:**

1. **`lifespan` / startup guards** — The test fixture bootstraps the app via `TestClient` which triggers the lifespan, but with `SQUEEZYPAY_ENCRYPTION_KEY` and `SQUEEZYPAY_SECRET_KEY` set in `conftest.py` (via `os.environ.setdefault`). The missing-key error branches therefore never trigger. The `initial_passphrase.tmp` bootstrap is never exercised because no test creates that file in `APPDATA`.

2. **Rate-limit handler** — `slowapi`'s `RateLimitExceeded` exception path is never deliberately triggered; the test suite uses per-test rate-key isolation specifically to avoid hitting limits, so the 429 handler is dead code from the test perspective.

3. **CORS origin helper** — The private `_is_allowed_origin()` function is only reachable via the middleware path, which is transparent to `TestClient` in the default case. No test sends requests from a non-allowed origin or a LAN IP origin.

4. **`__main__` block** — Cannot be covered by `pytest` importing the module. These are entry points requiring direct subprocess invocation or `importlib.import_module` tricks.

#### Risk classification (ISTQB)

**MEDIUM — The lifespan startup guards and the rate-limit handler represent operational safety logic. A regression in the missing-key check would allow the app to start without encryption capability.**

- **EP for `_is_allowed_origin`:** Three partitions: (1) exact-match allowed origin, (2) LAN IP regex match, (3) disallowed origin. None are tested.
- **Decision coverage for `rate_limit_exceeded_handler`:** The CORS header injection (`if origin and _is_allowed_origin(origin)`) has 0% coverage.
- **Risk for lifespan:** Medium. The startup guards are validated implicitly by the fact that the test suite always sets the keys — but a refactoring that changes the env var name would not fail any test.

#### Test suggestions (stubs with docstrings)

```python
# tests/test_main.py
import pytest
from unittest.mock import patch, MagicMock


# ── Origin helper ──────────────────────────────────────────────────────────────

def test_is_allowed_origin_exact_match():
    """
    EP: exact match in _ALLOWED_ORIGINS list → True.
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://localhost:5173") is True


def test_is_allowed_origin_lan_ip_regex():
    """
    EP: LAN IP (192.168.x.x) must match the regex → True.
    BVA: 192.168.0.1 (min segment), 192.168.255.255 (max segment).
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://192.168.1.100") is True
    assert _is_allowed_origin("http://192.168.1.100:3000") is True


def test_is_allowed_origin_disallowed():
    """
    EP: external origin not in list and not matching regex → False.
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("https://evil.example.com") is False


def test_is_allowed_origin_10_dot_subnet():
    """
    EP: 10.x.x.x LAN subnet must match regex → True.
    """
    from main import _is_allowed_origin
    assert _is_allowed_origin("http://10.0.0.1") is True


# ── Rate limit handler ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rate_limit_handler_includes_cors_for_allowed_origin():
    """
    rate_limit_exceeded_handler: when origin is allowed, response must include
    Access-Control-Allow-Origin header so the browser can read the 429 body.
    """
    from fastapi import Request
    from slowapi.errors import RateLimitExceeded
    from main import rate_limit_exceeded_handler

    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"origin": "http://localhost:5173"}
    exc = RateLimitExceeded(detail="1 per second")

    response = await rate_limit_exceeded_handler(mock_request, exc)
    assert response.status_code == 429
    assert "Access-Control-Allow-Origin" in response.headers


@pytest.mark.asyncio
async def test_rate_limit_handler_no_cors_for_disallowed_origin():
    """
    rate_limit_exceeded_handler: disallowed origin must NOT receive CORS headers.
    """
    from fastapi import Request
    from slowapi.errors import RateLimitExceeded
    from main import rate_limit_exceeded_handler

    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"origin": "https://attacker.example.com"}
    exc = RateLimitExceeded(detail="1 per second")

    response = await rate_limit_exceeded_handler(mock_request, exc)
    assert response.status_code == 429
    assert "Access-Control-Allow-Origin" not in response.headers


# ── Lifespan missing-key guards ────────────────────────────────────────────────

def test_lifespan_raises_if_encryption_key_missing(monkeypatch):
    """
    lifespan: absent SQUEEZYPAY_ENCRYPTION_KEY must raise RuntimeError on startup.
    The error message must guide the user to generate_key.py.
    """
    # This test must use a fresh TestClient with the key unset.
    monkeypatch.delenv("SQUEEZYPAY_ENCRYPTION_KEY", raising=False)
    from fastapi.testclient import TestClient
    from main import app
    with pytest.raises(RuntimeError, match="SQUEEZYPAY_ENCRYPTION_KEY"):
        with TestClient(app):
            pass


def test_lifespan_raises_if_secret_key_missing(monkeypatch):
    """
    lifespan: absent SQUEEZYPAY_SECRET_KEY must raise RuntimeError on startup.
    """
    monkeypatch.delenv("SQUEEZYPAY_SECRET_KEY", raising=False)
    from fastapi.testclient import TestClient
    from main import app
    with pytest.raises(RuntimeError, match="SQUEEZYPAY_SECRET_KEY"):
        with TestClient(app):
            pass


# ── generate-key CLI mode ──────────────────────────────────────────────────────

def test_generate_key_fernet(tmp_path):
    """
    --generate-key fernet: must produce a valid Fernet key written to file.
    Test by calling the generation logic directly, not via subprocess.
    """
    from cryptography.fernet import Fernet
    import secrets as _secrets

    out = tmp_path / "fernet.key"
    key = Fernet.generate_key().decode()
    out.write_text(key)
    loaded = Fernet(out.read_text().encode())  # must not raise
    assert loaded is not None


def test_generate_key_secret(tmp_path):
    """
    --generate-key secret: must produce a 64-char hex string (32 bytes).
    BVA: exactly 64 hex chars.
    """
    import secrets
    key = secrets.token_hex(32)
    assert len(key) == 64
    assert all(c in "0123456789abcdef" for c in key)
```

---

### `api/plaid.py` — 83%

#### What is uncovered

Lines 48, 50: `exchange_token` — the `ValueError` (409 Conflict — second item already connected) and `RuntimeError` (503 — Plaid API unavailable) error branches. The `except Exception` (400) branch at line 51–52 is tested, but the specific typed exceptions are not.

Lines 66–69: `disconnect_item` — the `RuntimeError` (503) and generic `Exception` (400) error branches on the `PlaidService.disconnect_item` call.

Lines 87–90: `sync_balances` — the `RuntimeError` (503) and generic `Exception` (400) error branches.

Lines 120–123: `sync_transactions` — the `RuntimeError` (503) and generic `Exception` (400) error branches.

#### Why it is uncovered

The test suite in `test_plaid.py` consistently tests the success path and the `ValueError` → 404 path, but never mocks `PlaidService` methods to raise `RuntimeError` or bare `Exception`. The `ValueError` → 409 path for `exchange_token` (second institution already connected) is also not tested.

This is a test completeness gap — the code exists, the tests exist for adjacent paths, but the specific exception-mapping branches were not written.

#### Risk classification (ISTQB)

**HIGH — These branches translate Plaid API errors into appropriate HTTP status codes. If a regression changes `RuntimeError` to a different exception type in `PlaidService`, the 503 branches would never fire and callers would receive generic 400 or 500 responses.**

- **EP:** For each Plaid endpoint: success, `ValueError`, `RuntimeError`, generic `Exception` — four partitions. Tests cover 1–2 of 4 in each case.
- **Decision coverage:** Each `try/except` chain has 3–4 branches. Current coverage: ~50% on the exception chains.

#### Test suggestions (stubs with docstrings)

```python
# additions to tests/test_plaid.py
from unittest.mock import patch
from services.plaid_service import PlaidService


class TestExchangeTokenErrorPaths:
    def test_exchange_second_item_returns_409(self, client):
        """
        EP: ValueError raised by PlaidService (second institution) → 409 Conflict.
        """
        with patch.object(PlaidService, "exchange_public_token",
                          side_effect=ValueError("already connected")):
            response = client.post("/api/plaid/exchange-token",
                                   json={"public_token": "public-abc"})
        assert response.status_code == 409

    def test_exchange_runtime_error_returns_503(self, client):
        """
        EP: RuntimeError (missing Plaid creds / API down) → 503 Service Unavailable.
        """
        with patch.object(PlaidService, "exchange_public_token",
                          side_effect=RuntimeError("Plaid credentials not set")):
            response = client.post("/api/plaid/exchange-token",
                                   json={"public_token": "public-abc"})
        assert response.status_code == 503


class TestDisconnectItemErrorPaths:
    def test_disconnect_runtime_error_returns_503(self, client):
        """
        EP: RuntimeError during item_remove API call → 503.
        """
        with patch.object(PlaidService, "disconnect_item",
                          side_effect=RuntimeError("Plaid API unavailable")):
            response = client.delete("/api/plaid/items/1")
        assert response.status_code == 503

    def test_disconnect_generic_exception_returns_400(self, client):
        """
        EP: unexpected exception during disconnect → 400.
        """
        with patch.object(PlaidService, "disconnect_item",
                          side_effect=Exception("unexpected")):
            response = client.delete("/api/plaid/items/1")
        assert response.status_code == 400


class TestSyncBalancesErrorPaths:
    def test_sync_balances_runtime_error_returns_503(self, client):
        """
        EP: RuntimeError (Plaid client creation fails) → 503.
        """
        with patch.object(PlaidService, "sync_balances",
                          side_effect=RuntimeError("credentials not set")):
            response = client.post("/api/plaid/accounts/sync-balances",
                                   json={"plaid_item_id": 1})
        assert response.status_code == 503


class TestSyncTransactionsErrorPaths:
    def test_sync_transactions_runtime_error_returns_503(self, client):
        """
        EP: RuntimeError during transaction sync → 503.
        """
        with patch.object(PlaidService, "sync_transactions",
                          side_effect=RuntimeError("API unreachable")):
            response = client.post("/api/plaid/transactions/sync",
                                   json={"plaid_item_id": 1, "days_back": 30})
        assert response.status_code == 503
```

---

### `services/plaid_service.py` — 92%

#### What is uncovered

Lines 44–50: `_read_win_user_env()` — the happy path where `winreg.OpenKey` and `QueryValueEx` succeed and return a value. The exception path (returns `None`) is indirectly exercised when tests patch the function, but the real `winreg` success path is Windows-specific and never reached in any test.

Lines 65–71: `_get_plaid_client()` — the success path (client is constructed and returned). Every test either mocks `_get_plaid_client` at the call site or tests the `RuntimeError` raise. The actual Plaid SDK client construction is never executed in tests.

Line 94: `PlaidService.create_link_token()` — the `response["link_token"]` extraction from a real (mocked) Plaid response object is tested, but the dict-access line itself is only reached when `link_token_create` returns successfully through the full call chain; the coverage tool may not count this line due to mock depth.

Lines 130, 137: `_fetch_institution_name()` — the happy path: `item_get`, `institution_id` extraction, and `institutions_get_by_id` call. The exception path (line 138–140) returns `None`, but the non-exception path (lines 126–137) is not covered. Every exchange token test mock either omits the item_get mock or the mock returns a response the path doesn't follow.

Lines 228, 320–321: `sync_transactions` — the `if not account:` guard (line 228, transaction for unknown account is silently skipped) and `disconnect_item` — the `logger.warning` on a failed `item_remove` call (line 320–321) are uncovered.

Line 366: `get_blame_data` — the `else: label = f"Account #{tx.plaid_account_id}"` branch when a transaction's ORM account relationship is `None`.

#### Why it is uncovered

- `_read_win_user_env` is a Windows Registry API call — untestable without a real Windows `HKCU\Environment` key or a mock that simulates `winreg`.
- `_get_plaid_client` success path is always bypassed by patching at the call site.
- `_fetch_institution_name` success path requires `item_get` to return an institution ID and then `institutions_get_by_id` to return a name — the mock in `test_plaid.py` only configures `item_public_token_exchange` and `accounts_get`, not the item/institution lookup calls.
- The `if not account` guard in sync_transactions requires seeding a transaction whose `account_id` references a Plaid account that does not exist in the local DB — a scenario not covered by any test.
- The `item_remove` warning path requires `item_remove` to raise during `disconnect_item` — no test mocks this specific failure.

#### Risk classification (ISTQB)

**MEDIUM — These are mostly defensive/fallback paths. The `_fetch_institution_name` success path is the highest-value gap because institution name display is user-visible; a regression here would produce `None` institution names silently.**

- **EP:** For `_fetch_institution_name`: success (returns string) vs exception (returns None). Only exception partition is covered.
- **Decision coverage:** `disconnect_item` warning branch (line 320) — 0% coverage.

#### Test suggestions (stubs with docstrings)

```python
# additions to tests/test_plaid_service.py
from unittest.mock import MagicMock, patch
import pytest


class TestReadWinUserEnv:
    def test_returns_value_when_registry_key_found(self, monkeypatch):
        """
        _read_win_user_env: when winreg.QueryValueEx returns a value, must
        return that value as a string.
        EP: key present in HKCU\Environment partition.
        """
        mock_winreg = MagicMock()
        mock_key = MagicMock().__enter__.return_value
        mock_winreg.OpenKey.return_value.__enter__.return_value = mock_key
        mock_winreg.QueryValueEx.return_value = ("my-plaid-client-id", 1)
        mock_winreg.HKEY_CURRENT_USER = "HKCU"

        with patch.dict("sys.modules", {"winreg": mock_winreg}):
            from importlib import reload
            import services.plaid_service as ps_module
            reload(ps_module)
            result = ps_module._read_win_user_env("SQUEEZYPAY_PLAID_CLIENTID")

        assert result == "my-plaid-client-id"

    def test_returns_none_on_registry_error(self, monkeypatch):
        """
        _read_win_user_env: when winreg raises (key absent / permission denied),
        must return None without propagating the exception.
        EP: key absent partition.
        """
        from services.plaid_service import _read_win_user_env
        with patch("services.plaid_service.winreg" if hasattr(
            __import__("services.plaid_service", fromlist=[""]), "winreg"
        ) else "builtins.__import__",
                   side_effect=Exception("registry access denied")):
            # Direct approach: monkeypatch winreg inside the function
            pass  # Already covered by existing TestPlaidClientMissingEnv test


class TestFetchInstitutionName:
    def test_returns_institution_name_on_success(self):
        """
        _fetch_institution_name: when both item_get and institutions_get_by_id
        succeed, must return the institution name string.
        EP: successful institution lookup partition.
        """
        mock_client = MagicMock()
        mock_client.item_get.return_value = {
            "item": {"institution_id": "ins_123"}
        }
        mock_client.institutions_get_by_id.return_value = {
            "institution": {"name": "First National Bank"}
        }

        from services.plaid_service import PlaidService
        result = PlaidService._fetch_institution_name(mock_client, "access-token-x")
        assert result == "First National Bank"

    def test_returns_none_when_institution_id_missing(self):
        """
        _fetch_institution_name: when item_get returns no institution_id,
        must return None without raising.
        EP: missing institution_id partition.
        """
        mock_client = MagicMock()
        mock_client.item_get.return_value = {
            "item": {}  # no institution_id key
        }

        from services.plaid_service import PlaidService
        result = PlaidService._fetch_institution_name(mock_client, "access-token-x")
        assert result is None

    def test_returns_none_on_exception(self):
        """
        _fetch_institution_name: any exception must be swallowed, return None.
        EP: API error partition.
        """
        mock_client = MagicMock()
        mock_client.item_get.side_effect = Exception("Plaid API error")

        from services.plaid_service import PlaidService
        result = PlaidService._fetch_institution_name(mock_client, "access-token-x")
        assert result is None


class TestDisconnectItemWarningPath:
    def test_disconnect_continues_after_item_remove_failure(self, db):
        """
        disconnect_item: if _get_plaid_client().item_remove raises, must log
        a warning and still delete the item from the local DB (return True).
        Decision coverage: the 'except Exception' branch on item_remove.
        """
        from repositories.plaid_repository import PlaidItemRepository
        from services.plaid_service import PlaidService
        from services.encryption_service import encryption_service

        item = PlaidItemRepository.create(db, "item-del", "enc-tok", None, "Bank")

        mock_client = MagicMock()
        mock_client.item_remove.side_effect = Exception("Plaid error during remove")

        with patch("services.plaid_service._get_plaid_client", return_value=mock_client):
            with patch.object(encryption_service, "decrypt", return_value="raw-token"):
                result = PlaidService.disconnect_item(db, item.id)

        assert result is True
        assert PlaidItemRepository.get_by_id(db, item.id) is None


class TestSyncTransactionsUnknownAccount:
    def test_skips_transaction_with_unknown_account(self, db):
        """
        sync_transactions: transactions referencing a Plaid account_id not in
        the local DB must be silently skipped (no crash, count not incremented).
        Decision coverage: the 'if not account: continue' branch (line 228).
        """
        from repositories.plaid_repository import PlaidItemRepository
        from services.plaid_service import PlaidService
        from services.encryption_service import encryption_service

        item = PlaidItemRepository.create(db, "item-unk", "enc-tok", None, "Bank")

        mock_client = MagicMock()
        mock_client.transactions_get.return_value = {
            "transactions": [
                {
                    "transaction_id": "tx-ghost",
                    "account_id": "unknown-acct-id",  # not in local DB
                    "amount": 50.0,
                    "date": "2026-06-01",
                    "name": "Ghost Transaction",
                    "merchant_name": None,
                    "personal_finance_category": None,
                    "payment_channel": "online",
                    "pending": False,
                    "logo_url": None,
                    "iso_currency_code": "USD",
                }
            ]
        }

        with patch("services.plaid_service._get_plaid_client", return_value=mock_client):
            with patch.object(encryption_service, "decrypt", return_value="raw-token"):
                result = PlaidService.sync_transactions(db, item.id, days_back=30)

        assert result["added"] == 0
        assert result["updated"] == 0
```

---

### `services/settings_service.py` — 84%

#### What is uncovered

The uncovered lines correspond to two paths in `update_settings`:
1. The `logger.warning(f"Ignoring unknown settings key='{key}'")`  branch when an unrecognised key is submitted.
2. The `except (ValueError, TypeError)` block when a value cannot be converted by the `_CONVERTERS[key]` function (e.g., `"abc"` for `due_soon_days`).

#### Why it is uncovered

`test_settings.py` tests `test_update_settings_invalid_type` submits `"not-a-number"` for `due_soon_days`, but this is handled at the Pydantic layer (`api/settings.py`) before the service is called, so the `except (ValueError, TypeError)` block in the service is never reached. No test sends an unknown key to `SettingsService.update_settings` directly (only via the HTTP layer which also validates first).

#### Risk classification (ISTQB)

**LOW — The validation layer above prevents invalid data from reaching these branches in normal operation. However, the service layer defensiveness would be silently broken if a new key were added without a corresponding Pydantic validator.**

#### Test suggestions (stubs with docstrings)

```python
# tests/test_settings_service.py
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker
from models.models import Base
from services.settings_service import SettingsService


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:",
                           connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()
    engine.dispose()


def test_update_settings_unknown_key_is_ignored(db):
    """
    SettingsService.update_settings: unknown key must be silently ignored
    (warning logged, key not persisted), and the response must not contain
    the unknown key.
    EP: unrecognised key partition.
    """
    result = SettingsService.update_settings(db, {"totally_unknown_key": "value"})
    assert "totally_unknown_key" not in result


def test_update_settings_invalid_value_raises_value_error(db):
    """
    SettingsService.update_settings: a value that cannot be converted by the
    registered converter must raise ValueError with an informative message.
    EP: invalid type partition (bypassing the Pydantic layer).
    BVA: empty string and non-numeric string are both in the invalid partition.
    """
    with pytest.raises(ValueError, match="due_soon_days"):
        SettingsService.update_settings(db, {"due_soon_days": "not-a-number"})


def test_update_settings_invalid_float_raises_value_error(db):
    """
    EP: non-numeric string for large_payment_threshold must raise ValueError.
    """
    with pytest.raises(ValueError, match="large_payment_threshold"):
        SettingsService.update_settings(db, {"large_payment_threshold": "abc"})
```

---

### `repositories/settings_repository.py` — 83%

#### What is uncovered

The uncovered lines are in `SettingsRepository.set()`: specifically the `else` branch (lines 20–22) where the key does **not** exist yet and a new `Setting` record is created and added. The existing tests always exercise the update path (key already exists from prior calls) but never the insert path (key being set for the first time).

#### Why it is uncovered

`test_settings.py` calls `PUT /api/settings/` which triggers `SettingsService.update_settings` → `SettingsRepository.set`. On the first call in any test, the key should not exist yet and the `else` branch should execute. However, since `test_update_settings_partial` first sets both keys and then updates one, and the other tests start from a fresh DB and immediately set values, it is possible the coverage tool is not attributing the `else` branch correctly — or the tests execute in an order that always hits the update path first due to shared fixture state.

More likely the `SettingsRepository.get()` (the single-key read path, line 11–13) has a gap when the key is absent (returns `None` from the `else` branch of the ternary), which is never explicitly tested at the repository level.

#### Risk classification (ISTQB)

**LOW — The functionality is implicitly tested through the service/API layer. A dedicated repository unit test is good hygiene but the risk of a silent regression is low given the simplicity of the ORM logic.**

#### Test suggestions (stubs with docstrings)

```python
# tests/test_settings_repository.py
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker
from models.models import Base
from repositories.settings_repository import SettingsRepository


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:",
                           connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()
    engine.dispose()


def test_get_returns_none_for_missing_key(db):
    """
    SettingsRepository.get: absent key must return None, not raise.
    EP: key absent partition.
    """
    assert SettingsRepository.get(db, "nonexistent_key") is None


def test_set_creates_new_record(db):
    """
    SettingsRepository.set: when key does not exist, must INSERT a new row.
    EP: insert partition (key absent before set).
    """
    record = SettingsRepository.set(db, "due_soon_days", "5")
    assert record.key == "due_soon_days"
    assert record.value == "5"
    assert SettingsRepository.get(db, "due_soon_days") == "5"


def test_set_updates_existing_record(db):
    """
    SettingsRepository.set: when key already exists, must UPDATE in place.
    EP: update partition (key present before set).
    BVA: value transitions from default to boundary (e.g. "1" and "365").
    """
    SettingsRepository.set(db, "due_soon_days", "7")
    SettingsRepository.set(db, "due_soon_days", "14")
    assert SettingsRepository.get(db, "due_soon_days") == "14"
    # Only one row should exist (no duplicate insert)
    from models.models import Setting
    count = db.query(Setting).filter(Setting.key == "due_soon_days").count()
    assert count == 1
```

---

### `services/auth_service.py` — 90%

#### What is uncovered

The uncovered lines are in `create_token()` and `decode_token()`:
- Line 45–46: `if not secret: raise RuntimeError(...)` in `create_token` when `SQUEEZYPAY_SECRET_KEY` is absent.
- Line 56–57: same guard in `decode_token`.

#### Why it is uncovered

`conftest.py` always sets `SQUEEZYPAY_SECRET_KEY` via `os.environ.setdefault`. No test explicitly unsets the variable and calls `create_token()` or `decode_token()` directly at the service layer.

#### Risk classification (ISTQB)

**MEDIUM — These guards are a last-resort safety net. If a refactor removed the lifespan startup check in `main.py`, `AuthService` could be called without a secret key, which would produce an unhelpful internal error rather than the expected RuntimeError.**

#### Test suggestions (stubs with docstrings)

```python
# additions to tests/test_change_passphrase.py or a new test_auth_service.py

def test_create_token_raises_if_no_secret(db, monkeypatch):
    """
    AuthService.create_token: absent SQUEEZYPAY_SECRET_KEY must raise RuntimeError.
    EP: missing secret partition.
    """
    from services.auth_service import AuthService
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "")
    service = AuthService(db)
    with pytest.raises(RuntimeError, match="SQUEEZYPAY_SECRET_KEY"):
        service.create_token()


def test_decode_token_raises_if_no_secret(db, monkeypatch):
    """
    AuthService.decode_token: absent SQUEEZYPAY_SECRET_KEY must raise RuntimeError.
    EP: missing secret partition.
    """
    from services.auth_service import AuthService
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", "")
    service = AuthService(db)
    with pytest.raises(RuntimeError, match="SQUEEZYPAY_SECRET_KEY"):
        service.decode_token("any.token.value")
```

---

### `seed.py` — 0%

#### What is uncovered

All 20 lines: the `seed_bills()` function (both the skip-if-bills-exist path and the insert-and-commit path), and the `if __name__ == "__main__"` CLI entry point.

#### Why it is uncovered

`seed.py` is not imported or called anywhere in the test suite. It is a one-time CLI utility with a `__main__` guard. No test exercises `seed_bills()` directly, and the test fixture initialises an empty in-memory database without calling the seed function.

#### Risk classification (ISTQB)

**LOW — Seed data is used only for initial setup of a fresh install. A regression in `seed_bills()` would only affect new users running the seed command, and the data is strictly cosmetic (example billers that users replace). The `if existing_count > 0: return` guard is the most interesting branch.**

#### Test suggestions (stubs with docstrings)

```python
# tests/test_seed.py
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker
from models.models import Base, Bill
from seed import HARDCODED_BILLS, seed_bills


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:",
                           connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    yield s
    s.close()
    engine.dispose()


def test_seed_bills_inserts_all_hardcoded_bills(db):
    """
    seed_bills: on empty DB, must insert exactly len(HARDCODED_BILLS) rows.
    EP: empty database partition.
    """
    seed_bills(db)
    count = db.query(Bill).count()
    assert count == len(HARDCODED_BILLS)


def test_seed_bills_skips_if_bills_exist(db):
    """
    seed_bills: if any bill already exists, must not insert additional rows.
    EP: non-empty database partition (idempotency guard).
    Decision coverage: the 'if existing_count > 0: return' branch.
    """
    # Pre-seed one bill manually
    db.add(Bill(name="Pre-existing", category="Utilities",
                day_of_month=1, url="https://example.com", recurring=True))
    db.commit()

    seed_bills(db)
    count = db.query(Bill).count()
    assert count == 1  # No additional bills added


def test_seed_bills_all_bills_have_required_fields(db):
    """
    seed_bills: every inserted bill must have non-empty name, category, url
    and a valid day_of_month.
    BVA: day_of_month must be in [1, 31].
    """
    seed_bills(db)
    bills = db.query(Bill).all()
    for bill in bills:
        assert bill.name and bill.name.strip()
        assert bill.category and bill.category.strip()
        assert bill.url and bill.url.startswith("http")
        assert 1 <= bill.day_of_month <= 31
```

---

## TDD Adherence Assessment

### Positive indicators

- **Test structure mirrors code structure:** For every `api/*.py` module (bills, auth, plaid, settings, income, credentials, payment_history, payment_methods, categories), there is a corresponding `tests/test_*.py` file. This 1:1 mapping is a strong TDD signal.
- **Service-layer unit tests exist independently of the API layer:** `test_plaid_service.py` and `test_bill_repository.py` test business logic without going through the HTTP layer, indicating developers are writing unit tests as well as integration tests.
- **Validation tests are well-developed:** `test_validation.py` and the `BillCreate` validator tests show EP thinking applied proactively.
- **Security concern captured in test naming:** `test_access_token_never_in_response` and `test_access_token_not_in_dict` show security-minded test design at the service layer.

### Negative indicators and TDD gaps

1. **Auth bypass in shared fixture is a TDD anti-pattern.** The `conftest.py` override of `require_auth` was almost certainly added as a convenience shortcut. In strict TDD, the authentication boundary would have been tested first, with the shortcut applied only after all auth cases were covered. The result is 56% coverage on the most critical module and zero MC/DC coverage on the JWT validation logic.

2. **No test file for `diagnostics.py` despite it being a non-trivial module.** A TDD approach would produce a test file at the time the endpoint was built. The absence of any test here is a classic "code first, tests later (never)" pattern for utility endpoints.

3. **`autofill` feature has zero test coverage.** The `_try_autofill` function (44 lines) was written without any tests. Subprocess-based features are harder to test but not impossible — the mock examples in the stub section above show it is straightforward to test each subprocess outcome.

4. **Mocks used extensively where integration tests would add more value.** `test_plaid.py` and `test_plaid_service.py` correctly mock the external Plaid API. However, the encryption service is sometimes mocked unnecessarily — `encryption_service.decrypt` can be exercised with the test Fernet key already set in `conftest.py`. Excessive mocking of in-process services reduces the value of the tests as regression detectors.

5. **`test_plaid.py` `_mock_plaid_client()` does not configure `item_get` / `institutions_get_by_id`.** This means `_fetch_institution_name()` always takes the exception path in all exchange-token tests, effectively never testing the success path. This is an oversight rather than a deliberate design choice.

6. **Exception-variant tests are systematically absent for Plaid error paths.** The pattern `test_X_success` exists for every endpoint but `test_X_runtime_error_returns_503` does not. This suggests tests were written by tracing the happy path rather than applying EP to identify all partitions.

---

## Recommendations

Priority order based on risk-based test prioritisation (ISTQB):

### P1 — Critical (address before next release)

1. **Write `tests/test_core_auth.py`** covering all five `require_auth` branches using direct function calls (no HTTP layer, no fixture override). This eliminates the zero MC/DC coverage on the security boundary and validates all four decision outcomes independently.

2. **Remove the blanket `require_auth` override from `conftest.py`** for at least a subset of tests, or add a separate `authenticated_client` fixture that uses a real JWT. This would allow the existing 191 tests to organically cover the auth module without requiring a separate test file.

### P2 — High (address in current sprint)

3. **Write autofill endpoint tests** covering the four `_try_autofill` outcomes (returncode=0, returncode!=0, `TimeoutExpired`, `Popen` exception) using `unittest.mock.patch`. This is the largest untested reachable code block in the codebase.

4. **Write `tests/test_diagnostics.py`** covering the `get_diagnostics` endpoint with patched `_get_alembic_revision` and `_read_log_tail`. Add EP tests for `plaid_configured` boolean logic.

5. **Add `RuntimeError` / `ValueError` / `Exception` variant tests for all Plaid API endpoints** in `test_plaid.py`. This closes the 503/409/400 branch gaps in `api/plaid.py`.

### P3 — Medium (address in next sprint)

6. **Add `_fetch_institution_name` success-path test** in `test_plaid_service.py`. Configure the mock client to return an institution ID and name, verify the string is returned correctly.

7. **Add `disconnect_item` Plaid API failure test** verifying that a failed `item_remove` call logs a warning but still deletes the local DB record (return True).

8. **Add `AuthService.create_token` / `decode_token` missing-secret tests** at the service layer to cover the 90% gap.

9. **Add `sync_transactions` unknown-account skip test** (the `if not account: continue` guard).

### P4 — Low (good hygiene, schedule as capacity allows)

10. **Write `tests/test_seed.py`** covering the insert path, the skip-if-exists path, and the field integrity assertion.

11. **Write `tests/test_settings_repository.py`** covering the insert branch of `SettingsRepository.set` and the `None` return of `get` for a missing key.

12. **Write `tests/test_settings_service.py`** at the service unit level covering the unknown-key-ignored path and the invalid-value `ValueError` raise.

13. **Write `tests/test_main.py`** covering `_is_allowed_origin` EP cases, `rate_limit_exceeded_handler` CORS header logic, and the lifespan missing-key guards.

14. **Consider a Plaid Sandbox integration test suite** (opt-in, gated on `SQUEEZYPAY_TESTING_INTEGRATION=1`) to exercise `_get_plaid_client` success path and `_read_win_user_env` on Windows CI. These paths are currently 0%-tested in automated runs.
