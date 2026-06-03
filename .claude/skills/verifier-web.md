# verifier-web

Playwright-driven verifier for SqueezyPay. Use this skill whenever `/verify` is
invoked on a change that touches the frontend or any API the frontend calls.

## Prerequisites

- `SQUEEZYPAY_DEV_PASSPHRASE` set as a Windows user environment variable.
  Read it at runtime via PowerShell: `[System.Environment]::GetEnvironmentVariable("SQUEEZYPAY_DEV_PASSPHRASE", "User")`
  then inject it: `$env:SQUEEZYPAY_DEV_PASSPHRASE = $pass` before running node.
- App must be running. Invoke the `run-squeezypay` skill first if unsure.
- Playwright installed at repo root: `C:\SqueezyPay\node_modules\playwright`
- Run node from `C:\SqueezyPay` (repo root) so `require('playwright')` resolves.
- Write temp scripts with the Write tool to `C:\SqueezyPay\_verify_run.js`, delete after.
- Screenshots go to `C:\tmp\` — create it with `New-Item -ItemType Directory -Force C:\tmp` if needed.

## Login helper

Every verification session starts with a login. Use this Node snippet:

```js
const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
const PASS = process.env.SQUEEZYPAY_DEV_PASSPHRASE;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
await page.locator('input[type="password"]').fill(PASS);
await page.locator('button[type="submit"]').click();
await page.waitForSelector('nav', { timeout: 10000 });
await page.waitForTimeout(2000); // let React Query fetch data
// page is now authenticated and on the dashboard
```

If login fails, report BLOCKED. Do not guess the passphrase.

## DOM notes (keep current)

Verified 2026-06-03 against production DOM:
- Bill cards: use `button:has-text("Start Workflow")` to count/target
- Nav tabs: `button:has-text("History")` etc. — nav items are `<button>` not `<a>`
- Modal overlay: `div.fixed.inset-0`; close via X button near top-right of modal
- Nav items: Home, Bills, History, Income, Settings, Accounts (Soon), Budget (Soon)
- One browser console 404 on dashboard load is benign — fires when a bill has no stored credentials

## Core workflow checks

After login, verify these in order.

### 1. Dashboard
```js
const billCount = await page.locator('button:has-text("Start Workflow")').count();
// billCount > 0 means bills present; 0 means empty state (also acceptable)
await page.screenshot({ path: 'C:/tmp/verify_dashboard.png' });
```

### 2. Payment workflow modal
```js
await page.locator('button:has-text("Start Workflow")').first().click();
await page.waitForTimeout(1000);
const overlayVisible = await page.locator('div.fixed.inset-0').isVisible();
await page.screenshot({ path: 'C:/tmp/verify_modal.png' });
// Close via X button
const closeBtn = page.locator('div.fixed.inset-0 button').first();
await closeBtn.click().catch(() =>
  page.locator('div.fixed.inset-0').click({ position: { x: 10, y: 10 }, force: true })
);
await page.waitForTimeout(800);
```

### 3. Payment History tab
```js
await page.locator('button:has-text("History")').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/tmp/verify_history.png' });
```

### 4. Income tab
```js
await page.locator('button:has-text("Income")').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/tmp/verify_income.png' });
```

### 5. Settings tab
```js
await page.locator('button:has-text("Settings")').first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/tmp/verify_settings.png' });
```

## Scope guidance

**Full workflow check** - use all 5 checks above when verifying:
- Auth changes
- Dashboard / bill card changes
- Navigation changes
- Any change described as "refactor" or "cleanup" across multiple components

**Targeted check** - run only the relevant tab(s) when verifying:
- A single component or API endpoint
- Example: change to `PaymentHistory.tsx` → only run check 3

**Skip this verifier entirely** when:
- Change is backend-only with no frontend surface (pure service/repository layer)
- Change is docs, config, or CI only
- Report: `SKIP — no frontend surface`

## Report format

Use the standard verify report format. Include screenshot paths as evidence.
Attach any browser console errors captured via the `page.on('console', ...)` listener.
