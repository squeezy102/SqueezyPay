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

**Last result:** ✅ Pass (Phase 0 — verified all seeded billers)

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

## TC-008: Log a Payment via Start Workflow Modal

**What it tests:** Payment workflow modal saves a payment record correctly

**Steps:**
1. Open `http://localhost:5173`
2. Click "Start Workflow" on any bill card
3. Click "Go to [Biller]" - verify biller site opens in new tab
4. Enter an amount, confirmation number, and payment method
5. Click "Save Payment"

**Expected:** Green "Payment saved!" banner appears, modal closes after ~1.5 seconds

**Last result:** ✅ Pass (2026-06-01)

---

## TC-009: Payment History Table Shows Saved Records

**What it tests:** Payment history API and table view

**Steps:**
1. Log a payment via TC-008
2. Click "History" in the nav
3. Verify the payment appears in the table

**Expected:** Record visible with correct biller, amount, date, confirmation number

**Last result:** ✅ Pass (2026-06-01)

---

## TC-010: Payment History Search

**What it tests:** Search filtering in history table

**Steps:**
1. Open History tab
2. Type part of a biller name in the search box

**Expected:** Table filters to matching records only, record count updates

**Last result:** ✅ Pass (2026-06-01)

---

## TC-011: Payment History Sort

**What it tests:** Column sort in history table

**Steps:**
1. Open History tab with multiple records
2. Click "Amount" column header
3. Click again to reverse sort

**Expected:** Rows reorder by amount ascending then descending

**Last result:** ⏳ Not yet tested - requires multiple payment records

---

## TC-012: Mobile Layout Renders Correctly

**What it tests:** Responsive layout on iPhone

**Steps:**
1. Open app on iPhone via local IP
2. Verify hamburger menu appears (no sidebar)
3. Tap hamburger - verify nav dropdown opens
4. Navigate to History tab

**Expected:** Clean single-column layout, no horizontal overflow, no wiggle

**Last result:** ✅ Pass (2026-06-01)

---

## TC-013: Auto-Start on Windows Login

**What it tests:** Admin server starts automatically on login

**Steps:**
1. Restart PC
2. Wait ~30 seconds after login
3. Navigate to `http://localhost:9000`

**Expected:** Admin dashboard loads without manually starting anything

**Last result:** ✅ Registered and verified via Task Scheduler (2026-06-01)

---

## TC-014: Add a Bill via Bill Management UI

**What it tests:** BillManagement add flow — form modal saves to backend, table updates

**Steps:**
1. Open the Bills tab
2. Click "Add Bill"
3. Fill in biller name, category, day of month, amount
4. Click Save

**Expected:** Modal closes, new bill appears in the table

**Last result:** ⏳ Not yet tested

---

## TC-015: Edit a Bill via Bill Management UI

**What it tests:** BillManagement edit flow — existing values pre-populate, changes persist

**Steps:**
1. Open the Bills tab
2. Click Edit on any existing bill
3. Change the amount
4. Click Save

**Expected:** Modal closes, updated amount shows in the table

**Last result:** ⏳ Not yet tested

---

## TC-016: Delete a Bill

**What it tests:** Delete action permanently removes bill from the database and dashboard

**Steps:**
1. Open the Bills tab
2. Click Delete on any bill
3. Confirm the action in the confirmation dialog
4. Navigate to Dashboard

**Expected:** Bill no longer appears in Bills tab or on Dashboard; record is permanently gone (no inactive/hidden state)

**Last result:** ⏳ Not yet tested

---

## TC-017: Add an Income Source

**What it tests:** IncomeManagement add flow and monthly total recalculation

**Steps:**
1. Open the Income tab
2. Click "Add Income"
3. Enter a source name, amount, and frequency (e.g. bi-weekly)
4. Click Save

**Expected:** New income source appears in the list; monthly total bar updates to reflect the new entry

**Last result:** ⏳ Not yet tested

---

## TC-018: Edit Alert Threshold in Settings

**What it tests:** Settings save + live dashboard behavior driven by updated threshold

**Steps:**
1. Open the Settings tab
2. Change "Due Soon Days" to 3
3. Click Save — verify confirmation flash appears
4. Navigate to Dashboard

