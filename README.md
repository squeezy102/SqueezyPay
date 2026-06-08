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

SQLite lives at `backend/squeezypay.db` and never leaves your machine. The Plaid access token is encrypted at rest using a key you generate and store as a Windows environment variable. See the [Architecture wiki page](https://github.com/squeezy102/SqueezyPay/wiki/Architecture) for the full design.

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

See the [Getting Started wiki page](https://github.com/squeezy102/SqueezyPay/wiki/Getting-Started) for the full walkthrough: environment variable setup, encryption key generation, dependency install, and first run.

## Key environment variables

| Variable | Purpose |
|---|---|
| `SQUEEZYPAY_ENCRYPTION_KEY` | Fernet key — encrypts credentials and Plaid tokens |
| `SQUEEZYPAY_PLAID_CLIENTID` | Plaid client ID |
| `SQUEEZYPAY_PLAID_SECRET` | Plaid secret |
| `SQUEEZYPAY_PLAID_ENV` | `sandbox` or `production` |

All configuration is via Windows User environment variables (HKCU\Environment). No `.env` file is committed. See the [Configuration wiki page](https://github.com/squeezy102/SqueezyPay/wiki/Configuration).

## Running the app

Start via the system tray launcher — manages all services, no console window:

```powershell
.\scripts\launch-tray.ps1
```

A tray icon appears in the Windows system tray. Right-click for Start All / Stop All / Open Dashboard / Open App. Running it again when already running does nothing — a named mutex prevents duplicate instances.

| Service | URL |
|---|---|
| Admin dashboard | `http://localhost:9000` |
| App (frontend) | `http://localhost:5173` |
| Backend API | `http://localhost:8000` |
| API docs (Swagger) | `http://localhost:8000/docs` |

To access from other devices on your home network, replace `localhost` with your PC's local IP (`ipconfig` → IPv4 Address).

## Documentation

Full documentation lives in the [GitHub Wiki](https://github.com/squeezy102/SqueezyPay/wiki). Wiki source files are in [`wiki/`](wiki/) — edits go there, and CI pushes them to the wiki on every merge to `dev`.

| Page | Contents |
|---|---|
| [Getting Started](https://github.com/squeezy102/SqueezyPay/wiki/Getting-Started) | Install, configure, and run for the first time |
| [Configuration](https://github.com/squeezy102/SqueezyPay/wiki/Configuration) | All environment variables and settings |
| [Architecture](https://github.com/squeezy102/SqueezyPay/wiki/Architecture) | System design, data flow, and key decisions |
| [Database](https://github.com/squeezy102/SqueezyPay/wiki/Database) | Schema, migrations, and data model |
| [API Reference](https://github.com/squeezy102/SqueezyPay/wiki/API-Reference) | All backend endpoints |
| [Frontend](https://github.com/squeezy102/SqueezyPay/wiki/Frontend) | Component structure, routing, and state management |
| [Testing](https://github.com/squeezy102/SqueezyPay/wiki/Testing) | Running backend, frontend, and E2E test suites |
| [Deployment](https://github.com/squeezy102/SqueezyPay/wiki/Deployment) | Serving on your local network |
| [Roadmap](https://github.com/squeezy102/SqueezyPay/wiki/Roadmap) | Planned features and design decisions |
| [Troubleshooting](https://github.com/squeezy102/SqueezyPay/wiki/Troubleshooting) | Common issues and fixes |

## Branching strategy

| Branch | Purpose |
|---|---|
| `master` | Protected. Merges from `dev` at milestones only. CI must pass. |
| `dev` | Integration branch. All feature/fix PRs land here first. |
| `feature/short-description` | Branch from `dev`, PR back to `dev`. |
| `fix/short-description` | Branch from `dev`, PR back to `dev`. |

## Forking

SqueezyPay is designed around a single financial institution. If you fork it and want multi-institution support, remove the guard in `backend/services/plaid_service.py` (`exchange_public_token`) and update `frontend/src/components/Accounts.tsx`. See the [Architecture wiki page](https://github.com/squeezy102/SqueezyPay/wiki/Architecture#single-institution-design) for the full rationale.

Generate a new encryption key. Never reuse a key from another instance.

## Project tracking

| Resource | Link |
|---|---|
| Issues & bugs | [github.com/squeezy102/SqueezyPay/issues](https://github.com/squeezy102/SqueezyPay/issues) |
| Milestones | [github.com/squeezy102/SqueezyPay/milestones](https://github.com/squeezy102/SqueezyPay/milestones) |
| Project board | [github.com/squeezy102/SqueezyPay/projects](https://github.com/squeezy102/SqueezyPay/projects) |
| Discussions | [github.com/squeezy102/SqueezyPay/discussions](https://github.com/squeezy102/SqueezyPay/discussions) |
| Releases & installers | [github.com/squeezy102/SqueezyPay/releases](https://github.com/squeezy102/SqueezyPay/releases) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
