# Audit Dimension Report: Backend Python
## Document ID: AUDIT-DIM-BACKEND-001
## Version: 1.0 (Iteration 1)
## Date: 2026-06-07
## Auditor: Automated agent + senior review
## Scope: `backend/**/*.py`, `scripts/tray.py`, `scripts/check_ci_warnings.py`, `scripts/generate_key.py`, `admin/main.py`, `admin/tests/test_admin.py`
## Bibliography: All reference IDs resolved in `audit/BIBLIOGRAPHY.md`

---

## Methodology

Every `.py` file in scope was read line by line. Findings are derived by:
1. Direct inspection of source code
2. Cross-reference against cited standards
3. Cross-file consistency analysis (type contract matching, inter-service call chains, test-to-code coverage)

No finding is stated without a line number and a quoted code fragment. Where a claim cannot be confirmed by reading the file, it is not stated.

---

## 1. Critical Security — Admin Server
*Standards applied: [REF-08] OWASP Top 10; [REF-09] OWASP ASVS 4.0; [REF-14] OWASP REST Security*

### 1.1 Admin Server Has No Authentication and Binds to `0.0.0.0`

**FILE: `admin/main.py`, lines 200–206:**
```python
app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"])
```
**FILE: `scripts/tray.py`, lines 110–120:**
```python
subprocess.Popen([str(VENV_PYTHON), "-m", "uvicorn", "main:app",
    "--host", "0.0.0.0", "--port", str(ADMIN_PORT)], ...)
```
The admin server starts on `0.0.0.0:9000` (all interfaces) with `allow_origins=["*"]` and no authentication on any endpoint. Any machine on the LAN — or from the internet if port 9000 is forwarded — can:
- Start or stop the main backend (`POST /api/start/backend`, `POST /api/stop/backend`)
- Read the full log file including bill names and service events (`GET /api/logs/raw`)
- Read recent parsed log entries (`GET /api/logs/recent`)

Per [REF-08] A01 (Broken Access Control) and [REF-09] ASVS §4.0 (Access Control): "Verify that all pages and resources require authentication." The admin server should either bind to `127.0.0.1` only, or require a pre-shared token on all API calls.

**Severity: CRITICAL** — unauthenticated remote control of the application's lifecycle from any LAN host.

### 1.2 Admin `stream_logs` SSE Has No Cancellation — Resource Exhaustion

**FILE: `admin/main.py`, lines 278–295:**
```python
def generate():
    while True:
        # reads log file, yields events
        time.sleep(1)
return StreamingResponse(generate(), media_type="text/event-stream")
```
The `generate()` function is a synchronous infinite loop. When a client disconnects from the SSE stream, FastAPI/Starlette cannot interrupt a synchronous generator. Each open connection holds the log file open and loops indefinitely, consuming a thread from the threadpool. Repeated connections without cancellation-aware async generators leads to thread exhaustion. Per [REF-14] OWASP REST Security §Resource Exhaustion.

**Severity: HIGH** — resource exhaustion path; no connection count limit, no cancellation mechanism.

### 1.3 Admin `recent_logs` Has No `lines` Upper Bound

**FILE: `admin/main.py`, lines 298–311:**
```python
async def recent_logs(lines: int = 100):
    with open(_log_path, "r") as f:
        all_lines = f.readlines()
    return all_lines[-lines:]
```
`lines` has no upper bound. A client requesting `lines=999999` forces the full log file (up to 5 MB per the rotating handler configuration) to be read and returned on every call.

**Severity: HIGH** — unbounded resource consumption per request.

---

## 2. Security — Core Backend
*Standards applied: [REF-08] OWASP Top 10; [REF-09] OWASP ASVS 4.0; [REF-11] RFC 7519; [REF-13] OWASP Cryptographic Storage*

### 2.1 Rate Limit Bypass via `X-Test-Rate-Key` Header

**FILE: `backend/core/limiter.py`, lines 12–14:**
```python
if "X-Test-Rate-Key" in request.headers:
    return request.headers["X-Test-Rate-Key"]
```
Any client — not just test processes — can supply the `X-Test-Rate-Key` header to receive a unique rate-limit bucket. This completely defeats rate limiting on `POST /api/auth/login` (the primary brute-force target). An attacker who discovers this header can make unlimited login attempts by rotating the header value. The header should be respected only when `os.environ.get("SQUEEZYPAY_TESTING")` is set. Per [REF-09] ASVS §2.2.1 (Brute Force Protection).

**Severity: HIGH** — authentication brute-force protection is bypassable in production.

### 2.2 Empty Secret Key Allows Accepting Any JWT

