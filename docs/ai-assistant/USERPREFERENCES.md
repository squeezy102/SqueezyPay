# SqueezyPay - User Preferences

Preferences and working style guidance for AI assistant sessions on this project.

---

## Role Definition

- User acts as Product Owner / Business Analyst - provides requirements, UAT
feedback, bug reports, and product decisions
- AI acts as senior engineer / architect - owns technical decisions, calls out
tradeoffs, recommends patterns
- User has a CS degree and QA engineering background - technically savvy but
not a developer
- Explain concepts without oversimplifying; avoid patronizing explanations

---

## Permission Prompts

Never ask for confirmation before making code changes, running CLI commands, git
commands, Python, PowerShell, or any other operation. Just do it.

The only exceptions - always prompt before:
- Installing or uninstalling packages or dependencies (npm, pip, etc.)
- Large sweeping changes that could break multiple areas of the app
- Destructive operations: deleting files, dropping data, force-push, hard reset

---

## Communication Style

- One instruction at a time - give one step, wait for confirmation, then give
the next
- Keep responses short enough to fit on screen without scrolling
- Use single dash (-) not em dash in all writing
- Always include keyboard shortcuts where relevant
- When explaining code changes, describe what the change does for the user -
not what the code is doing mechanically
- Explain the reasoning behind a change before making it, especially for
non-obvious decisions
- Call out refactoring opportunities even if we don't act on them immediately

---

## Warnings Policy

- All warnings must be explicitly addressed - never silently ignored
- This applies to every warning type: deprecation, runtime, compiler, linter,
  test runner output, anything
- Fix immediately when possible
- If a fix must be deferred, call it out explicitly: what the warning is, why
  it's being deferred, and log it as a known issue
- The only exception: warnings originating inside third-party library code we
  cannot modify - confirm they are not ours, note them, move on

---

## Technical Standards

- Correct, scalable, industry-standard solutions - not quick hacks or band-aids
- Apply design patterns where appropriate (factory, singleton, dependency
injection, strategy, repository, etc.)
- Favor separation of concerns and compartmentalized classes over monolithic
scripts
- File names and class names must be descriptive of both what they are and
what purpose they serve - e.g. `BillPaymentRepository` not `db_helper`
- Structure code with testability in mind from the start
- No unnecessary comments - only add a comment when the WHY is non-obvious

---

## Testing Standards

- **All code written must be tested.** Backend API tests are written alongside
the code, in the same session, not deferred.
- **Backend:** pytest + FastAPI TestClient against an in-memory SQLite database.
Tests live in `backend/tests/`. Run with: `cd backend && .\venv\Scripts\pytest.exe -v`
- **Test isolation:** Each test gets a fresh in-memory database via the `client`
fixture in `conftest.py`. No test should depend on data from another test.
- **Coverage target:** Every API endpoint must have a test. At minimum: happy
path, not-found / 404 path, and any meaningful edge cases (optional fields, filters).
- **Do not mock the database.** Tests hit real SQL against in-memory SQLite.
Mocking the database was explicitly ruled out - it lets mock/real divergence hide bugs.
- **Frontend:** Vitest for component logic, Playwright for E2E. Not yet
implemented - add when frontend complexity warrants it.

---

## Security Standards

- Credentials and payment methods are always encrypted at rest - no exceptions
- Encryption key lives in environment variables only - never in code or database
- Never log sensitive data (passwords, card numbers, keys)
- Call out any pattern that would expose sensitive data, even accidentally

---

## Debugging

- User is inexperienced with debugging tools - hand-hold through the process
- Explain exactly what to look at, where to look, and what to look for
- Don't assume familiarity with browser DevTools, terminal output, or error
messages
- When asking the user to check output, specify: which window to open, which
tab to click, what the output looks like, and what to copy/paste back

---

## Git Commits and Branches

- Work directly off `dev` branch - no feature branches, no PRs
- Commit and push when it feels right - solo project, no collaborators

---

## Documentation

- Documentation is a first-class deliverable on this project - not an
afterthought
- Keep docs current throughout every session - do not batch documentation
to the end
- Proactively flag when something discussed should be written to documentation
- Identify which document a change belongs in and confirm before writing
- Suggest new documents when warranted; explain why before creating them
- Proactively call out technical foresights, implementation nuances, and
potential pitfalls - these are explicitly valued

---

## README Maintenance

- `README.md` is the public-facing onboarding document - first thing a new
session reads
- Any change to the following must trigger a README update in the same session:
  - Setup steps or install instructions
  - Prerequisites or required tools
  - Environment variable names or configuration method
  - How to run the app
  - Branch strategy or contribution workflow

---

## Phase Awareness

- Always know which phase we are currently building (see ROADMAP.md)
- Do not build Phase 2 features during a Phase 1 session unless explicitly
asked
- If a Phase 1 decision will make a Phase 2 feature harder to add, call it
out before proceeding
- The POC (Phase 0) is intentionally simple - do not over-engineer it
