# SqueezyPay - Requirements

---

## REQ-001: Bill Dashboard

The primary landing screen of the application. Provides a complete at-a-glance
view of all household bills and their current status.

### Layout

- List or card view of all bills showing: biller name, category, amount due,
due date, and payment status (unpaid, paid, overdue)
- Visual indicators for bills due within 7 days
- Visual indicators for overdue bills
- One-click button per bill that opens the biller's payment page in a new
browser tab

### Behavior

- Dashboard is the default landing page on app load
- Bills are sorted by due date ascending by default
- Paid bills can be hidden or shown via a toggle
- Clicking a bill's payment button logs a pending navigation - confirmation
number is recorded separately after payment

---

## REQ-002: Bill Management

CRUD operations for managing the household bill list.

### Bill Record Fields

- Biller name (required)
- Category (required - drawn from REQ-009 category list)
- Payment URL (required - the exact URL to navigate to for payment)
- Expected amount (required)
- Due date / day of month (required)
- Recurring flag (yes/no)
- Notes (optional)
- Active/inactive flag (for seasonal or paused bills)

### Behavior

- Bills can be added, edited, and deleted
- Recurring bills auto-generate the next due date after a payment is logged
- One-time bills are marked complete after payment and removed from the active
dashboard view
- Subscription services are tagged as recurring with a fixed amount

---

## REQ-003: Payment History Log

A per-bill record of every payment made through or logged in SqueezyPay.

### Payment Record Fields

- Bill reference
- Payment date
- Amount paid (actual - may differ from expected)
- Payment method used (card or account reference from the vault)
- Confirmation number (optional but encouraged)
- Notes (optional)

### Behavior

- Payment history is accessible per bill and as a global log
- Global log is filterable by date range, biller, and category
- Logging a payment updates the bill's status on the dashboard
- Confirmation numbers are stored as plain text - searchable

---

## REQ-004: Secure Credential Vault

Encrypted storage for biller login credentials and household payment methods.

### Credential Records

- Biller reference
- Username / email
- Password
- Notes (optional - e.g. "security question answer is maiden name")

### Payment Method Records

- Nickname (e.g. "Visa ending in 1234", "Joint Checking")
- Type (credit card, debit card, bank account)
- Last 4 digits
- Expiration date (cards only)
- Notes (optional)

### Security

- All credential and payment method data is encrypted at rest using Fernet
symmetric encryption
- Encryption key is stored as an environment variable on the host machine only -
never in the database or codebase
- Vault data is never transmitted outside the home network
- Plaid credentials are never stored in the vault - Plaid handles its own
OAuth flow

### Behavior

- Credentials are viewable (decrypted on demand) within the app
- Copy-to-clipboard for username and password individually
- Payment methods are referenced by nickname throughout the app - full details
only visible in the vault

### Card Scanning

- Payment method details can be captured by pointing the device camera at a physical card
- All scanning and OCR processing is client-side only - card data never leaves the device during capture
- Scanned data populates the payment method entry form; user confirms before saving
- Implemented via Tesseract.js (browser-based OCR, no external API)
- Supported on iPhone Safari via getUserMedia()
- UX consideration: card scanning has a reputation for taking as long as manual entry in practice - evaluate real-world value before investing in this

---

## REQ-005: Spending Projections

Forward-looking cash flow view based on known recurring bills and income.

### Layout

- Timeline view (30/60/90 day) showing upcoming bill due dates and amounts
- Running balance projection based on income minus upcoming bills
- Visual indicator when projected balance goes negative

### Behavior

- Projections are based on expected amounts for recurring bills
- Income entries (REQ-010) feed the starting balance
- One-time bills are included if they fall within the projection window
- Projection updates automatically when bills or income entries change
- A calendar view showing income dates and bill due dates together is a planned layout alternative to the timeline view

---

## REQ-006: Bank Account Integration (Plaid)

Automatic transaction and balance data pulled from your financial institution's
accounts via the Plaid API.

### Supported Account Types

- Checking
- Savings
- Credit card
- Loans

### Data Displayed Per Account

- Current balance
- Available balance (where applicable)
- Transaction history (90 days default, configurable)
- Transaction detail: date, merchant name, amount, Plaid category,
user-assigned category override

### Behavior

- Plaid connection is established once via OAuth flow - user logs into their
financial institution through Plaid's secure interface
- Financial institution credentials are never stored in SqueezyPay
- Transaction data is refreshed on demand ("Refresh" button) or automatically
at app startup
- Transactions are stored locally in SQLite after each refresh - app functions
with last-known data if Plaid is unavailable
- Plaid's merchant category codes are used as default transaction categories -
user can override per transaction or set a rule to always override a merchant

### Accounts View

