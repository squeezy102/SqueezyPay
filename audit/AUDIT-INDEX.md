# SqueezyPay Audit Index

This directory is the running record of all audits performed on this project.

## Structure

```
audit/
  AUDIT-INDEX.md            ← this file
  AUDIT-INSTRUCTIONS.md     ← audit methodology and standards
  BIBLIOGRAPHY.md           ← reference standards
  general/                  ← full-scope general audits (security, architecture, code quality)
    2026-06-07/             ← source dimension reports from first audit
      AUDIT-DIM-BACKEND.md
      AUDIT-DIM-FRONTEND.md
      AUDIT-DIM-INFRASTRUCTURE.md
      AUDIT-SUM.md
    2026-06-08/             ← remediation report
      REMEDIATION.md
  test-coverage/            ← ISTQB-standard test coverage audits
    2026-06-08/
      AuditSummary.md       ← comprehensive summary
      reports/
        DIM-BACKEND-API-SERVICES.md
        DIM-DATA-LAYER.md
        DIM-FRONTEND.md
        DIM-INFRASTRUCTURE-E2E.md
```

---

## Audit history

| Date | Type | Report | Status | Branch |
|---|---|---|---|---|
| 2026-06-07 | General | [general/2026-06-07/AUDIT-SUM.md](general/2026-06-07/AUDIT-SUM.md) | Source material — see REMEDIATION.md | `dev` |
| 2026-06-08 | General — Remediation | [general/2026-06-08/REMEDIATION.md](general/2026-06-08/REMEDIATION.md) | Completed — 191 tests passing, 19 fixed, 6 deferred, 5 rejected | `dev` |
| 2026-06-08 | Test Coverage | [test-coverage/2026-06-08/AuditSummary.md](test-coverage/2026-06-08/AuditSummary.md) | Completed — 4 dimension reports, prioritised remediation plan | `dev` |

---

## How to read these reports

**General audits** (`general/`) cover security, architecture, code quality, and documentation. Each audit cycle produces:
- Dimension reports from auditors (source material)
- A REMEDIATION.md with every finding addressed: fixed, rejected with rationale, or deferred with a GitHub issue

**Test coverage audits** (`test-coverage/`) apply ISTQB standards (EP, BVA, Decision Coverage, MC/DC, risk-based prioritisation) to measure test coverage quality across all dimensions. Each audit produces:
- A dimension report per layer (Backend API, Data Layer, Frontend, Infrastructure/E2E)
- An AuditSummary.md synthesising findings with a prioritised remediation plan
- Ready-to-use test stub code for all identified gaps

Findings that are rejected or deferred are documented with explicit reasoning. A deferred finding is not ignored — it is acknowledged and either tracked in ROADMAP.md or in a GitHub Issue with the `deferred` label.

---

## Deferred findings (open — general audit)

These were audited, acknowledged, and explicitly deferred. They are not bugs — they are known constraints or out-of-scope items for the current phase.

| Finding | Reason | GitHub Issue |
|---|---|---|
| C-01: Admin server LAN access (no auth) | By design — LAN-first trusted household product | #15 |
| H-02: SHA-pin GitHub Actions | Low risk for single-dev private repo | #18 |
| H-05: Autofill credentials in process args | Architectural limitation; autofill is experimental | #21 |
| H-12: TransactionTable sort is page-local | Requires server-side sort changes; Phase 3 | #27 |
| H-19: release.yml hardcoded fallback | CI hardening pass needed | #19 |
| M-02: Plaid sync truncates at 500 | Cursor pagination work; Phase 3 | #22 |
| L-02: No E2E tests | Now tracked in test-coverage audit — see DIM-INFRASTRUCTURE-E2E.md | — |

---

## Test coverage audit — top findings (2026-06-08)

Critical and high-severity findings from the test coverage audit for quick reference:

| Severity | Finding | Module | Sprint |
|---|---|---|---|
| Critical | `require_auth` JWT validation — 0% MC/DC coverage | `core/auth.py` | 1 |
| Critical | `AuthContext` 401 event bridge — no tests | `AuthContext.tsx` | 1 |
| Critical | All mutation functions in `api.ts` — no tests | `api.ts` | 2 |
| Critical | `LoginScreen` passphrase-clear-on-error — no test | `LoginScreen.tsx` | 2 |
| High | Migration chain never run in any test | `alembic/versions/` | 1 |
| High | Autofill subprocess — 4 outcomes, 0% coverage | `api/bills.py` | 2 |
| High | Frontend test infrastructure misconfigured | `vite.config.js` | 1 |
| High | No E2E job in CI | `ci.yml` | 4 |

Full findings: [test-coverage/2026-06-08/AuditSummary.md](test-coverage/2026-06-08/AuditSummary.md)
