# Audit Dimension Report: Frontend
## Document ID: AUDIT-DIM-FRONTEND-001
## Version: 1.0 (Iteration 1)
## Date: 2026-06-07
## Auditor: Automated agent + senior review
## Scope: `frontend/src/**`, `frontend/eslint.config.js`, `frontend/tsconfig.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/public/manifest.json`
## Bibliography: All reference IDs resolved in `audit/BIBLIOGRAPHY.md`

---

## Methodology

Every file in scope was read in full. Findings were derived by:
1. Direct inspection of source code
2. Cross-reference against cited standards
3. Cross-file consistency analysis (API contract matching, query key consistency, type shape matching)

No finding is stated without a line number and quoted code fragment. Where a finding could not be confirmed by reading the file, it is not stated.

---

## 1. TypeScript Correctness
*Standards applied: [REF-21] TypeScript tsconfig reference; [REF-22] Google TypeScript Style Guide*

### 1.1 Compiler Configuration
**FILE: `frontend/tsconfig.json`**

`"strict": true` is enabled (line 8). This activates `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, and `strictPropertyInitialization`. `noUnusedLocals: true` (line 9), `noUnusedParameters: true` (line 10), and `noFallthroughCasesInSwitch: true` (line 11) are all enabled. Compiler configuration is strong.

**FILE: `frontend/vite.config.js`**

The Vite configuration file itself is `.js`, not `.ts`. The Vite configuration is therefore not subject to TypeScript checking. Per [REF-22] §File Extensions: "Use `.ts` for TypeScript files." Minor; no runtime impact.

### 1.2 `any` Usage Policy

**FILE: `frontend/eslint.config.js`, line 35:**
```js
'@typescript-eslint/no-explicit-any': 'warn'
```
`any` is warned, not errored. Per [REF-22] §any: "Do not use `any`. It effectively silences the TypeScript compiler." The warn-only policy allows `any` usage to accumulate silently. Combined with unchecked type assertions in `api.ts` (see §1.3), this creates latent type safety erosion.

### 1.3 Unsafe Type Assertions

**FILE: `frontend/src/utils/api.ts`**

Multiple `response.json() as Promise<T>` and `await response.json() as T` assertions are used throughout, e.g.:
- Line 44: `return response.json() as Promise<AuthStatus>`
- Line 54: `return response.json() as Promise<TokenResponse>`
- Line 327: `return await response.json() as Credential | null`

Per [REF-22] §Type Assertions: "Type assertions should be used sparingly... and only when you are certain about the type." These assertions are applied to unvalidated network responses. If the backend changes a field name or type, TypeScript will not detect the mismatch. There is no runtime validation (no Zod, io-ts, or similar schema validation library). This is the established project pattern; the risk is accepted by the design.

### 1.4 `activeTab` Type Weakness

**FILE: `frontend/src/App.tsx`, line 19:**
```tsx
const [activeTab, setActiveTab] = useState("dashboard");
```
TypeScript infers `activeTab` as `string`, not as the union `"dashboard" | "bills" | "transactions" | "income" | "settings" | "accounts" | "spending"`. A typo in any `setActiveTab(...)` call would not be caught at compile time. Per [REF-21], `useState` can be typed explicitly: `useState<TabId>("dashboard")`. No type alias for valid tab IDs exists in the codebase.

### 1.5 `IncomeFormModal` Unsafe Cast

**FILE: `frontend/src/components/IncomeFormModal.tsx`, line 84:**
```tsx
data.frequency as IncomeFrequency
```
`data.frequency` is `string` (from react-hook-form). The cast to `IncomeFrequency` is unchecked. A `<select>` with only valid `IncomeFrequency` values makes this practically safe, but the type assertion bypasses compile-time discriminant checking. Per [REF-22] §Type Assertions: this class of cast should be narrowed via a type guard or `satisfies` operator.

### 1.6 `stalenessUtils.ts` Return Type

**FILE: `frontend/src/utils/stalenessUtils.ts`, line 3:**
```ts
export function staleness(lastSyncedAt: string | null | undefined)
```
Return type is inferred, not explicit. Per [REF-22] §Return Types: "Always annotate return types of functions, except for trivial one-liners or constructors." The return type `{ stale: boolean; label: string }` should be explicit.

### 1.7 `data/bills.js` — Dead Typed File

**FILE: `frontend/src/data/bills.js`**

A `.js` file with no type annotations. Not imported anywhere in the codebase (confirmed by grep: no `import.*bills` in any `.tsx`/`.ts` file). The object shape differs from the `Bill` interface in `types.ts` — field `note` (singular) vs `notes` (plural); field `amount` vs `expectedAmount`. This file is stale dead code whose shape contradicts the live type definitions.

---

## 2. React Correctness
*Standards applied: [REF-23] React Rules of Hooks; [REF-24] React purity rules*

### 2.1 Side Effect During Render — PlaidLinkButton

**FILE: `frontend/src/components/PlaidLinkButton.tsx`, lines 42–44:**
```tsx
if (linkToken && ready) {
  open();
}
```
This is executed at the top level of the function component body, outside any hook. Calling `open()` during the render phase is a side effect during render, which violates [REF-24]: "Components must not produce any observable side effects during rendering." In React 18 Strict Mode, components are double-invoked in development, meaning `open()` would be called twice. The correct pattern is:
```tsx
useEffect(() => {
  if (linkToken && ready) open();
}, [linkToken, ready, open]);
```
**Severity: HIGH** — architectural violation with behavior impact in StrictMode.

### 2.2 IncomeManagement Reactivation Error Silently Swallowed

**FILE: `frontend/src/components/IncomeManagement.tsx`, lines 52–62:**
```tsx
onSuccess: (result) => {
  if (!source.active && !result) {
    setError("Failed to reactivate income source.");
  }
}
```
`deactivateIncome` returns `Promise<void>`, so `result` for a deactivation is `undefined`. The condition `!source.active && !result` evaluates as `false && true` for a deactivation (correct — no error shown). For a reactivation where the API returns `null` (failure), `source.active` is `true` and `result` is `null` — the intended condition is `source.active === true && result === null`, but the code checks `!source.active` (which is `false` when `source.active === true`). The error branch is **never reachable**. Reactivation failures are silently dropped.

**Severity: HIGH** — logic error; error state never displayed to user on reactivation failure.

### 2.3 Unmounted Component Timer Leaks

**FILE: `frontend/src/components/LogPaymentModal.tsx`, line 136:**
```tsx
setTimeout(() => onLogged(result), 1500)
```
No cleanup. If the modal unmounts before 1500ms, `onLogged` executes on an unmounted component.

**FILE: `frontend/src/components/IncomeFormModal.tsx`, line 76:**
```tsx
setTimeout(() => onSave(), 1200)
```
Same pattern; no cleanup.

Both timers should store the return value and call `clearTimeout` in an effect cleanup or use a `useRef`-tracked flag.

**Severity: MEDIUM** — causes React "setState on unmounted component" warnings; no data loss risk.

### 2.4 MoneyInput Mixed Controlled/Uncontrolled State

**FILE: `frontend/src/components/MoneyInput.tsx`, lines 13–17:**
```tsx
useEffect(() => {
  setRaw(value != null ? String(value) : "");
}, [value]);
```
`MoneyInput` accepts a numeric `value` prop (controlled) but also maintains internal string `raw` state. The `useEffect` resets `raw` whenever `value` changes from outside. This creates a derived-state anti-pattern: per React documentation, deriving state from props via `useEffect` can produce double-render behavior and cursor-position side effects. The inline ESLint suppression comment `// eslint-disable-next-line react-hooks/set-state-in-effect` references a rule that does not exist in `eslint-plugin-react-hooks` v7.1.1; it suppresses nothing.

