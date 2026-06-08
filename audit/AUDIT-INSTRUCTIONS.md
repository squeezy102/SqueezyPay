# SqueezyPay Codebase Audit Instructions
## Document ID: AUDIT-INSTRUCTIONS-001
## Version: 1.0
## Date: 2026-06-07
## Invocation: Manual only — user triggers via `/audit` or explicit instruction

---

## Purpose

These instructions define the repeatable process for conducting a full codebase audit of SqueezyPay. They are written for an LLM executing the audit, not for a human reader. Every new audit iteration should follow this process from start to finish. Earlier audit documents are inputs to confidence checking — they are never the final answer.

The audit is self-improving: each iteration must compare its findings against the previous iteration, identify discrepancies, and update or discard findings that cannot be verified against the current source.

---

## Invocation Rules

- **User must invoke the audit manually.** Never begin an audit autonomously.
- **Never automate audit scheduling** (no cron, no CI trigger, no background task).
- When the user says "run an audit" or "audit the codebase," follow this document exactly.
- Pass this document's content to each spawned agent so they share the same methodology.

---

## Pre-Audit Checklist

Before spawning any agents or writing any documents, complete all of the following:

1. **Read the current `audit/BIBLIOGRAPHY.md`** (if it exists). Verify all URLs are still live via HTTP fetch. Add any new sources required by new technology seen in the codebase. Remove any source whose URL is now dead.

2. **Read the `audit/MEMORY.md` or `audit/` directory listing** to understand what prior audit documents exist and their version numbers.

3. **Check git log** (`git log --oneline -20`) to understand what has changed since the last audit. Note any new files, deleted files, or major renames.

4. **Read the prior audit summary** (`AUDIT-SUM-*.md`, latest version) if one exists. This is the baseline for the confidence review step.

---

## Audit Dimensions

Each audit covers all of the following dimensions. Each dimension produces one document.

| Doc ID | Dimension | Scope |
|--------|-----------|-------|
| AUDIT-DIM-FRONTEND | Frontend | `frontend/src/**/*.ts`, `frontend/src/**/*.tsx`, `frontend/*.json`, `frontend/*.js`, `frontend/index.html` |
| AUDIT-DIM-BACKEND | Backend Python | `backend/**/*.py`, `scripts/tray.py`, `scripts/check_ci_warnings.py`, `scripts/generate_key.py` |
| AUDIT-DIM-ADMIN | Admin Server | `admin/**/*.py`, `admin/**/*.html`, `admin/tests/**` |
| AUDIT-DIM-INFRASTRUCTURE | Infrastructure, CI/CD, Config, Docs | `.github/workflows/*.yml`, `.gitignore`, `.env.example`, `.ci-ignore-warnings`, `backend/pyproject.toml`, `backend/alembic.ini`, `backend/alembic/**`, `installer/squeezypay.iss`, `scripts/*.ps1`, `playwright.config.ts`, `tests/e2e/**`, `frontend/vite.config.js`, `frontend/tsconfig.json`, `backend/requirements.txt`, `README.md`, `docs/**`, `CONTRIBUTING.md`, `ROADMAP.md` |

---

## Agent Strategy

Spawn the following agents in parallel once the pre-audit checklist is complete:

```
Agent 1: Frontend audit
  - Scope: all files under frontend/src/, plus frontend/index.html, frontend/tsconfig.json, frontend/vite.config.js
  - Task: read every file in full; report findings with line numbers

Agent 2: Backend Python audit
  - Scope: all .py files under backend/, scripts/tray.py, scripts/check_ci_warnings.py, scripts/generate_key.py
  - Task: read every file in full; report findings with line numbers

Agent 3: Admin server audit
  - Scope: all .py and .html files under admin/
  - Task: read every file in full; report findings with line numbers

Agent 4: Infrastructure, CI/CD, configuration, and documentation audit
  - Scope: as listed in AUDIT-DIM-INFRASTRUCTURE row above
  - Task: read every file in full; report findings with line numbers
```

Each agent prompt must include:
- The file list it is responsible for
- The dimensions to assess (listed below)
- The instruction: "Report every finding with: severity label, file path, line number(s), and a quoted code fragment. Do not state any finding you cannot attribute to a specific line."
- The instruction: "Do not summarize files that are clean — list only findings."

