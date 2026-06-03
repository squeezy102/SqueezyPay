# SqueezyPay - Roadmap

Priority labels used throughout this document:

- **REQUIRED** - app is not useful without this
- **GOOD START** - makes the POC worth showing
- **GOOD NEXT STEP** - natural follow-on after the core is working
- **NICE TO HAVE** - meaningfully improves the app but not urgent
- **STRETCH GOAL** - worth building eventually; not in the near-term plan

---

## Engineering Foundations (Pre-Phase 2)

These are infrastructure and tooling items that must be in place before Phase 2 begins. They are cross-cutting concerns, not features.

| Item | Notes | Priority |
|---|---|---|
| ~~REQ-016: Authentication (household passphrase, bcrypt, JWT sessions)~~ | ~~Phase 1 item - not yet built~~ DONE | ~~REQUIRED~~ |
| ~~TypeScript migration (frontend)~~ | ~~Migrate before the codebase grows further~~ DONE | ~~REQUIRED~~ |
| ~~Alembic database migrations~~ | ~~Schema will evolve; manual migrations are risky~~ DONE | ~~REQUIRED~~ |
| ~~GitHub Actions CI gate~~ | ~~Automated test gate on push to dev, PR to master; 80% coverage threshold; branch protection on master~~ DONE | ~~REQUIRED~~ |
| ~~Playwright~~ | ~~E2E tests for critical flows~~ Scaffolded at repo root; tests/e2e/ ready; full suite to be written as features accumulate DONE | ~~GOOD NEXT STEP~~ |
| ~~React Query (TanStack Query)~~ | ~~Add before more API call patterns accumulate~~ DONE | ~~REQUIRED~~ |
| ~~React Hook Form~~ | ~~Add before more forms are written~~ DONE | ~~REQUIRED~~ |
| pytest + pytest-asyncio | Backend test infrastructure | REQUIRED |
| ~~Vitest~~ | ~~Frontend unit test infrastructure~~ 38 tests: 16 billUtils.ts + 22 api.ts DONE | ~~REQUIRED~~ |
| ~~Ruff (Python linter)~~ | ~~pyproject.toml configured, all violations fixed, wired into CI~~ DONE | ~~REQUIRED~~ |
| ~~ESLint + typescript-eslint~~ | ~~Frontend linter configured for .ts/.tsx, wired into CI~~ DONE | ~~REQUIRED~~ |
| Recharts | Needed for Phase 2+ charts; add before Phase 2 begins | GOOD NEXT STEP |
| PyJWT | Add when authentication is implemented | Add with auth |
| slowapi | Rate limiting on login endpoint | Add with auth |

---

## Phase 0 - POC (1-2 coding sessions)

**Goal:** Something real enough to show. Any household member can open it on
their phone, see the household bills, and navigate to a biller's payment page
in one click. No backend required. No database. No encryption. Just a working
frontend with real data.

| Feature | Requirement | Priority |
|---|---|---|
| Static bill dashboard with real bills and due dates | REQ-001 | REQUIRED |
| One-click navigation to biller payment pages | REQ-001 | REQUIRED |
| Accessible from any device on home network | REQ-014 | REQUIRED |
| Clean, usable UI - not an embarrassment | - | REQUIRED |
| PWA manifest so it's installable on mobile | REQ-014 | GOOD START |

**What Phase 0 is NOT:**
- No backend server
- No database
- No encryption
- No Plaid
- No login
- Bills are hardcoded for the demo

**Done when:** A household member installs it on their phone and navigates to a biller's payment page.

---

## Phase 1 - Real Foundation

**Goal:** Replace the hardcoded POC with a real backend and database.
The app now stores and serves real data. Credentials and payment methods
are encrypted. Payment history is logged.

