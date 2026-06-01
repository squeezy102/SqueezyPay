# SqueezyPay - AI Session Context

Running notes for AI assistant continuity across sessions.

---

## Repository State

- **Active branch:** `dev`
- **Last commit:** Initial commit - repo scaffold and ai-assistant documentation
- **Uncommitted changes:** None

---

## Current App State

Phase 0 (POC) is not yet started. The repository has been scaffolded with
documentation only. No application code exists yet.

The first coding session will build the Phase 0 POC - a static frontend
bill dashboard with no backend. See ROADMAP.md for Phase 0 scope.

---

## What Has Been Built

Nothing yet. This is a fresh repository.

---

## What Has NOT Been Built (Phase 0 targets)

- Static React frontend
- Bill dashboard with hardcoded bill data
- One-click biller navigation
- PWA manifest for mobile install
- Local network hosting

---

## File Structure

```
squeezypay/
- README.md                     Public-facing onboarding doc
- .gitignore
- docs/
  - ai-assistant/
    - CONTEXT.md                This file
    - REQUIREMENTS.md           Full feature requirements (REQ-001 through REQ-015)
    - ROADMAP.md                Build phases with priority labels
    - DECISIONS.md              Vision, philosophy, architecture decision log
    - USERPREFERENCES.md        Working style and AI collaboration guidelines
```

Application code will be added starting in the first coding session.
Expected structure once Phase 0 is underway:

```
squeezypay/
- frontend/                     React app (Phase 0+)
  - public/
    - manifest.json             PWA manifest
    - icons/                    App icons for home screen install
  - src/
    - components/
      - BillDashboard/
      - BillCard/
    - App.jsx
    - index.jsx
- backend/                      FastAPI app (Phase 1+)
  - api/                        Route handlers
  - models/                     SQLAlchemy models
  - services/                   Business logic
  - repositories/               Database access layer
  - database/                   SQLite setup and migrations
  - main.py                     FastAPI app entry point
- .env.example                  Example environment variable file (no secrets)
```

---

## Key Technical Notes

- Stack: Python (FastAPI) + SQLite + React
- Encryption: Fernet (cryptography library) for credentials and payment methods
- Bank integration: Plaid API (free developer tier) for Example Credit Union data
- Hosting: Runs on host Windows PC, accessible on home network via local IP
- Mobile: PWA for "Add to Home Screen" on iPhone and Android
- No external access - app is bound to local network only

---

## Decisions Still Open

- Plaid free tier limits and Example Credit Union support should be verified before
Phase 2 begins - see ROADMAP.md implementation concerns
- Plaid OAuth redirect URL behavior on a local network needs to be tested
early in Phase 2
- Host PC startup behavior (auto-start server on boot) - not yet designed

---

## Active Work / Known Issues

None yet - no code has been written.

---

## Biller Reference

Known household billers and their payment URLs. To be moved into the
database in Phase 1. Listed here for POC hardcoding reference.

| Biller | Category | URL |
|---|---|---|
| Example Credit Union | Loans / Debt | https://www.example.com |
| Example Internet Co | Internet / Phone | https://www.example.com/buy/broadband/pay-bill.html |
| Example Electric Co | Utilities | https://www.example.com/account/pay-bill |
| City of East Alton | Utilities | (verify URL) |
| Example Medical Co | Healthcare / Medical | https://www.example.com/pay/ |
| Example Finance Co | Loans / Debt | https://www.example.com/pay |
| Example Student Loan Co | Education | https://example.com/payment |
| Example Student Loan Co 2 | Education | https://www.example.com/manage-loans/make-a-payment/ |

> **Note:** Verify all payment URLs before the POC demo. Billers occasionally
> change their URL structure.