- Each linked account displayed as a card showing balance and account type
- Clicking an account opens its transaction history
- Transactions are searchable and filterable by date, amount, and category

---

## REQ-007: Blame Graph

Visual spending breakdown showing where money is going, by card and by category.
Designed to support honest household spending conversations.

### Data Sources

- Plaid transaction data (linked accounts - REQ-006)
- Manually logged payments (REQ-003)

### Views

- **By card** - pie or donut chart showing total spend per payment method
over a selected time period
- **By category** - pie or donut chart showing total spend per category
(fast food, convenience, online vendors, subscriptions, utilities, etc.)
- **Combined** - selected card broken down by category

### Time Period Selection

- Current month (default)
- Last 30 / 60 / 90 days
- Custom date range
- Year to date

### Behavior

- Charts update automatically when time period changes
- Hovering a segment shows the total amount and percentage
- Clicking a segment drills down to the individual transactions that make
up that segment
- Categories are drawn from REQ-009 category list
- Plaid categories are mapped to SqueezyPay categories automatically;
user can override

---

## REQ-008: Budget Targets

User-defined monthly spending targets per category, compared against actual
spending.

### Budget Record Fields

- Category (required)
- Monthly target amount (required)
- Notes (optional)

### Layout

- Budget overview shows each category with: target, actual spend this month,
remaining, and a progress bar
- Over-budget categories are highlighted visually
- Summary line shows total budgeted vs. total spent

### Behavior

- Actual spend is pulled from Plaid transactions + logged payments
- Budget targets roll over month to month (same target each month unless changed)
- Overage from last month does not carry forward
- Budget view is accessible from the dashboard and from the blame graph

---

## REQ-009: Transaction Categories

A standardized category list used across bills, transactions, and the blame graph.

### Default Categories

- Housing (rent, mortgage)
- Utilities (electric, gas, water)
- Internet / Phone
- Groceries
- Fast Food / Dining Out
- Convenience / Gas Station
- Online Shopping
- Subscriptions / Streaming
- Healthcare / Medical
- Insurance
- Loans / Debt
- Education
- Entertainment
- Travel
- Personal Care
- Kids
- Miscellaneous

### Behavior

- Categories are user-editable - new ones can be added, existing ones renamed
- Categories cannot be deleted if transactions are assigned to them (reassign first)
- Plaid merchant category codes are automatically mapped to SqueezyPay categories
at import time
- User can set a permanent override rule: "Always categorize [merchant] as [category]"
- Transactions can be split across multiple categories (e.g. a single Costco transaction categorized as part groceries, part household, part clothing)

---

## REQ-010: Income Tracking

Household income entries used to contextualize spending and power projections.

### Income Record Fields

- Source name (e.g. "Paycheck - Job Name")
- Amount (net / take-home)
- Frequency (weekly, bi-weekly, semi-monthly, monthly)
- Next expected date
- Active/inactive flag

### Behavior

- Income entries feed the spending projection (REQ-005)
- Monthly income total is displayed on the dashboard and budget view
- Income is not pulled from Plaid - it is entered manually and maintained
by the user
- Multiple income sources supported (multiple household members, side income, etc.)

---

## REQ-011: Net Worth Snapshot

A single-screen summary of household financial position.

### Data Sources

- Bank account balances (from Plaid - REQ-006)
- Manually entered external assets (optional)
- Manually entered external liabilities (optional)

### Layout

- Assets column: bank balances + any manually entered assets
- Liabilities column: bank loan balances + any manually entered liabilities
- Net worth = assets minus liabilities, displayed prominently

### Behavior

- Bank account data refreshes with the same Plaid refresh cycle as REQ-006
- Manual assets/liabilities are user-maintained
- Historical net worth is tracked over time and displayed as a simple line chart
(one data point per month)

---

## REQ-012: Year-Over-Year Spending Comparison

Comparative view of spending across time periods to identify trends.

### Layout

- Bar chart comparing monthly totals: current year vs. prior year
- Filterable by category
- Summary showing percentage change year over year per category

### Behavior

- Requires at least two months of transaction data to be useful
- Data sourced from Plaid transactions + logged payments
- Available from the spending / analytics section of the app

---

## REQ-013: Due Date Alerts

Passive notifications warning the user when bills are approaching or overdue.

### Alert Types

- **Due soon** - bill is due within 7 days (configurable)
- **Overdue** - bill's due date has passed and no payment has been logged
- **Upcoming large payment** - any bill over a configurable threshold

### Behavior

- Alerts are displayed on the dashboard as a banner or badge
- Alert threshold (7 days) is configurable in settings
- Alerts clear automatically when a payment is logged
- No external push notifications in Phase 1 - dashboard-only

---

## REQ-014: Progressive Web App (PWA)

