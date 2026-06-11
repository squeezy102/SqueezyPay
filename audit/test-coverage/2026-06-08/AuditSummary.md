# Test Coverage Audit — Comprehensive Summary

**Project:** SqueezyPay  
**Audit date:** 2026-06-08  
**Branch:** `dev`  
**Auditor:** Claude Code (claude-sonnet-4-6) — parallel multi-agent analysis  
**Standards applied:** ISTQB EP, BVA, Decision Coverage, MC/DC, Risk-Based Test Prioritisation, Testing Trophy (Kent C. Dodds)

---

## Dimension Reports

| Report | Scope | File |
|---|---|---|
| DIM-BACKEND-API-SERVICES | API routes, services, auth, main | [reports/DIM-BACKEND-API-SERVICES.md](reports/DIM-BACKEND-API-SERVICES.md) |
| DIM-DATA-LAYER | Repositories, SQLAlchemy, migrations, schema | [reports/DIM-DATA-LAYER.md](reports/DIM-DATA-LAYER.md) |
| DIM-FRONTEND | React components, hooks, contexts, api.ts | [reports/DIM-FRONTEND.md](reports/DIM-FRONTEND.md) |
| DIM-INFRASTRUCTURE-E2E | E2E scaffold, admin, auth middleware, rate limiting, seed, CI | [reports/DIM-INFRASTRUCTURE-E2E.md](reports/DIM-INFRASTRUCTURE-E2E.md) |

---

## Overall Coverage Snapshot

| Layer | Tests | Coverage | Gate |
|---|---|---|---|
| Backend Python | 191 | 92% overall | `--cov-fail-under=80` enforced in CI |
| Frontend TypeScript | 38 | ~30% (reported) / **<10% actual** | No threshold |
| Admin Python | 15 | Not measured | No coverage step in CI |
| E2E (Playwright) | 0 running | 0% | Not wired to CI |

**Backend 92% headline is misleading.** The remaining 8% is concentrated in the highest-risk modules: the auth boundary, the autofill subprocess path, the diagnostics endpoint (entirely untested), and the startup/migration paths. The 92% average obscures zero MC/DC coverage on the security boundary.

**Frontend 30% is also misleading** — the Vitest `include` filter covers only `src/utils/**`, so all 22 components, both context providers, and the focus-trap hook are excluded from the denominator entirely. True application coverage is well below 10%.

---

## Risk-Prioritised Finding Summary

### Critical

| # | Finding | Module | Why Critical |
|---|---|---|---|
| C1 | `require_auth` JWT validation — 0% MC/DC coverage | `core/auth.py` (56%) | `conftest.py` overrides auth to a no-op for all 191 tests; expired-token and invalid-token paths are never exercised; a silent regression here could break authentication enforcement entirely |
| C2 | `AuthContext` 401 event bridge — no tests | `src/context/AuthContext.tsx` | The seam between `api.ts` (dispatches `squeezypay:unauthorized`) and `AuthContext` (clears session) is completely untested; a broken bridge leaves stale tokens in sessionStorage |
| C3 | Mutation functions in `api.ts` — no tests | `src/utils/api.ts` (23% effective) | `createBill`, `updateBill`, `deleteBill`, `loginAuth`, `changePassphrase`, `saveCredential` PUT/POST branch, `createPlaidLinkToken`, all Plaid data functions — completely untested write surface |
| C4 | `LoginScreen` passphrase-clear-on-error — no test | `src/components/LoginScreen.tsx` | "Clear field on 401" is a security requirement; a DOM that retains the passphrase after a failed attempt is a bug with no automated guard |

### High

