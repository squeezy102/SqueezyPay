# Contributing to SqueezyPay

SqueezyPay is a household tool built for personal use and shared as open source. Contributions are welcome — bug fixes, documentation improvements, and new features that make sense for a single-household self-hosted finance app.

---

## Standards and expectations

This project is built with the same standards expected of professional software. That expectation extends to every contribution.

**Use established conventions, not invented ones.** Personal finance is a solved problem domain. There are thousands of applications in this space with decades of collective design, UX, and engineering knowledge behind them. Before proposing a new approach to anything — a data model, a UX pattern, a sync strategy, a security mechanism — research how existing tools handle it. Reference those decisions. Justify deviations from established practice.

**Use reputable standards, guidelines, and literature.** Financial data handling, security, accessibility, and API design each have authoritative references. Use them:
- Security: [OWASP Top 10](https://owasp.org/www-project-top-ten/), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [NIST guidelines](https://www.nist.gov/cybersecurity)
- Accessibility: [WCAG 2.1](https://www.w3.org/TR/WCAG21/), [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)
- Testing: [ISTQB standards](https://www.istqb.org/), [pytest documentation](https://docs.pytest.org/), [Testing Library principles](https://testing-library.com/docs/guiding-principles)
- Python: [PEP 8](https://peps.python.org/pep-0008/), [PEP 484](https://peps.python.org/pep-0484/), [PEP 257](https://peps.python.org/pep-0257/)
- TypeScript/React: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html), [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)

**Test-driven development is not optional.** Tests are written before or alongside the code they cover, not after. New functionality without tests will not be merged. The test coverage audit reports in `audit/test-coverage/` define the current gaps and the expected remediation approach — do not add to those gaps.

**Do things correctly, not quickly.** Speed of delivery is not a value here. Correctness, integrity, and thoroughness are. A slower, well-reasoned, well-tested, well-documented contribution is always preferred over a fast one.

**Documentation is a first-class deliverable.** If a change affects how the app behaves, the wiki must be updated in the same PR. If a change introduces a new concept, constraint, or configuration option, it must be documented. Undocumented behaviour is a defect.

**Accuracy matters.** If you are uncertain about a design decision, a security implication, or the correct approach to a problem — say so explicitly. Do not paper over uncertainty with confident-sounding language. Flagging unknowns is respected; hiding them is not.

**PRs are reviewed to a high standard.** Every PR is read in full. A PR that does not meet the bar — inadequate tests, undocumented behaviour, deviations from established conventions without justification, or code that prioritised speed over correctness — will be rejected. Repeated submissions that do not reflect the feedback from a prior rejection will result in no further reviews from that contributor.

---

## Before you start

Read the docs. The architecture and design decisions are documented in the [GitHub Wiki](https://github.com/squeezy102/SqueezyPay/wiki) and shape what "a good contribution" looks like here.

Key constraints to understand before proposing changes:

- **Single institution** — the app intentionally supports exactly one connected financial institution. See [Architecture](https://github.com/squeezy102/SqueezyPay/wiki/Architecture#single-institution-design). Changes that break this constraint will not be merged; changes that make it more configurable (e.g. an opt-in multi-institution mode) may be discussed.
- **Self-hosted, local network** — no cloud dependency, no external accounts, no telemetry. Changes that introduce these will not be accepted.
- **No financial institution names hardcoded** — institution names are always fetched from the user's active Plaid connection or derived from imported data, never hardcoded in source.

## Development setup

See [Getting Started](https://github.com/squeezy102/SqueezyPay/wiki/Getting-Started) for the full setup walkthrough.

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

CI runs all three suites. A PR that drops coverage below the current threshold will not be merged. See [Testing](https://github.com/squeezy102/SqueezyPay/wiki/Testing) for details.

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

Documentation lives in [`wiki/`](wiki/) in this repo. CI pushes `wiki/` to the [GitHub Wiki](https://github.com/squeezy102/SqueezyPay/wiki) on every push to `dev`, so the wiki is always current with the branch.

**To update docs:** edit the relevant file in `wiki/` and commit. The push-to-wiki step in CI does the rest.

`docs/` does not exist. All documentation writes go to `wiki/`.

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
