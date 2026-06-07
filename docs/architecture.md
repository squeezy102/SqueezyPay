# Architecture

## Overview

SqueezyPay is a three-tier web application running entirely on a single PC on a home network. There is no cloud dependency. The frontend, backend, and database all run locally.

```
Browser (any device on LAN)
        │
        │ HTTP
        ▼
┌─────────────────────┐
│  React / Vite       │  :5173  (dev) or static build (prod)
│  TypeScript         │
│  TanStack Query     │
└─────────┬───────────┘
          │ HTTP / JSON
          ▼
┌─────────────────────┐
│  FastAPI            │  :8000
│  SQLAlchemy ORM     │
│  Alembic migrations │
└─────────┬───────────┘
          │ SQLite
          ▼
┌─────────────────────┐
│  squeezypay.db      │  backend/squeezypay.db
└─────────────────────┘
          │
          │ HTTPS (Plaid SDK)
          ▼
     Plaid API

          │ subprocess (autofill)
          ▼
  Playwright / Chromium
  (autofill_worker.py)
```

## Backend

**Entry point:** `backend/main.py` — starts Uvicorn, mounts all routers.

**Routers** (`backend/api/`):
- `auth.py` — login, logout, token refresh
- `bills.py` — bill CRUD + `POST /{bill_id}/autofill` (Playwright biller login)
- `payments.py` — payment history log
- `credentials.py` — encrypted credential vault
- `income.py` — income stream management
- `settings.py` — app settings
- `plaid.py` — Plaid link flow, account/transaction sync, blame graph
- `admin.py` — service status and log viewer (admin dashboard)

**Services** (`backend/services/`):
- `plaid_service.py` — all Plaid API calls, transaction parsing, blame computation
- `encryption_service.py` — Fernet encrypt/decrypt wrapper
- `plaid_category_mapper.py` — maps Plaid's `personal_finance_category` taxonomy to internal categories

**Scripts** (`backend/scripts/`):
- `generate_key.py` — generates the Fernet encryption key
- `autofill_worker.py` — Playwright worker spawned by the autofill endpoint; navigates to the biller URL, fills username/password fields, then blocks until the browser disconnects
- `diagnose_autofill.py` — CLI diagnostic tool: `python scripts/diagnose_autofill.py <url>`. Runs the field-detection logic and reports which selectors matched, useful for debugging biller sites that fail autofill.

**Repositories** (`backend/repositories/`): data access layer over SQLAlchemy models. Routes call services; services call repositories. Raw queries do not appear in routes.

**Database** (`backend/database/`):
- `models.py` — all SQLAlchemy models
- `db.py` — session factory and `get_db()` dependency
- `alembic/` — migration history

**Logging** (`backend/core/logging_config.py`): structured JSON-compatible log lines. Request middleware logs every `[REQUEST]` and `[RESPONSE]`. Sensitive values (tokens, keys, passwords) are never logged.

## Frontend

**Entry point:** `frontend/src/main.tsx` → `App.tsx`.

**Routing:** client-side tab state via `useState` in `App.tsx`. No React Router. The active tab name is a string (`"dashboard"`, `"accounts"`, etc.) that maps to a component import.

**State management:** TanStack Query v5 for all server state. No Redux or Zustand. Local UI state (modals, form state) lives in component state.

**Components** (`frontend/src/components/`):
- `NavBar.tsx` — sidebar (desktop) + top bar (mobile), union type `NavTab | NavDivider`
- `Dashboard.tsx` — account balances, bills, income, spend snapshots, AI callout placeholder
- `Accounts.tsx` — Plaid connection flow, account balance cards
- `Transactions.tsx` — transaction table with date/amount/merchant
- `Bills.tsx` — unified bills hub: Overview, Pay Bills, Payment History, Manage Billers sub-views
- `CredentialModal.tsx` — standalone modal for creating/editing biller credentials; used by `Bills.tsx` and `LogPaymentModal`
- `Spending.tsx` — blame graph by category and account
- `Income.tsx` — income stream management
- `Settings.tsx` — passphrase change, sync preferences
- `Budget.tsx` — budget targets (not yet active)
- `PlaidLinkButton.tsx` — wraps `usePlaidLink`; renders Plaid Link modal on click

