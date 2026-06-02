# SqueezyPay - Architecture Decision Log

## Vision and Origin

SqueezyPay is a household bill management and personal finance dashboard that lives
on the home network and is accessible from any device in the house. It is a private,
self-hosted utility - not a product for distribution.

**The problem it solves** - Managing household finances is fragmented. Credentials
are scattered across notebooks, spreadsheets, and browser autofill. Paying bills
means hunting down URLs, navigating forgot-password flows, and manually reconciling
what got paid and what didn't. There is no single place to see the full financial
picture, track spending habits, or have an honest conversation about where the money
is going.

SqueezyPay is the single source of truth for household finances. Every bill, every
credential, every payment record, every transaction - all in one place, accessible
from any device on the home network.

**The goal** - When it's time to pay bills, any household member can open SqueezyPay
from their phone, tablet, laptop, or PC, see exactly what's due, navigate to the
right place in one click, log the confirmation number, and be done. No hunting,
no friction, no spreadsheets.

---

## Core Product Philosophy

**Household-first design** - This app is built for a family, not a single user.
Every UX decision should ask: "Can a non-technical household member use this
without explanation?" Simplicity is a feature.

**Security without paranoia** - Credentials and payment methods are encrypted at
rest. The app never leaves the home network. No cloud sync, no external accounts,
no third-party data sharing beyond what is explicitly required (Plaid for bank
data). The threat model is a stranger on the internet - not a household member.

**One-click to action** - Every bill should be payable in the fewest possible
clicks. The dashboard is the launchpad. If a user has to navigate more than two
screens to pay a bill, the UX has failed.

**Data over assumption** - The blame graph and budget tracking are only useful if
the data is accurate and complete. Automatic data ingestion (Plaid) is preferred
over manual entry wherever possible. Manual entry is a fallback, not a strategy.

**Build to grow** - The POC is a bill dashboard. The full vision includes bank
integration, spending analytics, budget targets, and net worth tracking. Every
architectural decision should leave room for that growth without requiring a rewrite.

---

## Technology Stack

| Decision | Why |
|---|---|
| Python (FastAPI) | Clean, fast, lightweight REST API. Excellent documentation. Easy to run as a background service on Windows. Strong ecosystem for encryption and data handling. |
| SQLite | No server to manage. Single file database. More than sufficient for household-scale data. Portable and easy to back up. |
| React (frontend) | Component model is well-suited to a dashboard. Runs in any browser. PWA support for mobile home screen install. Large ecosystem. |
| Fernet encryption (cryptography library) | Industry-standard symmetric encryption for credentials and payment methods at rest. Simple API, well-audited. |
| Plaid API | Industry-standard bank data aggregator. Powers Venmo, Cash App, Robinhood. Free developer tier covers personal use. Supports Example Credit Union. Legal, stable, designed for this use case. |
| PWA (Progressive Web App) | Enables "Add to Home Screen" on iPhone and Android - looks and feels like a native app. No App Store, no install, no maintenance. Works on any browser. |

---

## Security

| Decision | Why |
|---|---|
| Credentials encrypted at rest (Fernet) | Plaintext credentials in a database are unacceptable even for a private app. Fernet provides authenticated encryption - tampering is detectable. |
| Encryption key in environment variable | The key never lives in the codebase or the database. Stored as a system environment variable on the host machine only. |
| App bound to local network only | FastAPI server binds to the local network interface, not 0.0.0.0. The app is unreachable from outside the home network without explicit configuration. |
| Plaid credentials never stored | The Plaid OAuth flow handles the Example Credit Union login handshake. ECU credentials are never transmitted to or stored by SqueezyPay. |
| No authentication layer (Phase 1) | The app is on a private home network. The threat model does not require user login for Phase 1. This is a conscious, documented tradeoff - not an oversight. User accounts may be added in a later phase if kids are given network access. |

---

## Architecture