**Expected:** Dashboard only shows due-soon alert banners for bills due within 3 days (not 7)

**Last result:** ⏳ Not yet tested

---

## TC-019: Add a Transaction Category

**What it tests:** Settings category add flow + category appears in bill form dropdown

**Steps:**
1. Open the Settings tab
2. In the Transaction Categories card, type a new category name and click Add
3. Open the Bills tab and click "Add Bill"
4. Open the category dropdown

**Expected:** New category appears in the dropdown list

**Last result:** ⏳ Not yet tested

---

## TC-020: Dashboard Shows Overdue Alert Banner

**What it tests:** Overdue detection in `billUtils.js` and red AlertBanner rendering

**Steps:**
1. Ensure at least one bill has a due date in the past (day of month already passed this cycle)
2. Open the Dashboard tab

**Expected:** Red "Overdue" alert banner appears at the top of the dashboard listing the overdue bill(s)

**Last result:** ⏳ Not yet tested

---

## TC-021: Dashboard Shows Due-Soon Alert Banner

**What it tests:** Due-soon detection and amber AlertBanner rendering

**Steps:**
1. Ensure at least one bill is due within the configured due-soon threshold (default 7 days)
2. Open the Dashboard tab

**Expected:** Amber "Due Soon" alert banner appears listing the upcoming bill(s)

**Last result:** ⏳ Not yet tested

---

## TC-022: Hidden Bills Expand/Collapse Toggle

**What it tests:** Expand/collapse chevron button reveals and hides the upcoming bills grid

**Steps:**
1. Open the Dashboard tab when more bills exist than are shown in the action area
2. Click the chevron/expand button below the main bill cards

**Expected:** Hidden bills grid expands to show remaining bills; clicking again collapses it

**Last result:** ⏳ Not yet tested

---

## TC-027: First Launch - Setup Screen Appears

**What it tests:** AuthGate shows SetupScreen when no passphrase is configured

**Steps:**
1. With a fresh database (no auth_config row), open http://localhost:5173
2. Observe the landing screen

**Expected:** Setup screen appears with "Welcome to SqueezyPay" heading and two password fields

**Last result:** ⏳ Not yet tested

---

## TC-028: First Launch - Create Passphrase

**What it tests:** Setup flow creates passphrase and logs in automatically

**Steps:**
1. On the setup screen, enter a passphrase (8+ characters) in both fields
2. Click "Create Passphrase"

**Expected:** App loads directly into the dashboard - no separate login step

**Last result:** ⏳ Not yet tested

---

## TC-029: Login Screen on Reload

**What it tests:** Session does not persist across tab close (sessionStorage behavior)

**Steps:**
1. After setup/login, close the browser tab
2. Reopen http://localhost:5173

**Expected:** Login screen appears (not the dashboard)

**Last result:** ⏳ Not yet tested

---

## TC-030: Login - Correct Passphrase

**What it tests:** Login with correct passphrase grants access

**Steps:**
1. On the login screen, enter the correct household passphrase
2. Click "Sign In"

**Expected:** App loads into the dashboard

**Last result:** ⏳ Not yet tested

---

## TC-031: Login - Wrong Passphrase

**What it tests:** Login rejects incorrect passphrase

**Steps:**
1. On the login screen, enter an incorrect passphrase
2. Click "Sign In"

**Expected:** Error message appears - app does not grant access

**Last result:** ⏳ Not yet tested

---

## TC-032: Logout

**What it tests:** Logout clears session and returns to login screen

**Steps:**
1. While logged in, click the logout button in the sidebar (desktop) or mobile menu
2. Observe the result

**Expected:** Login screen appears immediately

**Last result:** ⏳ Not yet tested

---

## TC-033: Protected API Without Token

**What it tests:** Backend rejects unauthenticated API requests

**Steps:**
1. Open http://localhost:8000/docs
2. Try GET /api/bills/ without a token

**Expected:** 401 Unauthorized response

**Last result:** ⏳ Not yet tested

---

## Future Test Cases (not yet testable)

- TC-023: Credential vault - store and retrieve biller credentials
- TC-024: Payment method vault - store and retrieve payment method
- TC-025: PWA installs on iPhone home screen
- TC-026: Show credentials in workflow modal - copy username and password
