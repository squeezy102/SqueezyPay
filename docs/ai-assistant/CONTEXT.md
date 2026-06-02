# SqueezyPay - AI Session Context

Running notes for AI assistant continuity across sessions.

---

## Repository State

- **Active branch:** `master`
- **Last commit:** (see git log)
- **Uncommitted changes:** None

---

## Current App State

**Phase 0 (POC):** Complete.

**Phase 1 (Real Foundation):** In progress - ~85% complete.

**Admin Dashboard:** Pulled forward from Phase 4. Basic version complete and working.

---

## What Has Been Built

**Frontend (React + Vite + Tailwind v4):**
- App shell with responsive layout - sidebar nav on desktop (lg+), hamburger menu on mobile
- Sidebar contains logo, nav items, dark mode toggle at bottom
- Bill dashboard - card grid, scales 1/2/3/4 columns by breakpoint, status badges
- Bill cards - "Start Workflow" button opens payment workflow modal
- Payment workflow modal - two-panel design (Step 1: go pay / Step 2: log it)
  - Credentials section with show/hide toggle and per-field copy buttons
  - MoneyInput - standard number input with $ prefix, formats on blur (consistent desktop/iOS)
  - Payment method dropdown (pulls from vault, falls back to free text if empty)
  - Success banner on save, error message on failure
- Payment history view - sortable table, compact rows, search by biller/confirmation/method/notes
- Dashboard filtered to bills due within 7 days + overdue; hidden bill count shown
- Dark mode toggle - defaults to system preference, persists in localStorage
- Design token system (`src/theme/tokens.js`) - all colors in one place
- API integration layer (`src/utils/api.js`) - snake_case → camelCase mapping, uses `window.location.hostname` so mobile (local IP) works
- PWA manifest for home screen install
- Viewport locked (`user-scalable=no`) to prevent mobile wiggle
- Logo (`frontend/public/logo.png`) in sidebar and mobile top bar

**Backend (FastAPI + SQLite):**
- SQLAlchemy ORM models: Bill, PaymentHistory, Credential, PaymentMethod, TransactionCategory, Income
- Bills API: `/api/bills/` - full CRUD
- Credentials API: `/api/credentials/` and `/api/credentials/by-bill/{bill_id}`
- Payment Methods API: `/api/payment-methods/`
- Payment History API: `/api/payment-history/` - GET all, GET by bill, POST to log, DELETE
- Encryption service (`services/encryption_service.py`) - Fernet, lazy-init, reads `SQUEEZYPAY_ENCRYPTION_KEY` env var
- Structured logging (`core/logging_config.py`) - console (plain) + rotating JSON file at `backend/logs/squeezypay.log`
- Health check endpoint: `/health`
- Database seed script: 7 household bills

**Admin Dashboard (FastAPI on port 9000):**
- Lives in `admin/` directory
- Service start/stop, live log viewer, status cards
- Successful `/api/status` polls suppressed from uvicorn log (noise filter)
- **Vision:** Full ops console - logs, metrics, health, graphs. Browser-based pinned tab. Do NOT convert to tray/native app.

**Scripts:**
- `scripts/generate_key.py` - one-time Fernet key generation
- `scripts/launch-admin.ps1` - starts admin server, opens browser
- `scripts/create-shortcut.ps1` - creates desktop shortcut
- `scripts/autostart.ps1` - starts admin server silently on login
- `scripts/register-autostart.ps1` - registers auto-start as Windows scheduled task (run once as Administrator)

**Desktop Shortcut:**
- "SqueezyPay Admin" on the desktop
- Double-click → admin server starts → browser opens at `http://localhost:9000`
- Use Start buttons in dashboard to bring up backend and frontend

---

## What Has NOT Been Built (Phase 1 remaining)

- Bill management UI - add, edit, deactivate bills from the frontend (REQ-002)
- Due date alerts on dashboard (REQ-013)
- Income tracking API and UI (REQ-010)
- Settings screen (REQ-015)

---

## Next Session Priorities

1. **Bill management UI** - add/edit/deactivate bills from the frontend (REQ-002). Currently bills can only be added via the seed script.
2. **Due date alerts** - banner/badge on dashboard for overdue and due-soon bills (REQ-013)
3. **Income tracking** - API and UI (REQ-010)
4. **Settings screen** - alert thresholds, category management (REQ-015)

---

## File Structure

