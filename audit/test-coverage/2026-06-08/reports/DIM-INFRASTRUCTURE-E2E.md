# Test Coverage Audit — Infrastructure, Integration & E2E

**Project:** SqueezyPay  
**Branch audited:** `dev`  
**Audit date:** 2026-06-08  
**Auditor:** Automated analysis via Claude Code (claude-sonnet-4-6)  
**Scope:** E2E scaffold, admin test suite, authentication middleware, rate limiting,
encryption error paths, seed data, migration integrity, CI pipeline configuration.

---

## Executive Summary

SqueezyPay has a mature **unit-test layer** (191 backend tests, 92 % coverage) and a
functioning CI pipeline that enforces an 80 % coverage floor and a warning gate.
However, the test pyramid above the unit tier is almost entirely absent:

- The only E2E spec (`tests/e2e/dashboard.spec.ts`) is a **skeleton with a single
  skipped placeholder** and is not run in CI.
- No integration test exercises the full HTTP stack with a real database file on disk.
- Frontend Vitest tests run in CI but achieve only **30 % coverage** with no
  component-integration or browser-driven tests.
- Four security-critical paths — JWT expiry, missing `SQUEEZYPAY_SECRET_KEY`, rate
  limit boundary, and the `EncryptionService` missing-key error — have **no test
  coverage at all**.
- Migration upgrade/downgrade paths are untested; seed logic is at **0 % coverage**.
- The admin CI job runs on `windows-latest` but collects no coverage metrics and has
  no coverage enforcement gate.

The aggregate risk is **medium-high**: no individual gap is catastrophic in isolation,
but the combination of an absent E2E layer, unverified security boundaries, and
untested infrastructure paths means that regression in any of these areas would reach
production silently.

---

## Test Pyramid Assessment (current vs recommended)

### Current pyramid (inverted / "ice cream cone" anti-pattern)

```
         [ E2E ]           0 tests running in CI (spec is a placeholder)
        [  Int  ]          0 true integration tests (server + real DB)
       [  Unit   ]         191 backend, 38 frontend — dominant layer
```

All backend integration tests use FastAPI `TestClient` with an in-memory SQLite
database and a mocked `require_auth` dependency. This is valuable but sits at the
boundary between unit and integration; it does not exercise the real authentication
flow end-to-end, real database file I/O, or Alembic migration state.

### Recommended pyramid (ISTQB / Testing Trophy aligned)

```
         [ E2E ]           5–10 critical-path Playwright tests in CI
        [  Int  ]          10–15 server-started integration tests covering
                           auth boundary, rate limit boundary, migrations
       [  Unit   ]         Keep existing unit suite, add missing paths
      [ Static  ]          TypeScript + Ruff (already present — good)
```

The **Testing Trophy** (Kent C. Dodds) would place the investment emphasis on
integration tests — tests that exercise real component wiring without the cost or
flakiness of a full browser. For SqueezyPay, that means:

1. Tests that start the real ASGI app with a temporary SQLite *file* (not `:memory:`)
   and exercise auth, bills, and payment-history in sequence.
2. A small Playwright suite that tests login, bill CRUD, and the payment log in a real
   browser, gating every PR to `master`.

The current approach optimises for speed of execution at the expense of confidence in
wiring. Given that SqueezyPay runs as a packaged single-binary desktop app, regression
in the startup, migration, and auth bootstrap sequence would be invisible until a user
runs the installer — the highest-cost failure mode.

---

## E2E Coverage Analysis

### Existing spec coverage

File: `C:\SqueezyPay\tests\e2e\dashboard.spec.ts`

```typescript
test.describe('Dashboard', () => {
  test.skip('placeholder - E2E suite not yet built', async () => {
    // TODO: implement dashboard E2E tests
  });
});
```

**Coverage: zero.** The file exists, the Playwright config is valid, and two browser
projects are declared (Desktop Chrome, Mobile Safari / iPhone 14). The infrastructure
is ready. No test logic has been written.