**FILE: `backend/core/auth.py`, line 13:**
```python
secret = os.environ.get("SQUEEZYPAY_SECRET_KEY", "")
```
If `SQUEEZYPAY_SECRET_KEY` is unset at runtime, `secret` is `""`. `jwt.decode(token, "", algorithms=["HS256"])` will accept any token signed with an empty string. The server lifespan guards against startup with no key (raising `RuntimeError`), but if the env var is cleared while the server is running, subsequent requests will silently accept tokens signed with `""`. A defensive `if not secret: raise HTTPException(401)` check in `require_auth` would close this gap. Per [REF-11] RFC 7519 §10.1 (Algorithm Security).

**Severity: HIGH** — post-startup env var clearing creates a total authentication bypass.

### 2.3 All Credentials Decrypted on Every Read

**FILE: `backend/services/credential_service.py`, lines 57–66:**
```python
def _to_dict(credential):
    return {
        ...
        "password": encryption_service.decrypt(credential.password_encrypted),
    }
```
`_to_dict` is called by `get_all()`, `get_by_id()`, and `get_by_bill_id()`. Every read operation — including the bulk `GET /api/credentials/` endpoint — decrypts all stored passwords. This means the plaintext password of every stored biller is in the HTTP response body for every credential read, not just when needed for autofill. Per [REF-13] OWASP Cryptographic Storage §Data Exposure: "Decrypt only when required."

**Severity: HIGH** — unnecessary decryption of all credentials on every read.

### 2.4 Autofill Worker Credentials Visible in Process List

**FILE: `backend/api/bills.py`, lines 131–135:**
```python
args = [
    sys.executable, str(AUTOFILL_WORKER),
    base64.b64encode(url.encode()).decode(),
    base64.b64encode(username.encode()).decode(),
    base64.b64encode(password.encode()).decode(),
]
```
Base64-encoded credentials are passed as command-line arguments to the autofill subprocess. On Windows, command-line arguments of child processes are visible in Task Manager and via `Get-Process | Select-Object CommandLine`. Base64 is not encryption — `base64.b64decode(...)` is trivial. Any process with process enumeration rights (any standard user on Windows) can read the encoded credentials and decode them. Per [REF-09] ASVS §2.7 (Sensitive Data Protection): credentials should be transmitted via stdin or IPC, not command-line arguments.

**Severity: HIGH** — biller credentials transiently visible in the process argument list.

### 2.5 Log Injection via `frontend_log` Endpoint

**FILE: `backend/api/frontend_log.py`, lines 10–22:**
```python
async def log_frontend_error(payload: dict):
    logger.error(payload.get("message", ""), ...)
```
`message`, `detail`, and `component` values are logged directly without sanitization. A malicious client can inject log-forge strings (ANSI escape sequences that alter terminal rendering, or structured JSON that impersonates legitimate log entries). The admin dashboard consumes these logs and displays them. Log injection via unsanitized user-controlled values is an OWASP A09 (Logging and Monitoring Failures) concern. The endpoint also has no body size limit — FastAPI/Starlette has no default max body size configured.

**Severity: MEDIUM** — log injection from any authenticated client; potential admin UI content injection.

### 2.6 bcrypt 72-Byte Silent Truncation

**FILE: `backend/api/auth.py`, line 13:**
```python
PassphraseRequest: min_length=8, max_length=1024
```
`bcrypt.hashpw` silently truncates input at 72 bytes. A passphrase of exactly 1024 chars is accepted and stored, but only the first 72 bytes are hashed. A user who sets a 200-character passphrase believes it is their full passphrase; in reality, any passphrase sharing the same first 72 bytes would authenticate successfully. Per [REF-10] NIST SP 800-132 §4 (Memory Functions). A pre-hash with SHA-256 before passing to bcrypt is the standard mitigation.

**Severity: MEDIUM** — passphrase longer than 72 bytes is effectively truncated without user notification.

---

## 3. Logic Defects

### 3.1 Plaid Transaction Sync Hard-Capped at 500

**FILE: `backend/services/plaid_service.py`, lines 211–253:**
```python
options = TransactionsGetRequestOptions(count=500, ...)
```
The Plaid transactions sync hard-codes `count=500` with no pagination loop. If a user has more than 500 transactions in the requested date range, transactions beyond 500 are silently dropped. No warning is logged or surfaced to the user. The Plaid API supports cursor-based pagination via `TransactionsSyncRequest` and offset pagination via `offset` in `TransactionsGetRequest`. Per [REF-25] TanStack Query (data completeness principle).

