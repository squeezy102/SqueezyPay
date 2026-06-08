# SqueezyPay Audit Index

This directory is the running record of all audits performed on this project.

| Date | Report | Status | Branch |
|---|---|---|---|
| 2026-06-08 | [2026-06-08/REMEDIATION.md](2026-06-08/REMEDIATION.md) | Completed — 191 tests passing | `dev` |

---

## How to read these reports

Each audit folder is named by date. Inside each folder:

- **REMEDIATION.md** — the full findings list with fix notes, rejection rationale, and deferral reasoning for every finding.

Findings that are rejected or deferred are documented with explicit reasoning. A deferred finding is not ignored — it is acknowledged and either tracked in ROADMAP.md or in a GitHub Issue with the `deferred` label.

---

## Deferred findings (open)

These were audited, acknowledged, and explicitly deferred. They are not bugs — they are known constraints or out-of-scope items for the current phase.

| Finding | Reason | GitHub Issue |
|---|---|---|
| C-01: Admin server LAN access (no auth) | By design — LAN-first trusted household product | #15 |
| H-02: SHA-pin GitHub Actions | Low risk for single-dev private repo | #18 |
| H-05: Autofill credentials in process args | Architectural limitation; autofill is experimental | #21 |
| H-12: TransactionTable sort is page-local | Requires server-side sort changes; Phase 3 | #27 |
| H-19: release.yml hardcoded fallback | CI hardening pass needed | #19 |
| M-02: Plaid sync truncates at 500 | Cursor pagination work; Phase 3 | #22 |
| L-02: No E2E tests | Phase 3 concern | — |
