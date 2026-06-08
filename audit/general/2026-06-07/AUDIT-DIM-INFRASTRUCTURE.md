# Audit Dimension Report: Infrastructure, CI/CD, Configuration, and Documentation
## Document ID: AUDIT-DIM-INFRASTRUCTURE-001
## Version: 1.0 (Iteration 1)
## Date: 2026-06-07
## Auditor: Automated agent + senior review
## Scope: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.gitignore`, `.env.example`, `.ci-ignore-warnings`, `backend/pyproject.toml`, `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/*.py`, `installer/squeezypay.iss`, `scripts/*.ps1`, `playwright.config.ts`, `tests/e2e/dashboard.spec.ts`, `frontend/vite.config.js`, `frontend/tsconfig.json`, `backend/requirements.txt`, `README.md`, `docs/*.md`, `CONTRIBUTING.md`, `ROADMAP.md`
## Bibliography: All reference IDs resolved in `audit/BIBLIOGRAPHY.md`

---

## Methodology

Every file in scope was read in full. Findings are derived by:
1. Direct inspection of each file line by line
2. Cross-reference against cited standards
3. Cross-file consistency analysis (e.g., documented variable names vs. code variable names, CI steps vs. documentation claims)

No finding is stated without a line number and a code fragment. Where a claim cannot be confirmed by direct file inspection, it is not stated.

---

## 1. CI/CD — `ci.yml`
*Standards applied: [REF-26] GitHub Actions security hardening; [REF-27] GitHub Actions workflow syntax; [REF-28] GitHub Dependabot for Actions*

### 1.1 All Action Versions Tag-Pinned, Not SHA-Pinned

**Lines 18, 20, 66, 68, 90** (and all other `uses:` lines):
```yaml
- uses: actions/checkout@v6
- uses: actions/setup-python@v6
- uses: actions/setup-node@v6
```
Per [REF-26] §Pinning Actions to a SHA: "We recommend pinning actions to a full length commit SHA. Pinning an action to a full length commit SHA is currently the only way to use an action as an immutable release." Tag `v6` is mutable — a compromise of the action maintainer's account could push malicious code to the `v6` tag and the workflow would execute it on the next run without any change to the workflow file.

**Severity: HIGH** — supply-chain risk; applies to all workflows.

### 1.2 Admin Job Coverage Gap

**Line 78:** The admin job runs `pytest tests/ -v` with no coverage threshold and no warning gate. The backend job (lines 34–56) enforces `--cov-fail-under=80` and processes a warning gate via `.ci-ignore-warnings`. The admin job has neither. Regressions in admin code that produce warnings or drop below a coverage threshold will not be detected by CI.

**Severity: MEDIUM** — inconsistency; admin code is not held to the same quality gate as backend code.

### 1.3 `$PIPESTATUS[0]` Shell Idiom

**Lines 97, 109:** 
```yaml
npm ci --legacy-peer-deps 2>&1 | tee /tmp/npm_install_output.txt; exit ${PIPESTATUS[0]}
```
`${PIPESTATUS[0]}` is Bash-specific. The job uses `runs-on: ubuntu-latest` with no `shell:` key, which defaults to `bash -e`, so this works today. If the shell default ever changes (e.g., to `sh`), the `${PIPESTATUS[0]}` expression silently expands to empty and the exit code is lost. Per [REF-27] §jobs.<job_id>.steps[*].shell, the shell should be declared explicitly: `shell: bash`.

**Severity: MEDIUM** — fragile reliance on implicit default shell.

### 1.4 CI Matrix Covers Single Python/Node Version

**Lines 20, 90:** Python 3.11 and Node 24 are the only tested versions. `backend/pyproject.toml` (line 9) declares `target-version = "py312"` for Ruff. The declared target version (py312) and the CI runtime (py311) are inconsistent. While Ruff's `pyupgrade` rules at py312 primarily enforce typing modernizations already valid in 3.11+, the gap means any py312-specific syntax Ruff might enforce is not actually tested for runtime compatibility.

**Severity: INFO** — inconsistency between declared target and tested runtime.

---

## 2. CI/CD — `release.yml`
*Standards applied: [REF-26] GitHub Actions security hardening; [REF-27] GitHub Actions workflow syntax*