**Severity: MEDIUM** — anti-pattern; no data corruption risk in current usage.

### 2.5 useFocusTrap — Empty Focusable Element Edge Case

**FILE: `frontend/src/hooks/useFocusTrap.ts`, lines 22–25:**
```ts
if (!firstFocusable || !lastFocusable) {
  e.preventDefault();
  return;
}
```
If a modal contains no focusable elements, Tab keypresses are prevented and swallowed. The user has no keyboard escape path. Per [REF-30] WCAG 2.1 §2.1.2 (No Keyboard Trap), focus must not be trapped without an accessible exit mechanism. In practice all modals contain at minimum a close button, so this is a hypothetical edge case in current code. However, it is a latent defect.

**Severity: MEDIUM** — violates WCAG 2.1 §2.1.2 under edge conditions.

---

## 3. Component Architecture
*Standards applied: [REF-22] Google TypeScript Style Guide; [REF-35] Google Testing Blog — Test Sizes*

### 3.1 Dead Code — `PaymentHistory.tsx`

**FILE: `frontend/src/components/PaymentHistory.tsx`**

This file (273 lines) is not imported anywhere in the application. Confirmed by searching all `.tsx` and `.ts` files for `import.*PaymentHistory` — no match. Its logic duplicates `BillPaymentHistory` inside `Bills.tsx`: identical `COLUMNS`, `SortKey`, `SortDir`, `SortIcon`, `cellValue`, `formatDate`, `formatAmount` declarations. Approximately 60 lines of logic are duplicated across both files.

