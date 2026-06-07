# Contributing to SqueezyPay

SqueezyPay is a household tool built for personal use and shared as open source. Contributions are welcome — bug fixes, documentation improvements, and new features that make sense for a single-household self-hosted finance app.

## Before you start

Read the docs. The architecture and design decisions are documented in [docs/](docs/) and shape what "a good contribution" looks like here.

Key constraints to understand before proposing changes:

- **Single institution** — the app intentionally supports exactly one connected financial institution. See [docs/architecture.md](docs/architecture.md#single-institution-design). Changes that break this constraint will not be merged; changes that make it more configurable (e.g. an opt-in multi-institution mode) may be discussed.
- **Self-hosted, local network** — no cloud dependency, no external accounts, no telemetry. Changes that introduce these will not be accepted.
- **No financial institution names hardcoded** — institution names are always fetched from the user's active Plaid connection or derived from imported data, never hardcoded in source.

## Development setup

See [docs/getting-started.md](docs/getting-started.md) for the full setup walkthrough.

Quick summary:

```powershell
# Clone and install
git clone https://github.com/your-username/squeezypay.git
cd squeezypay

# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head

# Frontend
cd ..\frontend
npm install
```

You will need Plaid API keys to test bank integration features. Start in `sandbox` mode — it provides synthetic bank accounts without real credentials.

## Branching

Branch from `dev`. PR back to `dev`. The maintainer merges `dev` → `master` at milestones.

```
git checkout dev
git pull
git checkout -b feature/your-feature-name
```

## Code style

**Python:**
- Ruff is the linter and formatter. `ruff check .` and `ruff format .` must both pass.
- No `print()` statements — use the logger (`from core.logging_config import get_logger`).
- Never log credentials, tokens, or encryption keys.
- SQLAlchemy models in `backend/database/models.py`. Repositories in `backend/repositories/`. Services in `backend/services/`. New data access must go through repositories, not raw queries in routes.

**TypeScript / React:**
- ESLint must pass: `npm run lint`.
- Tailwind for all styling — no inline `style={}` except for dynamic values that Tailwind can't express.
- TanStack Query for all server state. Don't use `useEffect` + `fetch` for data fetching.
- React Hook Form for all forms.

**Both:**
- No comments that describe what the code does — code should be self-describing. Comments are only for non-obvious constraints, workarounds, or invariants.
- No docstrings on obvious functions.

## Tests

Backend:
```powershell
cd backend
pytest
```

Frontend:
```powershell
cd frontend
npm test
```

E2E (Playwright — requires the app to be running):
```powershell
cd frontend
npx playwright test
```

CI runs all three suites. A PR that drops coverage below the current threshold will not be merged. See [docs/testing.md](docs/testing.md) for details.

## Database migrations

If your change requires a schema change, create an Alembic migration:

```powershell
cd backend
alembic revision --autogenerate -m "short description of change"
```

Review the generated migration before committing. Autogenerate is not always correct — verify the `upgrade()` and `downgrade()` functions manually.

## Pull request checklist

- [ ] Branched from `dev`, targeting `dev`
- [ ] `ruff check .` passes (backend)
- [ ] `ruff format .` passes (backend)
- [ ] `npm run lint` passes (frontend)
- [ ] `pytest` passes (backend)
- [ ] `npm test` passes (frontend)
- [ ] New features have tests
- [ ] Schema changes include an Alembic migration
- [ ] No credentials, keys, or sensitive data in any committed file
- [ ] `SqueezyContext/` and `.claude/` are in `.gitignore` and not committed

## Security

Never commit:
- `.env` files
- `SQUEEZYPAY_ENCRYPTION_KEY` values
- Plaid credentials
- Database files (`*.db`, `*.sqlite`)

If you discover a security issue, open a private issue or contact the maintainer directly rather than filing a public bug report.

## Questions

Open an issue. Check existing issues first — your question may already be answered.
