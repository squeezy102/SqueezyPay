# Roadmap

All core phases through Phase 2 are complete. Active work is Phase 2+ extensions (scheduled sync, CSV/OFX import) and Phase 4 admin tooling pulled forward.

## Phase status

| Phase | Status |
|---|---|
| Phase 0 — POC | Complete |
| Phase 1 — Real Foundation | Complete |
| Phase 2 — Bank Integration | Complete |
| Phase 3 — Budget and Projections | Not started |
| Phase 4 — Analytics and Polish | Partially started (admin dashboard pulled forward) |

---

## Phase 2 — Bank Integration and Spending Visibility

**Goal:** Connect your financial institution via Plaid. The blame graph becomes real. Spending data flows automatically.

### Complete

- Plaid OAuth connection flow
- Bank account balances displayed
- Transaction history per account
- Automatic Plaid category mapping
- Blame graph — by category
- Blame graph — by account
- Transaction search and filter
- Manual category override per transaction
- Single-institution enforcement (backend 409 guard + UI constraint)
- Dashboard — account balances, bills, income, spend snapshots
- Bills hub refactor — unified `Bills` tab with Overview, Pay Bills, Payment History, Manage Billers sub-views
- Biller autofill — `POST /api/bills/{id}/autofill` launches Playwright worker; fills username + password fields on biller site (**known limitation:** always opens a new browser window, cannot open a tab in an existing window)
- Credential vault UI — `CredentialModal` for create/edit; credentials auto-displayed in payment modal with Copy buttons

### Phase 2+ backlog

Features in scope for this phase but not yet built.

| Feature | Priority | Notes |
|---|---|---|
| Scheduled balance sync | High | APScheduler job; configurable interval, 4h minimum per Plaid guidelines |
| Scheduled daily transaction sync | High | Replaces manual-only flow |
| CSV/OFX import | High | Supplemental ingestion for the single connected institution |
| Transaction deduplication | Required with CSV/OFX | Match on date + amount + merchant |
| Per-cardholder transaction ownership tagging | Medium | See design note below |
| Blame graph — drill down to transactions | Medium | Click category → see transactions |
| Recurring transaction detection | Medium | Auto-suggest bills from Plaid data |

### Stretch

| Feature | Notes |
|---|---|
| Plaid webhook receiver | Requires public URL or tunnel (ngrok, Cloudflare Tunnel) |
| Spend and deposit notifications | SendGrid + SMS gateway already scaffolded |
| Windows installer | See design note below |

---

## Phase 3 — Budget and Projections

| Feature | Priority |
|---|---|
| Budget targets per category | High |
| Budget vs. actual progress bars | High |
| Spending projections (30/60/90 day) | Medium |
| Over-budget visual indicators | Medium |
| Net worth snapshot | Low |
| Cash flow calendar view | Low |

---

## Phase 4 — Analytics and Polish

| Feature | Priority |
|---|---|
| LLM-assisted insights panel | High |
| Year-over-year spending comparison | Medium |
| Auto-start on Windows login | High |
| Streamlined installer script | Medium |
| Update-available badge in admin dashboard | Medium |
| Export data to CSV | Low |
| Savings goals | Low |

---

## Continuous deployment / update awareness

SqueezyPay is self-hosted — there is no remote server to push to. CD for a home app means the running instance becoming aware of a new release and applying it.

**Planned approach (two phases):**

1. **Update-available badge (Phase 4)** — the admin dashboard polls the GitHub Releases API on startup, compares the running git SHA to the latest release tag, and shows a notification when a newer version exists. No automatic action; the user initiates the update manually.

2. **Auto-update (post-installer)** — once the Windows installer exists, an upgrade path follows naturally: the admin dashboard offers a one-click "pull and restart" that runs `git pull`, `pip install -r requirements.txt`, `npm install`, and `alembic upgrade head` in sequence, then restarts the backend and frontend. Gated on the installer work being complete first.

---

## Windows installer