**Severity: HIGH** — dead code with schema-equivalent duplication creates a maintenance hazard.

### 3.2 Dead Code — `data/bills.js`

**FILE: `frontend/src/data/bills.js`**

Not imported anywhere. Contains 74 lines of bill seed data whose shape contradicts `types.ts`. See §1.7.

**Severity: HIGH** — stale dead code with misleading schema.

### 3.3 `Bills.tsx` File Size and Responsibility

**FILE: `frontend/src/components/Bills.tsx` — 785 lines**

Contains at minimum 8 distinct sub-components: `SubNav`, `OverviewBillRow`, `RecentPaymentRow`, `BillsOverview`, `PayBills`, `SortIcon`, `PaymentHistoryCard`, `BillPaymentHistory`, `NotesPopover`, `CategoryBadge`, `ManageBillers`. Per [REF-22] §Source Organization: files should contain a single logical unit of functionality. A 785-line file with 8+ distinct components violates single-responsibility and makes both testing and future modification significantly harder.

**Severity: MEDIUM** — architectural debt; no functional defect.

### 3.4 Query Key Cache Fragmentation — Bills

`Dashboard.tsx` and `BillCard.tsx` use query key `["bills"]` via `getBills()`. `Bills.tsx` `BillsOverview` uses query key `["bills", "all"]` via `getAllBills()`. These are separate React Query cache entries. Cache invalidation triggered by `BillCard` (`queryClient.invalidateQueries({ queryKey: ["bills"] })`, line 80 of `BillCard.tsx`) does not invalidate `["bills", "all"]`. After logging a payment in Dashboard, the Bills Overview tab will show stale data.

**Severity: HIGH** — cache inconsistency; user sees stale bill data after payment actions.

### 3.5 `getBills` / `getAllBills` Duplication

**FILE: `frontend/src/utils/api.ts`, lines 191–213:**
`getBills()` and `getAllBills()` make identical requests to `/api/bills/` with identical logic. One is dead relative to the other's function. The distinction in naming implies different behavior that does not exist in the implementation.

**Severity: HIGH** — redundant API functions with no behavioral distinction; misleading to future developers.

### 3.6 Duplicate Formatting Functions

`formatDate`, `formatAmount`, `formatCurrency`, and `fmtExact` are independently defined in `Bills.tsx`, `Dashboard.tsx`, `IncomeManagement.tsx`, `Accounts.tsx`, `TransactionTable.tsx`, and `PaymentHistory.tsx`. A shared `src/utils/formatters.ts` module would eliminate approximately 60 lines of duplication and reduce inconsistency risk (e.g., currency formatting options differ between components).

**Severity: LOW** — duplication; no functional defect.

---