| Decision | Why |
|---|---|
| FastAPI backend + React frontend | Clean separation of concerns. Backend owns data, encryption, and Plaid integration. Frontend owns display and user interaction. They communicate via REST API. |
| SQLite via SQLAlchemy ORM | SQLAlchemy provides a clean abstraction over the database. Switching from SQLite to Postgres (if ever needed) requires only a connection string change. |
| Service layer between routes and database | Route handlers are thin. Business logic lives in service classes. This makes testing and future changes clean. |
| Repository pattern for data access | Database queries are isolated in repository classes. Nothing outside the repository layer writes raw SQL. |
| Plaid integration as an isolated service | PlaidIntegrationService owns all Plaid API communication. Nothing else in the app knows about Plaid. Swapping or removing it later requires changing only one class. |
| React component-per-feature structure | Each major feature (dashboard, bills, vault, transactions, blame graph) is its own component tree. Features don't bleed into each other. |
| Environment variables for all secrets | Encryption key, Plaid credentials, and any future API keys live in a .env file that is gitignored. Never committed. |

---

## Known Tech Debt

| Item | Description | Priority |
|---|---|---|
| `BillRepository` missing | `BillService` queries the ORM directly instead of going through a repository, violating the pattern used by every other service. Create `BillRepository` to match. | Before Phase 2 |
| `Income` model unused | Model defined and migration-ready but no API, service, or UI. Placeholder for Phase 1 income tracking (REQ-010). | Resolve when building REQ-010 |
| `TransactionCategory` model unused | Seeded in `db.py` but never exposed. Will be wired up in Settings screen (REQ-015). | Resolve when building REQ-015 |
| Mobile payment history | Table layout scrolls off-screen on mobile. Needs card/condensed layout for small screens. | Phase 1 quality pass |
| Starlette httpx warning | `StarletteDeprecationWarning` from `starlette.testclient` - not our code. Requires FastAPI upgrade to resolve. | Low - third-party |

---

## Design Pattern Standards

All backend code follows these patterns consistently. New code must conform.

| Pattern | Where Applied | Rule |
|---|---|---|
| Service layer | All business logic | Services receive a `db` session via constructor injection. No raw DB access outside services. |
| Repository pattern | All database access | Repositories are the only layer that touches SQLAlchemy models directly. Services call repositories, never the ORM directly. |
| Dependency injection | FastAPI routes | Database sessions are injected via `Depends(get_db)`. Services are instantiated inside route handlers with the injected session. |
| Singleton | Shared stateful objects | `EncryptionService` is a module-level singleton (lazy-initialized). One instance for the lifetime of the process. |
| Separation of concerns | All layers | Routes validate input and call services. Services contain logic and call repositories. Repositories do CRUD. Nothing bleeds across layers. |

**Frontend patterns:**
- One component tree per major feature (bills, vault, transactions, etc.)
- Shared state lives in React Context, not prop-drilled through component trees
- API calls are isolated in `src/utils/api.js` - no `fetch()` calls inside components

---

## Logging Strategy

Structured logging is built in from day one to support the future admin dashboard (Phase 4).

**Backend:**
- All logging goes through `core/logging_config.py`
- Each service module gets its own named logger: `get_logger("squeezypay.services.bills")`
- Console output: plain text (human-readable during development)
- File output: JSON (machine-readable, for admin dashboard consumption)
- Log file: `backend/logs/squeezypay.log` — rotating, 5MB max, 5 backups kept
- Log meaningful events: creates, updates, deletes, warnings for not-found cases
- Do NOT log sensitive data: never log passwords, encryption keys, or full credential records

**Log levels:**
- `INFO` — normal operations (bill retrieved, credential created, server started)
- `WARNING` — unexpected but non-fatal states (record not found on update/delete)
- `ERROR` — failures that need attention (encryption errors, DB errors)

**Future admin dashboard** will read `squeezypay.log` and display a live log viewer. The JSON format (timestamp, level, service, message) is the contract.

---

## UX Principles

These govern every UI decision. Non-negotiable.

