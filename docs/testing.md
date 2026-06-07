# Testing

SqueezyPay has three test layers: backend unit/integration tests (pytest), frontend unit tests (Vitest), and end-to-end tests (Playwright).

## Backend — pytest

**Location:** `backend/tests/`

**Run:**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest
```

**With coverage:**
```powershell
pytest --cov=. --cov-report=term-missing
```

Coverage threshold is enforced by CI. The current threshold is 80%. A PR that drops below it will not merge.

**Configuration:** `backend/pyproject.toml`
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

**What is tested:**
- All API routes (via FastAPI `TestClient`)
- Service layer logic (bill date math, blame computation, category mapping)
- Encryption round-trips
- Repository methods

**Database in tests:** Tests use a fresh in-memory SQLite database per session, not the production database file. The fixture is in `backend/tests/conftest.py`.

```python
@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
```

Do not mock the database in backend tests — use the real SQLite engine. See `CONTRIBUTING.md` for the rationale.

**Adding a test:**

Create `backend/tests/test_<module>.py`. Use the `client` and `db` fixtures from `conftest.py`. Follow existing test patterns.

---

## Frontend — Vitest

**Location:** `frontend/src/__tests__/` and co-located `*.test.ts` files.

**Run:**
```powershell
cd frontend
npm test
```

**Watch mode:**
```powershell
npm test -- --watch
```

**Coverage:**
```powershell
npm test -- --coverage
```

**What is tested:**
- `billUtils.ts` — due date calculation, overdue detection, sort order (16 tests)
- `api.ts` — fetch function behaviour with mocked responses (22 tests)

**Adding a test:**

Create `frontend/src/utils/__tests__/<module>.test.ts` for utility functions or `frontend/src/components/__tests__/<Component>.test.tsx` for components.

Use `vi.fn()` to mock `fetch` responses when testing API functions.

---

## End-to-end — Playwright

> Note: Playwright is also used as a backend runtime dependency for the biller autofill feature (`backend/scripts/autofill_worker.py`). The `playwright>=1.40.0` package is in `backend/requirements.txt`. The E2E test framework described here is separate from that feature.

**Location:** `tests/e2e/`

**Prerequisites:** The backend and frontend must both be running.

**Run:**
```powershell
npx playwright test
```

**Run with UI:**
```powershell
npx playwright test --ui
```

**Show report:**
```powershell
npx playwright show-report
```

**Configuration:** `playwright.config.ts` at the repo root. Targets `http://localhost:5173`.

The E2E suite is scaffolded and ready for test expansion. Critical flows to cover as the app matures:
- Login / logout
- Bill creation and due date display
- Plaid sandbox connection flow
- Transaction sync and display
- Payment log entry

---

## CI

GitHub Actions runs all three suites on:
- Push to `dev`
- Pull requests targeting `master`

Workflow file: `.github/workflows/ci.yml`

The CI job:
1. Sets up Python and Node
2. Installs backend and frontend dependencies
3. Runs `ruff check`
4. Runs `pytest --cov` with coverage threshold
5. Runs `npm run lint`
6. Runs `npm test`

Playwright E2E is not currently in the CI workflow (requires a running server). It is run manually before milestone merges.
