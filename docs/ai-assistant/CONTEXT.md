# SqueezyPay - AI Session Context

Running notes for AI assistant continuity across sessions.

---

## Repository State

- **Active branch:** `dev`
- **Last commit:** Initial commit - repo scaffold and ai-assistant documentation
- **Uncommitted changes:** None

---

## Current App State

**Phase 0 (POC):** Complete. Static React frontend with bill dashboard, verified working on desktop and iPhone.
All 7 biller payment URLs tested and functional.

**Phase 1 (Real Foundation):** In progress - 30% complete.
- FastAPI backend scaffold: DONE
- SQLite database with ORM models: DONE
- Bills API endpoint: DONE
- Database seeded with hardcoded bills: DONE
- Frontend connected to backend API: DONE
- Next: Credential vault encryption, payment history logging, bill management UI

Both frontend (Vite dev server on 5173) and backend (FastAPI on 8000) are running and communicating.

---

## What Has Been Built

**Frontend (React + Vite + Tailwind):**
- Bill dashboard component with responsive card grid layout
- Bill card component with status badges (overdue, due soon, upcoming)
- One-click "Pay Bill" buttons linking to biller payment portals
- PWA manifest for home screen installation (iPhone, Android)
- Utility functions for date calculations and bill sorting
- API integration layer (frontend/src/utils/api.js)
- Tested on desktop and iPhone

**Backend (FastAPI + SQLite):**
- SQLAlchemy ORM models for bills, payments, credentials, payment methods, categories, income
- SQLite database with auto-initialization
- Bill service layer with CRUD operations
- REST API routes (/api/bills/) for bill management
- CORS middleware for frontend integration
- Health check endpoint (/health)
- Database seed script with 7 hardcoded bills
- Running on localhost:8000

**Infrastructure:**
- Frontend dev server on localhost:5173 (network-accessible via 192.168.1.221:5173)
- Backend API on localhost:8000
- SQLite database file (squeezypay.db) in backend directory
- Python virtual environment for backend (backend/venv)

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

## Running the App (Development)

**Terminal 1 - Backend:**
```
cd backend
source venv/Scripts/activate  # Windows: .\venv\Scripts\Activate.ps1
python main.py
```
Backend runs on `http://localhost:8000`
API docs available at `http://localhost:8000/docs`

**Terminal 2 - Frontend:**
```
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173` (network: `http://192.168.1.221:5173`)

Both must be running for the app to work. Backend should start first.

---

## Active Work / Known Issues / Next Steps

**Phase 1 Progress (30% complete):**
- ✅ Backend scaffold and FastAPI app
- ✅ SQLite database with ORM models
- ✅ Bills API endpoint
- ✅ Frontend connected to backend API
- ⏳ Credential vault (encrypted storage for usernames/passwords)
- ⏳ Payment history logging API
- ⏳ Bill management UI (add/edit/deactivate bills)
- ⏳ Due date alerts on dashboard
- ⏳ Income tracking API and UI
- ⏳ Settings screen

**Known Issues:**
- None currently - app is stable and functional

**User Notes:**
- User has additional household billers beyond the 7 seeded in database.
  Once bill management UI is built (REQ-002), add these via the app UI.
- Local DNS naming (squeezypay.local) is a Phase 1+ task (ROADMAP.md).
  Currently accessible via IP address (192.168.1.221:5173).

**Architecture Decisions:**
- Friction removal hierarchy for bill payment (DECISIONS.md) - always prioritize:
  1. Automated payment via API (ideal)
  2. Seamless pre-authenticated login (fallback 1)
  3. One-click navigation to payment page (fallback 2)
  4. Home page + stored credentials (last resort)
- Credential vault (Phase 1) will enable fallbacks 1 and 4.

**Biller Notes:**
- Example Credit Union: No direct payment portal. Users manage via app or branch.
- Example Finance Co / Example Medical Co: Example Medical Co is owned by Example Finance Co. Links go to home pages (payment portal requires login context).

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
