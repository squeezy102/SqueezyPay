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

**Phase 1 (Real Foundation):** In progress - ~70% complete.

**Admin Dashboard:** Pulled forward from Phase 4. Basic version complete and working.

---

## What Has Been Built

**Frontend (React + Vite + Tailwind v4):**
- Bill dashboard with responsive card grid, status badges (overdue, due soon, upcoming)
- Bill card component — dark mode aware, uses design token system
- Dark mode toggle (moon/sun icon in header) — defaults to system preference, persists in localStorage
- Design token system (`src/theme/tokens.js`) — all colors and visual decisions in one place
- API integration layer (`src/utils/api.js`) — handles snake_case → camelCase mapping from backend
- PWA manifest for home screen install (iPhone, Android)
- Removed deprecated `apple-mobile-web-app-capable` meta tag
- ThemeContext (`src/context/ThemeContext.jsx`) — React context for dark mode state

**Backend (FastAPI + SQLite):**
- SQLAlchemy ORM models: Bill, PaymentHistory, Credential, PaymentMethod, TransactionCategory, Income
- All models follow snake_case convention; `PaymentMethod.payment_type` (not `type` — avoids Python builtin shadow)
- Service layer with explicit `_to_dict()` on all services — controls exactly what fields the API exposes
- Bills API: `/api/bills/` — full CRUD, returns dicts (not raw ORM objects)
- Credentials API: `/api/credentials/` and `/api/credentials/by-bill/{bill_id}`
- Payment Methods API: `/api/payment-methods/`
- Encryption service (`services/encryption_service.py`) — Fernet, lazy-init, reads `SQUEEZYPAY_ENCRYPTION_KEY` env var
- Structured logging (`core/logging_config.py`) — console (plain text) + rotating JSON file at `backend/logs/squeezypay.log`
- All services have named loggers (`squeezypay.services.*`)
- Health check endpoint: `/health`
- Database seed script: 7 household bills

**Admin Dashboard (FastAPI on port 9000):**
- Lives in `admin/` directory
- Serves `dashboard.html` at `/`
- `/api/status` — reports whether backend (8000) and frontend (5173) are running
- `/api/start/{service}` and `/api/stop/{service}` — starts/stops backend and frontend processes
- `/api/logs/recent` — returns last N lines of `squeezypay.log` as parsed JSON
- `/api/logs` — Server-Sent Events stream for live log tailing
- Dashboard UI: service cards with status dots, start/stop buttons, live log viewer with level filter
- **Vision:** This grows into a full operations console — logs, metrics, health checks, graphs, diagnostics. Keep it browser-based (pinned tab). Do NOT convert to tray app or native app.

**Scripts:**
- `scripts/generate_key.py` — one-time Fernet key generation with setup instructions
- `scripts/launch-admin.ps1` — starts admin server, waits for ready, opens browser
- `scripts/create-shortcut.ps1` — creates "SqueezyPay Admin" desktop shortcut

**Desktop Shortcut:**
- "SqueezyPay Admin" on the desktop
- Double-click → launcher window opens → admin server starts → browser opens at `http://localhost:9000`
- From the dashboard, use Start buttons to bring up backend and frontend

---

## What Has NOT Been Built (Phase 1 remaining)

- Payment history logging API and UI (REQ-003)
- Bill management UI — add, edit, deactivate bills (REQ-002)
- Due date alerts on dashboard (REQ-013)
- Income tracking API and UI (REQ-010)
- Settings screen (REQ-015)

---

## Next Session Priorities

1. **Write health check log suppression** — the uvicorn access log is noisy with successful `/api/status` polls from the dashboard's status poller. Add a custom logging filter in `admin/main.py` that suppresses these from the access log.
2. **Auto-start on Windows login** — services should start automatically so the user never has to think about it. Admin tab should open on login. This was deferred at end of session 2.
3. **Payment history logging API** — next Phase 1 item after admin dashboard
4. **Bill management UI** — add/edit/deactivate bills from the frontend

---

## File Structure

```
squeezypay/
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── docs/ai-assistant/
│   ├── CONTEXT.md          This file
│   ├── REQUIREMENTS.md     REQ-001 through REQ-015
│   ├── ROADMAP.md          Build phases and priorities
│   ├── DECISIONS.md        Architecture and design decisions
│   ├── USERPREFERENCES.md  Working style guidelines
│   └── TESTCASES.md        Manual test cases (growing list)
├── scripts/
│   ├── generate_key.py     One-time encryption key setup
│   ├── launch-admin.ps1    Admin dashboard launcher
│   └── create-shortcut.ps1 Desktop shortcut creator
├── admin/
│   ├── main.py             Admin FastAPI app (port 9000)
│   ├── dashboard.html      Admin dashboard UI
│   └── requirements.txt    Admin dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BillDashboard.jsx
│   │   │   └── BillCard.jsx
│   │   ├── context/
│   │   │   └── ThemeContext.jsx
│   │   ├── theme/
│   │   │   └── tokens.js       Design tokens (all colors live here)
│   │   ├── utils/
│   │   │   ├── api.js          API calls + snake_case→camelCase mapping
│   │   │   └── billUtils.js    Date/status calculations
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/manifest.json
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
    │   └── payment_method_repository.py
    ├── services/
    │   ├── bill_service.py
    │   ├── credential_service.py
    │   ├── encryption_service.py
    │   └── payment_method_service.py
    └── api/
        ├── bills.py
        ├── credentials.py
        └── payment_methods.py
```

---

## Key Technical Notes

- **Naming conventions:** Python = snake_case (vars/functions), PascalCase (classes), UPPER_SNAKE_CASE (constants). JS = camelCase (vars/functions), PascalCase (components/files).
- **API response pattern:** All service `_to_dict()` methods control what fields are exposed. Never return raw ORM objects from routes.
- **snake_case ↔ camelCase:** Backend speaks snake_case (Python convention). Frontend speaks camelCase (JS convention). `api.js` is the translator — mapping happens once on the way in.
- **Encryption key:** `SQUEEZYPAY_ENCRYPTION_KEY` Windows user environment variable. Set once, never touched again. Lose it = lose all vault data.
- **Admin dashboard vision:** Full ops console (logs, metrics, health, graphs). Browser-based pinned tab — do not convert to tray app or native desktop app.
- **Design tokens:** All frontend colors in `src/theme/tokens.js`. Never hardcode colors in components.
- **Logging:** JSON logs at `backend/logs/squeezypay.log`. Admin dashboard reads this file. Never log passwords, keys, or credential data.

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
cd c:\SqueezyPay\backend
.\venv\Scripts\Activate.ps1
cd ..\admin
python -m uvicorn main:app --host 0.0.0.0 --port 9000
```

URLs:
- App: `http://localhost:5173` (network: `http://192.168.1.221:5173`)
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Admin dashboard: `http://localhost:9000`

---

## Decisions Still Open

- **Auto-start on Windows login** — not yet implemented. Priority for next session.
- **Plaid free tier / Example Credit Union support** — verify before Phase 2 begins
- **Plaid OAuth on local network** — test redirect URL behavior early in Phase 2
- **Local DNS** (`squeezypay.local`) — Phase 1+ quality of life, not blocking

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