**Goal:** A user who has never heard of Python, Node, or Alembic should be able to run one file and have a working SqueezyPay on their home network within five minutes. Zero runtime dependencies on the target machine.

**Toolchain:**
- **Inno Setup** — produces `SqueezyPay-Setup.exe`, the single artifact the user downloads and runs
- **PyInstaller** — compiles the FastAPI backend + all Python dependencies into `backend.exe` (no Python required on target)
- **`npm run build`** — produces `frontend/dist/` static files served directly by `backend.exe` (no Node required on target)
- **GitHub Actions** (Windows runner) — builds all of the above and attaches the `.exe` to each GitHub Release

**Install layout:**
```
C:\Program Files\SqueezyPay\
  backend.exe        PyInstaller bundle — FastAPI + uvicorn + all deps
  frontend\          Static build — served by backend.exe via StaticFiles
  admin\             Admin dashboard (separate FastAPI process)
  alembic\           Migration files — needed at runtime for upgrades
  unins000.exe       Inno Setup uninstaller

%APPDATA%\SqueezyPay\
  squeezypay.db      Database — lives here so reinstalls/upgrades preserve data
  logs\              Log files
```

**Installer screens:**
1. Welcome
2. License (MIT)
3. Install location (default: `C:\Program Files\SqueezyPay`)
4. **Select Components** — Core (always installed) + optional Biller Autofill (~150 MB Chromium; checked by default). Description shown to user: *"Attempts to open your biller's login page and fill in your credentials automatically. Works well on some sites, not at all on others — results vary by biller. Experimental."*
5. **Security setup** — encryption key and JWT secret generated automatically, stored as User env vars; user sees confirmation only
6. **Plaid setup (optional)** — explanation of what Plaid is + link to dashboard.plaid.com; fields for Client ID and Secret; prominent "Skip — set this up later" option; stored as User env vars
7. **Passphrase** — choose household login passphrase with confirm field
8. **Options** — "Start automatically on Windows login" (Task Scheduler), "Create desktop shortcut", "Open SqueezyPay when done"
9. Installing (progress)
10. Done

**What the installer does:**
- Extracts binaries and static files to Program Files
- Creates `%APPDATA%\SqueezyPay\` and subdirs
- Generates `SQUEEZYPAY_ENCRYPTION_KEY` (Fernet) and `SQUEEZYPAY_JWT_SECRET`, writes to `HKCU\Environment`
- Writes Plaid credentials to `HKCU\Environment` if provided
- Runs `backend.exe --migrate` (Alembic upgrade head, headless, exits when done)
- Optionally creates Task Scheduler entry via `schtasks /create`
- Creates desktop shortcut opening `http://localhost:8000` in default browser
- Registers uninstaller in Add/Remove Programs

**`backend.exe` modes:**
- `backend.exe` — normal server (serves API + frontend static files on :8000)
- `backend.exe --migrate` — runs Alembic upgrade head and exits; used by installer and future upgrade flow