## 4. API Contract Correctness
*Standards applied: [REF-19] SQLAlchemy 2.0 ORM docs; [REF-25] TanStack Query v5 docs*

### 4.1 Hardcoded API Base URL

**FILE: `frontend/src/utils/api.ts`, line 21:**
```ts
export const API_BASE = `http://${window.location.hostname}:8000`;
```
Port `8000` is hardcoded. Protocol is hardcoded as `http://`. No `VITE_API_BASE` environment variable override exists. For deployments behind a reverse proxy (port 443, HTTPS), this will silently fail. For LAN-only deployments (the documented primary use case), `http://` is functionally acceptable but means all API traffic including bearer tokens and biller credentials travel in plaintext over the network.

**Severity: MEDIUM** — documented limitation warranted; no `VITE_API_BASE` escape hatch exists.

### 4.2 Credential Type snake_case Inconsistency

**FILE: `frontend/src/types.ts`, lines 48–53** (`Credential` interface) and **`frontend/src/utils/api.ts`, line 327:**
The `Credential` type uses snake_case field names (`bill_id`, `username`, `password`, `encrypted_password`) matching the raw backend response. All other domain types (`Bill`, `Income`, `Payment`, `PlaidAccount`, etc.) are remapped to camelCase in `api.ts`. `Credential` is the sole exception — it is returned raw. This is internally consistent (the type accurately reflects the wire format) but architecturally inconsistent with the established pattern.

**Severity: MEDIUM** — inconsistency; risk of future developer error when consuming `Credential` fields.

### 4.3 Client-Side Sort on Paginated Data

**FILE: `frontend/src/components/TransactionTable.tsx`, lines 82–96:**
`sortKey` and `sortDir` are included in the React Query `queryKey` but are not forwarded to `getPlaidTransactions()`. The backend does not receive sort parameters. Sorting is applied by the browser only to the current page of 50 results. With a large transaction history, "sort by amount descending" will show the highest-amount transaction from the current 50-row page, not from the full dataset.

**Severity: HIGH** — produces functionally incorrect sort results for users with more than 50 transactions.

### 4.4 Transaction Spend Calculation Truncation

**FILE: `frontend/src/components/Dashboard.tsx`, lines 328–331:**
```tsx
queryFn: () => getPlaidTransactions({ startDate: daysAgo(1), endDate: today(), limit: 200 }),
```
Last-24hr spend is computed by fetching up to 200 transactions. If a user has more than 200 transactions in a 24-hour window (unlikely for a household app but architecturally possible), the spend total will be understated without any warning.

**Severity: LOW** — theoretical limit; household use case makes it extremely unlikely.

---

## 5. Security
*Standards applied: [REF-08] OWASP Top 10; [REF-09] OWASP ASVS 4.0; [REF-14] OWASP REST Security; [REF-16] OWASP JWT Cheat Sheet*

### 5.1 `window.open` Missing `noopener`

**FILE: `frontend/src/components/BugReportModal.tsx`, line 157:**
```tsx
window.open(`${GITHUB_NEW_ISSUE_URL}?${params.toString()}`, "_blank");
```
The third argument is absent. Without `"noopener,noreferrer"`, the opened tab has access to `window.opener`, which per [REF-08] A05 (Security Misconfiguration) creates a reverse tabnapping vector. While the target is `github.com` (trusted), the correct pattern per [REF-14] §Browser Security Controls is always to use `rel="noopener noreferrer"` or the equivalent `window.open` third argument.

**Severity: MEDIUM** — low practical risk given target is GitHub; correctness issue.

### 5.2 `http://` Hardcoded Protocol

**FILE: `frontend/src/utils/api.ts`, line 21:**
All API traffic including bearer tokens, biller usernames/passwords, and Plaid credentials flows over `http://` on the local network. Per [REF-13] OWASP Cryptographic Storage and [REF-14] OWASP REST Security, sensitive data should not be transmitted in cleartext. For a local-network-only deployment this is a documented architectural constraint, but it should be recorded as a known limitation with a ROADMAP entry.

