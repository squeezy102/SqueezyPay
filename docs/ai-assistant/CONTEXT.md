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

**Phase 1 (Real Foundation):** Complete.

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
- Bill management view (`BillManagement.jsx`) - table of all bills (active + inactive), add/edit/deactivate actions; `BillFormModal.jsx` for add/edit with validation, category dropdown, recurring toggle
- Income management view (`IncomeManagement.jsx`) - monthly total summary bar, table, show/hide inactive toggle; `IncomeFormModal.jsx` for add/edit
- Settings page (`Settings.jsx`) - Alert Thresholds card (due-soon days, large payment threshold with save confirmation); Transaction Categories card (inline add/edit, 409 conflict messaging)
- Dashboard filtered to bills due within N days (configurable via settings) + overdue; hidden bills expand/collapse toggle (chevron button reveals upcoming bills grid)
- Alert banners on dashboard: overdue, due-soon, large payment - neutral card style, colored icon conveys criticality; thresholds loaded from live settings
- Dark mode toggle - defaults to system preference, persists in localStorage
- Design token system (`src/theme/tokens.js`) - all colors in one place; `cardClass` for uniform card backgrounds, `alertBannerTokens` for banner styling, `actionTokens` for buttons
- API integration layer (`src/utils/api.js`) - snake_case → camelCase mapping, uses `window.location.hostname` so mobile (local IP) works
- PWA manifest for home screen install
- Viewport locked (`user-scalable=no`) to prevent mobile wiggle
- Logo (`frontend/public/logo.png`) in sidebar and mobile top bar

**Backend (FastAPI + SQLite):**
- SQLAlchemy ORM models: Bill, PaymentHistory, Credential, PaymentMethod, TransactionCategory, Income, Setting
- Bills API: `/api/bills/` - full CRUD
- Credentials API: `/api/credentials/` and `/api/credentials/by-bill/{bill_id}`
- Payment Methods API: `/api/payment-methods/`
- Payment History API: `/api/payment-history/` - GET all, GET by bill, POST to log, DELETE
- Income API: `/api/income/` - full CRUD + `/monthly-total` endpoint
- Settings API: `GET /PUT /api/settings/` - key/value store, defaults seeded at startup (`due_soon_days=7`, `large_payment_threshold=500.0`)
- Categories API: `GET/POST/PUT /api/categories/` - no delete endpoint, 409 on duplicate name
- Repository layer: `BillRepository`, `IncomeRepository`, `SettingsRepository`, `CategoryRepository` (joins existing credential/payment method/payment history repositories)
- `IncomeService` with `get_monthly_total` computing estimated monthly income from frequency
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

## What Was Built This Session

**Frontend retheme - SNES-inspired design system:**
- Full color scheme overhaul across all frontend components
- Sidebar: deep SNES violet (`violet-900`) with violet-tinted nav states; teal action buttons (`teal-600`) throughout
- Page backgrounds: `violet-50` light / `slate-950` dark
- All `gray-*` replaced with `slate-*`; all `indigo-*` replaced with `violet-*` (accents) or `teal-*` (buttons)
- `cardClass` token added to `tokens.js` — single uniform card style (`white / slate-800`) used everywhere
- Bill cards: removed status-driven colored backgrounds; all cards now same neutral color; status conveyed by badge only
- Category badges removed from bill dashboard cards — reduced visual noise
- Alert banners: removed colored backgrounds; neutral card style with colored icons only (red=overdue, amber=due-soon, violet=large payment)
- `statusTokens.card` removed — no component reads card background from status tokens anymore
- All modal components (`LogPaymentModal`, `BillFormModal`, `IncomeFormModal`) updated to slate palette
- Mobile top bar matches sidebar violet treatment

---

## What Has NOT Been Built (Phase 1 remaining)

Phase 1 is complete. All REQs have been built.

---

## Next Session Priorities

1. **Tech debt: mobile payment history table** - payment history table is not usable on mobile (scrolls off screen). Needs a card-based or condensed layout for small screens. Deferred by user.
2. **Tech debt: mobile bill management table** - likely same issue as payment history, not yet tested on mobile.
3. **Phase 2 planning: Plaid** - verify Example Credit Union Plaid support, verify Plaid free tier limits, design Plaid OAuth flow for local network. Do before writing any Plaid code.
4. **Admin dashboard metrics pass** - uptime, request rate, DB stats. Admin dashboard is functional but metrics are thin.

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
│   │   │   ├── NavBar.jsx              Sidebar (desktop) + MobileTopBar (mobile)
│   │   │   ├── BillDashboard.jsx       Home tab - bill cards, alert banners, expand/collapse
│   │   │   ├── BillCard.jsx            Individual bill card + Start Workflow button
│   │   │   ├── BillManagement.jsx      Bills tab - manage all bills (active + inactive)
│   │   │   ├── BillFormModal.jsx       Add/edit bill modal
│   │   │   ├── LogPaymentModal.jsx     Payment workflow modal (2-panel)
│   │   │   ├── MoneyInput.jsx          Currency input component
│   │   │   ├── PaymentHistory.jsx      History tab - sortable payment table
│   │   │   ├── IncomeManagement.jsx    Income tab - monthly total + income list
│   │   │   ├── IncomeFormModal.jsx     Add/edit income modal
│   │   │   └── Settings.jsx            Settings tab - alert thresholds + categories
│   │   ├── context/
│   │   │   └── ThemeContext.jsx
│   │   ├── theme/
│   │   │   └── tokens.js               All colors/design tokens, including alertBannerTokens
│   │   └── utils/
│   │       ├── api.js                  All API calls + snake_case→camelCase mapping
│   │       └── billUtils.js            Date/status calculations, filterActionableBills
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
    │   ├── bill_repository.py
    │   ├── credential_repository.py
    │   ├── income_repository.py
    │   ├── payment_method_repository.py
    │   ├── payment_history_repository.py
    │   ├── settings_repository.py
    │   └── category_repository.py
    ├── services/
    │   ├── bill_service.py
    │   ├── category_service.py
    │   ├── credential_service.py
    │   ├── encryption_service.py
    │   ├── income_service.py
    │   ├── payment_method_service.py
    │   ├── payment_history_service.py
    │   └── settings_service.py
    ├── api/
    │   ├── bills.py
    │   ├── categories.py
    │   ├── credentials.py
    │   ├── income.py
    │   ├── payment_methods.py
    │   ├── payment_history.py
    │   └── settings.py
    └── tests/
        ├── conftest.py
        ├── test_bills.py
        ├── test_bill_repository.py
        ├── test_categories.py
        ├── test_frontend_log.py
        ├── test_income.py
        ├── test_payment_history.py
        └── test_settings.py
```

---

## Key Technical Notes

- **Naming conventions:** Python = snake_case (vars/functions), PascalCase (classes). JS = camelCase (vars/functions), PascalCase (components).
- **API response pattern:** All service `_to_dict()` methods control exposed fields. Never return raw ORM objects from routes.
- **snake_case ↔ camelCase:** Backend speaks snake_case. Frontend speaks camelCase. `api.js` is the only translator.
- **Encryption key:** `SQUEEZYPAY_ENCRYPTION_KEY` Windows user environment variable. Lose it = lose all vault data.
- **API base URL:** `window.location.hostname` - works on both localhost and mobile via local IP.
- **Dashboard filter:** `filterActionableBills()` in `billUtils.js` - shows bills due within N days + overdue. Threshold driven by `due_soon_days` setting (default 7), fetched from backend on load.
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