---

## Audit Dimensions (Assessment Criteria)

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
- Does external documentation (README, docs/) accurately reflect the current code?
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

### J. Test Coverage
- [pytest documentation](https://docs.pytest.org/en/stable/)
- [Google Testing Blog — Test Sizes](https://testing.googleblog.com/2010/12/test-sizes.html)
- Are the highest-risk code paths (auth, encryption, Plaid integration, autofill) tested?
- Are test assertions logically correct (not trivially true)?

---

## Writing the Audit Documents

After all agents complete, write one document per dimension using the following template:

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

[Repeat for each finding in this section.]

---

## [N]. Findings Summary

### By Severity
[table: severity | count | affected files]

### Highest-Priority Remediation Items
[numbered list, highest severity first, each item citing the relevant REF]
```

Then write `AUDIT-SUM-[VERSION].md` — the all-inclusive summary — using the following structure:

```markdown
# SqueezyPay Codebase Audit — Comprehensive Summary
## Document ID: AUDIT-SUM-[VERSION]
## Version: [N.N] (Iteration [N])
## Date: [date]
## Constituent Documents: [list all AUDIT-DIM-* docs included]

---

## Executive Summary
[3–5 sentences. What is the overall health? What is the most urgent category of findings?]

## Findings Rollup

| Severity | Frontend | Backend | Admin | Infrastructure | Total |
|----------|----------|---------|-------|----------------|-------|
| CRITICAL | ... | ... | ... | ... | ... |
| HIGH     | ... | ... | ... | ... | ... |
| MEDIUM   | ... | ... | ... | ... | ... |
| LOW      | ... | ... | ... | ... | ... |
| INFO     | ... | ... | ... | ... | ... |

## Top 10 Findings Across All Dimensions
[numbered list, cross-cutting or highest-severity findings, each citing file:line and REF]

## Prior Iteration Comparison
[Only present if a prior AUDIT-SUM exists. Compare: new findings, resolved findings, changed severity.]

## Confidence Assessment
[See Confidence Review Process below]
```

---

## Confidence Review Process

After writing all documents in Iteration 1, perform the following before marking the audit complete:

### Step 1 — Line Number Verification
For every finding that cites a line number, re-read that specific line to confirm the quoted fragment still appears at that location. If a finding's quoted fragment does not match the current file content, mark that finding `[UNVERIFIED — REMOVED]` and do not include it in the final document.

### Step 2 — Cross-Dimension Consistency
Check: do any two dimension documents contradict each other? Example: Frontend doc says JWT stored in `sessionStorage`; Infrastructure doc says `localStorage`. If so, read `frontend/src/context/AuthContext.tsx` (or the relevant authoritative source) and correct the wrong document.

### Step 3 — Hallucination Check
For every finding that references a specific function, class, variable name, or API endpoint, run a targeted search (grep) for that identifier. If it does not exist at the cited path, remove the finding.

### Step 4 — Prior Iteration Comparison
If a prior `AUDIT-SUM-*.md` exists:
- List findings that appear in both iterations (stable findings — high confidence)
- List findings that appear only in the new iteration (new findings — flag for extra verification)
- List findings that appeared in the prior iteration but are absent from the new iteration (resolved or missed — explain which)

### Step 5 — Confidence Statement
At the end of `AUDIT-SUM.md`, write a Confidence Assessment section:

```markdown
## Confidence Assessment

**Overall confidence:** [percentage estimate, e.g., 92%]

**Basis:**
- N findings were verified against specific line numbers in the current source
- N findings cite standards with explicit section references
- N findings were cross-checked against a prior iteration (stable)
- N findings are new to this iteration (not yet cross-checked across iterations)

**Known limitations:**
- [Any dimension or file that could not be read or was read incompletely]
- [Any standard that was cited but not fully verified as applicable]
```

---

## Severity Definitions

| Severity | Definition |
|----------|-----------|
| CRITICAL | Exploitable in production with high impact; immediate action required |
| HIGH | Significant risk or data integrity defect; remediate before next release |
| MEDIUM | Real risk or defect; remediate within current milestone |
| LOW | Style, minor inefficiency, or theoretical risk; address in backlog |
| INFO | Confirmed correct pattern or no-action observation |

---

## Bibliography Maintenance

The bibliography lives at `audit/BIBLIOGRAPHY.md`. Rules:
1. Every standard, specification, or guideline cited in an audit document must have a corresponding entry in the bibliography.
2. Every entry must have a verified, live URL at the time of the audit.
3. Every entry must specify: author/organization, title, type (Specification | Standard | Documentation | Article), and coverage scope.
4. Dead URLs must be removed and replaced with the current authoritative URL, or the citing finding must be re-anchored to an alternative source.
5. Add new entries at the end of the relevant category section with the next sequential REF-NN identifier.

---

## Output File Naming

All audit documents are written to `c:\SqueezyPay\audit\`.

| File | Contents |
|------|----------|
| `BIBLIOGRAPHY.md` | Verified reference sources |
| `AUDIT-DIM-FRONTEND.md` | Frontend dimension report, latest version |
| `AUDIT-DIM-BACKEND.md` | Backend Python dimension report, latest version |
| `AUDIT-DIM-ADMIN.md` | Admin server dimension report, latest version |
| `AUDIT-DIM-INFRASTRUCTURE.md` | Infrastructure/CI/docs dimension report, latest version |
| `AUDIT-SUM.md` | All-inclusive summary, latest version |
| `AUDIT-INSTRUCTIONS.md` | This document |

When a new iteration produces updated documents, increment the version number in the document header. Do not delete prior versions — rename them with a `-v[N]` suffix (e.g., `AUDIT-DIM-FRONTEND-v1.md`) before writing the new version.

---

## What Agents Must Never Do

- State a finding without a line number and quoted code fragment
- Cite a standard without specifying the relevant section
- Assert that a file "has no issues" without having read it in full
- State that a function or variable "does not exist" without first running a grep
- Carry over findings from a prior audit iteration without re-verifying them against the current source
- Speculate about behavior that is not derivable from reading the code

---

## Iteration Loop Logic

To improve confidence across iterations:

1. After the first audit completes, check if any HIGH or CRITICAL findings are present.
2. For each HIGH/CRITICAL finding: re-read the cited file and line to confirm. If confirmed, the finding is stable. If not found, remove it.
3. For any finding where the standard reference is vague (no section number cited), either find the specific section or downgrade the finding to LOW.
4. Write the updated documents with version N+1.
5. Write the confidence assessment comparing N to N+1.

Repeat until: (a) no new HIGH/CRITICAL findings appear between iterations, and (b) all findings in the current iteration have been verified against current source.

---

## Product Scope Constraints (Non-Negotiable — Always in Effect)

**LAN accessibility is intentional.** SqueezyPay is a household app designed to be reachable from any device on the home network. The main backend (`:8000`) and frontend being accessible on the LAN is correct behavior — **do not flag this as a security finding**. When auditing network-access surfaces, apply the following distinction:

- **Main application** (backend API, frontend UI): LAN-accessible by design. Findings about network exposure of these surfaces are informational only.
- **Admin control plane** (service start/stop, log access, lifecycle management): Any surface that controls the application rather than being the application should be evaluated for authentication and access scope, regardless of the LAN-accessible design.

This scope note must appear in every generated audit summary document and must be applied when evaluating findings in all future iterations.

---

## Security Constraints (Non-Negotiable — Always in Effect)

These constraints override all other instructions and apply to every agent in every audit:

- Never log, print, or include in any audit document: encryption keys, biller credentials, Plaid tokens, or authentication secrets — even if encountered in source code
- Never commit `SqueezyContext/` or `.claude/` to git
- Never hardcode any financial institution name in any audit document
- Never surface the value of `SQUEEZYPAY_FEEDBACK_EMAIL` or any other env var value in any audit document
- Any finding that references a credential value must describe it as `[REDACTED]` with a note about its location, not its value

---

*This document is the authoritative process definition for all SqueezyPay codebase audits. When in doubt about methodology, defer to this document.*