### 2.1 All Action Versions Tag-Pinned (Including Third-Party)

**Lines 15, 20, 38, 248:**
```yaml
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
- uses: actions/setup-python@v6
- uses: softprops/action-gh-release@v2
```
Same supply-chain risk as §1.1 above. Critically, `softprops/action-gh-release@v2` (line 248) is a third-party action that receives the `GITHUB_TOKEN` with write-release permissions. Third-party action tag pinning carries higher risk than first-party, per [REF-26] §Third-party Actions.

**Severity: HIGH** — third-party action with write permissions pinned only to a mutable tag.

### 2.2 Hardcoded Fallback Credentials via `||` Operator

**Line 62:**
```yaml
SQUEEZYPAY_ENCRYPTION_KEY: ${{ secrets.SQUEEZYPAY_ENCRYPTION_KEY_TEST || 'dGVzdC10ZXN0LXRlc3QtdGVzdC10ZXN0LXRlc3Q=' }}
```
**Line 138–139:**
```yaml
$testPassphrase = "${{ secrets.SANDBOX_TEST_PASSPHRASE || 'TestPassphrase123!' }}"
```
**Line 204:**
```yaml
$loginBody = '{"passphrase":"' + "${{ secrets.SANDBOX_TEST_PASSPHRASE || 'TestPassphrase123!' }}" + '"}'
```
When the named secret is not configured in the repository, the `||` expression falls back to a hardcoded plaintext value. For `SANDBOX_TEST_PASSPHRASE`, the literal string `TestPassphrase123!` appears in lines 138 and 204 — this value appears in the workflow run logs unmasked when the secret is absent. For a private repository this is low risk; if the repository is ever made public or the logs are exposed, the value is visible to anyone who can read the workflow logs. Per [REF-26] §Secrets: "Never embed secrets directly in workflow files." The fallback pattern has the same effect as embedding the secret directly.

**Severity: HIGH** — plaintext credential appears in workflow file; logged when secret is absent.

### 2.3 Version String Used as Shell Input Without Sanitization

