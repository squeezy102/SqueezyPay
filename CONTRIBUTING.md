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

**Warning gate:** CI scans all test output for unapproved warnings. Any warning not listed in `.ci-ignore-warnings` will fail the build. If your change introduces a new warning from a third-party library you cannot fix, add it to `.ci-ignore-warnings` with a comment explaining why it is accepted.

**Manual installer test (Windows):** To verify a packaged install on a clean machine, use the Windows Sandbox scripts:
```powershell
# Enable Windows Sandbox (one-time, requires admin + reboot)
.\scripts\sandbox\enable_sandbox.ps1

# Build installer locally, then open a clean sandbox
python scripts/sandbox/run_sandbox_test.py --installer dist\SqueezyPay-Setup.exe
```
The sandbox boots, installs the app silently, and the exerciser script verifies the backend starts and responds correctly.

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
- `SQUEEZYPAY_SECRET_KEY` values
- Plaid credentials
- Database files (`*.db`, `*.sqlite`)

If you discover a security issue, open a private issue or contact the maintainer directly rather than filing a public bug report.

## Documentation

SqueezyPay maintains documentation in two places:

| Location | Purpose | Priority |
|---|---|---|
| [GitHub Wiki](https://github.com/squeezy102/SqueezyPay/wiki) | User-facing setup, configuration, usage guides — readable without cloning | **Primary** |
| [`docs/`](docs/) | Same content mirrored into the repo — available offline and colocated with code | Secondary |

**Both must be kept in sync.** The Wiki is authoritative when they diverge. When updating documentation, update the Wiki first, then mirror the change to `docs/`. Never update only one side.

---

## Project management

SqueezyPay uses GitHub-native tooling as the primary PM layer. Local `.md` files provide narrative context, but the authoritative task list lives on GitHub.

| Tool | Purpose |
|---|---|
| [Issues](https://github.com/squeezy102/SqueezyPay/issues) | Bug reports, feature requests, known limitations |
| [Milestones](https://github.com/squeezy102/SqueezyPay/milestones) | Release scope — each milestone maps to a versioned release |
| [Project board](https://github.com/squeezy102/SqueezyPay/projects) | Backlog → In Progress → In Review → Done view across all issues |
| [Discussions](https://github.com/squeezy102/SqueezyPay/discussions) | Architecture decisions, open-ended design questions, ADRs |
| [Releases](https://github.com/squeezy102/SqueezyPay/releases) | Versioned installer downloads with auto-generated release notes |

### Linking PRs to issues

Use `Closes #N` in the PR body to auto-close the linked issue when the PR merges to master:

```
## Summary
- Fix passphrase bootstrap race on first install

Closes #7
```

This moves the issue to Done on the project board automatically.

### Filing issues

Before opening a new issue, check [existing issues](https://github.com/squeezy102/SqueezyPay/issues) — especially open and closed ones. If you're unsure whether something is a bug, start a [Discussion](https://github.com/squeezy102/SqueezyPay/discussions) first.

## Questions

Open a [Discussion](https://github.com/squeezy102/SqueezyPay/discussions) or an [Issue](https://github.com/squeezy102/SqueezyPay/issues) depending on whether it's a question or a defect. Check existing threads first.
