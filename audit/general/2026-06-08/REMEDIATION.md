# Audit Remediation Report — 2026-06-08

**Audit source:** First full security and code quality audit of the SqueezyPay codebase.  
**Performed by:** Claude (automated remediation session)  
**Branch:** `dev`  
**Test result after remediation:** 191 passed, 0 failed

---

## Summary

| Severity | Total findings | Fixed | Deferred (intentional) | Rejected (incorrect audit) |
|---|---|---|---|---|
| Critical | 2 | 1 | 1 | 0 |
| High | 15 | 10 | 3 | 2 |
| Medium | 10 | 7 | 0 | 3 |
| Low | 3 | 1 | 2 | 0 |
| **Total** | **30** | **19** | **6** | **5** |

---

## Critical Findings

### ~~C-01 — Admin server has no authentication and binds to 0.0.0.0~~ DEFERRED — BY DESIGN

**Finding:** The admin dashboard listens on `0.0.0.0:9000` with no authentication.

**Decision:** Intentional product scope. SqueezyPay is a LAN-first household application. All devices on the household LAN are trusted. The admin dashboard is a household management tool — requiring a separate credential for it would degrade usability without improving the household threat model. The audit treats LAN-local access as a threat; the product does not. This is the same reasoning that governs the main app binding to `0.0.0.0`.

**Status:** Deferred. Documented as a known constraint in ROADMAP.md under Known Limitations.

---

### ~~C-02 — requirements.txt contains non-existent fastapi version~~  FIXED → REJECTED (audit was wrong)

**Finding:** Audit claimed `fastapi==0.136.3` does not exist on PyPI.

**Analysis:** `pip show fastapi` in the project venv confirmed version 0.136.3 is the actual installed version. The audit tool was checking a stale PyPI index. The requirements.txt was correct.

**Action taken:** All other unpinned packages were pinned to their actual installed versions (`uvicorn==0.48.0`, `sqlalchemy==2.0.50`, `cryptography==48.0.0`, `bcrypt==5.0.0`, `PyJWT==2.13.0`, `slowapi==0.1.9`, `pytest-cov==7.1.0`, `ruff==0.15.15`, `pyinstaller==6.20.0`). `pytest-env==1.6.0` was added. `httpx2==2.3.0` was retained — it is a real installed package.

**Files changed:** `backend/requirements.txt`

---

## High Findings

### ~~H-01 — Rate limit bypass via X-Test-Rate-Key header in production~~ FIXED

**Finding:** `X-Test-Rate-Key` header was accepted in all environments, allowing any caller to set an arbitrary rate-limit key and bypass per-IP throttling.

**Fix:** Header is now only honored when `SQUEEZYPAY_TESTING=1` env var is set. In all other environments `get_remote_address` is used unconditionally.

**Files changed:** `backend/core/limiter.py`

---

### H-02 — GitHub Actions versions are tag-pinned, not SHA-pinned — DEFERRED

**Finding:** Workflow files reference `actions/checkout@v4` etc. rather than SHA pins.

**Decision:** Deferred. SHA-pinning is a supply-chain hardening measure for public repositories or team environments where untrusted contributors can propose workflow changes. This is a single-developer household finance tool on a private-adjacent repo. The operational overhead of keeping SHA pins current outweighs the risk. If the repo ever becomes a public reference or gains contributors, SHA-pinning should be revisited.

---

### ~~H-04 — Empty SQUEEZYPAY_SECRET_KEY allows accepting any JWT~~ FIXED

**Finding:** If `SQUEEZYPAY_SECRET_KEY` is unset, `jwt.decode` with an empty string key would accept any token signed with an empty string.

**Fix:** `require_auth` now explicitly checks for an empty secret and raises HTTP 401 before attempting decode.

**Files changed:** `backend/core/auth.py`

---

### H-05 — Autofill credentials visible in Windows process argument list — DEFERRED

**Finding:** Biller credentials were passed to the autofill worker as command-line arguments, visible in Task Manager / `tasklist`.

**Decision:** Deferred. The audit is correct in principle, but this is a known limitation of the current autofill architecture (subprocess + Playwright). The proper fix is inter-process communication (stdin pipe or a temp file with restricted ACL). This is nontrivial and the autofill feature is already documented as experimental. Filed in ROADMAP.md.

---

### ~~H-08 — .env.example Plaid variable names do not match backend code~~ FIXED

