# SqueezyPay

A self-hosted personal finance dashboard for households. Connect your financial institution via Plaid to see live account balances, transaction history, and a spending blame graph. Track bills, log payments, manage income streams, and keep credentials in an encrypted local vault — all on your home network, with no cloud dependency.

## What it does

- **Dashboard** — at-a-glance view of account balances, upcoming bills, income streams, and spending snapshots
- **Plaid bank integration** — connect one financial institution to sync live balances and transactions
- **Spending blame graph** — category and account breakdowns of where money went over a rolling window
- **Bill management** — track bills with due dates, overdue alerts, and one-click navigation to biller payment pages
- **Payment history** — log payments with confirmation numbers
- **Income tracking** — configure expected income streams and reconcile against real deposits
- **Credential vault** — AES-Fernet encrypted storage for biller login credentials (username + password per biller)
- **Payment method vault** — store card nicknames and last-four digits; referenced when logging payments
- **PWA** — installs on iPhone and Android from any browser on your home network

## Architecture at a glance

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, SQLite, Alembic |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Data fetching | TanStack Query v5 (React Query) |
| Plaid | `plaid-python` SDK, Transactions + Accounts products |
| Encryption | `cryptography` (Fernet / AES-128-CBC) |
| Testing | pytest, Vitest, Playwright |
| CI | GitHub Actions |

SQLite lives at `backend/squeezypay.db` and never leaves your machine. The Plaid access token is encrypted at rest using a key you generate and store as a Windows environment variable. See [docs/architecture.md](docs/architecture.md) for the full design.

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11 or later |
| Node.js | 18 LTS or later |
| Windows | 10 / 11 (primary target — macOS/Linux works with minor path adjustments) |

A free [Plaid developer account](https://dashboard.plaid.com/) is required to use the bank integration. The app runs without it for bill tracking and credential vault features.

## Quick start

```
git clone https://github.com/your-username/squeezypay.git
cd squeezypay
```

See [docs/getting-started.md](docs/getting-started.md) for the full walkthrough: environment variable setup, encryption key generation, dependency install, and first run.

## Key environment variables

| Variable | Purpose |
|---|---|
| `SQUEEZYPAY_ENCRYPTION_KEY` | Fernet key — encrypts credentials and Plaid tokens |
| `SQUEEZYPAY_PLAID_CLIENTID` | Plaid client ID |
| `SQUEEZYPAY_PLAID_SECRET` | Plaid secret |
| `SQUEEZYPAY_PLAID_ENV` | `sandbox` or `production` |

All configuration is via Windows User environment variables (HKCU\Environment). No `.env` file is committed. See [docs/configuration.md](docs/configuration.md).

## Running the app

```powershell
# Terminal 1 — backend (from /backend)
.\venv\Scripts\Activate.ps1
python main.py

# Terminal 2 — frontend (from /frontend)
npm run dev
```

Or use the admin dashboard at `http://localhost:9000` (see [docs/deployment.md](docs/deployment.md)) to start/stop services from a browser.

| Service | URL |
|---|---|
| App | `http://localhost:5173` |
| Backend API | `http://localhost:8000` |
| API docs (Swagger) | `http://localhost:8000/docs` |
| Admin dashboard | `http://localhost:9000` |

To access from other devices on your home network, replace `localhost` with your PC's local IP (`ipconfig` → IPv4 Address).

## Documentation

| Document | Contents |
|---|---|
| [Getting Started](docs/getting-started.md) | Install, configure, and run for the first time |
| [Configuration](docs/configuration.md) | All environment variables and settings |
| [Architecture](docs/architecture.md) | System design, data flow, and key decisions |
| [Database](docs/database.md) | Schema, migrations, and data model |
| [API Reference](docs/api-reference.md) | All backend endpoints |
| [Frontend](docs/frontend.md) | Component structure, routing, and state management |
| [Testing](docs/testing.md) | Running backend, frontend, and E2E test suites |
| [Deployment](docs/deployment.md) | Serving on your local network |
| [Roadmap](docs/roadmap.md) | Planned features and design decisions |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and fixes |

## Branching strategy

| Branch | Purpose |
|---|---|
| `master` | Protected. Merges from `dev` at milestones only. CI must pass. |
| `dev` | Integration branch. All feature/fix PRs land here first. |
| `feature/short-description` | Branch from `dev`, PR back to `dev`. |
| `fix/short-description` | Branch from `dev`, PR back to `dev`. |

## Forking

SqueezyPay is designed around a single financial institution. If you fork it and want multi-institution support, remove the guard in `backend/services/plaid_service.py` (`exchange_public_token`) and update `frontend/src/components/Accounts.tsx`. See [docs/architecture.md](docs/architecture.md#single-institution-design) for the full rationale.

Generate a new encryption key. Never reuse a key from another instance.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
