# SqueezyPay Audit Instructions
## Document ID: AUDIT-INSTRUCTIONS-001
## Version: 2.0
## Date: 2026-06-08
## Invocation: Manual only — user triggers via explicit instruction

---

## Purpose

These instructions define two repeatable audit processes for SqueezyPay:

1. **General Audit** — full-scope review of code quality, security, architecture, and documentation
2. **Test Coverage Audit** — ISTQB-standard assessment of test coverage, testability, and test strategy

Both audit types are self-improving: each iteration compares findings against the prior iteration, verifies findings against current source, and updates or discards anything that cannot be confirmed.

These instructions are written for an LLM executing an audit, not for a human reader.

---

## Invocation Rules

- **User must invoke the audit manually.** Never begin an audit autonomously.
- **Never automate audit scheduling** (no cron, no CI trigger, no background task).
- When the user says "run an audit" or "audit the codebase," run a **General Audit**.
- When the user says "test coverage audit" or "coverage audit," run a **Test Coverage Audit**.
- Pass this document's content to each spawned agent so they share the same methodology.

---

## Output Directory Structure

All audit artefacts live under `audit/`:

```
audit/
  AUDIT-INDEX.md            ← running index of all audits ever performed
  AUDIT-INSTRUCTIONS.md     ← this document
  AUDIT-INSTRUCTIONS.md     ← this document
  BIBLIOGRAPHY.md           ← verified reference sources
  general/
    YYYY-MM-DD/             ← one folder per audit cycle (source DIM reports)
      AUDIT-DIM-BACKEND.md
      AUDIT-DIM-FRONTEND.md
      AUDIT-DIM-INFRASTRUCTURE.md
      AUDIT-SUM.md
    YYYY-MM-DD/             ← remediation folder (one per remediation cycle)
      REMEDIATION.md
  test-coverage/
    YYYY-MM-DD/             ← one folder per test coverage audit
      AuditSummary.md
      reports/
        DIM-BACKEND-API-SERVICES.md
        DIM-DATA-LAYER.md
        DIM-FRONTEND.md
        DIM-INFRASTRUCTURE-E2E.md
```

Update `AUDIT-INDEX.md` after every audit with a new row in the history table.

---

---

# Part I — General Audit

---

## General Audit: Pre-Audit Checklist

Before spawning any agents or writing any documents, complete all of the following:

1. **Read `audit/BIBLIOGRAPHY.md`**. Verify all URLs are still live via HTTP fetch. Add any new sources required by new technology seen in the codebase. Remove any source whose URL is now dead.

2. **Read `audit/AUDIT-INDEX.md`** to understand what prior audits exist.

3. **Check git log** (`git log --oneline -20`) to understand what has changed since the last audit. Note any new files, deleted files, or major renames.

4. **Read the prior audit summary** (`audit/general/*/AUDIT-SUM.md`, latest) if one exists. This is the baseline for the confidence review step.

---

## General Audit: Dimensions

Each general audit covers all of the following dimensions. Each dimension produces one document.

| Doc ID | Dimension | Scope |
|--------|-----------|-------|
| AUDIT-DIM-FRONTEND | Frontend | `frontend/src/**/*.ts`, `frontend/src/**/*.tsx`, `frontend/*.json`, `frontend/*.js`, `frontend/index.html` |
| AUDIT-DIM-BACKEND | Backend Python | `backend/**/*.py`, `scripts/tray.py`, `scripts/check_ci_warnings.py`, `scripts/generate_key.py` |
| AUDIT-DIM-ADMIN | Admin Server | `admin/**/*.py`, `admin/**/*.html`, `admin/tests/**` |
| AUDIT-DIM-INFRASTRUCTURE | Infrastructure, CI/CD, Config, Docs | `.github/workflows/*.yml`, `.gitignore`, `.env.example`, `.ci-ignore-warnings`, `backend/pyproject.toml`, `backend/alembic.ini`, `backend/alembic/**`, `installer/squeezypay.iss`, `scripts/*.ps1`, `playwright.config.ts`, `tests/e2e/**`, `frontend/vite.config.js`, `frontend/tsconfig.json`, `backend/requirements.txt`, `README.md`, `wiki/**`, `CONTRIBUTING.md`, `ROADMAP.md` |

---