The Playwright config (`playwright.config.ts`) sets `forbidOnly: !!process.env.CI`,
meaning a `test.only` will cause CI to fail — but the `test.skip` above will not.
There is **no CI step** that runs `npx playwright test`, so even if real tests were
written they would not gate PRs.

### Missing critical user journeys

| Journey | Risk if untested | ISTQB Level |
|---|---|---|
| Login (correct passphrase → token → access protected route) | HIGH — authentication bypass goes undetected | System |
| First-run setup (passphrase not configured → setup flow) | HIGH — new-install regression invisible | System |
| Bill CRUD (create / read / update / delete via UI) | MEDIUM — core domain feature, 191 unit tests partially mitigate | System |
| Payment log (log a payment, verify it appears) | MEDIUM — financial data integrity | System |
| Plaid connect (link token → exchange → accounts appear) | MEDIUM — third-party integration, mocked in unit tests | System |
| Rate limit hit in browser (10 login attempts → 429 with Retry-After) | HIGH — security, untested at any level | System |
| Session expiry (token expires → 401 → redirect to login) | HIGH — security, no test at any level | System |
| Mobile Safari layout (iPhone 14 project declared but never run) | LOW — cosmetic | System |

### Test suggestion stubs (Playwright)

**Stub 1 — Login flow (HIGH priority)**

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('correct passphrase returns token and redirects to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Passphrase').fill('CorrectHorseBatteryStaple');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByTestId('nav-bills')).toBeVisible();
  });

  test('wrong passphrase shows 401 error message', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Passphrase').fill('wrongpassword');
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByRole('alert')).toContainText(/incorrect/i);
  });

  test('accessing /dashboard without token redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
```

**Stub 2 — Bill CRUD (MEDIUM priority)**

```typescript
// tests/e2e/bills.spec.ts
import { test, expect } from '@playwright/test';

// Assumes auth helper sets Bearer token in localStorage or cookie
test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Bills', () => {
  test('create a bill and verify it appears in the list', async ({ page }) => {
    await page.goto('/dashboard/bills');
    await page.getByRole('button', { name: /add bill/i }).click();
    await page.getByLabel('Name').fill('Test Electric Co');
    await page.getByLabel('Category').selectOption('Utilities');
    await page.getByLabel('Day of month').fill('15');
    await page.getByLabel('URL').fill('https://example.com');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('Test Electric Co')).toBeVisible();
  });

  test('delete a bill and verify it is removed', async ({ page }) => {
    await page.goto('/dashboard/bills');
    const row = page.getByText('Test Electric Co').locator('..');
    await row.getByRole('button', { name: /delete/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText('Test Electric Co')).not.toBeVisible();
  });
});
```

**Stub 3 — CI job (add to `.github/workflows/ci.yml`)**

```yaml
e2e:
  name: E2E Tests (Playwright)
  runs-on: ubuntu-latest
  needs: [backend, frontend]
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: '24'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    - run: npm ci --legacy-peer-deps
      working-directory: frontend
    - run: npx playwright install --with-deps chromium
    - name: Start backend
      env:
        SQUEEZYPAY_ENCRYPTION_KEY: ${{ secrets.CI_ENCRYPTION_KEY }}
        SQUEEZYPAY_SECRET_KEY: ${{ secrets.CI_SECRET_KEY }}
      run: uvicorn main:app --port 8000 &
      working-directory: backend
    - name: Start frontend
      run: npm run dev &
      working-directory: frontend
    - run: npx playwright test --project=chromium
