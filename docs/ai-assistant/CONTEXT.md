# SqueezyPay - AI Session Context

Running notes for AI assistant continuity across sessions.

---

## Repository State

- **Active branch:** `dev`
- **Last commit:** Initial commit - repo scaffold and ai-assistant documentation
- **Uncommitted changes:** None

---

## Current App State

Phase 0 (POC) is complete and tested. The static React frontend with bill dashboard is live on the dev server and installable as a PWA on iPhone and Android.

Active work: Phase 1 begins next - backend and database implementation.

---

## What Has Been Built

- React frontend with Vite + Tailwind CSS
- Bill dashboard component with card layout
- Hardcoded bill data (7 household billers)
- Bill status tracking (overdue, due soon, upcoming)
- One-click navigation to biller payment URLs
- PWA manifest for home screen install on iPhone and Android
- Dev server accessible from home network via local IP
- Fully tested on desktop (localhost) and iPhone (via local IP)

---

## What Has NOT Been Built (Phase 1 targets)

- FastAPI backend
- SQLite database
- Encryption for credentials and payment methods
- Credential vault
- Payment history logging
- Bill management (add, edit, deactivate)
- Settings screen

---

## File Structure

```
squeezypay/
- README.md                     Public-facing onboarding doc
- LICENSE                       MIT license
- .gitignore
- .env.example                  Example environment variables (no secrets)
- docs/
  - ai-assistant/
    - CONTEXT.md                This file
    - REQUIREMENTS.md           Full feature requirements (REQ-001 through REQ-015)
    - ROADMAP.md                Build phases with priority labels
    - DECISIONS.md              Vision, philosophy, architecture decision log
    - USERPREFERENCES.md        Working style and AI collaboration guidelines
- frontend/                     React app (Phase 0 - complete)
  - src/
    - components/
      - BillDashboard.jsx       Dashboard component
      - BillCard.jsx            Individual bill card
    - data/
      - bills.js                Hardcoded bill data
    - utils/
      - billUtils.js            Date and status calculations
    - App.jsx                   Root component
    - main.jsx                  Entry point
    - index.css                 Tailwind imports
  - public/
    - manifest.json             PWA manifest
  - vite.config.js
  - index.html
  - package.json
- backend/                      FastAPI app (Phase 1+)
  - (to be created)
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

- **Phase 1 task:** User has additional household billers beyond the 7 hardcoded in Phase 0.
  Once bill management UI is built (REQ-002), add these to the database.

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