## General Audit: Agent Strategy

Spawn the following agents in parallel once the pre-audit checklist is complete:

```
Agent 1: Frontend audit
  Scope: all files under frontend/src/, plus frontend/index.html, frontend/tsconfig.json, frontend/vite.config.js
  Task: read every file in full; report findings with line numbers

Agent 2: Backend Python audit
  Scope: all .py files under backend/, scripts/tray.py, scripts/check_ci_warnings.py, scripts/generate_key.py
  Task: read every file in full; report findings with line numbers

Agent 3: Admin server audit
  Scope: all .py and .html files under admin/
  Task: read every file in full; report findings with line numbers

Agent 4: Infrastructure, CI/CD, configuration, and documentation audit
  Scope: as listed in AUDIT-DIM-INFRASTRUCTURE row above
  Task: read every file in full; report findings with line numbers
```

Each agent prompt must include:
- The file list it is responsible for
- The assessment criteria listed below
- The instruction: "Report every finding with: severity label, file path, line number(s), and a quoted code fragment. Do not state any finding you cannot attribute to a specific line."
- The instruction: "Do not summarize files that are clean — list only findings."

---

## General Audit: Assessment Criteria

All agents assess the following dimensions within their scope:

### A. Tech Stack
- Are declared dependencies consistent with what is actually imported and used?
- Are version pins present and correct?
- Are there phantom package names (versions that do not exist on PyPI or npm)?