```

---

## Admin Dashboard Test Coverage

File: `C:\SqueezyPay\admin\tests\test_admin.py`

### What is covered

| Area | Tests | Verdict |
|---|---|---|
| Import / startup smoke | `test_imports`, `test_app_constructed` | Good |
| `/api/status` shape (running, port, url keys) | `test_status_returns_200`, `test_status_contains_backend` | Good |
| `/api/start` and `/api/stop` with unknown service | Two tests | Good |
| `_is_port_in_use` — port free / port bound | Two tests using real sockets | Good |
| Duplicate start guard (port already in use) | `test_start_backend_already_running` | Good |
| Dashboard HTML served | `test_dashboard_served`, `test_dashboard_has_*_view` | Adequate |
| Logs endpoint — file present / file absent | Two tests | Good |

The admin suite is **proportionate to the admin server's surface area**. It tests the
core operational contract (status, start/stop guards, log streaming, HTML serving)
without over-specifying implementation detail.

### Gaps

| Gap | Severity | Risk |
|---|---|---|
| No CI coverage enforcement — `pytest tests/ -v` runs with no `--cov` flag | MEDIUM | Coverage regressions in admin go undetected |
| `/api/stop` success path (process actually stops) | LOW | Stop mechanics not exercised — relies on mock |
| `_process_alive` logic not directly tested | LOW | Edge case: PID exists but not the correct process |
| `dev` mode vs `packaged` mode branching — tests skip rather than cover both | LOW | Mode-specific paths (frontend start/stop) invisible in CI |
| No test for `/api/logs/recent` with a non-empty log file | LOW | Log parsing bugs would survive test run |

**Recommendation:** Add `--cov=. --cov-fail-under=70` to the admin CI pytest invocation.
Write one additional test that writes a known log line to a temp file and asserts it
appears in `/api/logs/recent` output.

---

## Security-Critical Path Coverage

### Authentication middleware gaps

File: `C:\SqueezyPay\backend\core\auth.py`  
Reported coverage: **56 %**

The `require_auth` function has five distinct execution paths:

| Path | Covered | Test |
|---|---|---|
| `credentials` is `None` (no Authorization header) → 401 | YES | `test_protected_route_without_token` |
| `secret` is empty string (env var not set) → 401 "Authentication unavailable" | **NO** | None |
| `jwt.decode` succeeds → pass through | YES | `test_protected_route_with_token` (indirectly; dependency is overridden in most tests) |
| `jwt.ExpiredSignatureError` → 401 "Session expired" | **NO** | None |
| `jwt.InvalidTokenError` → 401 "Invalid token" | **NO** | None |

**Security implication of missing-secret path (line 16–17):** If `SQUEEZYPAY_SECRET_KEY`
is absent from the environment at runtime, the server returns 401 for every protected
route. This is a safe fail-closed posture, but without a test, a future refactor could
accidentally turn this into a fail-open (allow-all) behaviour. The `lifespan` function
in `main.py` raises `RuntimeError` if the key is absent at startup, which mitigates this
at the process level — but the defensive check in `require_auth` itself is still
untested.

**Security implication of expired-token path:** An expired JWT must return 401, not 200.
Without a test for this path, a library upgrade or algorithm change could silently break
token expiry enforcement. This is the highest-risk gap in the auth module.

**Severity: HIGH (expired-token path), MEDIUM (invalid-token, missing-secret)**

**Test suggestion stubs:**

```python
# backend/tests/test_auth_middleware.py
import time
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient as _TC
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

import database.db as db_module
from database.db import get_db
from main import app
from models.models import Base

SECRET = "test-secret-key-for-testing-only-32chars!!"


