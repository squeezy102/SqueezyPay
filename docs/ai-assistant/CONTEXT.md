# SqueezyPay - AI Session Context

Running notes for AI assistant continuity across sessions.

---

## Repository State

- **Active branch:** `dev`
- **Last commit:** (see git log)
- **Uncommitted changes:** None — all work committed.

---

## Current App State

**Phase 0 (POC):** Complete.

**Phase 1 (Real Foundation):** Complete. All REQs including REQ-016 (authentication) are done.

**Engineering Foundations:** Alembic done. Auth done. TypeScript migration done. CI gate done. Playwright scaffolded. React Query, React Hook Form, Vitest still to do.

**Admin Dashboard:** Pulled forward from Phase 4. Basic version complete and working.

---

## What Has Been Built

**Frontend (React + Vite + Tailwind v4 + TypeScript):**
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
- `AuthContext` (`src/context/AuthContext.jsx`) - token state in sessionStorage, 401 event handling, isConfigured/isAuthenticated/loading
- `SetupScreen` (`src/components/SetupScreen.jsx`) - first-launch passphrase creation screen
- `LoginScreen` (`src/components/LoginScreen.jsx`) - returning session login screen
- `AuthGate` in `App.jsx` - routes to Setup, Login, or AppShell based on auth state
- Logout button in sidebar (desktop) and mobile dropdown

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
- Database seed script: example household bills
- Auth API: `GET /api/auth/status`, `POST /api/auth/setup`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/change-passphrase`
- `AuthConfig` model and `auth_config` table (Alembic migration `3b8a84212839`)
- `AuthService` (`services/auth_service.py`) - bcrypt hashing, JWT token creation/verification, passphrase change
- `require_auth` dependency (`core/auth.py`) - JWT bearer token guard on all API routes
- slowapi rate limiting on login endpoint (10/min)

**Admin Dashboard (FastAPI on port 9000):**
- Lives in `admin/` directory
- Service start/stop, live log viewer, status cards
- Successful `/api/status` polls suppressed from uvicorn log (noise filter)
- **Vision:** Full ops console - logs, metrics, health, graphs. Browser-based pinned tab. Do NOT convert to tray/native app.

**Scripts:**
- `scripts/generate_key.py` - one-time Fernet key generation
- `scripts/tray.py` - system tray icon; manages all three services; icon color = green/yellow/red aggregate state
- `scripts/launch-tray.ps1` - desktop shortcut target; installs deps, launches tray hidden
- `scripts/launch-admin.ps1` - legacy admin-only launcher (kept for fallback)
- `scripts/create-shortcut.ps1` - creates desktop shortcut (now targets launch-tray.ps1)
- `scripts/autostart.ps1` - legacy; superseded by launch-tray.ps1 for autostart
- `scripts/register-autostart.ps1` - registers tray auto-start as Windows scheduled task (run once as Administrator)

**Desktop Shortcut:**
- "SqueezyPay" on the desktop
- Double-click → tray icon appears in system tray, admin server starts automatically
- Right-click tray icon → Start All / Stop All / Open Dashboard / Open App / individual service toggles
- Icon is green (all up), yellow (partial), red (all down)

---

## What Was Built This Session

**Tray icon tooltip:**
- Hover over tray icon now shows per-service status (Admin / Backend / Frontend with ●/○ indicators)
- Updates every 4 seconds with the poll cycle
- Color was already working (green/yellow/red), tooltip was the missing piece

**Admin dashboard - frontend start/stop fixes (PARTIALLY BROKEN - see below):**
- Stop logic rewritten: kill tracked handle + kill by port + wait for process to exit + poll port release
- `_is_port_in_use` now verifies owning pid is alive (avoids Windows stale socket false positives)
- Subprocess stdout/stderr now piped to `backend/logs/backend.log` and `backend/logs/frontend.log`
- `_load_user_env()` expanded to read both HKLM system env and HKCU user env and combine all PATH sources

**KNOWN BROKEN - MUST FIX NEXT SESSION:**
- Frontend still does not start from admin dashboard / tray
- `frontend.log` shows: `'npm' is not recognized as an internal or external command`
- Root cause: `cmd.exe` subprocess launched by the admin server is not inheriting PATH correctly even though nodejs IS in `os.environ` PATH when tested directly
- Confirmed: `subprocess.run(['cmd.exe', '/c', 'where npm'], env=os.environ)` finds npm when run from terminal. Same call fails when admin server launches it as a subprocess.
- Hypothesis: the admin server itself is launched by the tray with a stripped environment, and `os.environ` inside the admin process does not have the full PATH. `_load_user_env()` should fix this but something is still wrong.
- Next session: add a debug endpoint to `/api/debug/env` that returns the PATH the admin server sees, compare with what terminal sees, and trace from there.

**React Query (TanStack Query v5):**
- `@tanstack/react-query@5.101.0` + `@tanstack/react-query-devtools@5.101.0` installed in `frontend/`
- `QueryClientProvider` added in `main.tsx` (staleTime: 30s, retry: 1)
- `ReactQueryDevtools` added in `App.tsx` (initialIsOpen: false — floating button in dev)
- All `useEffect`/`useState` API call patterns replaced with `useQuery`/`useMutation` across every component:
  - `BillDashboard` — `useQuery(["bills"])` + `useQuery(["settings"])`
  - `BillCard` — `useQueryClient` to invalidate `["bills"]` on payment logged
  - `BillManagement` — `useQuery(["bills", "all"])`, mutations for save/toggle with invalidation
  - `PaymentHistory` — `useQuery(["payments"])`
  - `LogPaymentModal` — `useQuery(["credentials", "bill", billId])`, `useQuery(["paymentMethods"])`, mutation for logPayment invalidates `["payments"]` + `["bills"]`
  - `IncomeManagement` — `useQuery(["income", { includeInactive }])`, `useQuery(["income", "monthly-total"])`, mutation for toggle
  - `IncomeFormModal` — mutation for create/update, invalidates `["income"]`
  - `Settings` (AlertThresholdsCard) — `useQuery(["settings"])`, mutation for updateSettings
  - `Settings` (CategoriesCard) — `useQuery(["categories"])`, invalidation on add/edit
- Query key taxonomy (canonical - use these everywhere):
  - `["bills"]` — active bills
  - `["bills", "all"]` — all bills including inactive
  - `["settings"]` — app settings
  - `["payments"]` — all payment history
  - `["payments", "bill", billId]` — payments for a specific bill
  - `["income", { includeInactive: boolean }]` — income sources
  - `["income", "monthly-total"]` — computed monthly income total
  - `["categories"]` — transaction categories
  - `["credentials", "bill", billId]` — credential for a bill
  - `["paymentMethods"]` — payment methods vault

**CI gate (GitHub Actions):**
- `.github/workflows/ci.yml` — runs on push to dev and PR to master
- Backend job: `pytest --cov --cov-fail-under=80` (currently 87% coverage, 55 tests passing)
- Frontend job: `tsc --noEmit` typecheck
- Secrets: `CI_ENCRYPTION_KEY` and `CI_SECRET_KEY` stored in GitHub repo secrets
- Node.js pinned to 24 in workflow (20 deprecated June 2026)
- `fastapi` pinned to `0.136.3` in requirements.txt to match local venv (was 0.104.1, caused CI httpx compat failure)
- `pytest-cov==6.0.0` added to requirements
- `.coverage` and `htmlcov/` added to `.gitignore`
- Fixed stale status code assertions in `test_bills.py`, `test_bill_repository.py`, `test_payment_history.py` (tests expected 200 on endpoints that now correctly return 201/204/404)
- `BillCreate.expected_amount` made `float | None` (was required float — test correctly caught it)
- Branch protection on master enabled in GitHub with "Do not allow bypassing" checked

**Playwright E2E scaffold:**
- `package.json` + `package-lock.json` at repo root — standard Playwright layout
- `playwright.config.ts` — targets `localhost:5173`, Chromium + Mobile Safari projects
- `tests/e2e/dashboard.spec.ts` — placeholder spec; full suite to be written as features accumulate
- Playwright browsers downloaded locally

**Repo made public:**
- Full git history scrubbed via `git filter-repo --replace-text` — all personal biller names (Navy Federal/NFCU, Sallie Mae, Nelnet, Ameren, AT&T, CareCredit, Synchrony) replaced with generic examples across all commits on all branches
- Force-pushed all branches after rewrite
- GitHub repo visibility changed to public
- Issues enabled; branch protection enforced

**Previous session (tray + TypeScript):**
**Single-instance tray enforcement:**
- `tray.py` acquires Windows named mutex `Global\SqueezyPayTray` at startup; second launch detects it and exits silently before doing anything
- `launch-tray.ps1` also checks for a running `tray.py` process before launching to avoid even a brief double-icon flash

**TypeScript migration (frontend):**
- Full migration from `.jsx`/`.js` to `.tsx`/`.ts` — zero old source files remain
- `src/types.ts` — all shared domain interfaces (Bill, Payment, Income, AppSettings, Category, Credential, PaymentMethod, auth types, BillStatus union)
- `src/utils/api.ts` — all API functions typed with raw/mapped interfaces, typed payloads (BillPayload, LogPaymentPayload, IncomePayload)
- `src/utils/billUtils.ts` — date/status utilities typed
- `src/theme/tokens.ts` — design tokens typed
- `src/context/AuthContext.tsx`, `ThemeContext.tsx` — contexts typed with explicit interfaces, `useAuth`/`useTheme` now throw if used outside provider
- All 14 components converted to `.tsx` with full prop/state typing
- `tsconfig.json` with strict mode enabled
- `src/vite-env.d.ts` — Vite client type reference
- `package.json` — added `typecheck` script (`tsc --noEmit`)
- Build: 0 TS errors, clean Vite build (95ms, 35 modules)

**System tray icon:**
- `scripts/tray.py` — pystray + Pillow tray icon; owns the admin server process directly; delegates backend/frontend to the admin API; polls every 4s and updates icon color (green/yellow/red) and menu state in real time
- `scripts/launch-tray.ps1` — desktop shortcut target; installs deps, launches tray with no console window
- `scripts/create-shortcut.ps1` — updated to target tray launcher; shortcut renamed to "SqueezyPay"
- `scripts/register-autostart.ps1` — updated to launch tray on login
- `admin/requirements.txt` — added pystray, Pillow, requests

**Codebase audit and cleanup:**
- Service/repository layer standardized - `CredentialRepository`, `PaymentMethodRepository`, `CredentialService`, `PaymentMethodService` converted from instance-based to static methods. Entire backend now uses one consistent pattern.
- Pydantic request models added to all endpoints that were using raw `dict`: `bills.py`, `income.py`, `payment_history.py`, `settings.py`, `categories.py`. All 404s now use `HTTPException` consistently.
- N+1 query fixed in `PaymentHistoryService.get_all()` - now a single JOIN query. Also added `order_by(payment_date.desc())`.
- `BillDashboard.jsx` `largePending` filter - removed dead `!== "paid"` check that could never be true.
- CORS locked down from `allow_origins=["*"]` to localhost ports + private network IP regex (`192.168.*`, `10.*`).
- `filterActionableBills()` in `billUtils.js` - removed redundant double status calculation. Overdue bills have negative `daysUntilDue` so `<= windowDays` already catches them.
- Logo removed from all components (SetupScreen, LoginScreen, NavBar sidebar, NavBar mobile). `logo.png` deleted from repo. App name displayed as text.
- Mobile scope formally narrowed: Windows primary, iPhone functional for core workflows only (dashboard, bill pay, balance check, payment history). Documented in DECISIONS.md.
- Decision reversed: system tray icon approved for service management. Documented in DECISIONS.md.

**Admin dashboard stop/start fixes:**
- `_load_user_env()` added to `admin/main.py` - reads `HKCU\Environment` from the Windows registry and merges user env vars into the backend subprocess env. Fixes 500 errors on login when backend is launched from the admin dashboard shortcut.
- `stop_service` rewritten to kill by port via `psutil` when no tracked process handle exists. Stop now works regardless of how the service was started (manually, prior admin instance, shortcut, etc.)
- Backend Open link removed from dashboard - backend has no browseable UI; link returned 404. `url` field removed from backend status response; dashboard template updated to only render Open button when `info.url` is present.
- Service card `min-height` added to `status-row` to keep card heights uniform after removing the URL line from the backend card.

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

## What Has NOT Been Built

Phase 1 is complete. All REQs including REQ-016 (authentication) have been built.

---

## Next Session Priorities

1. **BLOCKER: Fix frontend start from admin dashboard** - npm not found in subprocess PATH. Add `/api/debug/env` endpoint to the admin server, call it and compare PATH to what a terminal sees. Fix `_load_user_env()` or the subprocess launch so npm resolves. Test by starting/stopping frontend 3 times via the dashboard before declaring fixed.
2. **React Hook Form** - add before more forms are written. Migrate BillFormModal, IncomeFormModal, LogPaymentModal, Settings.
3. **Vitest** - frontend unit test infrastructure. Install, configure, write initial tests for billUtils and api utilities.
5. **Tech debt: branding refactor** - Logo removed (was placeholder). App name displayed as text in sidebar, mobile top bar, login, and setup screens. A proper brand identity is needed before open-source launch: new logo, new color scheme (approachable, professional - replace the SNES violet/teal placeholder). Treat all current visual design as a placeholder. Do not invest in polish until brand direction is decided.
6. **Tech debt: UI/theming overhaul** - Current color scheme is jarring and clashing. The SNES-inspired violet/teal theme needs a full design pass. Blocked on branding refactor above.
7. **Tech debt: no UI for passphrase change** - `POST /api/auth/change-passphrase` is built but not surfaced in the Settings screen. Add a "Change Passphrase" card to Settings when doing the Settings pass.
8. **Tech debt: mobile payment history table** - payment history table is not usable on mobile (scrolls off screen). Payment history is a core mobile workflow - needs a card-based or condensed layout for small screens.
9. **Tech debt: mobile bill management table** - bill management (add/edit/deactivate) is desktop-only scope. Mobile only needs to view and pay bills, not manage them. Low priority.
10. **Phase 2 planning: Plaid** - verify your financial institution's Plaid support, verify Plaid free tier limits, design Plaid OAuth flow for local network. Do before writing any Plaid code.
11. **Admin dashboard metrics pass** - uptime, request rate, DB stats. Admin dashboard is functional but metrics are thin.

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
│   │   │   ├── Settings.jsx            Settings tab - alert thresholds + categories
│   │   │   ├── SetupScreen.jsx         First-launch passphrase creation screen
│   │   │   └── LoginScreen.jsx         Returning session login screen
│   │   ├── context/
│   │   │   ├── ThemeContext.jsx
│   │   │   └── AuthContext.jsx
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
    ├── alembic/
    │   └── versions/
    ├── core/
    │   ├── logging_config.py
    │   └── auth.py
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
    │   ├── settings_service.py
    │   └── auth_service.py
    ├── api/
    │   ├── bills.py
    │   ├── categories.py
    │   ├── credentials.py
    │   ├── income.py
    │   ├── payment_methods.py
    │   ├── payment_history.py
    │   ├── settings.py
    │   └── auth.py
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
- **JWT secret key:** `SQUEEZYPAY_SECRET_KEY` Windows user environment variable. Used for JWT signing. Lose it = all sessions invalidated (not data loss, just forces re-login).
- **Auth token storage:** Stored in `sessionStorage` - clears on browser/tab close by design (REQ-016).
- **API base URL:** `window.location.hostname` - works on both localhost and mobile via local IP.
- **Dashboard filter:** `filterActionableBills()` in `billUtils.js` - shows bills due within N days + overdue. Threshold driven by `due_soon_days` setting (default 7), fetched from backend on load.
- **Design tokens:** All frontend colors in `src/theme/tokens.js`. Never hardcode colors in components.
- **Logging:** JSON logs at `backend/logs/squeezypay.log`. Never log passwords, keys, or credential data.
- **Platform targets:** Windows primary. Mobile (iPhone) supported for core workflows only: dashboard, bill pay, balance check, payment history. All other features (reporting, graphs, analytics, settings management, bill management) are desktop-only. Android out of scope.
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

- **Plaid free tier / institution support** - verify your financial institution is on Plaid's supported list and free tier limits are acceptable before Phase 2 begins
- **Plaid OAuth on local network** - test redirect URL behavior early in Phase 2
- **Local DNS** (`squeezypay.local`) - Phase 1+ quality of life, not blocking
- **Credential vault UX (mobile)** - copy-paste two-trip flow is acknowledged as poor. Second-pass design discussion explicitly wanted before Phase 2.
- **Browser extension (desktop auto-fill)** - planned for later phase, not yet scoped

---

## Biller Reference

The database seed script (`backend/seed.py`) includes example bills. Replace these with your own billers after setup.