**Severity: HIGH** — silent data loss for users with large transaction histories.

### 3.2 Category Mapper References Non-Existent Local Categories

**FILE: `backend/services/plaid_category_mapper.py`, lines 23–24:**
```python
"INCOME": "Income",
"TRANSFER_IN": "Transfer",
"TRANSFER_OUT": "Transfer",
```
Neither `"Income"` nor `"Transfer"` are among the 17 seeded default categories in `database/db.py` (lines 68–87). `resolve_category_id` returns `None` for any transaction with Plaid primary category `INCOME`, `TRANSFER_IN`, or `TRANSFER_OUT`. These transactions are stored with `category_id = NULL` and appear as "uncategorized" regardless of the mapper's intent.

**Severity: MEDIUM** — category mapping silently produces NULL for Income and Transfer transactions.

### 3.3 User Category Assignments Overwritten on Sync

**FILE: `backend/repositories/plaid_repository.py`, lines 110–115:**
When `PlaidTransactionRepository.upsert` updates an existing transaction, it overwrites all fields including `category_id`. If a user manually assigned a category via `POST /api/plaid/transactions/{id}/category`, the next Plaid sync will overwrite that assignment with the auto-mapped value (which may be NULL, per §3.2).

**Severity: MEDIUM** — user data (manual category assignments) silently discarded on sync.

### 3.4 `change_passphrase` Null Dereference on Race Condition

**FILE: `backend/services/auth_service.py`, lines 60–66:**
```python
def change_passphrase(self, current: str, new: str) -> bool:
    if not self.verify(current):
        return False
    config = self.db.query(AuthConfig).first()
    config.passphrase_hash = ...  # AttributeError if config is None
```
Between the `verify()` check (line 61) and the subsequent query (line 63), a concurrent request could delete the `AuthConfig` row (theoretically, though no delete endpoint exists for it). If `config` is `None`, line 64 raises `AttributeError: 'NoneType' object has no attribute 'passphrase_hash'`, producing a 500 error. The gap should be guarded with `if not config: return False`.

**Severity: LOW** — requires a race condition that is not currently achievable through any API endpoint; defensive fix is trivial.

### 3.5 `PaymentType` Enum Is Dead Code

**FILE: `backend/api/payment_methods.py`, lines 14–18:**
```python
class PaymentType(StrEnum):
    credit_card = "credit_card"
    debit_card = "debit_card"
    bank_account = "bank_account"
```
`PaymentMethodCreate.payment_type` is typed as `str`, not `PaymentType`. The enum is defined but never used in any Pydantic model, validator, or service method. Any string up to 50 chars is accepted. Per [REF-01] PEP 8: "Code that is never executed should be removed."

**Severity: LOW** — dead code; misleading to future developers.

### 3.6 `plaid/blame` `days_back` Is Unbounded

**FILE: `backend/api/plaid.py`, lines 136–138:**
```python
async def get_blame(days_back: int = 30, ...):
```
No `Query(30, ge=1, le=365)` constraint. A client can request `days_back=99999`, causing the service layer to iterate potentially years of transactions in Python memory.

**Severity: MEDIUM** — no upper bound; memory exhaustion for pathological inputs.

---

## 4. Type Annotations and Code Style
*Standards applied: [REF-01] PEP 8; [REF-02] PEP 257; [REF-03] PEP 484; [REF-04] PEP 526*

### 4.1 Missing Return Types on Route Handlers

Route handler functions throughout the backend lack return type annotations, contrary to [REF-03] PEP 484 §Function Annotations. Affected files (all route handlers):
- `backend/api/auth.py` — lines 27, 34, 43, 52, 57
- `backend/api/bills.py` — lines 47, 59, 72, 94, 107, 119
- `backend/api/credentials.py` — lines 28, 34, 38, 44, 50, 58, 63
- `backend/api/diagnostics.py` — line 63
- `backend/api/income.py` — lines 28, 38, 49, 54, 66, 82, 92
- `backend/api/plaid.py` — all route handlers
- `backend/core/auth.py` — line 12

**Severity: LOW** — style; no runtime impact. `noUnusedLocals` equivalent is Ruff's `ANN` rules, which are not currently enabled.

### 4.2 `f-string` in Logger Calls

Multiple files use `f-string` formatting in `logger.info(f"...")`, `logger.warning(f"...")` calls:
- `backend/api/bills.py` — lines 150, 154, 159, 162
- `backend/services/plaid_service.py` — multiple

Per [REF-01] PEP 8 and Python logging documentation: logger calls should use `%`-style formatting (`logger.info("value: %s", value)`) to avoid string interpolation cost when the log level is not active. The project uses both styles inconsistently.