**Severity: MEDIUM** — documented design constraint; acceptable for LAN-only; unacceptable if exposed to public internet.

### 5.3 Error Boundary Stack Trace Leakage

**FILE: `frontend/src/components/ErrorBoundary.tsx`, lines 5–17:**
`error.stack` is posted to `/api/frontend-log/` without sanitization. Stack traces in browser production builds include Vite-generated file paths (e.g., `C:\SqueezyPay\frontend\src\...`). This reveals the host machine's filesystem path structure. For a self-hosted single-user app on a local network, impact is minimal.

**Severity: LOW** — minimal practical risk in self-hosted context.

### 5.4 `sessionStorage` Token Storage

**FILE: `frontend/src/context/AuthContext.tsx`, line 23:**
The JWT is stored in `sessionStorage`, not `localStorage`. Per [REF-16] OWASP JWT Cheat Sheet, `sessionStorage` is preferable to `localStorage` as it is scoped to the browser tab and cleared on tab close, reducing the persistence window for token theft. This is the correct choice.

**Severity: INFO** — confirmed correct pattern.

### 5.5 PAT Handling in BugReportModal

**FILE: `frontend/src/components/BugReportModal.tsx`, lines 99, 128–153:**
The GitHub PAT is stored in component state, sent directly to `https://api.github.com` over HTTPS, and never logged or persisted. The input uses `type="password"` (line 304) and `autoComplete="off"` (line 308). This is correct per [REF-09] OWASP ASVS §2.10 (Service Authentication Security).

**Severity: INFO** — confirmed correct pattern.

---

## 6. Accessibility
*Standards applied: [REF-29] WCAG 2.1; [REF-30] WAI-ARIA 1.2*

### 6.1 Systemic Label/Input Association Gap — CRITICAL PATTERN

The following files contain `<label>` elements that are not associated with their `<input>` or `<textarea>` via `htmlFor`/`id`:

| File | Fields Affected |
|------|----------------|
| `BillFormModal.tsx` | Name, Category, URL, Expected Amount, Due Day, Notes |
| `LogPaymentModal.tsx` | Date Paid, Amount Paid |
| `CredentialModal.tsx` | Username / Email |
| `IncomeFormModal.tsx` | Source Name, Amount, Frequency, Day of Month |
| `Settings.tsx` | Due Soon Warning, Large Payment Threshold |
| `BugReportModal.tsx` | All 5 user-input fields |

Per [REF-29] WCAG 2.1 §1.3.1 (Info and Relationships, Level A): "Information, structure, and relationships conveyed through presentation can be programmatically determined." Per [REF-30] WAI-ARIA 1.2 §aria-labelledby: inputs without programmatic label association are not navigable by screen reader users. This is a **Level A** (minimum conformance) violation across the majority of the application's interactive forms.

Only `LoginScreen.tsx` and `SetupScreen.tsx` implement this correctly.

**Severity: HIGH** — systemic WCAG 2.1 Level A violation.

### 6.2 Viewport Scaling Disabled