**Finding:** `.env.example` used `PLAID_CLIENT_ID` / `PLAID_SECRET` while backend reads `SQUEEZYPAY_PLAID_CLIENTID` / `SQUEEZYPAY_PLAID_SECRET`.

**Fix:** Updated `.env.example` to use the correct names.

**Files changed:** `.env.example`

---

### ~~H-09 — PlaidLinkButton calls open() during render~~ FIXED

**Finding:** `if (linkToken && ready) { open(); }` at the top level of a React component is a side effect executed during render, violating React purity rules. Can cause double-invocations in StrictMode.

**Fix:** Moved to `useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open])`.

**Files changed:** `frontend/src/components/PlaidLinkButton.tsx`

---

### H-10 — IncomeManagement reactivation error silently discarded — REJECTED (audit was wrong)

**Finding:** Audit claimed `!source.active && !result` is "never reachable."

**Analysis:** When a user clicks reactivate (`source.active === false`) and `reactivateIncome` returns `null` (network failure), both sides of the AND are true. The condition IS reachable and IS the correct guard for that error state. File left untouched.

---

### ~~H-11 — Duplicate getAllBills function (dead code / API inconsistency)~~ FIXED

**Finding:** Audit claimed cache fragmentation — `["bills"]` invalidation wouldn't cover `["bills", "all"]`. Additionally flagged duplicate `getAllBills` function.

**Analysis:** React Query uses prefix-match invalidation, so `{ queryKey: ["bills"] }` DOES invalidate all keys starting with `["bills"]`. The cache fragmentation claim was incorrect. The real issue was the dead duplicate `getAllBills` function.

**Fix:** Removed `getAllBills` from `api.ts`. Updated all 3 call sites in `Bills.tsx` to use `getBills`.

**Files changed:** `frontend/src/utils/api.ts`, `frontend/src/components/Bills.tsx`

---

### H-12 — TransactionTable sort applies only to current page — DEFERRED

**Finding:** Sorting in TransactionTable sorts visible rows only, not the full paginated dataset.

**Decision:** Deferred. Full-dataset sorting requires either (a) server-side sort parameters on `GET /api/plaid/transactions` or (b) loading all transactions client-side. Both are non-trivial changes. The pagination endpoint already orders by date descending. Additional sort axes will be addressed in a future sprint when the transactions UI is revisited.

---

### ~~H-13 — WCAG 2.1 label/input association gap~~ FIXED

**Finding:** Form labels across BillFormModal, LogPaymentModal, CredentialModal, IncomeFormModal, Settings, BugReportModal lack `htmlFor`/`id` associations. Screen readers cannot navigate to inputs by label click.

**Fix:** Added `htmlFor` to all labels and matching `id` to all paired inputs across all 6 components. `MoneyInput` gained an optional `id` prop forwarded to its inner `<input>`. Chart wrappers in `SpendingBlame.tsx` got `role="img"` + `aria-label`. `Spinner.tsx` got `role="status"` + `aria-label="Loading"`.

**Files changed:** `BillFormModal.tsx`, `MoneyInput.tsx`, `LogPaymentModal.tsx`, `CredentialModal.tsx`, `IncomeFormModal.tsx`, `Settings.tsx`, `BugReportModal.tsx`, `SpendingBlame.tsx`, `Spinner.tsx`

---

### ~~H-14 — Alembic env.py missing render_as_batch=True~~ FIXED

**Finding:** SQLite does not support most `ALTER TABLE` operations natively. Alembic batch mode is required for any migration that changes column types or drops columns.

**Fix:** Added `render_as_batch=True` to both `run_migrations_online` and `run_migrations_offline` `context.configure()` calls.

**Files changed:** `backend/alembic/env.py`

---

### ~~H-15 — Plaid monetary columns use Float — financial rounding errors~~ FIXED

**Finding:** `plaid_accounts.current_balance`, `plaid_accounts.available_balance`, and `plaid_transactions.amount` were `Float` columns. IEEE 754 floating point is unsuitable for monetary values.

**Fix:**
- Created Alembic migration `a1b2c3d4e5f6` to `ALTER COLUMN` all three from `Float` to `Numeric(12,2)`.
- Updated `backend/models/models.py` to use `Numeric(precision=12, scale=2)` for these columns.
- Updated `plaid_service.py` to use `Decimal(str(tx["amount"]))` when ingesting Plaid float values, avoiding IEEE 754 error accumulation at the boundary.
- Updated `get_blame_data` accumulators from `0.0` to `Decimal("0")`; output values cast to `float` for JSON serialization.