**API layer** (`frontend/src/utils/api.ts`): all fetch calls. No component makes a fetch call directly.

**Types** (`frontend/src/types.ts`): TypeScript interfaces matching backend serializers.

## Data flow — Plaid sync

```
User clicks "Sync Transactions"
        │
        ▼
PlaidService.sync_transactions(db, item_id, days_back)
        │
        ├─ Decrypt access token (Fernet)
        ├─ Call Plaid transactions.get
        ├─ For each transaction:
        │    ├─ Resolve account (PlaidAccountRepository)
        │    ├─ Map personal_finance_category → internal category_id
        │    └─ Upsert transaction (PlaidTransactionRepository)
        └─ Return { added, updated }
```

Access tokens are decrypted in memory, used for the API call, and the decrypted value is deleted immediately after. The encrypted form is the only persistent representation.

## Encryption

Fernet (AES-128-CBC + HMAC-SHA256) via the Python `cryptography` library. One key, stored as `SQUEEZYPAY_ENCRYPTION_KEY` in Windows User environment variables.

Encrypted values are stored as base64 strings. The key is read from the environment on each call to `encryption_service.encrypt()` or `encryption_service.decrypt()` — it is never stored in memory beyond the operation.

Encrypted fields: biller credentials, payment method details, Plaid access tokens.

## Single-institution design

SqueezyPay supports exactly one connected financial institution at a time. This is an intentional design constraint, not a limitation to be worked around.

**Rationale:**
- A household typically uses one primary bank. The app is optimized for depth of insight into one institution, not breadth across many.
- Multi-institution support introduces complexity in the UI (institution picker on every screen), data model (all foreign keys gain an institution dimension), and reconciliation logic (deduplication across institutions).
- The supplemental CSV/OFX import path is also scoped to the single connected institution, maintaining consistency.

**Enforcement:**
- Backend: `PlaidService.exchange_public_token` checks for an existing `PlaidItem` before accepting a new one. If one exists, it raises `ValueError` → HTTP 409.
- Frontend: `Accounts.tsx` renders `PlaidLinkButton` only when no item is connected. Once connected, the connect affordance is removed entirely from the page.

**Forking guidance:** If you want multi-institution support, remove the guard block in `backend/services/plaid_service.py` (`exchange_public_token`, lines that check `PlaidItemRepository.get_all`) and update `Accounts.tsx` to always render a connect option. You will also need to add institution context to every query and view that currently assumes a single institution.

## CSV / OFX import

Supplemental ingestion for the single connected institution. Not a back door for connecting additional institutions — the import is expected to represent the same accounts already connected via Plaid.

Deduplication strategy: match on date + amount + merchant_name. A transaction imported from CSV that matches an existing Plaid transaction is marked as a duplicate and skipped. The `source` column on `plaid_transactions` records where each row originated (`plaid` or `import`).

## Admin dashboard

A separate FastAPI app running on `:9000`. Provides:
- Service status cards (backend, frontend) with start/stop controls
- Live log viewer with level and source filters

The admin dashboard is a developer/operator tool, not a user-facing feature. It runs independently of the main backend.

## Authentication

Single-user, household passphrase model. On login, the backend validates the bcrypt-hashed passphrase and returns a JWT. All protected routes require `Authorization: Bearer <token>`. The JWT is stored in `localStorage` and expires after a configurable interval (default: 24 hours).

There are no individual user accounts. The household shares one passphrase.

## CI

GitHub Actions runs on push to `dev` and on pull requests to `master`:
- `ruff check` and `ruff format --check` (backend)
- `pytest` with coverage threshold (backend)
- `npm run lint` (frontend)
- `npm test` (frontend, Vitest)

Branch protection on `master` requires CI to pass before merge.
