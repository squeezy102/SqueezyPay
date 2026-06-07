# Roadmap

Current development phase: **Phase 2** (bank integration and spending visibility).

## Phase status

| Phase | Status |
|---|---|
| Phase 0 — POC | Complete |
| Phase 1 — Real Foundation | Complete |
| Phase 2 — Bank Integration | In progress |
| Phase 3 — Budget and Projections | Not started |
| Phase 4 — Analytics and Polish | Not started |

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

### In progress / next

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
| Auto-start on Windows login | High (tech debt) |
| Streamlined installer script | Medium |
| Export data to CSV | Low |
| Savings goals | Low |

---

## Windows installer

**Goal:** A user who has never heard of Python, Node, or Alembic should be able to run one file and have a working SqueezyPay on their home network within five minutes.

**What the installer needs to do:**
1. Check for Python 3.11+ and Node 18+, download and install them silently if missing (winget or direct download)
2. Clone or extract the repo to a user-chosen directory
3. Create the Python virtual environment and run `pip install -r requirements.txt`
4. Run `npm install` in the frontend directory
5. Generate `SQUEEZYPAY_ENCRYPTION_KEY` and `SQUEEZYPAY_JWT_SECRET`, store them as Windows User environment variables
6. Prompt for Plaid credentials (optional — can be skipped and configured later)
7. Run `alembic upgrade head` to initialize the database
8. Create desktop shortcuts for the admin dashboard and the app
9. Optionally register a Task Scheduler entry for auto-start on login
10. Open the app in the browser when done

**Likely implementation:** PowerShell script (`install.ps1`) for the bootstrap layer, which handles prerequisites and environment setup. The script should be runnable by right-clicking and choosing "Run with PowerShell" — no prior terminal experience required.

**Design decisions to settle:**
- Self-contained bundle (Python + Node embedded) vs. system installs? Embedded is simpler for the user but large (~200 MB). System installs are lighter but require more error handling.
- Upgrade path: how does a user update to a new version without losing their database and environment variables?
- Uninstaller: should the installer register an uninstall entry in Add/Remove Programs?

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
| Admin dashboard | Service start/stop, live log viewer |
| Unified request logging | `[REQUEST]`/`[RESPONSE]` middleware, filter chips |
| Passphrase change UI | Settings tab |
| Mobile payment history | Card layout for small screens |
