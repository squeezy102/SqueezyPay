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

- Bills can be added, edited, and deactivated (not hard-deleted)
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

- Nickname (e.g. "ECU Visa", "Joint Checking")
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

---

## REQ-006: Example Credit Union Account Integration (Plaid)

Automatic transaction and balance data pulled from Example Credit Union
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

- Plaid connection is established once via OAuth flow - user logs into ECU
through Plaid's secure interface
- ECU credentials are never stored in SqueezyPay
- Transaction data is refreshed on demand ("Refresh" button) or automatically
at app startup
- Transactions are stored locally in SQLite after each refresh - app functions
with last-known data if Plaid is unavailable
- Plaid's merchant category codes are used as default transaction categories -
user can override per transaction or set a rule to always override a merchant

### Accounts View

- Each ECU account displayed as a card showing balance and account type
- Clicking an account opens its transaction history
- Transactions are searchable and filterable by date, amount, and category

---

## REQ-007: Blame Graph

Visual spending breakdown showing where money is going, by card and by category.
Designed to support honest household spending conversations.

### Data Sources

- Plaid transaction data (ECU accounts - REQ-006)
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
- Multiple income sources supported (both spouses, side income, etc.)

---

## REQ-011: Net Worth Snapshot

A single-screen summary of household financial position.

### Data Sources

- ECU account balances (from Plaid - REQ-006)
- Manually entered external assets (optional)
- Manually entered external liabilities (optional)

### Layout

- Assets column: ECU balances + any manually entered assets
- Liabilities column: ECU loan balances + any manually entered liabilities
- Net worth = assets minus liabilities, displayed prominently

### Behavior

- ECU data refreshes with the same Plaid refresh cycle as REQ-006
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