SqueezyPay must be installable as a home screen app on mobile devices and
bookmarkable as a desktop shortcut on laptops and PCs.

### Behavior

- Manifest and service worker configured so iOS Safari and Android Chrome
offer "Add to Home Screen"
- Home screen icon opens the app directly without browser chrome
- On the host PC, a desktop shortcut starts the backend server and opens
the app in the default browser
- App is accessible from any device on the home network via the host PC's
local IP address and port
- App is not accessible from outside the home network

---

## REQ-015: Settings

Application configuration accessible from a settings screen.

### Configurable Items

- Due date alert threshold (days before due - default 7)
- Plaid connection management (connect, disconnect, refresh)
- Transaction category override rules
- Income entries (add, edit, deactivate)
- Category management (add, rename)
- Large payment alert threshold
- Default transaction history window (default 90 days)
- Passphrase change (see REQ-016)

---

## REQ-016: Authentication

A single household passphrase that gates access to the app. Designed for scenarios where the app may be reachable beyond a strictly private network.

### Behavior

- On first launch with no passphrase configured, the app prompts the user to set one
- All routes require an active session - unauthenticated requests redirect to the login screen
- The session persists until the browser is closed or the user explicitly logs out
- One passphrase for the household - no per-user accounts
- Passphrase is stored as a bcrypt hash - never in plaintext
- Passphrase can be changed from the settings screen (REQ-015)

### Security Notes

- Single-factor gate appropriate for home network use - not enterprise-grade auth
- Does not replace network-level access controls
- Protects against accidental exposure if the host machine becomes reachable beyond the home network

---

## REQ-017: Notification System

A configurable notification system that alerts household members about bills, spending, deposits, and financial summaries via email and/or SMS. Users choose their own delivery method and configure their own sending infrastructure.

### Delivery Methods

- **Email** - via SendGrid. Each household configures their own free SendGrid account and API key. The sending address is user-configured; the display name is "SqueezyPay". No shared infrastructure between households.
- **SMS** - via email-to-SMS carrier gateway. User configures their phone number and carrier (no third-party SMS API required). Major US carriers supported: Example Internet Co (`@txt.att.net`), T-Mobile (`@tmomail.net`), Verizon (`@vtext.com`). Standard carrier messaging rates apply.
- Both methods can be active simultaneously per notification type.

### Notification Types

| Notification | Trigger | Configurable |
|---|---|---|
| Bill due | X days before due date | Days in advance, per-bill on/off |
| Bill overdue | Due date passed, no payment logged | On/off |
| Large transaction | Transaction exceeds threshold | Dollar threshold |
| Deposit received | Deposit transaction detected | On/off |
| Anomaly alert | Spending in a category is significantly above the user's normal pattern | Sensitivity threshold |
| Weekly spend summary | Scheduled | Day of week, with or without blame breakdown |
| Monthly snapshot | Scheduled | Day of month, content selection |
| Spend with blame | Scheduled or on-demand | Frequency, breakdown depth |
| Custom report | User-defined schedule | Content, frequency, format |

### Presets

Presets are starting points only. Every notification is individually configurable regardless of preset.

| | Low | Medium | High |
|---|---|---|---|
| Bills due | Weekly digest | 3 days + day-of | 7 days + 3 days + day-of |
| Bills overdue | Off | On | On |
| Monthly snapshot | On | On | On |
| Large transactions | Off | Configurable threshold | Every transaction |
| Weekly spend summary | Off | On | On |
| Daily spend summary | Off | Off | On |
| Blame breakdown | Monthly | Weekly | Weekly |
| Deposits | Off | On | On |
| Custom reports | Off | Off | On |

### Settings

- SendGrid API key
- Verified sender email address
- Display name (default: "SqueezyPay")
- SMS phone number and carrier selection
- Notification preset selection (Low / Medium / High / Custom)
- Per-notification toggles and configuration
- Quiet hours (no notifications sent during configured window)

### Behavior

- Notification infrastructure is built in Phase 1; bill-due alerts are the first live notification type
- Spend, deposit, and blame notifications activate as their data sources come online (Phase 2+)
- Custom reports are Phase 3+
- Notifications are queued and retried on delivery failure - not silently dropped
- No notification is sent without the user explicitly enabling it

---

## REQ-018: Recurring Transaction Detection

Automatic identification of recurring charges in Plaid transaction data, with suggestions to add them as tracked bills.

### Behavior

- On transaction sync, the app scans for charges that recur on a regular interval (weekly, monthly, annual)
- Detected recurring charges are surfaced to the user as suggested bills to add to the dashboard
- User can accept (adds bill), dismiss (ignores suggestion), or mark as already tracked
- Detection is heuristic-based - same merchant, similar amount, regular cadence
- Bridges Phase 2 (Plaid data) and the bill management system automatically