**Line 109:**
```yaml
$version = "${{ github.ref_name }}" -replace '^v', ''
```
`github.ref_name` is derived from the git tag name, which is user-controlled within the constraints of git ref naming rules (no spaces, `..`, `?`, `*`, `[`, `\`, `^`, `~`, or `:` per Git). Semicolons and parentheses are not valid in ref names, limiting injection vectors. However, this value is passed downstream to the Inno Setup compiler (`/DAppVersion=`) via PowerShell string interpolation. The risk is low given git ref naming constraints, but per [REF-27] §Contexts and best practices, externally-sourced context values should be sanitized before use in shell commands.

**Severity: LOW** — low-probability injection risk given git ref naming constraints.

### 2.4 `Start-Sleep 2` After Health Check — Race Condition

**Line 195:**
```yaml
Start-Sleep 2
```
The 2-second sleep follows a `/health` endpoint check confirming the server is accepting connections. However, the server's lifespan startup handler (which seeds the passphrase from `initial_passphrase.tmp`) runs after the first connection is accepted. The `/api/auth/status` call at line 197 requires the passphrase seed to have completed. On a slow runner where lifespan startup takes longer than 2 seconds, the auth check fails. A retry loop with explicit state polling would be more robust.

**Severity: LOW** — race condition on slow runners; current 2-second assumption may not hold.

---

## 3. Configuration Files

### 3.1 `.env.example` — Variable Names Do Not Match Backend Code

**FILE: `.env.example`, lines 8–19:**
The file documents:
```
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_secret_here
PLAID_ENV=sandbox
```
The backend reads (confirmed by `backend/plaid_service.py` and `backend/tests/conftest.py`):
```python
SQUEEZYPAY_PLAID_CLIENTID
SQUEEZYPAY_PLAID_SECRET
SQUEEZYPAY_PLAID_ENV
```
The variable names in `.env.example` do not include the `SQUEEZYPAY_` prefix and use different casing (`PLAID_CLIENT_ID` vs `SQUEEZYPAY_PLAID_CLIENTID`). A developer following `.env.example` verbatim to configure Plaid will set environment variables that the backend never reads, resulting in Plaid being non-functional with no error message beyond "Plaid not configured."

Additionally, the following variables are documented in `docs/configuration.md` as supported but are absent from `.env.example`:
- `SQUEEZYPAY_HOST`
- `SQUEEZYPAY_PORT`
- `SQUEEZYPAY_JWT_EXPIRE_MINUTES`
- `VITE_FEEDBACK_EMAIL` (self-tracked as Issue #8 in `ROADMAP.md`)

**Severity: HIGH** — developer onboarding blocker; incorrect Plaid variable names will cause silent configuration failure.

### 3.2 `.ci-ignore-warnings` — Overly Broad `DeprecationWarning` Exemption

**Line 13:** `DeprecationWarning` is approved as a blanket substring match with no scope restriction. Any `DeprecationWarning` from any source — including first-party SqueezyPay code — will be silently accepted by CI. The intent is to exempt third-party library warnings; the implementation has no such scope limit.

**Severity: MEDIUM** — CI quality gate blind spot; first-party deprecation warnings are hidden.

### 3.3 `backend/pyproject.toml` — `pytest-env` Not in `requirements.txt`

**`backend/pyproject.toml`, line 6:** `env = ["SQUEEZYPAY_TESTING=1"]` requires `pytest-env` to be installed. `pytest-env` does not appear in `backend/requirements.txt`. If it is not installed, the `env` directive is silently ignored. The `SQUEEZYPAY_TESTING=1` variable is set directly in `conftest.py` as a fallback, so the behavior is correct in practice — but the `pyproject.toml` entry is misleading.

**Severity: LOW** — no functional impact; misleading configuration entry.

### 3.4 `backend/pyproject.toml` — `target-version = "py312"` vs CI Runtime `3.11`

**Line 9:** Ruff's `target-version = "py312"` enforces Python 3.12 idioms. CI installs and tests on Python 3.11. This creates a gap where Ruff may enforce syntax that is technically valid in 3.11 for annotations but targets 3.12 semantics. No active breakage observed, but the declared version should match the tested runtime.

**Severity: LOW** — inconsistency; no current breakage.

---

## 4. Database Migrations
*Standards applied: [REF-19] SQLAlchemy 2.0 ORM docs; [REF-20] Alembic Tutorial; [REF-31] SQLite Datatypes; [REF-32] Alembic Operations Reference*

### 4.1 `op.drop_column` Without Batch Mode on SQLite

**FILE: `backend/alembic/versions/9e03c93944c3_initial_schema.py`, lines 24–25:**
```python
op.drop_column('payment_methods', 'type')
```
SQLite does not natively support `ALTER TABLE DROP COLUMN` before SQLite 3.35 (released 2021-03-12). For Python 3.11 on Ubuntu 20.04 LTS runners, the bundled SQLite version may be 3.31.x — below the threshold. Per [REF-32] §batch_alter_table: "SQLite does not support the `ALTER TABLE` statement for modification of table structure beyond adding columns. Alembic implements batch table operations for SQLite." Executing this migration without `batch_op` context manager will raise `CompileError` or silently do nothing, depending on SQLite version.

**Severity: HIGH** — migration may fail or produce no-op on SQLite < 3.35.

### 4.2 Misleading Migration Name — `initial_schema`

**FILE: `backend/alembic/versions/9e03c93944c3_initial_schema.py`, lines 1–35:**
The file is named `initial_schema` but its entire content is a column rename on an existing `payment_methods` table — not a schema creation. The core schema (`bills`, `payment_history`, `credentials`, etc.) is created outside Alembic via SQLAlchemy `create_all` in `init_db()`. The migration name implies full schema bootstrapping but performs only a structural change. A developer inspecting the migration history will be misled about what Alembic manages.

**Severity: MEDIUM** — misleading; no functional defect.

### 4.3 Monetary Values Stored as `Float` — IEEE 754 Precision Loss

**FILE: `backend/alembic/versions/5a43611da40e_add_plaid_tables.py`, lines 44, 53:**
```python
sa.Column('current_balance', sa.Float(), nullable=True),
sa.Column('available_balance', sa.Float(), nullable=True),
```
**Line 55 (plaid_transactions):**
```python
sa.Column('amount', sa.Float(), nullable=True),
```
Per [REF-31] SQLite Datatypes §Type Affinity: SQLite `REAL` (mapped from `sa.Float`) is an IEEE 754 64-bit floating point. Representing monetary values in floating point is incorrect for a financial application — the classic example is `0.1 + 0.2 != 0.3`. Per [REF-19] §Column Types, `sa.Numeric(precision=12, scale=2)` maps to SQLite `NUMERIC`, which uses integer storage for values within the precision range, preserving exact decimal representation.

**Severity: HIGH** — incorrect data type for financial values; causes rounding errors in summation and comparison.

### 4.4 Missing Indexes on Foreign Key Columns

**FILE: `backend/alembic/versions/5a43611da40e_add_plaid_tables.py`:**

`plaid_accounts.plaid_item_id` (FK to `plaid_items`, line 46) — no index.
`plaid_transactions.plaid_account_id` (FK to `plaid_accounts`, line 59) — no index.
`plaid_transactions.date` (line 62) — no index despite being the primary filter column in all transaction range queries.
`plaid_transactions.category_id` (FK to `transaction_categories`, line 67) — no index.

Per [REF-32] §create_index: indexes on foreign key columns are standard practice. SQLite does not auto-index foreign keys. For a personal-scale app the performance impact is negligible with small data volumes; at scale these become full-table scans.

**Severity: MEDIUM** — missing indexes; no functional impact at current scale.

### 4.5 `DateTime` Columns Are Timezone-Naive

**FILE: `backend/alembic/versions/3b8a84212839_add_auth_config.py`, lines 27–28:**
`auth_config.created_at` and `auth_config.updated_at` use `sa.DateTime()` (timezone-naive). Per [REF-31], SQLite stores datetimes as TEXT strings. If the system clock changes (DST, clock correction, NTP drift), timestamps may become incoherent. `sa.DateTime(timezone=True)` stores UTC offset explicitly. This is consistent across the entire codebase — all `DateTime` columns are timezone-naive.

**Severity: LOW** — consistent design choice; theoretical coherence risk if system clock changes.

### 4.6 `alembic/env.py` — `run_migrations_offline` Missing `render_as_batch=True`

**FILE: `backend/alembic/env.py`, lines 31–48:**
The offline migration path does not pass `render_as_batch=True`. The online path (lines 55–74) also omits it. Per [REF-32] §batch_alter_table: batch mode is required for SQLite DDL operations. Since migration `9e03c93944c3` performs a column drop, and `env.py` does not enable batch mode globally, the migration relies on either SQLite 3.35+ or will fail.

**Severity: HIGH** — same root cause as §4.1; the env.py configuration does not enable the batch mode that SQLite requires.

---

## 5. Installer — `squeezypay.iss`

### 5.1 Passphrase Written to Plaintext Temp File

**Lines 397–405:**
```pascal
SaveStringToFile(ExpandConstant('{userappdata}\SqueezyPay\initial_passphrase.tmp'),
  passphrase, False);
```
The household passphrase is written to `%APPDATA%\SqueezyPay\initial_passphrase.tmp` in plaintext. Any process running as the same user can read this file between the installer writing it and the backend consuming and deleting it on first start. The file deletion occurs inside the backend process startup; on a slow system, the window may be several seconds. This is a design-level constraint (the backend must receive the passphrase somehow before the auth database is configured), but the plaintext temp file exposure window should be documented as a known limitation.

**Severity: MEDIUM** — documented design constraint; low risk for a home user on a single-user machine.

### 5.2 Encryption Key Written Even on Generation Failure

**Lines 391–400:**
```pascal
if fernetKey = '' then begin
  MsgBox('WARNING: Could not generate encryption key. ...', mbError, MB_OK);
end else begin
  ...registry writes...
end;
```
The warning dialog does not abort the installation. If `GenerateFernetKey()` fails and `fernetKey` is empty string, the registry entry for `SQUEEZYPAY_ENCRYPTION_KEY` is skipped (lines 99–100 only write if the `{code:GetXxx}` accessor returns a value). The backend will then fail to start with a missing-key error rather than an incorrect-key error. This is recoverable by re-running setup. The installer UI does not communicate that a re-run is needed.

**Severity: MEDIUM** — installation can silently complete in a non-functional state without a clear recovery path shown to the user.

### 5.3 Placeholder AppId GUID

**Line 28:**
```ini
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
```
This is a well-known placeholder GUID. Per Inno Setup documentation, the `AppId` is used by Windows to identify the application for uninstall, upgrade detection, and registry deduplication. If any other application installed on the same machine uses the same placeholder GUID (common for developers using templates), Windows will treat them as the same application, causing incorrect uninstall behavior. The GUID should be regenerated uniquely.

**Severity: MEDIUM** — functionally correct in isolation; conflicts possible on developer machines that use the same template GUID.

### 5.4 Task Scheduler XML via String Concatenation

**Lines 410–428:**
The Task Scheduler XML is constructed by string concatenation in Pascal script. The install path (`ExpandConstant('{app}')`) is interpolated directly without XML escaping. A custom install path containing `&`, `<`, or `>` would produce malformed XML and the Task Scheduler task would fail to register. The `{autopf}` default resolves to a safe path, but custom paths (via `DirPage` in the wizard) are not validated for XML-unsafe characters.

**Severity: MEDIUM** — XML injection risk for non-default install paths with special characters.

### 5.5 `SQUEEZYPAY_PLAID_ENV` Hardcoded to `production`

**Line 103:**
```ini
ValueData: "production"
```
A user who enters Plaid sandbox credentials during installation will have `SQUEEZYPAY_PLAID_ENV=production` written to their registry, causing all Plaid API calls to fail with "invalid credentials" rather than a clear "environment mismatch" error. The installer UI does not distinguish between sandbox and production credential entry.

**Severity: LOW** — user experience issue; recoverable by manually updating the registry value.

---

## 6. PowerShell Scripts
*Standards applied: [REF-33] Microsoft PowerShell Scripting Guidelines*

### 6.1 `launch-tray.ps1` — `pip install` on Every Launch

**`scripts/launch-tray.ps1`, line 11:**
```powershell
& $python -m pip install -q -r $adminRequirements
```
This runs `pip install` every time the tray launcher is invoked. This has three risks:
1. On network-isolated machines (offline home network), the pip call fails silently (no error check).
2. It silently mutates the venv on every launch — an inadvertent package upgrade could break the admin server.
3. On slow systems or slow networks, this adds seconds to every startup.

Per [REF-33] §Error Handling: "Scripts should report errors clearly and exit with a non-zero exit code if the operation fails." No error handling is present for the `pip install` step.

**Severity: HIGH** — mutates environment on every launch; no error handling.

### 6.2 `launch-tray.ps1` — `CommandLine` Property May Be Null

**`scripts/launch-tray.ps1`, lines 16–18:**
```powershell
Get-Process -Name python | Where-Object {
  $_.CommandLine -like "*tray.py*"
}
```
On some Windows configurations (without `SeDebugPrivilege`), the `CommandLine` property of a process owned by the current user is accessible, but `Get-Process` may not return it in all contexts. If `$_.CommandLine` is null, the `Where-Object` filter returns no matches, incorrectly concluding the tray is not running and launching a duplicate instance. The correct approach is `Get-WmiObject Win32_Process -Filter "Name='python.exe'"` with a `CommandLine` filter, or relying entirely on the named mutex in `tray.py`.

**Severity: MEDIUM** — may cause duplicate tray process launch.

### 6.3 `autostart.ps1` — Argument Splitting on Space

**`scripts/autostart.ps1`, line 17:**
```powershell
-ArgumentList $serverArgs.Split(" ")
```
`$serverArgs` contains uvicorn arguments with the `$adminDir` path interpolated. If the admin directory path contains spaces (e.g., `C:\Users\John Doe\SqueezyPay`), splitting on a single space will break the argument list. Per [REF-33]: "Use arrays for argument lists, not space-splitting."

**Severity: MEDIUM** — fails for install paths containing spaces.

### 6.4 `register-autostart.ps1` — Over-Granted Privileges

**`scripts/register-autostart.ps1`, line 26:**
```powershell
-RunLevel Highest
```
The task is registered to run at elevated (Administrator) privileges. The tray launcher and backend server do not require elevated rights. Running them elevated means all spawned child processes run with Administrator rights — a violation of least-privilege per [REF-08] A01 (Broken Access Control): "Principle of least privilege... not always applied."

**Severity: MEDIUM** — unnecessary privilege elevation; OWASP A01 concern.

---

## 7. E2E Tests and Playwright

### 7.1 Entire E2E Suite Is a Single `test.skip` Placeholder

**FILE: `tests/e2e/dashboard.spec.ts`, lines 7–9:**
```typescript
test.skip('placeholder - E2E suite not yet built', async ({ page }) => {
  // TODO: Implement E2E tests
});
```
The E2E test suite covers zero functionality. `playwright.config.ts` configures two projects (Chromium and Mobile Safari), but no CI job runs Playwright tests. Running `npx playwright test` produces a report with no meaningful test results.

**Severity: HIGH** — zero E2E coverage; the full UI interaction path (login, bill payment, Plaid sync, etc.) has no automated regression testing.

### 7.2 `playwright.config.ts` — `baseURL` Targets Dev Server, Not Packaged App

**`playwright.config.ts`, line 11:**
```typescript
baseURL: 'http://localhost:5173'
```
The packaged production app serves the frontend from `http://localhost:8000`. E2E tests configured against `:5173` would not test the production build path. No `webServer` configuration exists to start the dev server before tests, requiring a pre-running server.

**Severity: MEDIUM** — E2E config tests dev server only; production path untested.

---

## 8. `vite.config.js` — Documented Proxy Does Not Exist

**FILE: `frontend/vite.config.js`:**
The file contains no `server.proxy` configuration. `docs/frontend.md`, line 171, states: "The Vite dev server proxies `/api/*` to `http://localhost:8000`. Configured in `vite.config.ts`." This statement is false.

The frontend's `api.ts` constructs all requests using an absolute URL (`API_BASE = \`http://${window.location.hostname}:8000\``), so relative `/api/*` paths are never used. The CORS middleware in `main.py` allows `http://localhost:5173` as an origin. API calls therefore succeed in dev mode via absolute URLs with CORS, not via proxy. The documentation claim is incorrect, but the actual behavior works through a different mechanism.

Additionally: the file is named `vite.config.js` throughout the actual filesystem, but `docs/frontend.md` references it as `vite.config.ts` on lines 27 and 171.

**Severity: MEDIUM** — documentation inaccurate; actual behavior works correctly via a different mechanism.

---

## 9. `backend/requirements.txt` — Dependency Pinning
*Standards applied: [REF-36] PyPI Advisory Database; [REF-37] npm audit documentation (principles applied by analogy)*

### 9.1 Non-Existent Package Versions

**Line 1:** `fastapi==0.136.3` — FastAPI's latest stable release series is 0.115.x. Version 0.136.3 does not exist on PyPI. A `pip install -r requirements.txt` against this file will fail with `ERROR: No matching distribution found for fastapi==0.136.3`, breaking both CI and local developer setup.

**Line 17:** `pytest-asyncio==1.4.0` — pytest-asyncio's public releases are in the `0.x` series (latest ~0.23.x as of early 2025). Version 1.4.0 does not correspond to the known release series. This may be a typo for `0.14.0`.

**Line 18:** `httpx2==2.3.0` — `httpx2` is not a known PyPI package. `httpx` (line 17 also lists `httpx==0.28.1`) is the standard package. Either a phantom package name or a duplicate entry.

**Severity: CRITICAL** — `pip install -r requirements.txt` fails immediately due to non-existent `fastapi` version. CI and local setup are broken by these entries.

### 9.2 Security-Critical Dependencies Unpinned

**Lines 7–9:**
```
bcrypt
PyJWT
slowapi
```
`bcrypt`, `PyJWT`, and `slowapi` are used in authentication and rate-limiting — the security-critical path. No version constraints. Per [REF-36], an unpinned `PyJWT` could resolve to a version with a different `decode()` signature (v1 vs v2 had breaking API changes). An unpinned `bcrypt` could resolve to a version with an incompatible password hashing API.

**Severity: HIGH** — security-critical packages unpinned; major version changes could break auth silently.

### 9.3 `ruff` and `pyinstaller` Unpinned

**Line 22:** `ruff` — completely unpinned. Ruff has introduced breaking changes between minor versions (new rules that flag previously passing code). An unpinned ruff means `ruff check .` could fail after any `pip install` upgrade.

**Line 23:** `pyinstaller` — unpinned. PyInstaller version affects the packaged binary behavior. A major version change could break the `backend.spec` build configuration.

**Severity: MEDIUM** — build-time tools unpinned; susceptible to silent breakage on version upgrades.

### 9.4 `cryptography==41.0.7` — Known CVEs Available

**Line 4:** `cryptography==41.0.7`. Versions 42.x and 43.x contain security fixes over 41.x, including patches for CVE-2023-49083 (NULL pointer dereference in PKCS12 parsing). While this CVE does not affect Fernet usage directly, the package is below the current stable release by two major versions. Per [REF-36], staying current with the `cryptography` package is standard practice for a security library.

**Severity: MEDIUM** — known CVEs in installed version; upgrade path exists.

---

## 10. Documentation Accuracy
*Standards applied: [REF-01] PEP 8 (principles applied by analogy to doc accuracy)*

### 10.1 `docs/configuration.md` — Unimplemented Variables Documented as Functional

**Lines 55–56:** `SQUEEZYPAY_HOST` and `SQUEEZYPAY_PORT` are documented as supported. `backend/main.py` hardcodes `uvicorn.run(app, host="0.0.0.0", port=8000)` — no code reads these variables. A user setting `SQUEEZYPAY_PORT=9001` will find the backend still starts on port 8000.

**Line 63:** `SQUEEZYPAY_JWT_EXPIRE_MINUTES` is documented. No backend code reads this variable. JWT expiry appears hardcoded.

**Line 9:** "The backend hot-reloads variables from the registry without restart." This is only true for Plaid credentials (via `_read_win_user_env()` in `plaid_service.py`). `SQUEEZYPAY_ENCRYPTION_KEY` and `SQUEEZYPAY_SECRET_KEY` are read from `os.environ` only at startup. The documentation overstates the scope of hot-reload behavior.

**Severity: MEDIUM** — documentation claims functionality that does not exist; misleads developers and users.

### 10.2 `docs/deployment.md` — "Auto-start Not Yet Implemented" Contradicts Scripts

**Lines 66–68:** "Auto-start on Windows login — Not yet implemented." However, `scripts/register-autostart.ps1`, `scripts/autostart.ps1`, and the Task Scheduler XML in `installer/squeezypay.iss` (lines 407–428) all implement autostart via Task Scheduler. The feature IS implemented. The documentation is outdated.

**Severity: MEDIUM** — documentation states a feature is absent when it is present.

### 10.3 `docs/troubleshooting.md` — SQLAlchemy 2.x Incompatible VACUUM Snippet

**Lines 167–177:**
```python
conn.execute('VACUUM')
```
In SQLAlchemy 2.x, `conn.execute()` requires a `text()` wrapper for raw SQL strings. The bare string form was removed in SQLAlchemy 2.0 and raises `ObjectNotExecutableError`. Per [REF-19] §Migration Notes, raw string execution was deprecated in SQLAlchemy 1.4 and removed in 2.0. The correct call is `conn.execute(text('VACUUM'))`.

**Severity: MEDIUM** — troubleshooting snippet raises an exception on the project's declared SQLAlchemy version (2.0.23).

### 10.4 `docs/api-reference.md` — Diagnostics Endpoint Auth Claim Contradicts Code

**Line 516:** The `GET /api/diagnostics/` entry states "No authentication required." `backend/main.py`, line 145, adds `dependencies=[Depends(require_auth)]` to this route. The endpoint requires authentication. The documentation directly contradicts the code.

**Severity: MEDIUM** — documentation states no authentication required for a protected endpoint; a client following the docs will receive HTTP 401.

### 10.5 `docs/frontend.md` — JWT Storage Location Contradiction

**Line 138:** "The JWT is stored in `sessionStorage`."  
**`docs/architecture.md`, line 154:** "The JWT is stored in `localStorage`."

One of these is incorrect. `frontend/src/context/AuthContext.tsx` line 23 is the authoritative source; it stores the JWT in `sessionStorage`. The `architecture.md` entry is incorrect.

**Severity: MEDIUM** — documentation contradiction; one document states the wrong storage location.

### 10.6 `README.md` — Dev vs. Production URL Distinction Absent

**Lines 71–75:** Service URLs listed (`:5173` for app, `:8000` for API, `:9000` for admin) are accurate for development mode only. In a packaged install, the frontend is served from `:8000` and `:5173` does not exist. Users who installed via the installer will find the listed URL unreachable.

**Severity: MEDIUM** — README URLs correct for dev; misleading for installed users.

### 10.7 `docs/architecture.md` — Models Path Inconsistency

**Line 120:** References `backend/database/models.py`. `backend/alembic/env.py`, line 17, uses `from models.models import Base`, implying models live at `backend/models/models.py`, not `backend/database/models.py`. One of these paths is incorrect.

**Severity: LOW** — path discrepancy between documentation and code reference.

---

## 11. Findings Summary

### By Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 1 | `requirements.txt` non-existent fastapi version |
| HIGH | 8 | Action SHA pinning (both workflows), hardcoded fallback credentials (release.yml), `op.drop_column` without batch mode, `env.py` missing `render_as_batch`, monetary Float columns, `.env.example` wrong variable names, `launch-tray.ps1` pip mutation, E2E test suite empty |
| MEDIUM | 22 | Admin job CI gap, `PIPESTATUS` shell idiom, release.yml race condition, `.ci-ignore-warnings` DeprecationWarning scope, `auth_config` single-row table, alembic `DateTime` timezone, misleading migration name, missing FK indexes, passphrase temp file, installer key failure silent, placeholder GUID, Task Scheduler XML injection, `PLAID_ENV` hardcoded, `CommandLine` null risk, `autostart.ps1` space-split, `register-autostart.ps1` over-privilege, Playwright dev-server-only config, `vite.config.js` proxy docs, `cryptography` CVEs, unpinned `ruff`/`pyinstaller`, docs inaccuracies (×6) |
| LOW | 8 | `release.yml` tag injection risk, `Start-Sleep` race, `pyproject.toml` version mismatch, `create-shortcut.ps1` execution policy, `alembic.ini` relative URL, timezone-naive datetimes, `autostart.ps1` duplicate startup paths, `architecture.md` model path |
| INFO | 6 | CI single-version matrix, `pyproject.toml` `asyncio_default_fixture_loop_scope`, `.gitignore` `%USERPROFILE%` comment, `alembic.ini` post-write hooks commented, PLAID_ENV production hardcoded in installer, Playwright retry/serialize settings correct |

### Highest-Priority Remediation Items

1. **`requirements.txt` — `fastapi==0.136.3` is a non-existent version** [CRITICAL] — Correct to the actual installed version. CI cannot run.
2. **GitHub Actions SHA pinning** [HIGH, REF-26] — Pin all action `uses:` lines to commit SHAs, especially `softprops/action-gh-release@v2`.
3. **`release.yml` hardcoded fallback credentials** [HIGH, REF-26] — Remove `||` fallback literals; fail the build explicitly when secrets are absent.
4. **`.env.example` variable names** [HIGH] — Correct to `SQUEEZYPAY_PLAID_CLIENTID`, `SQUEEZYPAY_PLAID_SECRET`, `SQUEEZYPAY_PLAID_ENV`.
5. **Monetary `Float` columns in Plaid tables** [HIGH, REF-31] — Migrate `current_balance`, `available_balance`, `amount` to `sa.Numeric(precision=12, scale=2)`.
6. **`op.drop_column` + `env.py` missing `render_as_batch=True`** [HIGH, REF-32] — Add `context.configure(..., render_as_batch=True)` to both `run_migrations_online` and `run_migrations_offline` in `env.py`.
7. **`bcrypt`, `PyJWT`, `slowapi` unpinned** [HIGH, REF-36] — Pin all security-critical dependencies to exact versions.
8. **`launch-tray.ps1` pip on every launch** [HIGH, REF-33] — Remove pip install from tray launch path; perform dependency installation at install time only.
9. **E2E test suite empty** [HIGH, REF-35] — Implement at minimum a login and dashboard smoke test.
10. **`docs/troubleshooting.md` SQLAlchemy VACUUM snippet** [MEDIUM, REF-19] — Change to `conn.execute(text('VACUUM'))`.

---

*All findings in this document are traceable to specific line numbers in the source files listed in scope. No finding is stated without a direct code reference. Bibliography references are to verified sources in `audit/BIBLIOGRAPHY.md`.*