| Principle | Rule |
|---|---|
| Wife test | Every screen must be usable by a non-technical person with zero explanation. If it needs a label, add the label. If it needs a tooltip, add the tooltip. Assume nothing. |
| One-click to action | The most common task (paying a bill) must never require more than two screens. The dashboard is the launchpad. |
| Dark mode | The app supports light and dark mode. Dark mode is toggled by the user and the preference is persisted in localStorage. Default is system preference. |
| Desktop first, iOS parity | Design for desktop first. Maintain as much parity with iOS as possible. Android is out of scope. Features that only work on desktop (browser extension, etc.) are acceptable but must be clearly scoped as desktop-only. |
| No jargon | Labels, buttons, and messages use plain English. No technical terms visible to end users. |
| Forgiving UI | Destructive actions (delete, deactivate) require a confirmation step. No accidental data loss. |

---

## Data Flow

```
Browser (any device on home network)
  -> React frontend (served by FastAPI or separate dev server)
  -> REST API calls to FastAPI backend
  -> Route handler (thin - validates input, calls service)
  -> Service layer (business logic)
  -> Repository layer (database read/write)
  -> SQLite database

Plaid flow:
  -> User triggers "refresh transactions" in UI
  -> Frontend calls /api/plaid/transactions
  -> PlaidIntegrationService calls Plaid API
  -> Plaid fetches live data from Example Credit Union
  -> Transactions stored/updated in SQLite
  -> Response returned to frontend
```

---

## Branching Strategy

Solo project, no collaborators. Work directly off `dev`. No feature branches, no PRs. Commit and push when it feels right.

---

## Product / UX

| Decision | Why |
|---|---|
| Friction removal hierarchy for bill payment | The primary job of the app is to remove friction. There are four levels, in priority order:
1. **Ideal:** Automated payment - user clicks "pay" and the app handles everything (requires biller API - Phase 1+ skip).
2. **Fallback 1:** Auto-login - app opens biller login page and injects credentials automatically (requires desktop browser extension - planned, not yet built).
3. **Fallback 2:** Assisted login - app opens the biller's payment page URL and displays stored credentials (username + password) with copy buttons so the user can paste manually. This is the current implemented behavior.
4. **Last resort:** Home page + credentials - app opens the biller's home page and surfaces credentials. Used when no payment URL is stored.

**Current credential UX (Phase 1):** The payment workflow modal shows a "Show Credentials" toggle. When expanded, username and password are each shown in their own field with a copy button. User copies one, switches tab, pastes, comes back, copies the other. Acknowledged as poor UX - a second-pass design discussion is explicitly wanted before this is considered final.

**Mobile (iOS) credential limitation:** iOS clipboard holds one item at a time. There is no path to auto-fill credentials from a PWA into another Safari tab. The copy-paste flow requires two round trips between tabs. This is an open known issue with no good solution at the PWA layer. A native iOS app with Credential Provider Extension could solve it but that is out of scope. |
| Platform targets | Desktop (Windows PC/laptop) first. iOS (iPhone/iPad) second. Android explicitly out of scope - no household members use Android. Browser extension features are desktop-only and should be clearly marked as such. PWA features should work on both desktop and iOS. |
| PWA for mobile | A home screen icon that opens the app directly is the closest thing to a native app without an App Store submission. Essential for the "pay bills from your phone" use case. |
| Blame graph by card, not by person | Cards are objective facts in the transaction data. Assigning blame by person requires a mapping that could cause friction. Card-level data is accurate and still tells the story. Users can draw their own conclusions about whose card is whose. |
| Automatic Plaid categorization | Plaid returns merchant category codes with every transaction. Using these as the default category saves enormous manual effort and makes the blame graph useful from day one. Users can override categories. |
| Bill amount: expected vs. actual | Fixed bills (Netflix) always match. Variable bills (Example Electric Co, electric) never do. Tracking both gives an accurate picture of projected vs. real cash flow. |
| Income tracked alongside expenses | Spending percentages are meaningless without income context. Budget targets require knowing what the total is. Income is a first-class data point, not an afterthought. |