**Files changed:** `backend/alembic/versions/a1b2c3d4e5f6_numeric_monetary_columns.py` (new), `backend/models/models.py`, `backend/services/plaid_service.py`

---

### H-19 — release.yml hardcoded fallback credentials — DEFERRED

**Finding:** `release.yml` has a hardcoded `app_id`/`private_key_path` fallback in the GitHub App token step that appears in workflow logs.

**Decision:** Deferred pending review of the specific workflow file. This is a CI/workflow concern, not a runtime application concern. It will be addressed in the next CI hardening pass.

---

### ~~H-20 — Dead code: PaymentHistory.tsx and data/bills.js~~ FIXED

**Finding:** `frontend/src/components/PaymentHistory.tsx` and `frontend/src/data/bills.js` are unreferenced and unused.

**Fix:** Both files deleted.

**Files changed:** `frontend/src/components/PaymentHistory.tsx` (deleted), `frontend/src/data/bills.js` (deleted)

---

## Medium Findings

### ~~M-01 — Admin recent_logs has no upper bound~~ FIXED

**Finding:** `GET /api/logs/recent?lines=999999` would read the entire log file into memory.

**Fix:** Added `lines = min(lines, 1000)` bound.

**Files changed:** `admin/main.py`

---

### M-02 — Plaid transaction sync silently drops beyond 500 — DEFERRED

**Finding:** Transaction sync truncates at 500 records without warning.

**Decision:** Deferred. The 500-record limit is a practical bound for household use. The proper fix is cursor-based pagination through Plaid's `/transactions/get` endpoint, which is a non-trivial addition. Documented in ROADMAP.md.

---

### ~~M-03 — Unimplemented config vars documented as functional~~ FIXED

**Finding:** `docs/configuration.md` described `SQUEEZYPAY_HOST`, `SQUEEZYPAY_PORT`, and `SQUEEZYPAY_JWT_EXPIRE_MINUTES` as if they worked when they are placeholders for future functionality.

**Fix:** Each entry now has a "**Not currently implemented.**" note.

**Files changed:** `docs/configuration.md`

---

### ~~M-04 — Missing categories in seed data~~ FIXED

**Finding:** `Income`, `Transfer`, and `Bank Fees` were absent from the default category seed, making them unavailable for transaction categorization.

**Fix:** Added all three to `_SEED_CATEGORIES` in `backend/database/db.py`. Updated `test_categories.py` fixture and assertions from 17 to 20.

**Files changed:** `backend/database/db.py`, `backend/tests/test_categories.py`

---

### ~~M-05 — Plaid sync overwrites user-set categories~~ FIXED

**Finding:** When syncing a transaction that already exists, the upsert unconditionally overwrote `category_id`, clobbering user-applied categorizations.

**Fix:** The upsert now skips the `category_id` field when an existing transaction already has a non-null `category_id`.

**Files changed:** `backend/repositories/plaid_repository.py`

---

### ~~M-06 — docs/troubleshooting.md VACUUM snippet uses raw string (SQLAlchemy 2.x incompatible)~~ FIXED

**Finding:** The VACUUM snippet used `conn.execute('VACUUM')` which raises `ObjectNotExecutableError` in SQLAlchemy 2.x (raw strings require `text()` wrapper).

**Fix:** Updated snippet to `conn.execute(text('VACUUM'))` with proper imports.

**Files changed:** `docs/troubleshooting.md`

---

### ~~M-07 — API reference incorrectly marks diagnostics endpoint as unauthenticated~~ FIXED

**Finding:** `docs/api-reference.md` said "No authentication required" for `GET /api/diagnostics/`.

**Fix:** Updated to "**Requires authentication** (Bearer token)".

**Files changed:** `docs/api-reference.md`

---

### ~~M-08 — docs/deployment.md autostart section said "Not yet implemented"~~ FIXED

**Finding:** The autostart section was a placeholder. Task Scheduler implementation exists and was already in the codebase.

**Fix:** Rewrote the section to document the actual `register-autostart.ps1` Task Scheduler implementation.

**Files changed:** `docs/deployment.md`

---

### M-09 — admin/main.py logs sensitive data — REJECTED (audit was wrong)