| # | Finding | Module | Why High |
|---|---|---|---|
| H1 | Migration chain never run in any test | `alembic/versions/` | The `--migrate` installer path has no automated test; a broken migration surfaces only when a user runs the installer; `render_as_batch=True` column recreation is unverified |
| H2 | Autofill subprocess paths — 0% coverage | `api/bills.py` (67%) | `_try_autofill()` — 44 lines, 4 reachable outcomes (returncode 0, non-zero, TimeoutExpired, Popen exception) — completely untested; subprocess caller with no test is a reliability gap |
| H3 | Plaid API error branches — 503/409 paths absent | `api/plaid.py` (83%) | `RuntimeError` → 503 and `ValueError` → 409 branches never exercised; tests cover only happy path and one not-found path per endpoint |
| H4 | Category-preservation guard — no test | `plaid_repository.py` line 149 | The guard that prevents Plaid sync from overwriting user-assigned categories is never asserted; silent data loss if the guard is accidentally removed |
| H5 | Rate-limit boundary — 429 never asserted | `core/limiter.py` | Brute-force protection on the login endpoint (`10/minute`) is never tested at any level; `X-Test-Rate-Key` isolation mechanism exists specifically to make this testable |
| H6 | `useFocusTrap` Tab cycling — WCAG 2.1 SC 2.1.2 | `src/hooks/useFocusTrap.ts` | All four Tab/Shift+Tab cycling branches uncovered; WCAG keyboard trap is a known accessibility requirement with no verification |
| H7 | `BillFormModal` `expectedAmount: 0 → null` | `src/components/BillFormModal.tsx` | Non-obvious business rule: `0` must become `null` or all bills show `$0.00` instead of "Amount varies"; no test enforces this mapping |
| H8 | `SettingsRepository` insert path — no repo-layer test | `repositories/settings_repository.py` (83%) | `set()` insert branch and `get()` null-return branch never tested in isolation; upsert correctness (no duplicate PK) unverified at the SQL level |
| H9 | Frontend test infrastructure misconfigured | `vite.config.js` | `environment: 'node'` and `include: ['src/utils/**']` exclude all components from coverage; `@testing-library/react` is not installed; no component test can run today |
| H10 | No E2E job in CI | `.github/workflows/ci.yml` | Playwright config is wired but no `e2e` job exists; login, session expiry, and bill CRUD are not gated on any CI step |

### Medium

| # | Finding | Module | Why Medium |
|---|---|---|---|
| M1 | `api/diagnostics.py` — 29%, no test file | `api/diagnostics.py` | Entire diagnostics endpoint (table counts, Alembic revision, log tail, Plaid config detection) never tested; silent exception in the table-count loop returns `-1` undetected |
| M2 | `main.py` lifespan guards and CORS logic — 45% uncovered | `main.py` (55%) | Missing-key `RuntimeError` guards, CORS origin helper, and rate-limit 429 handler all uncovered; CORS headers on 429 are silently missing for disallowed origins |
| M3 | `services/auth_service.py` missing-secret guards | `services/auth_service.py` (90%) | `create_token` and `decode_token` missing-`SQUEEZYPAY_SECRET_KEY` `RuntimeError` never exercised |
| M4 | `stalenessUtils.ts` — 0% | `src/utils/stalenessUtils.ts` | Pure function with 5 EP classes and 3 BVA boundaries; drives staleness warnings on Dashboard and TransactionTable; 12h boundary off-by-one has no test |
| M5 | `ThemeContext` localStorage / matchMedia logic | `src/context/ThemeContext.tsx` | Init branches (stored preference, matchMedia fallback, no preference) and `toggle()` write-back untested |
| M6 | `Settings.tsx` passphrase validation — no test | `src/components/Settings.tsx` | Two client-side validation rules (mismatch, length < 8) that exist only in component code; entirely untested |
| M7 | `PaymentHistoryRepository` — HTTP-only, 93% | `repositories/payment_history_repository.py` | `get_all()` ordering and `get_by_id()` null-return never exercised at the repository layer; FK cascade delete with `bill_id` not tested |
| M8 | Admin CI: no coverage measurement | `admin/` CI step | `pytest tests/ -v` with no `--cov`; coverage regressions in admin go undetected |
| M9 | `PlaidTransactionRepository.get_all()` date filters uncovered | `plaid_repository.py` line 173 | `start_date` filter branch never exercised; date-range filtering produces wrong results silently if broken |
| M10 | SQLite FK pragma not set in test engine | `tests/conftest.py` | `PRAGMA foreign_keys = ON` not set; orphaned-row inserts silently succeed in tests; FK constraint integrity never verified |
| M11 | `Numeric` column type precision unverified | All repositories | `Numeric(12,2)` columns return `Decimal` but tests assert float equality; SQLite stores as text; precision divergence between test and production undetected |

### Low