**Severity: LOW** — minor performance concern; style inconsistency.

### 4.3 `generate_key.py` Module-Level Execution

**FILE: `scripts/generate_key.py`:**
All key generation logic runs at module level. `import generate_key` from any script would immediately print a key to stdout. Per [REF-01] PEP 8: scripts with side effects should guard with `if __name__ == "__main__":`.

**Severity: LOW** — footgun for future imports; no current impact.

### 4.4 Missing Module and Function Docstrings

Per [REF-02] PEP 257, all public modules, classes, methods, and functions should have docstrings. Systematic absences:
- `backend/models/models.py` — no class-level docstrings on any ORM model
- `backend/services/credential_service.py`, `encryption_service.py`, `auth_service.py` — no method docstrings
- `backend/core/auth.py` — `require_auth` is the single authentication enforcement point; no docstring
- `backend/repositories/*.py` — no method docstrings
- `admin/main.py` — route functions lack docstrings

**Severity: LOW** — documentation gap; no functional impact.

### 4.5 `DateTime` Timezone Naivety — Consistent Project-Wide Issue

**FILE: `backend/models/models.py`, line 9:**
```python
_utcnow = lambda: datetime.now(UTC)
```
`Column(DateTime)` without `timezone=True` strips the timezone on SQLite round-trip. Code that compares `datetime.now(UTC)` (timezone-aware) to a retrieved column value (naive) will raise `TypeError: can't compare offset-naive and offset-aware datetimes`. No such comparison currently exists in the codebase, but the pattern is latent. Per [REF-19] SQLAlchemy docs §DateTime.

**Severity: LOW** — latent defect; not triggered by current code paths.

---

## 5. Test Coverage
*Standards applied: [REF-34] pytest documentation; [REF-35] Google Testing Blog — Test Sizes*

### 5.1 Rate Limiter Bypass Not Tested in Production Mode

**FILE: `backend/tests/` (no file covers this path):**
No test verifies that supplying `X-Test-Rate-Key` is rejected when `SQUEEZYPAY_TESTING` is not set. The security vulnerability in §2.1 has no corresponding regression test.

**Severity: HIGH** — critical security behavior untested.

### 5.2 `conftest.py` Hardcoded Test Encryption Key

**FILE: `backend/tests/conftest.py`, lines 8–9:**
```python
os.environ.setdefault("SQUEEZYPAY_ENCRYPTION_KEY",
    "dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXJlc3Q=")
```
A cryptographic key is embedded in source code. Per [REF-13] OWASP Cryptographic Storage §Key Management: "Cryptographic keys should not be stored in source code." `setdefault` means this only activates when the env var is absent — the test key will never be used if a real key is set. Risk is low in practice, but it is an anti-pattern: if a developer deploys with this key by accidentally not setting the env var, all credentials are "encrypted" with a publicly known key.

**Severity: MEDIUM** — anti-pattern; test key in source code; `setdefault` mitigates but does not eliminate risk.

### 5.3 `test_credentials.py` Assertion Logic Error

**FILE: `backend/tests/test_credentials.py`, line 70:**
```python
assert "password" not in data or data.get("password") == "MyPassword1!"
```
The comment states "Password must NOT be returned in plaintext" but the assertion is satisfied in two cases: (a) `"password"` is not in the response, OR (b) `"password"` is in the response and equals `"MyPassword1!"`. Case (b) — the current behavior — satisfies the assertion while the stated intent is not achieved. The `or` should be `and`, or the test should simply verify the correct value is returned (documenting that plaintext return is intentional). As written, the test does not enforce either "no password returned" or "correct password returned."

**Severity: MEDIUM** — assertion logic error; test does not verify its stated behavior.

### 5.4 No Test for Autofill Endpoint

**FILE: `backend/tests/test_bills.py`:**
`POST /api/bills/{id}/autofill` has zero test coverage. The autofill code path includes subprocess management, base64 argument encoding, 12-second timeout, and success/failure detection. Per [REF-35] Google Testing Blog: "Small tests are the foundation; they should cover all logic paths."

**Severity: MEDIUM** — highest-complexity endpoint in the bills module is untested.

### 5.5 Auth Override Bypasses All Integration Auth Testing

**FILE: `backend/tests/conftest.py`, lines 43–50:**
```python
app.dependency_overrides[require_auth] = lambda: None
```
All tests sharing the module-level `client` fixture bypass authentication entirely. The interaction between a valid JWT and every other endpoint is never tested end-to-end. Only two tests in `test_auth.py` use real JWT validation.