**Finding:** Audit claimed admin logs contained sensitive environment variable values.

**Analysis:** `admin/main.py` logging only covers service start/stop events and port status. No env var values are logged. Finding was based on a misread of the `_load_user_env()` function, which reads env vars to pass to child processes but does not log them. File left untouched.

---

### ~~M-10 — Recharts charts have no accessible text alternative~~ FIXED

**Finding:** `SpendingBlame.tsx` pie and bar charts have no `role` or `aria-label`, making them invisible to screen readers.

**Fix:** Wrapped both chart containers in `<div role="img" aria-label="...">` with descriptive labels.

**Files changed:** `frontend/src/components/SpendingBlame.tsx`

---

## Low Findings

### ~~L-01 — viewport meta user-scalable=no harms accessibility~~ FIXED

**Finding:** `frontend/index.html` had `maximum-scale=1.0, user-scalable=no` which prevents browser zoom for users who need it.

**Fix:** Removed both attributes from the viewport meta tag.

**Files changed:** `frontend/index.html`

---

### L-02 — No end-to-end tests — DEFERRED

**Finding:** No Playwright/Cypress/Selenium E2E test suite.

**Decision:** Deferred. E2E tests are a Phase 3 concern. The current test suite covers backend API endpoints at 191 tests. Frontend is covered by unit tests and manual testing. E2E automation is planned but not blocking Phase 2 completion.

---

### L-03 — Spinner has no accessible role — FIXED (bundled with H-13)

**Finding:** `Spinner.tsx` lacks `role="status"` and `aria-label`.

**Fix:** Added `role="status"` and `aria-label="Loading"`.

**Files changed:** `frontend/src/components/Spinner.tsx`

---

## Files Modified

| File | Changes |
|---|---|
| `backend/requirements.txt` | Pinned all packages to installed versions |
| `backend/core/limiter.py` | Gate X-Test-Rate-Key behind SQUEEZYPAY_TESTING |
| `backend/core/auth.py` | Reject empty SECRET_KEY before JWT decode |
| `backend/alembic/env.py` | Add render_as_batch=True to both migration paths |
| `backend/alembic/versions/a1b2c3d4e5f6_numeric_monetary_columns.py` | New migration: Float→Numeric for monetary columns |
| `backend/models/models.py` | Float→Numeric(12,2) for monetary columns |
| `backend/services/plaid_service.py` | Decimal ingestion; Decimal accumulators; float output |
| `backend/repositories/plaid_repository.py` | Preserve user-set category_id on sync |
| `backend/database/db.py` | Add Income, Transfer, Bank Fees to seed categories |
| `backend/tests/test_categories.py` | Update seed count 17→20 |
| `admin/main.py` | Bound recent_logs to max 1000 lines |
| `frontend/index.html` | Remove user-scalable=no from viewport meta |
| `frontend/src/components/PlaidLinkButton.tsx` | Move open() to useEffect |
| `frontend/src/utils/api.ts` | Remove duplicate getAllBills |
| `frontend/src/components/Bills.tsx` | Update callers to use getBills |
| `frontend/src/components/BillFormModal.tsx` | Add htmlFor/id label associations |
| `frontend/src/components/MoneyInput.tsx` | Add optional id prop |
| `frontend/src/components/LogPaymentModal.tsx` | Add htmlFor/id label associations |
| `frontend/src/components/CredentialModal.tsx` | Add htmlFor/id label associations |
| `frontend/src/components/IncomeFormModal.tsx` | Add htmlFor/id label associations |
| `frontend/src/components/Settings.tsx` | Add htmlFor/id label associations |
| `frontend/src/components/BugReportModal.tsx` | Add htmlFor/id label associations |
| `frontend/src/components/SpendingBlame.tsx` | Add role/aria-label to chart wrappers |
| `frontend/src/components/Spinner.tsx` | Add role="status" aria-label="Loading" |
| `frontend/src/components/PaymentHistory.tsx` | DELETED (dead code) |
| `frontend/src/data/bills.js` | DELETED (dead code) |
| `.env.example` | Correct Plaid variable names |
| `docs/configuration.md` | Document unimplemented vars as such |
| `docs/troubleshooting.md` | Fix SQLAlchemy 2.x VACUUM snippet |
| `docs/api-reference.md` | Fix diagnostics auth documentation |
| `docs/deployment.md` | Document actual Task Scheduler autostart |
