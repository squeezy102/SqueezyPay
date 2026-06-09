# Testing

SqueezyPay has three test layers: backend unit/integration tests (pytest), frontend unit tests (Vitest), and end-to-end tests (Playwright).

---

## Universal Test Standards

These rules apply to every test in the project — pytest, Vitest, and Playwright alike.

### Isolation is absolute

Every test must be completely independent. A test must:

- Set up everything it needs at the start.
- Clean up everything it created at the end.
- Pass whether run alone, in any order, or in parallel with every other test.
- Never depend on state left behind by another test.
- Never assume a particular database or UI state exists before it runs.

### Test data must be destroyed

If a test creates any artifact — a database row, a UI element, a file — that artifact must be deleted before the test ends. **This applies even when the test fails.** Use language-appropriate mechanisms to guarantee cleanup on failure:

- **Playwright:** `try/finally` wrapping `afterEach` cleanup
- **pytest:** `yield` fixtures with teardown after the `yield`, or `try/finally` in the test body
- **Vitest:** `afterEach` hooks, `vi.restoreAllMocks()`

**The state of the system must be exactly the same after a test as it was before. This is the law.**

### Test data must be uniquely identified

Tests that create named data must use a unique identifier per invocation so parallel runs never conflict. Use a UUID, timestamp, or random suffix — never a fixed string.

### Tests must not be brittle

- Target elements by role, label, or semantic meaning — not by CSS class, XPath, or DOM position.
- Never use positional selectors (`.nth()`, `.last()`) to disambiguate elements that should be individually addressable. Give them distinct labels instead.
- Never use fixed `sleep` or `waitForTimeout` to wait for things to appear. Use explicit waits against visible state.
- Test behavior (what the user sees), not implementation (how the code works internally).

### Tests must not depend on each other

No test may rely on a predecessor. If a test needs data, it creates that data itself. If tests share setup, use fixtures — not test ordering.

---

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
testpaths = ["tests", "../scripts/tests"]
markers = [
    "slow: integration tests that run real migrations against on-disk SQLite",
]
```

**Test markers:**

- `@pytest.mark.slow` — migration integration tests that write real SQLite files. Included in the full suite (CI runs all), excluded in fast local runs:
  ```powershell
  pytest -m "not slow"   # skip migration tests
  pytest -m slow          # run only migration tests
  ```

**What is tested:**
- All API routes (via FastAPI `TestClient`)
- Service layer logic (bill date math, blame computation, category mapping)
- Encryption round-trips
- Repository methods
- JWT authentication boundary (`test_core_auth.py`)
- Alembic migration chain integrity (`test_migrations.py` — full upgrade/downgrade/round-trip on real SQLite files)
- Tray icon helpers (`scripts/tests/test_tray.py` — Windows-only dependencies are mocked so this runs on Linux CI)

**Database in tests:** Tests use a fresh in-memory SQLite database per session, not the production database file. The fixture is in `backend/tests/conftest.py`.

```python
@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
```

Do not mock the database in backend tests — use the real SQLite engine.

**Adding a test:**

Create `backend/tests/test_<module>.py`. Use the `client` and `db` fixtures from `conftest.py`. Follow existing test patterns. Every test that writes rows must clean them up or use a transaction that rolls back.

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

**Coverage configuration:** `frontend/vite.config.js` includes all of `src/**` in the coverage denominator.

```js
test: {
  environment: 'jsdom',
  coverage: {
    provider: 'v8',
    include: ['src/**'],
    exclude: ['src/**/*.test.*', 'src/main.tsx'],
  },
}
```

**Mock discipline:** Always call `vi.restoreAllMocks()` in `afterEach` so mocks do not leak between tests. When mocking `fetch`, restore it immediately after the assertion.

**Adding a test:**

Create `frontend/src/utils/__tests__/<module>.test.ts` for utility functions or `frontend/src/components/__tests__/<Component>.test.tsx` for components.

---

## End-to-end — Playwright

> Note: Playwright is also used as a backend runtime dependency for the biller autofill feature (`backend/scripts/autofill_worker.py`). The `playwright>=1.40.0` package is in `backend/requirements.txt`. The E2E test framework described here is separate from that feature.

**Location:** `tests/e2e/`

**Configuration:** `playwright.config.ts` at the repo root. Targets `http://localhost:5173`. `fullyParallel: true` — all tests must be safe to run in parallel.

### E2E Standards (non-negotiable)

In addition to the universal standards above, Playwright tests must follow these rules:

**Credentials are never hardcoded.** `SQUEEZYPAY_E2E_PASSPHRASE` must be set in the environment. There is no default. A missing env var causes an immediate, loud failure. A hardcoded fallback is a security vulnerability and is prohibited.