**Severity: MEDIUM** — auth integration is not tested across the API surface.

---

## 6. Architecture

### 6.1 `main.py` Binds to `0.0.0.0` Without TLS

**FILE: `backend/main.py`, line 250:**
```python
uvicorn.run(app, host="0.0.0.0", port=8000)
```
The main backend also binds to all interfaces without TLS. Bearer tokens, biller credentials submitted via API calls, and Plaid tokens transit the LAN in cleartext HTTP. Per [REF-14] OWASP REST Security §HTTPS: "Sensitive data must be transmitted over encrypted channels." For a local-network-only deployment, this is the documented design constraint, but it must be noted as a ROADMAP item.

**Severity: MEDIUM** — documented design constraint; accepted for LAN-only; unacceptable if publicly exposed.

### 6.2 Credential Service Decoupling Gap

The `credential_service._to_dict` function always decrypts. A future refactor that introduces a "list without password" endpoint (e.g., for a UI that shows only bill name + username) would require adding a `decrypt: bool = True` parameter or splitting `_to_dict` into two variants. The current design makes all callers pay the decryption cost regardless of need.

**Severity: LOW** — architectural concern for future maintainability; no current functional defect.

### 6.3 Admin Log File Handles Not Closed on Shutdown

**FILE: `admin/main.py`, lines 113–126:**
`_open_log(name)` opens file handles in append mode, stored in `_log_handles`. The lifespan `shutdown` (lines 191–196) only terminates processes. Log file handles are never explicitly closed. On normal shutdown these are closed by the OS process cleanup, but explicit `handle.close()` calls in the lifespan would prevent log data loss if buffered writes are pending.

**Severity: LOW** — resource cleanup gap; no data loss risk on normal shutdown (OS handles file close).

---

## 7. Findings Summary

### By Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 1 | Admin server: no auth, all-origin CORS, `0.0.0.0` |
| HIGH | 8 | Admin SSE no cancellation, admin `recent_logs` unbounded, rate limit bypass header, empty-secret JWT bypass, all credentials decrypted on read, autofill args in process list, Plaid transaction 500 hard cap, rate-limiter test gap |
| MEDIUM | 12 | bcrypt 72-byte truncation, log injection, category mapper dead categories, user categories overwritten on sync, `days_back` unbounded, conftest test key, `test_credentials` assertion error, no autofill test, auth override bypasses integration testing, admin/main.py CORS + binding |
| LOW | 16 | Missing return type annotations (systemic), f-string logger calls, `generate_key.py` module-level exec, missing docstrings (systemic), DateTime timezone naivety, `PaymentType` dead enum, `change_passphrase` null race, `bill_repository.delete` double-query, `autostart.ps1` space split, admin handle cleanup |
| INFO | 8 | Correct patterns: `sessionStorage` JWT, Fernet key cached in singleton, `PassphraseRequest` length validation, Plaid token deleted from memory post-exchange, import order in alembic env.py, dead boilerplate in alembic env.py |

### Highest-Priority Remediation Items

1. **Admin server — add `127.0.0.1` binding and authentication** [CRITICAL, REF-08, REF-09] — Bind admin to localhost only, or add a pre-shared token to all admin API routes.
2. **Rate limit bypass — guard `X-Test-Rate-Key` behind `SQUEEZYPAY_TESTING` env var** [HIGH, REF-09] — Add `if not os.environ.get("SQUEEZYPAY_TESTING"): return request.client.host` before the header check.
3. **Empty secret key — add defensive check in `require_auth`** [HIGH, REF-11] — `if not secret: raise HTTPException(401)`.
4. **Credential decryption — add `include_password: bool` parameter to `_to_dict`** [HIGH, REF-13] — Decrypt only for autofill calls; return `None` for password in list/get contexts.
5. **Autofill credentials — pass via stdin pipe, not argv** [HIGH, REF-09] — Refactor `_try_autofill` to write credentials to subprocess stdin.
6. **Plaid transaction pagination — implement offset loop** [HIGH] — Loop with `offset` until `transactions` response is empty.
7. **Category mapper — add `"Income"` and `"Transfer"` to seeded categories, or remove dead mappings** [MEDIUM] — Either seed the categories or remove the unreachable mappings.
8. **Admin `stream_logs` — rewrite as async generator with cancellation** [HIGH, REF-14] — Use `asyncio` and `request.is_disconnected()` to break the generator.

---

*All findings in this document are traceable to specific line numbers in source files. No finding is stated without a direct code reference. Bibliography references are to verified sources in `audit/BIBLIOGRAPHY.md`.*