| # | Finding | Module | Why Low |
|---|---|---|---|
| L1 | `seed.py` — 0% | `seed.py` | Idempotency guard (`skip if rows exist`) never asserted; insert path 0%; low risk since seed is illustrative one-time data |
| L2 | `EncryptionService` missing-key error path | `services/encryption_service.py` (94%) | `RuntimeError` on absent key is protected by `lifespan` guard; error message text is the only untested element |
| L3 | `BillRepository` not-found repo layer | `bill_repository.py` (94%) | `update()` and `delete()` null/false sentinels tested via HTTP only, not at repository layer |
| L4 | `CategoryRepository` null-return | `category_repository.py` (97%) | `get_by_id()` null path tested via HTTP only |
| L5 | `IncomeRepository` `reactivate()` success | `income_repository.py` (98%) | Tested via HTTP; no direct repository layer test |
| L6 | `services/settings_service.py` unknown-key path | `services/settings_service.py` (84%) | Unknown key warn-and-ignore path never reached; Pydantic layer validates before service sees it |
| L7 | `PlaidLinkButton` token-error display | `src/components/PlaidLinkButton.tsx` | Error state for failed `createPlaidLinkToken` has no test; silent failure if Plaid is misconfigured |
| L8 | `_fetch_institution_name` success path | `services/plaid_service.py` (92%) | Happy path of `item_get` + `institutions_get_by_id` never exercised; institution names could silently return `None` |

---

## Root Cause Analysis

Four root causes account for the majority of all gaps:

**RC1 — Auth fixture bypass (affects C1, M3, infrastructure section)**  
`conftest.py` registers `override_require_auth` (a no-op) as a FastAPI dependency override for every test. This was a pragmatic convenience decision that eliminated the need to generate tokens for every test, but it has the side effect of making `core/auth.py`'s JWT logic invisible to the coverage tracer across all 191 tests. The fix is a dedicated `test_core_auth.py` that calls `require_auth` directly, not through the HTTP layer.

**RC2 — Happy-path-only test writing (affects H2, H3, L8)**  
Multiple test files cover the success path and the most obvious failure path (404 not found) but do not apply EP to identify all exception classes. The pattern `test_X_success` exists without a companion `test_X_runtime_error_returns_503`. This is systematic, not isolated.

**RC3 — Missing test files for whole modules (affects M1, L1)**  
`api/diagnostics.py` (29% coverage, 56 lines) and `seed.py` (0%, 20 lines) have no test file at all. These are not gaps in existing tests — they represent modules that were written and shipped without any test being created alongside them.

**RC4 — Frontend test infrastructure not grown with the codebase (affects C2, C3, C4, H6, H7, H9)**  
The Vitest configuration was set up for utility functions and never expanded. `@testing-library/react` is absent, `environment: 'node'` is wrong for component tests, and `include: ['src/utils/**']` excludes the entire component tree. The 38 existing frontend tests are well-written; the infrastructure was never extended to enable component-level testing.

---

## Test Pyramid Gap

```
        [ E2E ]        0 tests in CI (Playwright config ready, no tests written)
       [  Int  ]       0 true integration tests (real server + real DB file)
      [  Unit   ]      191 backend + 38 frontend — all investment here
```

**Recommended shift:**

The next testing investment should prioritise the integration and system tiers over adding more unit tests. The unit layer is mature; marginal returns on additional unit coverage are low. The gaps that matter — auth regression, migration breakage, session expiry, bill CRUD round-trip — are only detectable at the integration or E2E tier.

---

## Prioritised Remediation Plan

### Sprint 1 — Security and Infrastructure Blockers (estimated: 3–4 days)

| Task | Files | Closes |
|---|---|---|
| Write `tests/test_core_auth.py` — all 5 `require_auth` branches | `core/auth.py` | C1, DIM-INFRA auth gaps |
| Fix frontend test infrastructure — install `@testing-library/react`, change `vite.config.js` `environment` + `include` | `vite.config.js`, `package.json` | H9 (blocker for all component tests) |
| Write `tests/test_migrations.py` — upgrade head, downgrade base, stamp-then-upgrade | `alembic/versions/` | H1 |
| Add migration smoke step to CI backend job | `.github/workflows/ci.yml` | H1 (CI gate) |
| Write `AuthContext.test.tsx` — 6 scenarios including 401 event bridge | `src/context/AuthContext.tsx` | C2 |