**Upgrade path:**
- User runs new installer over existing install
- Inno Setup detects existing installation, replaces binaries, preserves `%APPDATA%\SqueezyPay\`
- Installer runs `backend.exe --migrate` to apply any new migrations
- In-app update check (Phase 4) notifies user when a new release is available on GitHub

---

## Design decisions pending

### Per-cardholder spend breakdown

The household has two debit cards (primary + partner) on one shared checking account. The goal is to see what each person spent and where, enabling an honest per-person spending conversation.

**The constraint:** Plaid does not expose which physical card initiated a transaction. Both cards map to the same `plaid_account_id`. Card-level attribution is not available from the API.

**Options being considered:**

**Option A — Manual owner tagging (recommended)**
Add a nullable `owner` enum column (`me` / `partner` / `joint`) to `plaid_transactions`. Surface as a one-tap toggle in the transaction table. The blame view gains an owner dimension.

Pros: Fast to build, accurate (user-verified), no guessing.
Cons: Requires manual effort per transaction. Needs a bulk-tagging flow for the backlog.

Design questions to settle:
- What does the owner toggle look like in the transaction table?
- How should the blame view present the owner breakdown?
- Should manual tags survive a re-sync? (Yes — sync must not clobber manual owner assignments.)
- Should there be a bulk-tag mode for categorizing the backlog?

**Option B — Separate accounts per person** (not currently applicable)
Would only work if each person had their own separate Plaid account (separate checking accounts). In the current setup (shared account, two cards), both last fours map to the same `plaid_account_id`, so this provides no differentiation.

### LLM insights panel

Users supply their own API key for their LLM of choice (Claude, OpenAI, etc.). Design questions:
- Which providers to support? Multi-provider or Claude-only?
- On-demand (button) or background/scheduled?
- Single-shot or stateful conversation?
- Prompt composition: what financial context to include, and how much?

The backend will proxy requests through a thin layer so the API key is stored encrypted server-side and never exposed to the browser. UI must include a disclaimer: "For guidance only. Not financial advice."

### Bank data refresh scheduling

Plaid's recommended minimum refresh interval for balances is 4 hours. Transactions typically settle within 24 hours of posting. The planned implementation:

- `PLAID_BALANCE_SYNC_INTERVAL_HOURS` setting — minimum 4, configurable in Settings tab
- `PLAID_TRANSACTION_SYNC_ENABLED` toggle — daily sync at a configured time
- APScheduler in the backend process (no external task queue)
- Manual sync buttons remain available regardless of schedule settings

Webhook-based sync (immediate on Plaid SYNC_UPDATES_AVAILABLE events) requires a publicly reachable URL, which a home network does not have by default. Webhooks are a stretch goal pending documentation on tunnel options (Cloudflare Tunnel, ngrok).

---

## Known limitations and deferred items

These are tracked as GitHub Issues. Do not work around them — document and move on.

| Issue | Item | Notes |
|---|---|---|
| [#3](https://github.com/squeezy102/SqueezyPay/issues/3) | Autofill documentation pass | Update all docs where autofill is mentioned to flag it as experimental, not guaranteed, accepted in current state |
| [#4](https://github.com/squeezy102/SqueezyPay/issues/4) | Autofill always opens new browser window | Cannot open a tab in an existing browser window — OS/browser limitation, not fixable from the app |
| [#5](https://github.com/squeezy102/SqueezyPay/issues/5) | Biller autofill site compatibility | Works on some sites, fails on others; results vary by biller |
| [#6](https://github.com/squeezy102/SqueezyPay/issues/6) | Admin dashboard dev-only | Admin is not yet packaged into the installer; packaged installs have no admin UI |
| [#7](https://github.com/squeezy102/SqueezyPay/issues/7) | Windows Sandbox not enabled on dev machine | Sandbox test harness (`scripts/sandbox/`) is ready but requires enabling the Containers-DisposableClientVM Windows feature and rebooting |
| [#8](https://github.com/squeezy102/SqueezyPay/issues/8) | VITE_FEEDBACK_EMAIL not documented in .env.example | Bug report mailto path requires this env var; needs documentation |

---

## Completed milestones

### Engineering foundations

| Item | Notes |
|---|---|
| Authentication (bcrypt + JWT) | Household passphrase model |
| TypeScript migration | Full frontend |
| Alembic migrations | Schema version control |
| GitHub Actions CI | pytest + Vitest + ESLint + Ruff; branch protection on master |
| Playwright scaffolding | `tests/e2e/` ready; full suite to grow with features |
| TanStack Query v5 | All server state |
| React Hook Form | All forms |
| pytest (87%+ coverage) | Backend |
| Vitest (38 tests) | Frontend |
| Ruff | Python linting and formatting |
| ESLint + typescript-eslint | Frontend linting |
| Recharts | Chart library for spend graphs |
| Dark mode | System preference, persists per device |
| Admin dashboard | Service start/stop, live log viewer with named filter presets |
| Unified request logging | `[REQUEST]`/`[RESPONSE]` middleware; filter presets in log viewer |
| Passphrase change UI | Settings tab |
| Mobile payment history | Card layout for small screens |
