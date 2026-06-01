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

| Branch | Purpose |
|---|---|
| `master` | Stable milestones only - never commit directly here |
| `dev` | Active development - all PRs target this branch |
| `feature/short-description` | New features or enhancements |
| `fix/short-description` | Bug fixes |
| `docs/short-description` | Documentation changes only |
| `chore/short-description` | Maintenance, cleanup, dependency updates |

---

## Product / UX

| Decision | Why |
|---|---|
| One-click to biller payment page | The primary job of the app is to remove friction from bill paying. Navigating to a biller's site in one click is the minimum viable version of that. |
| PWA for mobile | A home screen icon that opens the app directly is the closest thing to a native app without an App Store submission. Essential for the "pay bills from your phone" use case. |
| Blame graph by card, not by person | Cards are objective facts in the transaction data. Assigning blame by person requires a mapping that could cause friction. Card-level data is accurate and still tells the story. Users can draw their own conclusions about whose card is whose. |
| Automatic Plaid categorization | Plaid returns merchant category codes with every transaction. Using these as the default category saves enormous manual effort and makes the blame graph useful from day one. Users can override categories. |
| Bill amount: expected vs. actual | Fixed bills (Netflix) always match. Variable bills (Example Electric Co, electric) never do. Tracking both gives an accurate picture of projected vs. real cash flow. |
| Income tracked alongside expenses | Spending percentages are meaningless without income context. Budget targets require knowing what the total is. Income is a first-class data point, not an afterthought. |