### Sprint 2 — High-Risk Logic Gaps (estimated: 3–4 days)

| Task | Files | Closes |
|---|---|---|
| Write `api.test.ts` additions — all mutation functions, Plaid functions, `saveCredential` PUT/POST, `mapBlameData` | `src/utils/api.ts` | C3 |
| Write `LoginScreen.test.tsx` — passphrase-clear-on-error, loading state, disabled guard | `src/components/LoginScreen.tsx` | C4 |
| Add autofill endpoint tests — 6 stubs covering all `_try_autofill` outcomes | `api/bills.py` | H2 |
| Add Plaid API error-branch tests — 503/409 for exchange, disconnect, sync-balances, sync-transactions | `api/plaid.py` | H3 |
| Add category-preservation guard test | `plaid_repository.py` | H4 |
| Write `tests/test_rate_limiting.py` — 429 boundary test | `core/limiter.py` | H5 |

### Sprint 3 — Coverage Closure (estimated: 3–4 days)

| Task | Files | Closes |
|---|---|---|
| Write `stalenessUtils.test.ts` — all EP classes and BVA boundaries | `src/utils/stalenessUtils.ts` | M4 |
| Write `ThemeContext.test.tsx` and `useFocusTrap.test.tsx` | context/hooks | M5, H6 |
| Write `BillFormModal.test.tsx` — expectedAmount mapping, validation | `src/components/BillFormModal.tsx` | H7 |
| Write `Settings.test.tsx` — passphrase mismatch and length validation | `src/components/Settings.tsx` | M6 |
| Write `tests/test_settings_repository.py` | `repositories/settings_repository.py` | H8 |
| Add `db` fixture with FK pragma to `tests/conftest.py` | `tests/conftest.py` | M10 |
| Write `tests/test_diagnostics.py` | `api/diagnostics.py` | M1 |
| Write `tests/test_seed.py` | `seed.py` | L1 |
| Write `tests/test_main.py` — CORS origin helper, rate-limit handler, lifespan guards | `main.py` | M2 |

### Sprint 4 — E2E and CI Hardening (estimated: 2–3 days)

| Task | Files | Closes |
|---|---|---|
| Write 3–5 Playwright tests — login, bill CRUD, payment log | `tests/e2e/` | H10 |
| Add `e2e` job to CI — Playwright chromium, gated on backend + frontend passing | `.github/workflows/ci.yml` | H10 |
| Add `--cov-fail-under=70` to admin CI step | `.github/workflows/ci.yml` | M8 |
| Add frontend coverage threshold to CI (suggest 50%, target 65% after Sprint 3) | `.github/workflows/ci.yml` | Frontend gate |

---

## Coverage Targets

| Layer | Current | After Sprint 1–2 | After Sprint 3–4 | Long-term |
|---|---|---|---|---|
| Backend | 92% | ~94% | ~96% | 98%+ with migration + seed |
| Frontend (true) | <10% | ~35% (context + api.ts) | ~65% (+ components) | 80%+ |
| Admin | Not measured | Not measured | Not measured | 70%+ with CI gate |
| E2E | 0 journeys | 0 | 3–5 critical paths | 8–10 paths |

---

## What Good Looks Like From Here

The backend unit tier is solid. The investment signal from this audit is clear: shift effort to:

1. **Auth boundary verification** — the one gap with direct security implications  
2. **Frontend component integration tests** — the largest total coverage gap in absolute terms  
3. **Migration integrity** — the highest-stakes silent failure mode in the installer workflow  
4. **E2E login + session expiry** — the gaps that only a real browser can catch

The test suggestion stubs in the dimension reports are immediately usable by an LLM or a developer writing tests in a dedicated effort. They are not implementations — they are behavioural specifications with the correct test structure, mocking pattern, and ISTQB classification so that the test-writing session can begin without further research.

---

*Audit directory:* `audit/test-coverage/2026-06-08/`  
*Dimension reports:* `audit/test-coverage/2026-06-08/reports/`  
*General audit:* `audit/general/2026-06-08/REMEDIATION.md`  
*Audit index:* `audit/AUDIT-INDEX.md`