### B. Code Convention and Style
- Python: [PEP 8](https://peps.python.org/pep-0008/) (line length, naming, import ordering, whitespace)
- Python: [PEP 257](https://peps.python.org/pep-0257/) (docstring conventions)
- Python: [PEP 484](https://peps.python.org/pep-0484/) / [PEP 526](https://peps.python.org/pep-0526/) (type annotations — are they present and correct?)
- TypeScript: [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) (file naming, `any` usage, type assertions, return types)
- React: [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks), [Components must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)

### C. Documentation Readability
- Does inline documentation explain *why*, not *what*?
- Does external documentation (README, wiki/) accurately reflect the current code?
- Are documented API endpoints, variable names, and configuration options consistent with actual code?

### D. Code Readability
- Is naming consistent and self-describing?
- Are there dead code files or functions with no callers?
- Are there large files that should be split?

### E. Logic Validity
- Does the code do what it claims to do?
- Are there conditions that can never be true or never be false?
- Are there off-by-one errors, null dereferences, or unchecked return values?
- Do type annotations match what is actually passed and returned?

### F. Security
- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [NIST SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf)
- [RFC 7519 (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- Secret handling: are secrets ever embedded, logged, or exposed?

### G. Accessibility
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/) — Level A and AA
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)
- Do all form inputs have programmatically associated labels?
- Do charts and non-text content have accessible alternatives?

### H. Database
- Are monetary values stored as `Numeric`, not `Float`?
- Are migrations correct and reversible?
- Are foreign key columns indexed?
- Does migration history accurately describe schema changes?

### I. CI/CD and Infrastructure
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- Are action versions SHA-pinned?
- Are all documented environment variables actually implemented in code?
- Are CI quality gates (coverage, warnings) consistently applied?

### J. Test Coverage (brief scan — full assessment belongs in a Test Coverage Audit)
- Are the highest-risk code paths (auth, encryption, Plaid integration, autofill) tested?
- Are test assertions logically correct (not trivially true)?
- Note severe gaps only; do not produce detailed coverage analysis here.

---

## General Audit: Output Documents

Write one document per dimension using this template:

```markdown
# Audit Dimension Report: [Dimension Name]
## Document ID: AUDIT-DIM-[NAME]-[VERSION]
## Version: [N.N] (Iteration [N])
## Date: [date]
## Auditor: Automated agent + senior review
## Scope: [list of files/paths covered]
## Bibliography: All reference IDs resolved in audit/BIBLIOGRAPHY.md

---

## [Section number]. [Section Name]
*Standards applied: [REF-XX] Name; [REF-YY] Name*

### [N.N] [Finding Title]

**FILE: `path/to/file.ext`, line(s) NN:**
```[language]
[quoted code fragment]
```
[Explanation citing the relevant standard. One paragraph. No opinions.]

**Severity: [CRITICAL | HIGH | MEDIUM | LOW | INFO]** — [one-line summary of impact].
```

Then write `AUDIT-SUM.md` using:

```markdown
# SqueezyPay Codebase Audit — Comprehensive Summary
## Document ID: AUDIT-SUM-[VERSION]
## Version: [N.N] (Iteration [N])
## Date: [date]
## Constituent Documents: [list all AUDIT-DIM-* docs included]

---

## Executive Summary

## Findings Rollup

| Severity | Frontend | Backend | Admin | Infrastructure | Total |
|---|---|---|---|---|---|

## Top 10 Findings Across All Dimensions

## Prior Iteration Comparison

## Confidence Assessment
```

Save all documents under `audit/general/YYYY-MM-DD/`. Update `audit/AUDIT-INDEX.md`.

---

## General Audit: Confidence Review Process

After writing all documents, perform the following before marking the audit complete:

**Step 1 — Line Number Verification**  
For every finding that cites a line number, re-read that specific line to confirm the quoted fragment still appears at that location. If a finding's quoted fragment does not match the current file content, mark that finding `[UNVERIFIED — REMOVED]` and do not include it in the final document.

**Step 2 — Cross-Dimension Consistency**  
Check: do any two dimension documents contradict each other? If so, read the authoritative source and correct the wrong document.

**Step 3 — Hallucination Check**  
For every finding that references a specific function, class, variable name, or API endpoint, run a targeted grep for that identifier. If it does not exist at the cited path, remove the finding.

**Step 4 — Prior Iteration Comparison**  
If a prior `AUDIT-SUM.md` exists: list findings present in both iterations (stable — high confidence), findings new to this iteration (flag for extra verification), and findings absent from the new iteration (resolved or missed — explain which).

**Step 5 — Confidence Statement**  
At the end of `AUDIT-SUM.md`:

```markdown
## Confidence Assessment

**Overall confidence:** [percentage]

**Basis:**
- N findings verified against specific line numbers in current source
- N findings cite standards with explicit section references
- N findings cross-checked against prior iteration (stable)
- N findings new to this iteration (not yet cross-checked)

**Known limitations:**
- [Any dimension or file that could not be read or was read incompletely]
```

---

## General Audit: Severity Definitions

| Severity | Definition |
|---|---|
| CRITICAL | Exploitable in production with high impact; immediate action required |
| HIGH | Significant risk or data integrity defect; remediate before next release |
| MEDIUM | Real risk or defect; remediate within current milestone |
| LOW | Style, minor inefficiency, or theoretical risk; address in backlog |
| INFO | Confirmed correct pattern or no-action observation |

---

---

# Part II — Test Coverage Audit

---

## Test Coverage Audit: Purpose

A test coverage audit goes beyond statement coverage percentages. It measures:

- **Equivalence partitioning (EP)** — are all equivalence classes of inputs represented?
- **Boundary value analysis (BVA)** — are boundary conditions (min, max, zero, off-by-one) tested?
- **Decision coverage** — is every conditional branch exercised?
- **MC/DC** — for security-critical decision points, does each condition independently affect the outcome?
- **TDD adherence** — were tests written alongside code or after? Are test doubles used where integration tests would be more valuable?
- **Test pyramid alignment** — is the investment at the right tier (unit / integration / E2E)?

Standards applied: ISTQB Foundation Level Syllabus, Testing Trophy (Kent C. Dodds), OWASP Testing Guide for security-critical paths.

---

## Test Coverage Audit: Pre-Audit Steps

1. **Run the full backend test suite with coverage:**
   ```
   cd backend
   pytest --cov=. --cov-report=json --cov-report=term-missing -q 2>&1
   ```
   Record: total tests, overall %, and per-module miss counts with line numbers.

2. **Run the full frontend test suite with coverage:**
   ```
   cd frontend
   npx vitest run --coverage --reporter=text 2>&1
   ```
   Record: total tests, overall statement/branch/function/line %, and per-file breakdown.

3. **Inventory test files:** list all `test_*.py` and `*.test.ts` files and which source modules they correspond to. Flag any source module with no corresponding test file.

4. **Check CI coverage gates:** read `.github/workflows/ci.yml` and note which jobs enforce `--cov-fail-under` or equivalent thresholds.

5. **Read the prior test coverage audit summary** (`audit/test-coverage/*/AuditSummary.md`, latest) if one exists, for the baseline comparison.

---

## Test Coverage Audit: Dimensions

Each test coverage audit covers four dimensions. Each dimension produces one report.

| Report | Scope |
|---|---|
| DIM-BACKEND-API-SERVICES | `backend/api/*.py`, `backend/services/*.py`, `backend/core/*.py`, `backend/main.py`, `backend/seed.py` |
| DIM-DATA-LAYER | `backend/repositories/*.py`, `backend/models/*.py`, `backend/alembic/**`, `backend/tests/conftest.py`, test files for repositories |
| DIM-FRONTEND | `frontend/src/**/*.ts`, `frontend/src/**/*.tsx`, `frontend/src/**/*.test.*`, `frontend/vite.config.js` |
| DIM-INFRASTRUCTURE-E2E | `tests/e2e/**`, `playwright.config.ts`, `admin/tests/**`, `backend/core/auth.py`, `backend/core/limiter.py`, `backend/services/encryption_service.py`, `.github/workflows/ci.yml` |

---

## Test Coverage Audit: Agent Strategy

Spawn the following four agents in parallel after completing the pre-audit steps:

```
Agent 1: Backend API and Services
  Scope: DIM-BACKEND-API-SERVICES
  Input: coverage data from pre-audit step 1 (module %, missing lines)
  Output: audit/test-coverage/YYYY-MM-DD/reports/DIM-BACKEND-API-SERVICES.md

Agent 2: Data Layer
  Scope: DIM-DATA-LAYER
  Input: coverage data from pre-audit step 1 (repository module %, missing lines)
  Output: audit/test-coverage/YYYY-MM-DD/reports/DIM-DATA-LAYER.md

Agent 3: Frontend
  Scope: DIM-FRONTEND
  Input: coverage data from pre-audit step 2 (file %, configuration state)
  Output: audit/test-coverage/YYYY-MM-DD/reports/DIM-FRONTEND.md

Agent 4: Infrastructure and E2E
  Scope: DIM-INFRASTRUCTURE-E2E
  Input: E2E spec inventory, CI job definitions, admin test inventory
  Output: audit/test-coverage/YYYY-MM-DD/reports/DIM-INFRASTRUCTURE-E2E.md
```

Each agent prompt must include:
- The exact coverage metrics for the modules in its scope (from pre-audit steps)
- The files to read in order to understand the uncovered code paths
- The ISTQB criteria to apply (EP, BVA, Decision Coverage, MC/DC, risk-based prioritisation)
- The instruction: "Work silently. Produce only the output file. Do not commit anything."
- The instruction: "For every coverage gap: identify WHY it is uncovered, classify severity using ISTQB risk-based prioritisation, and write a test suggestion stub — a `def test_...` or `describe`/`it` skeleton with a docstring describing what the test verifies. These are not implementations — they are specifications for a future test-writing session."

---

## Test Coverage Audit: Per-Dimension Report Structure

Each dimension report must follow this structure:

```markdown
# Test Coverage Audit — [Dimension Name]

[Project metadata header: date, scope, tool, standards applied]

---

## Executive Summary
[3–5 sentences. What is the overall coverage posture? What is the dominant root cause of gaps?]

## Coverage Metrics Table
[module | stmts | miss | % | severity]

## Gap Analysis (one section per gap module, ordered by severity)

### `<module>` — <coverage%>

#### What is uncovered
[Specific lines/branches, quoted from source]

#### Why it is uncovered
[Root cause: missing test file, fixture bypass, environmental gate, happy-path-only writing, etc.]

#### Risk classification (ISTQB)
[EP classes, BVA boundaries, decision coverage %, MC/DC applicability, risk narrative]

#### Test suggestion stubs
[`def test_...` or `describe`/`it` skeleton with docstring — not a full test, a specification]

## TDD Adherence Assessment (where applicable)

## Testing Strategy Assessment (where applicable)

## Recommendations
[Prioritised list, highest severity first]
```

---

## Test Coverage Audit: Summary Document

After all four dimension reports are complete, write `AuditSummary.md` at `audit/test-coverage/YYYY-MM-DD/AuditSummary.md` with the following structure:

```markdown
# Test Coverage Audit — Comprehensive Summary

[Metadata: date, branch, auditor, standards applied]

---

## Dimension Reports
[table linking to each DIM report]

## Overall Coverage Snapshot
[table: Layer | Tests | Coverage | Gate]

## Risk-Prioritised Finding Summary
[Critical / High / Medium / Low tables — finding | module | why | sprint]

## Root Cause Analysis
[Name the 3–5 root causes that account for the majority of gaps. One paragraph each.]

## Test Pyramid Gap
[ASCII diagram: current vs recommended]

## Prioritised Remediation Plan
[Sprint 1 / Sprint 2 / Sprint 3 / Sprint 4 tables with task, files, what it closes]

## Coverage Targets
[table: Layer | Current | After Sprint 1–2 | After Sprint 3–4 | Long-term]

## What Good Looks Like From Here
[2–3 paragraphs on where the investment should shift next]
```

---

## Test Coverage Audit: Severity Definitions

| Severity | Definition |
|---|---|
| Critical | Security boundary, authentication, or data integrity path with 0% decision coverage; a regression here could ship undetected |
| High | Business-critical path with <50% decision coverage, or an entire feature subsystem with no test at all |
| Medium | Logic gap that produces incorrect output silently; uncovered error-handling path; missing BVA boundary |
| Low | Missing negative-path test, missing isolated repo-layer test, untested idempotency guard |

---

## Test Coverage Audit: What Agents Must Never Do

- State a coverage gap without citing the specific uncovered lines from the coverage report
- Write test implementations — stubs and docstrings only; the writing of actual tests is a separate effort
- Claim a module is "adequately tested" without verifying EP and BVA coverage of its inputs
- Recommend removing the `conftest.py` auth fixture without acknowledging the scope of impact on the existing suite
- Propose mocking the database where an in-memory SQLite integration test would be more appropriate

---

---

# Shared Rules (Apply to Both Audit Types)

---

## Product Scope Constraints (Non-Negotiable)

**LAN accessibility is intentional.** SqueezyPay is a household app designed to be reachable from any device on the home network. The main backend (`:8000`) and frontend being accessible on the LAN is correct behaviour — **do not flag this as a security finding**. Apply this distinction:

- **Main application** (backend API, frontend UI): LAN-accessible by design. Findings about network exposure are informational only.
- **Admin control plane** (service start/stop, log access, lifecycle management): Evaluate for authentication and access scope regardless of the LAN-accessible design.

This scope note must appear in every generated audit summary document.

---

## Security Constraints (Non-Negotiable)

These constraints override all other instructions and apply to every agent in every audit:

- Never log, print, or include in any audit document: encryption keys, biller credentials, Plaid tokens, or authentication secrets — even if encountered in source code
- Never commit `SqueezyContext/` or `.claude/` to git
- Never hardcode any financial institution name in any audit document
- Never surface the value of `SQUEEZYPAY_FEEDBACK_EMAIL` or any other env var value
- Any finding that references a credential value must describe it as `[REDACTED]` with a note about its location, not its value

---

## Documentation Note

**`wiki/` is the single source of truth for user-facing documentation.** `docs/` does not exist. Any audit finding that references a documentation gap should point to the corresponding `wiki/` file, not a `docs/` path.

---

## What All Agents Must Never Do

- State a finding without evidence (line number, quoted fragment, or coverage line reference)
- Cite a standard without specifying the relevant section or criterion
- Assert that a file "has no issues" without having read it in full
- State that a function or variable "does not exist" without first running a grep or checking git history
- Carry over findings from a prior audit iteration without re-verifying them against the current source
- Speculate about behaviour that is not derivable from reading the code

---

## Bibliography Maintenance

The bibliography lives at `audit/BIBLIOGRAPHY.md`. Rules:
1. Every standard, specification, or guideline cited in an audit document must have a corresponding entry.
2. Every entry must have a verified, live URL at the time of the audit.
3. Every entry must specify: author/organization, title, type (Specification | Standard | Documentation | Article), and coverage scope.
4. Dead URLs must be removed and replaced, or the citing finding re-anchored to an alternative source.
5. Add new entries with the next sequential REF-NN identifier.

---

*This document is the authoritative process definition for all SqueezyPay audits. When in doubt about methodology, defer to this document.*