```
squeezypay/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── docs/ai-assistant/
│   ├── CONTEXT.md              This file
│   ├── REQUIREMENTS.md         REQ-001 through REQ-015
│   ├── ROADMAP.md              Build phases and priorities
│   ├── DECISIONS.md            Architecture and design decisions
│   ├── USERPREFERENCES.md      Working style guidelines
│   └── TESTCASES.md            Manual test cases
├── scripts/
│   ├── generate_key.py
│   ├── launch-admin.ps1
│   ├── create-shortcut.ps1
│   ├── autostart.ps1
│   └── register-autostart.ps1
├── admin/
│   ├── main.py
│   ├── dashboard.html
│   └── requirements.txt
├── frontend/
│   ├── index.html              Viewport locked for mobile
│   ├── public/
│   │   ├── logo.png            App logo
│   │   ├── manifest.json       PWA manifest
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src/
│   │   ├── App.jsx             App shell - sidebar + mobile nav + tab routing
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── NavBar.jsx          Sidebar (desktop) + MobileTopBar (mobile)
│   │   │   ├── BillDashboard.jsx   Home tab - bill cards, status badges
│   │   │   ├── BillCard.jsx        Individual bill card + Start Workflow button
│   │   │   ├── LogPaymentModal.jsx Payment workflow modal (2-panel)
│   │   │   ├── MoneyInput.jsx      Currency input component
│   │   │   └── PaymentHistory.jsx  History tab - sortable payment table
│   │   ├── context/
│   │   │   └── ThemeContext.jsx
│   │   ├── theme/
│   │   │   └── tokens.js           All colors/design tokens live here
│   │   └── utils/
│   │       ├── api.js              All API calls + snake_case→camelCase mapping
│   │       └── billUtils.js        Date/status calculations, filterActionableBills
│   ├── vite.config.js
│   └── package.json
└── backend/
    ├── main.py
    ├── seed.py
    ├── core/
    │   └── logging_config.py
    ├── database/
    │   └── db.py
    ├── models/
    │   └── models.py
    ├── repositories/
    │   ├── credential_repository.py
    │   ├── payment_method_repository.py
    │   └── payment_history_repository.py
    ├── services/
    │   ├── bill_service.py
    │   ├── credential_service.py
    │   ├── encryption_service.py
    │   ├── payment_method_service.py
    │   └── payment_history_service.py
    └── api/
        ├── bills.py
        ├── credentials.py
        ├── payment_methods.py
        └── payment_history.py
```

---

## Key Technical Notes

- **Naming conventions:** Python = snake_case (vars/functions), PascalCase (classes). JS = camelCase (vars/functions), PascalCase (components).
- **API response pattern:** All service `_to_dict()` methods control exposed fields. Never return raw ORM objects from routes.
- **snake_case ↔ camelCase:** Backend speaks snake_case. Frontend speaks camelCase. `api.js` is the only translator.
- **Encryption key:** `SQUEEZYPAY_ENCRYPTION_KEY` Windows user environment variable. Lose it = lose all vault data.
- **API base URL:** `window.location.hostname` - works on both localhost and mobile via local IP.
- **Dashboard filter:** `filterActionableBills()` in `billUtils.js` - shows bills due within 7 days + overdue. Configurable later via settings.
- **Design tokens:** All frontend colors in `src/theme/tokens.js`. Never hardcode colors in components.
- **Logging:** JSON logs at `backend/logs/squeezypay.log`. Never log passwords, keys, or credential data.
- **Platform targets:** Desktop (Windows) first. iOS parity. Android out of scope.
- **Credential vault on mobile:** Copy-paste only - iOS clipboard is one item at a time. Known limitation, second-pass design discussion wanted. See DECISIONS.md.

---

## Running the App

**Preferred: Desktop shortcut**
Double-click "SqueezyPay Admin" → use Start buttons in dashboard

**Manual fallback:**
```powershell
# Terminal 1 - Backend
cd c:\SqueezyPay\backend
.\venv\Scripts\Activate.ps1
python main.py

# Terminal 2 - Frontend
cd c:\SqueezyPay\frontend
npm run dev

# Terminal 3 - Admin dashboard
cd c:\SqueezyPay\admin
..\backend\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 9000
```

URLs:
- App: `http://localhost:5173` (network: `http://192.168.1.221:5173`)
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Admin dashboard: `http://localhost:9000`

---

## Decisions Still Open

- **Plaid free tier / Example Credit Union support** - verify before Phase 2 begins
- **Plaid OAuth on local network** - test redirect URL behavior early in Phase 2
- **Local DNS** (`squeezypay.local`) - Phase 1+ quality of life, not blocking
- **Credential vault UX (mobile)** - copy-paste two-trip flow is acknowledged as poor. Second-pass design discussion explicitly wanted before Phase 2.
- **Browser extension (desktop auto-fill)** - planned for later phase, not yet scoped

---

## Biller Reference

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