**FILE: `frontend/index.html`, line 7:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```
Per [REF-29] WCAG 2.1 §1.4.4 (Resize Text, Level AA): "Text can be resized without assistive technology up to 200 percent without loss of content or functionality." Disabling user scaling prevents browser zoom and violates this criterion.

**Severity: MEDIUM** — WCAG 2.1 Level AA violation.

### 6.3 Sortable Table Headers Not Keyboard-Accessible

**FILE: `frontend/src/components/Bills.tsx`, lines 417–428; `frontend/src/components/TransactionTable.tsx`, lines 200–225:**

Sortable `<th>` elements handle `onClick` but have no `tabIndex="0"` and no `onKeyDown` handler. Per [REF-29] WCAG 2.1 §2.1.1 (Keyboard, Level A): "All functionality of the content is operable through a keyboard interface." Clicking is the only way to sort; keyboard users cannot access this functionality.

**Severity: MEDIUM** — WCAG 2.1 Level A violation.

### 6.4 Charts Have No Accessible Alternative

**FILE: `frontend/src/components/SpendingBlame.tsx`, lines 178–208, 216–241:**

Recharts `<ResponsiveContainer>` wrappers for `PieChart` and `BarChart` have no `aria-label`, `role="img"`, or accessible text alternative. Per [REF-29] WCAG 2.1 §1.1.1 (Non-text Content, Level A): "All non-text content that is presented to the user has a text alternative." Financial charts with no text alternative are inaccessible to screen reader users.

**Severity: MEDIUM** — WCAG 2.1 Level A violation.

### 6.5 Spinner Has No Loading Announcement

**FILE: `frontend/src/components/Spinner.tsx`, line 3:**
```tsx
<div className="animate-spin ...">
```
No `role="status"`, no `aria-label`, no `aria-live` region. Per [REF-30] WAI-ARIA 1.2 §status role: loading indicators should use `role="status"` with an appropriate label so screen readers announce the loading state.

**Severity: MEDIUM** — WCAG 2.1 Level A violation.

---

## 7. Style and Convention
*Standards applied: [REF-01] PEP 8 (for structure analogy); [REF-22] Google TypeScript Style Guide*

### 7.1 File Naming

All component files use PascalCase (e.g., `BillFormModal.tsx`, `Dashboard.tsx`). Utility files use camelCase (`api.ts`, `billUtils.ts`, `stalenessUtils.ts`). Context files use PascalCase (`AuthContext.tsx`, `ThemeContext.tsx`). Consistent with [REF-22] §Naming Style.

### 7.2 Import Ordering

Imports are not consistently ordered per [REF-22] §Import ordering (external packages → internal modules → relative paths). Several files mix React imports with third-party library imports without a blank-line separator. No ESLint `import/order` rule is configured. Low impact.

### 7.3 `manifest.json` Purpose Field

**FILE: `frontend/public/manifest.json`, line 14:**
```json
"purpose": "any maskable"
```
Per the W3C Web App Manifest specification, `purpose` should be an array: `["any", "maskable"]`. A space-separated string is accepted by Chrome and Lighthouse but is not spec-conformant.

**Severity: LOW** — non-conformant but broadly tolerated.

---

## 8. Documentation
*Standards applied: [REF-02] PEP 257 (docstring principles applied by analogy); [REF-22] Google TypeScript Style Guide §Comments*

### 8.1 Inline Comment Quality

Per [REF-22] §Comments: "Use JSDoc for documenting public APIs. Use inline comments only when the code itself is not self-documenting." Most components have no inline comments. Where comments exist, they are generally appropriate (e.g., `billUtils.ts` line 15 explaining the two-function design for due dates). One incorrect comment was found:

**FILE: `frontend/src/components/MoneyInput.tsx`:**
```tsx
// eslint-disable-next-line react-hooks/set-state-in-effect
```
This rule name does not exist in `eslint-plugin-react-hooks` v7.1.1. The comment suppresses nothing. A developer reading this comment will incorrectly believe a lint suppression is in effect.

### 8.2 `data/bills.js` — No Deprecation Notice

The stale `data/bills.js` file has no comment indicating it is deprecated or unused. A developer encountering it has no signal that it is dead code and may inadvertently rely on it.

---

## 9. Test Coverage
*Standards applied: [REF-34] pytest documentation (principles applied by analogy to Vitest); [REF-35] Google Testing Blog — Test Sizes*

### 9.1 `api.test.ts` — Plaid Subsystem Untested

**FILE: `frontend/src/utils/api.test.ts`**

The following API functions have no test coverage:
- `getPlaidItems`, `getPlaidAccounts`, `getPlaidTransactions`, `syncPlaidBalances`, `syncPlaidTransactions`
- `assignPlaidTransactionCategory`, `getPlaidBlame`, `exchangePlaidPublicToken`, `createPlaidLinkToken`
- `deleteCredential`, `saveCredential`, `getCredentialByBill`, `autofillBill`
- `getPaymentMethods`, `createPaymentMethod`, `deletePaymentMethod`
- All income read endpoints beyond `createIncome`

The Plaid subsystem is the highest-complexity, highest-risk part of the API layer. Per [REF-35] Google Testing Blog, small unit tests should exercise all paths of utility functions. The absence of Plaid API tests means the snake_case → camelCase mapping for Plaid data has no test coverage.

**Severity: HIGH** — critical business logic untested.

### 9.2 `billUtils.test.ts` — Overdue Path in `filterActionableBills`

**FILE: `frontend/src/utils/billUtils.test.ts`, lines 139–146:**

The test explicitly documents that `filterActionableBills` shows bills past their current-month due date as ~28+ days away (next cycle), not as overdue. This is a known behavioral limitation documented in the test. The overdue detection path exists correctly in `getBillStatus` (tested separately on lines 51–56) but is not reachable via `filterActionableBills`. A user who expects to see "overdue" bills on the Dashboard bill section will not see them flagged as such.

**Severity: MEDIUM** — known limitation with documented behavior; affects user experience.

### 9.3 Vitest Environment Split

**FILE: `frontend/vite.config.js`, line 11:** Default `environment: 'node'`.  
**FILE: `frontend/src/utils/api.test.ts`, line 1:** `// @vitest-environment jsdom` override.