| Feature | Requirement | Priority |
|---|---|---|
| FastAPI backend + SQLite database | - | REQUIRED |
| Bill management (add, edit, delete) | REQ-002 | REQUIRED |
| Payment history log with confirmation numbers | REQ-003 | REQUIRED |
| Secure credential vault (encrypted) | REQ-004 | REQUIRED |
| Payment method storage (encrypted) | REQ-004 | REQUIRED |
| ~~Authentication (household passphrase)~~ | REQ-016 | ~~REQUIRED~~ DONE |
| Due date alerts on dashboard | REQ-013 | GOOD START |
| Notification infrastructure (SendGrid + SMS gateway setup) | REQ-017 | GOOD NEXT STEP |
| Income tracking | REQ-010 | GOOD START |
| Transaction categories | REQ-009 | REQUIRED |
| Settings screen (basic) | REQ-015 | GOOD NEXT STEP |

**Done when:** All household bills are in the database, credentials are
in the vault, and payment history is being logged with confirmation numbers.

---

## Phase 2 - Bank Integration and Spending Visibility

**Goal:** Connect your financial institution via Plaid. The blame graph becomes real.
Spending data flows automatically.

| Feature | Requirement | Priority |
|---|---|---|
| Plaid OAuth connection flow | REQ-006 | REQUIRED |
| Bank account balances displayed | REQ-006 | REQUIRED |
| Transaction history per account | REQ-006 | REQUIRED |
| Automatic Plaid category mapping | REQ-009 | GOOD START |
| Blame graph - by card | REQ-007 | REQUIRED |
| Blame graph - by category | REQ-007 | REQUIRED |
| Blame graph - drill down to transactions | REQ-007 | GOOD NEXT STEP |
| Transaction search and filter | REQ-006 | GOOD NEXT STEP |
| Manual category override per transaction | REQ-009 | NICE TO HAVE |
| Merchant category override rules | REQ-009 | NICE TO HAVE |
| Spend and deposit notifications | REQ-017 | GOOD NEXT STEP |
| Recurring transaction detection - auto-suggest bills from Plaid data | REQ-018 | GOOD NEXT STEP |

**Done when:** The blame graph is live with real transaction data from your
financial institution and the household can have an honest spending conversation
backed by numbers.

---

## Phase 3 - Budget and Projections

**Goal:** Add forward-looking financial planning. The app goes from
"what did we spend" to "what are we going to spend and can we afford it."

| Feature | Requirement | Priority |
|---|---|---|
| Spending projections (30/60/90 day) | REQ-005 | GOOD NEXT STEP |
| Budget targets per category | REQ-008 | GOOD NEXT STEP |
| Budget vs. actual progress bars | REQ-008 | GOOD NEXT STEP |
| Over-budget visual indicators | REQ-008 | NICE TO HAVE |
| Net worth snapshot | REQ-011 | NICE TO HAVE |
| Historical net worth line chart | REQ-011 | NICE TO HAVE |
| Blame and spend report notifications | REQ-017 | GOOD NEXT STEP |
| Custom report notifications | REQ-017 | NICE TO HAVE |
| Cash flow calendar view (income + bills on a calendar) | REQ-005 | NICE TO HAVE |

**Done when:** The household has a monthly budget set per category and
can see at a glance how they're tracking against it.

---

## Phase 4 - Analytics and Polish

**Goal:** Make the data useful over time. Year-over-year trends, deeper
spending insights, and a polished experience.

