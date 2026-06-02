# SqueezyPay - Test Cases

Manual test cases to run before every handoff. Add new cases as features are built.
Mark each with current status when running: ✅ Pass | ❌ Fail | ⏳ Not yet testable

---

## TC-001: Admin Dashboard Launches via Desktop Shortcut

**What it tests:** Desktop shortcut → launcher → admin server → browser

**Steps:**
1. Double-click "SqueezyPay Admin" on the desktop
2. Observe two windows open (launcher PowerShell + server window)
3. Observe browser opens automatically at `http://localhost:9000`

**Expected:** Browser shows SqueezyPay Admin dashboard with Backend and Frontend service cards

**Last result:** ✅ Pass (2026-06-01)

---

## TC-002: Admin Dashboard Shows Service Status

**What it tests:** `/api/status` correctly detects running services

**Steps:**
1. Open admin dashboard
2. Observe Backend and Frontend cards

**Expected:** Cards show correct Running/Stopped state with green/red dot

**Last result:** ✅ Pass — both services showed Running with green dots (2026-06-01)

---

## TC-003: Bill Dashboard Loads with Real Dates

**What it tests:** Frontend connects to backend, API mapping works, dates render correctly

**Steps:**
1. Open `http://localhost:5173`
2. Observe bill cards

**Expected:** Each card shows biller name, category badge, a real due date (e.g. "Due Jun 15"), and a Pay Bill button. No "Invalid Date" anywhere.

**Last result:** ✅ Pass after fixing snake_case → camelCase mapping in api.js (2026-06-01)

**Notes:** Was broken earlier this session — `day_of_month` from backend was not being mapped to `dayOfMonth` for frontend. Fixed in `src/utils/api.js`.

---

## TC-004: Dark Mode Toggle

**What it tests:** Theme switching and localStorage persistence

**Steps:**
1. Open `http://localhost:5173`
2. Click the moon/sun icon in the top-right header
3. Verify UI switches to dark/light mode
4. Close and reopen the browser tab
5. Verify mode was remembered

**Expected:** App switches modes on click. Preference persists across tab close/reopen.

**Last result:** ✅ Pass (2026-06-01)

---

## TC-005: Encryption Key Is Active

**What it tests:** `SQUEEZYPAY_ENCRYPTION_KEY` env var is set and backend can encrypt/decrypt

**Steps:**
1. Ensure backend is running
2. Open `http://localhost:8000/docs`
3. Find `POST /api/credentials/`
4. Submit a test credential with any bill_id, username, and password
5. Verify 201 response with no encryption error

**Expected:** Credential created successfully. No RuntimeError about missing key.

**Last result:** ⏳ Not yet tested — requires backend started with env var set and a valid bill_id

---

## TC-006: Pay Bill Button Opens Correct URL

**What it tests:** Bill card Pay Bill button navigates to biller payment page

**Steps:**
1. Open `http://localhost:5173`
2. Click "Pay Bill" on any bill card
3. Verify correct biller website opens in a new tab

**Expected:** New browser tab opens at the biller's payment URL

**Last result:** ✅ Pass (Phase 0 — verified all 7 billers)

---

## TC-007: Admin Log Viewer Shows Backend Logs

**What it tests:** Log file is created, read correctly, displayed in dashboard

**Steps:**
1. Stop backend if running
2. Start backend via admin dashboard Start button
3. Observe log panel in admin dashboard

**Expected:** Log entries appear in the panel showing backend startup messages

**Last result:** ⏳ Not yet tested — backend was started externally this session, not via dashboard

---

## Future Test Cases (not yet testable)

- TC-008: Add a bill via bill management UI
- TC-009: Edit a bill via bill management UI  
- TC-010: Log a payment with confirmation number
- TC-011: Payment history appears in history view
- TC-012: Credential vault — store and retrieve biller credentials
- TC-013: Payment method vault — store and retrieve payment method
- TC-014: PWA installs on iPhone home screen
- TC-015: App accessible from another device on the home network via local IP