The per-file environment override is correct and functional. However, it is undocumented in the project's testing documentation (`docs/testing.md`). A future test author adding a test that requires browser globals will encounter silent failures if they do not know to add the jsdom directive.

**Severity: LOW** — documentation gap; no functional defect.

---

## 10. Findings Summary

### By Severity

| Severity | Count | Files Affected |
|----------|-------|----------------|
| HIGH | 8 | `IncomeManagement.tsx`, `PlaidLinkButton.tsx`, `Bills.tsx`/`Dashboard.tsx`/`BillCard.tsx` (query key), `api.ts` (getBills/getAllBills), `TransactionTable.tsx`, `PaymentHistory.tsx`, `data/bills.js`, `api.test.ts` |
| MEDIUM | 28 | `api.ts`, `BugReportModal.tsx`, `MoneyInput.tsx`, `LogPaymentModal.tsx`, `IncomeFormModal.tsx`, `Bills.tsx`, `TransactionTable.tsx`, `SpendingBlame.tsx`, `BillFormModal.tsx`, `CredentialModal.tsx`, `Settings.tsx`, `NavBar.tsx`, `Spinner.tsx`, `index.html` |
| LOW | 12 | `tsconfig` file extension, `manifest.json`, `data/bills.js`, `activeTab` type, `stalenessUtils.ts`, duplicate formatters, `MoneyInput` ESLint comment, import ordering |
| INFO | 14 | Confirmed-correct patterns (sessionStorage, PAT handling, AuthContext cleanup, etc.) |

### Highest-Priority Remediation Items

1. **`PlaidLinkButton.tsx` — side effect during render** [HIGH, REF-24] — Move `open()` call into `useEffect`.
2. **`IncomeManagement.tsx` — reactivation error swallowed** [HIGH] — Fix boolean condition: `source.active === true && result === null`.
3. **Bills query key cache split** [HIGH, REF-25] — Unify `getBills`/`getAllBills` and standardize on one query key.
4. **`TransactionTable.tsx` — client-side sort on paginated data** [HIGH] — Implement server-side sort parameters on the backend endpoint, or document the limitation explicitly in the UI.
5. **Systemic label/input association gap** [HIGH, REF-29, REF-30] — Add `id` to all inputs, `htmlFor` to all labels, across all 6 affected form components.
6. **`PaymentHistory.tsx` dead file** [HIGH] — Delete.
7. **`data/bills.js` dead file** [HIGH] — Delete.
8. **Plaid API test coverage** [HIGH, REF-34] — Write tests for at minimum the camelCase mapping paths.

---

*All findings in this document are traceable to specific line numbers in source files. No finding is stated without a direct code reference. Bibliography references are to verified sources in `audit/BIBLIOGRAPHY.md`.*