```typescript
// CORRECT
const p = process.env.SQUEEZYPAY_E2E_PASSPHRASE;
if (!p) throw new Error('SQUEEZYPAY_E2E_PASSPHRASE is not set');

// PROHIBITED — never do this
const p = process.env.SQUEEZYPAY_E2E_PASSPHRASE ?? 'some-default';
```

**Cleanup is guaranteed.** Wrap data creation + deletion in `try/finally`:

```typescript
const cleanup = await createBill(page, name);
try {
  await expect(page.getByText(name)).toBeVisible();
} finally {
  await cleanup(); // runs even on assertion failure
}
```

**Data uses unique identifiers.** Never use a fixed string for created data:

```typescript
// CORRECT
const name = `E2E Bill ${crypto.randomUUID()}`;

// PROHIBITED
const name = 'E2E Test Bill';
```

**Locators are role-based.** Follow [Playwright best practices](https://playwright.dev/docs/best-practices):

```typescript
// CORRECT
page.getByRole('button', { name: 'Delete Electric Bill' })
page.getByLabel('Bill name')

// PROHIBITED
page.locator('.delete-btn').last()
page.locator('div > button:nth-child(2)')
```

### Required secrets

| Secret | Where set | Purpose |
|--------|-----------|---------|
| `CI_E2E_PASSPHRASE` | GitHub → Settings → Secrets → Actions | Passphrase seeded before tests via `/api/auth/setup` |
| `CI_ENCRYPTION_KEY` | Already exists | Backend encryption key |
| `CI_SECRET_KEY` | Already exists | Backend JWT secret |

`CI_E2E_PASSPHRASE` must be added to the repo before the `e2e` CI job will pass.

### Running locally

1. Start the backend (from `backend/`):
   ```
   SQUEEZYPAY_ENCRYPTION_KEY=<key> SQUEEZYPAY_SECRET_KEY=<key> python main.py
   ```

2. Seed the test passphrase (once, or after a DB wipe):
   ```
   curl -X POST http://localhost:8000/api/auth/setup \
     -H 'Content-Type: application/json' \
     -d '{"passphrase":"<your-local-test-passphrase>"}'
   ```

3. Start the frontend (from `frontend/`):
   ```
   npm run dev
   ```

4. Run Playwright:
   ```
   SQUEEZYPAY_E2E_PASSPHRASE=<your-local-test-passphrase> npx playwright test --project=chromium
   ```

   With the interactive UI runner:
   ```
   SQUEEZYPAY_E2E_PASSPHRASE=<your-local-test-passphrase> npx playwright test --ui
   ```

Choose any passphrase for local runs. Never commit it. Never reuse a production passphrase.

### Test coverage

| File | Tests | What is covered |
|------|-------|-----------------|
| `auth.spec.ts` | 4 | Login screen renders; wrong passphrase shows error; correct passphrase navigates to Dashboard; logout returns to login screen |
| `dashboard.spec.ts` | 1 | Dashboard heading and sidebar nav items render after login; no crash state |
| `bills.spec.ts` | 3 | Bills sub-nav pills visible; add a bill; delete a bill — each with full cleanup |
| `settings.spec.ts` | 4 | Settings tab loads; wrong current passphrase shows backend error; mismatched new passphrases shows client error; passphrase under 8 chars shows length error |
| `offline.spec.ts` | 1 | OfflineBanner appears when `/health` returns 503; disappears on recovery |

### Checklist for adding a new E2E test

- [ ] Can it run alone (`npx playwright test --grep "test name"`) and pass?
- [ ] Can it run in parallel with every other test without conflict?
- [ ] Does it clean up every database artifact it creates, even on failure (`try/finally`)?
- [ ] Are all locators role-based or labeled — no CSS or positional selectors?
- [ ] Is it free of `waitForTimeout`?
- [ ] Does it read `SQUEEZYPAY_E2E_PASSPHRASE` from the environment only — no hardcoded value?
- [ ] Does the test name describe the expected user-visible outcome?

---

## CI

GitHub Actions runs all three suites on:
- Push to `dev`
- Pull requests targeting `master`

Workflow file: `.github/workflows/ci.yml`

Jobs:
1. **backend** — `ruff check`, `pytest --cov` (80% threshold), startup smoke test
2. **frontend** — `npm run lint`, `npm test`, `tsc --noEmit`
3. **e2e** (depends on backend + frontend) — starts backend and frontend, seeds passphrase, runs `npx playwright test --project=chromium`
4. **publish-wiki** (push to dev only) — syncs `wiki/` to the GitHub Wiki