| Feature | Requirement | Priority |
|---|---|---|
| Year-over-year spending comparison | REQ-012 | NICE TO HAVE |
| Savings goals | - | NICE TO HAVE |
| Shared vs. personal expense tagging | - | NICE TO HAVE |
| User accounts / household member profiles | - | STRETCH GOAL |
| External asset / liability tracking | REQ-011 | STRETCH GOAL |
| ~~External push notifications (bill reminders)~~ | ~~REQ-013~~ | Covered by REQ-017 |
| ~~Dark mode~~ | - | ~~STRETCH GOAL~~ DONE |
| Export data to CSV | - | STRETCH GOAL |
| Card scanning for payment method entry (camera + client-side OCR) | REQ-004 | STRETCH GOAL |
| Community-maintained OAuth biller catalog | - | STRETCH GOAL |
| Companion browser extension - Edge, Chrome, Safari (seamless biller login from vault) | - | STRETCH GOAL |
| Streamlined setup / installer script | - | GOOD NEXT STEP |
| ~~Local admin dashboard (service management)~~ | - | ~~STRETCH GOAL~~ PULLED FORWARD - BASIC VERSION DONE |
| Auto-start on Windows login | - | REQUIRED (next session) |
| Admin dashboard - metrics and graphs | - | GOOD NEXT STEP |
| Admin dashboard - CPU/memory monitoring | - | NICE TO HAVE |
| ~~Unified logging — FastAPI request middleware + admin filter chip~~ | ~~Request middleware DONE; admin filter chip still pending~~ DONE - [REQUEST] entry + [RESPONSE] exit lines, REQ/RES filter chips in admin | ~~GOOD NEXT STEP~~ |
| Light mode UI overhaul | - | TECH DEBT (blocked on branding) |
| Notes popover on bill cards (replace inline truncated text) | - | TECH DEBT |
| Passphrase change UI in Settings | - | TECH DEBT |
| Mobile payment history — card layout for small screens | - | TECH DEBT |

**Admin Dashboard** - A browser-based operations console (pinned tab at localhost:9000).
Vision: one-stop shop for monitoring, debugging, troubleshooting, logging, diagnostics, and graphs.
This is a developer/owner tool — not user-facing. Grows over time.

Current state (basic):
- Service status cards (backend, frontend) with start/stop buttons
- Live log viewer with level filtering
- Desktop shortcut launcher

Planned additions (in order):
- Auto-start on Windows login (next session - high priority)
- Unified logging: FastAPI request middleware, `[REQUEST]` label, filter chip in log viewer
- Uptime tracking per service
- CPU and memory usage graphs
- Request rate and error rate metrics
- Database stats (row counts, DB file size)
- Quick links (API docs, app, database browser)

---

## Implementation Concerns

Foresights and potential complications to keep in mind before reaching
the relevant phase. Remove an entry once it has been resolved or designed around.

- **Phase 1 - Encryption key management:** The Fernet key must be generated
once and stored as an environment variable. If the key is lost, all encrypted
data is unrecoverable. Claude Code must generate a clear setup step that walks
through key generation and storage. Consider a one-time setup script.

- **Phase 2 - Plaid free tier limits:** Plaid's free developer tier has
transaction history limits and rate limits. Confirm these are acceptable for
household use before building the integration. As of 2025 the free tier
supports personal development use - verify this hasn't changed.

- **Phase 2 - Financial institution Plaid support:** Confirm your financial
institution is on Plaid's supported institutions list before building the
integration. This should be verified before Phase 2 begins, not during.

- **Phase 2 - Plaid OAuth on local network:** Plaid's OAuth redirect URL must
be a reachable address. On a local network this may require configuring the
redirect to the host PC's local IP. Test this early in Phase 2.

- **Phase 3 - Projection accuracy:** Projections are only as good as the data.
Variable bills (utilities) will always be estimates. Make sure the UI communicates
this clearly - projections are approximations, not guarantees.

- **Phase 4 - User accounts:** Adding user accounts after the fact is a significant
architectural change if the data model wasn't designed for it. When building
Phase 1, ensure bill and transaction records have an optional `created_by` field
even if it isn't used yet. This prevents a painful migration later.

- **Phase 1+ - Local DNS naming:** Users should not have to remember an IP address
to access the app. Implement local DNS (e.g., `squeezypay.local` or `squeezypay`
via .local mDNS or router DNS config). This is a UX priority for household use
but is not blocking Phase 1 - can be added once the backend is stable.