def _make_raw_client():
    """TestClient wired to real require_auth (no override)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    original_engine = db_module.engine
    original_sl = db_module.SessionLocal
    db_module.engine = engine
    db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    app.dependency_overrides[get_db] = lambda: (yield session)
    client = _TC(app, headers={"X-Test-Rate-Key": str(uuid.uuid4())})
    yield client
    app.dependency_overrides.clear()
    session.close()
    db_module.engine = original_engine
    db_module.SessionLocal = original_sl
    engine.dispose()


def test_expired_token_returns_401(monkeypatch):
    """An expired JWT must be rejected with 401 and 'Session expired'."""
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", SECRET)
    expired = jwt.encode(
        {"sub": "household", "exp": datetime.now(UTC) - timedelta(seconds=1)},
        SECRET,
        algorithm="HS256",
    )
    for client in _make_raw_client():
        resp = client.get("/api/bills/", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


def test_invalid_token_returns_401(monkeypatch):
    """A tampered JWT must be rejected with 401 and 'Invalid token'."""
    monkeypatch.setenv("SQUEEZYPAY_SECRET_KEY", SECRET)
    for client in _make_raw_client():
        resp = client.get(
            "/api/bills/",
            headers={"Authorization": "Bearer not.a.valid.jwt"},
        )
    assert resp.status_code == 401
    assert "invalid" in resp.json()["detail"].lower()


def test_missing_secret_key_returns_401(monkeypatch):
    """If SQUEEZYPAY_SECRET_KEY is absent, require_auth returns 401 (fail-closed)."""
    monkeypatch.delenv("SQUEEZYPAY_SECRET_KEY", raising=False)
    valid = jwt.encode({"sub": "household"}, "irrelevant", algorithm="HS256")
    for client in _make_raw_client():
        resp = client.get("/api/bills/", headers={"Authorization": f"Bearer {valid}"})
    assert resp.status_code == 401
    assert "unavailable" in resp.json()["detail"].lower()
```

### Rate limiting gaps

File: `C:\SqueezyPay\backend\core\limiter.py`  
Decorator limits in `api/auth.py`: `5/minute` (setup, change-passphrase), `10/minute` (login)

**What is tested:** The `_rate_limit_key` function's test-isolation mechanism (the
`X-Test-Rate-Key` header) is implicitly exercised by every test that uses the shared
`conftest.py` fixture. The key function itself — including the production fallback to
`get_remote_address` — has no direct unit test.

**What is not tested:**

| Gap | Severity | Risk |
|---|---|---|
| Hitting the `10/minute` login limit returns HTTP 429 with `Retry-After: 60` header | HIGH | Brute-force protection unverified |
| Rate limit resets after 1 minute (time-window logic) | MEDIUM | Limit could be permanent or absent after process restart |
| `_rate_limit_key` in production mode (no `SQUEEZYPAY_TESTING` env) falls back to remote address | MEDIUM | Key function branch at line 15–18 uncovered |
| CORS headers on 429 response match allowed origins | LOW | Client-side error handling breaks silently |
| `rate_limit_exceeded_handler` for non-allowed origin (no CORS headers injected) | LOW | Minor |

**Severity: HIGH (429 boundary), MEDIUM (key function, time window)**

**Test suggestion stub:**

```python
# backend/tests/test_rate_limiting.py
import os
import uuid

import pytest
from fastapi.testclient import TestClient


def _client_with_real_auth(app, db_override):
    """Client with real require_auth and a unique rate-limit key."""
    from database.db import get_db
    app.dependency_overrides[get_db] = db_override
    # Do NOT set X-Test-Rate-Key so the SAME bucket is shared across calls
    return TestClient(app)


def test_login_rate_limit_triggers_429(monkeypatch, client):
    """Exceed 10/minute login attempts from the same key — expect 429."""
    # Use a fixed test key so all 11 requests share one bucket
    fixed_key = str(uuid.uuid4())
    from fastapi.testclient import TestClient as _TC
    from main import app
    rate_client = _TC(app, headers={"X-Test-Rate-Key": fixed_key})

    # Setup a passphrase first
    client.post("/api/auth/setup", json={"passphrase": "SomePassphrase123"})

    with rate_client:
        responses = [
            rate_client.post("/api/auth/login", json={"passphrase": "wrong"})
            for _ in range(11)
        ]
    status_codes = [r.status_code for r in responses]
    assert 429 in status_codes, f"Expected 429 in {status_codes}"
    rate_limited = next(r for r in responses if r.status_code == 429)
    assert "Retry-After" in rate_limited.headers


def test_rate_limit_key_falls_back_to_remote_address(monkeypatch):
    """Without SQUEEZYPAY_TESTING set, _rate_limit_key returns get_remote_address result."""
    monkeypatch.delenv("SQUEEZYPAY_TESTING", raising=False)
    from unittest.mock import MagicMock
    from core.limiter import _rate_limit_key

    mock_request = MagicMock()
    mock_request.headers.get.return_value = None  # no X-Test-Rate-Key
    mock_request.client.host = "1.2.3.4"
    # Patch get_remote_address to confirm it's called
    import core.limiter as limiter_module
    original = limiter_module.get_remote_address
    limiter_module.get_remote_address = lambda r: r.client.host
    try:
        result = _rate_limit_key(mock_request)
    finally:
        limiter_module.get_remote_address = original
    assert result == "1.2.3.4"
```

### Encryption error paths

File: `C:\SqueezyPay\backend\services\encryption_service.py`  
Reported coverage: **94 %** — missing: lines 13–18 (the missing-key `RuntimeError`)

The uncovered block is:

```python
# line 13–18
key = os.environ.get("SQUEEZYPAY_ENCRYPTION_KEY")
if not key:
    raise RuntimeError(
        "SQUEEZYPAY_ENCRYPTION_KEY environment variable is not set. ..."
    )
```

**Risk analysis:** The `lifespan` function in `main.py` raises `RuntimeError` before
the app starts if the key is absent, so the `EncryptionService` missing-key branch
should never be reached in a correctly deployed server. However:

1. `encryption_service` is a module-level singleton. Any code that imports and calls
   it outside the FastAPI lifecycle (e.g., a future CLI script, migration helper, or
   test that doesn't set the env var) would hit this path silently and get a bare
   `RuntimeError` with no HTTP context.
2. The error message contains actionable guidance (`Run scripts/generate_key.py`).
   A test that asserts the *message text* would prevent that guidance from being
   accidentally removed or garbled.

**Severity: LOW** (protected by `lifespan` guard), but the test is trivial to add.

**Test suggestion stub:**

```python
# backend/tests/test_encryption_service.py
import os
import pytest
from services.encryption_service import EncryptionService


def test_encrypt_decrypt_roundtrip(monkeypatch):
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()
    monkeypatch.setenv("SQUEEZYPAY_ENCRYPTION_KEY", key)
    svc = EncryptionService()
    assert svc.decrypt(svc.encrypt("hello")) == "hello"


def test_missing_key_raises_runtime_error(monkeypatch):
    """_get_fernet() must raise RuntimeError with a helpful message when key is absent."""
    monkeypatch.delenv("SQUEEZYPAY_ENCRYPTION_KEY", raising=False)
    svc = EncryptionService()
    with pytest.raises(RuntimeError, match="SQUEEZYPAY_ENCRYPTION_KEY"):
        svc.encrypt("test")
```

---

## Infrastructure Testability

### Seed data

File: `C:\SqueezyPay\backend\seed.py`  
Coverage: **0 %**

`seed_bills` has two distinct behaviours:

1. **Skip if rows exist** — queries `Bill.count()`, prints "skipping", returns.
2. **Insert rows** — iterates `HARDCODED_BILLS`, calls `db.add` and `db.commit`.

These are simple enough that the risk of an untested bug is low. The data itself
(`HARDCODED_BILLS`) is illustrative placeholder content (all URLs are `example.com`),
so correctness of specific field values is not a production concern at this phase.

The higher-value concern is the **idempotency guard**: if `seed_bills` were called
twice on a non-empty database it must not create duplicate rows. This is tested
implicitly by the count check on line 69, but never asserted by a test.

**Severity: LOW** in isolation. Recommended test:

```python
# backend/tests/test_seed.py
import pytest
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import sessionmaker

from models.models import Base, Bill
from seed import seed_bills


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


def test_seed_inserts_bills(db):
    seed_bills(db)
    count = db.query(Bill).count()
    assert count == 7  # len(HARDCODED_BILLS)


def test_seed_is_idempotent(db):
    """Calling seed_bills twice must not duplicate rows."""
    seed_bills(db)
    seed_bills(db)
    count = db.query(Bill).count()
    assert count == 7


def test_seed_skips_when_bills_exist(db):
    """If bills already exist, seed_bills must not add more."""
    db.add(Bill(
        name="Existing", category="Utilities",
        day_of_month=1, url="https://example.com", recurring=True,
    ))
    db.commit()
    seed_bills(db)
    assert db.query(Bill).count() == 1
```

### Migrations

Location: `C:\SqueezyPay\backend\alembic\versions\`  
Migrations found: 4 scripts (`9e03c93944c3`, `3b8a84212839`, `5a43611da40e`,
`a1b2c3d4e5f6`)

**What is tested:** Nothing. No test anywhere exercises `alembic upgrade head` or
`alembic downgrade` against a real SQLite file.

**Risk analysis:**

The `--migrate` code path in `main.py` (lines 187–208) implements a dual strategy:

- **Fresh DB:** `init_db()` + `stamp head` (no migrations run).
- **Existing DB:** `init_db()` no-op + `upgrade head`.

This logic is invoked by the installer and upgrade flow and is exercised **only on a
user's machine after installation**. A broken migration discovered post-release would
corrupt or fail to upgrade user data with no automated safety net.

The `render_as_batch=True` flag in `env.py` is required for SQLite ALTER TABLE
support. A migration that forgets to use batch mode for a column rename would pass
review but fail silently on SQLite.

**Severity: HIGH** — data integrity, installer regression, silent failure mode.

**Test suggestion stub:**

```python
# backend/tests/test_migrations.py
"""
Verify that all Alembic migrations can be applied and reversed on a real SQLite file.
"""
import os
import tempfile
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import create_engine, inspect, text


@pytest.fixture
def tmp_db(tmp_path):
    db_path = tmp_path / "test.db"
    return str(db_path)


def _alembic_cfg(db_url: str) -> AlembicConfig:
    ini = Path(__file__).parent.parent / "alembic.ini"
    cfg = AlembicConfig(str(ini))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def test_upgrade_head_creates_all_tables(tmp_db):
    """alembic upgrade head must succeed on a fresh SQLite file."""
    url = f"sqlite:///{tmp_db}"
    cfg = _alembic_cfg(url)
    command.upgrade(cfg, "head")
    engine = create_engine(url)
    tables = inspect(engine).get_table_names()
    assert "bills" in tables
    assert "payment_history" in tables
    assert "auth_config" in tables
    assert "plaid_items" in tables
    engine.dispose()


def test_downgrade_base_then_upgrade_again(tmp_db):
    """Full upgrade → full downgrade → upgrade again must not raise."""
    url = f"sqlite:///{tmp_db}"
    cfg = _alembic_cfg(url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    engine = create_engine(url)
    assert "bills" in inspect(engine).get_table_names()
    engine.dispose()


def test_stamp_head_on_fresh_db_then_upgrade_is_noop(tmp_db):
    """Simulate the installer fresh-DB path: stamp head then upgrade head is safe."""
    from models.models import Base
    url = f"sqlite:///{tmp_db}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    engine.dispose()
    cfg = _alembic_cfg(url)
    command.stamp(cfg, "head")
    # upgrade after stamp should be a no-op (nothing to migrate)
    command.upgrade(cfg, "head")
```

**Note:** These tests should be tagged `@pytest.mark.slow` and can be conditionally
skipped in fast local runs with `-m "not slow"`. They should run on every PR to
`master`.

### CI pipeline gaps

File: `C:\SqueezyPay\.github\workflows\ci.yml`

#### What CI does well

| Behaviour | Assessment |
|---|---|
| Backend: `--cov-fail-under=80` enforced | Good coverage floor |
| Backend: `-W error::DeprecationWarning` promotes warnings to errors | Excellent hygiene gate |
| Backend: `check_ci_warnings.py` with `.ci-ignore-warnings` allowlist | Good — explicit approval required for any warning |
| Frontend: ESLint + Typecheck + Vitest all run | Adequate for current phase |
| Frontend: warning gate on npm install and Vitest | Good |
| Startup smoke test: `python -c "import main; print('startup import OK')"` | Good catch for broken imports |
| Admin: runs on `windows-latest` (correct platform) | Good — admin-specific Windows paths tested |
| Wiki publish: gated on all three jobs passing | Correct dependency |

#### Gaps

| Gap | Severity | Recommendation |
|---|---|---|
| **No E2E job** — Playwright tests never run | HIGH | Add `e2e` job (stub above); gate PRs to master |
| **Admin: no coverage enforcement** — `pytest tests/ -v` with no `--cov` | MEDIUM | Add `--cov=. --cov-fail-under=70` |
| **Frontend: no coverage threshold** — Vitest runs but `--coverage` absent | MEDIUM | Add `--coverage --reporter=text` and a threshold |
| **No migration smoke test in CI** — `alembic upgrade head` never run | HIGH | Add a step in the backend job: `python -c "from alembic.config import Config; ..."` against a temp file, or promote the migration tests above |
| **Backend startup smoke test does not set SQUEEZYPAY env vars** — wait, it does set them via `env:` block — but the `import main` path triggers `configure_logging` and avoids `lifespan` | LOW | Already acceptable; note that `lifespan` guards are not exercised here |
| **Frontend Vitest: 30 % coverage with no floor** | MEDIUM | Set `--coverage --reporter=lcov` and add a `coverage-summary` step that fails under 50 % |
| **No cross-job integration** — backend and frontend are tested in isolation; no test starts both and verifies the API contract | HIGH | The E2E job above would provide this |
| **PR to master vs push to dev** — CI triggers on `push: [dev]` and `pull_request: [master]`. Pushes directly to master are not gated. | LOW | Add `push: [master]` to `on:` if direct pushes are permitted |

---

## Recommendations

Listed in descending priority order, grouped by effort.

### Immediate (before next release)

1. **Write the three auth middleware tests** (expired token, invalid token,
   missing secret) identified in the security section. These are pure-unit,
   estimated 1 hour. Raise coverage of `core/auth.py` from 56 % to ~95 %.

2. **Add the migration smoke test** to the CI backend job. Even without the full
   test file, a single `alembic upgrade head && alembic downgrade base` against a
   temp file as a CI step costs under 10 seconds and catches the highest-severity gap.

3. **Add `--cov-fail-under=70` to the admin CI step.** One-line change to `ci.yml`.

### Short-term (next sprint)

4. **Write 2–3 Playwright tests** (login, bill create, payment log) and add the E2E
   CI job. The Playwright infrastructure is already scaffolded; the cost is primarily
   the test logic, not configuration.

5. **Add the rate-limit boundary test.** The `_rate_limit_key` test-isolation mechanism
   exists precisely to make this possible. Exceeding the `10/minute` login limit
   should produce a 429 with `Retry-After`.

6. **Write the seed tests.** These are three simple SQLAlchemy-in-memory tests;
   they eliminate the 0 % coverage on `seed.py` and assert idempotency.

### Medium-term (before beta / wider distribution)

7. **Add a frontend coverage threshold** to CI (suggest 50 % initially, rising to 60 %
   after component integration tests are added).

8. **Write 10–15 backend integration tests** that exercise the full lifecycle — setup
   passphrase, login, get token, use token against bills and payment history — without
   mocking `require_auth`. These live beside the existing test suite and complement
   the unit layer rather than replacing it.

9. **Add `--migrate` path test** — a test that calls `main.__main__` with `--migrate`
   against a temporary database file and asserts that `alembic_version` is stamped to
   `head`.

### Architecture note

The current test suite is **not a known limitation** of the technology stack. FastAPI's
`TestClient`, Playwright, pytest-alembic, and SQLAlchemy's in-memory SQLite all support
the tests described above without running a real server process. The gaps exist because
the test layer was not grown alongside the feature layer. The ISTQB-recommended
approach — risk-based test prioritisation — directs effort to the login/token pipeline,
migration integrity, and E2E critical paths first, because failures there are invisible
until a user's machine is affected. Unit coverage above 90 % on business logic is
excellent; the investment now should shift to the integration and system tiers.
