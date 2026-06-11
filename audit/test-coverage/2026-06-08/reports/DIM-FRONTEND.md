# Test Coverage Audit — Frontend

**Project:** SqueezyPay  
**Audit Date:** 2026-06-08  
**Auditor:** Claude Code (automated analysis)  
**Scope:** `c:\SqueezyPay\frontend\src\`  
**Stack:** React 19 + TypeScript + Vite + Tailwind; Vitest 4 + jsdom 29

---

## Executive Summary

The frontend test suite consists of 38 tests across two files (`api.test.ts` and `billUtils.test.ts`). Overall coverage is **30% statements / 25% branches / 40% functions / 31% lines**. Both existing test files target pure utility logic — no React component, hook, or context has any test at all.

The coverage figure is also artificially inflated: the Vitest `include` option in `vite.config.js` is set to `src/utils/**` only, so all 22 components, both context files, and the focus-trap hook are excluded from the denominator. True functional coverage of the application is far lower than 30%.

Key findings:

1. `billUtils.test.ts` does not appear in the coverage output despite 16 tests — the `include: ['src/utils/**']` filter covers it, but the file path may be excluded from the text report due to environment mismatch (`node` vs `jsdom`). This must be verified.
2. `stalenessUtils.ts`, the only other pure-logic utility, has 0% coverage despite being straightforwardly testable in isolation.
3. `AuthContext.tsx` is the highest-risk untested module: it owns the session token lifecycle, the 401 global event bridge, and the `configured` / `statusError` flags that gate the entire UI.
4. All mutation paths in `api.ts` — `createBill`, `updateBill`, `deleteBill`, `createPlaidLinkToken`, `exchangePlaidPublicToken`, credential functions, passphrase change — are completely untested.
5. `LoginScreen` and `Settings > ChangePassphraseCard` contain client-side validation logic (mismatch check, length check) that is entirely untested.
6. `useFocusTrap` has no tests despite containing non-trivial keyboard event logic (Tab cycling, shift-Tab reverse, focus restoration).

---

## Coverage Metrics Table

| Module | Statements | Branches | Functions | Lines | Test File |
|---|---|---|---|---|---|
| `src/utils/api.ts` | 23% | ~20% | ~30% | ~24% | `api.test.ts` (22 tests) |
| `src/utils/billUtils.ts` | reported 0% (exclusion issue) | 0% | 0% | 0% | `billUtils.test.ts` (16 tests — likely not counted) |
| `src/utils/stalenessUtils.ts` | 0% | 0% | 0% | 0% | none |
| `src/hooks/useFocusTrap.ts` | 0% | 0% | 0% | 0% | none |
| `src/context/AuthContext.tsx` | 0% | 0% | 0% | 0% | none |
| `src/context/ThemeContext.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/LoginScreen.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/Bills.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/BillFormModal.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/Settings.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/PlaidLinkButton.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/Dashboard.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/SpendingBlame.tsx` | 0% | 0% | 0% | 0% | none |
| `src/components/TransactionTable.tsx` | 0% | 0% | 0% | 0% | none |
| All other components (14 files) | 0% | 0% | 0% | 0% | none |

**Coverage config issue:** `vite.config.js` sets `environment: 'node'` globally and `include: ['src/utils/**']` for coverage. React component tests require `environment: 'jsdom'` (either globally or per-file via `// @vitest-environment jsdom`). The coverage `include` must be widened to `src/**` before any component tests will count.

---

## Untested Modules (by risk priority)

---

### `src/context/AuthContext.tsx` — Critical

#### What is untested

- Initial `getAuthStatus()` call on mount: sets `isConfigured`, `statusError`, and clears `loading`
- Cancellation of in-flight status request on unmount (`cancelled` flag)
- `login()`: writes token to `sessionStorage`, updates `isAuthenticated`
- `logout()`: calls `logoutAuth()`, removes token from `sessionStorage`, clears state; error-tolerant (never throws)
- 401 global event handler: `window.dispatchEvent(new Event('squeezypay:unauthorized'))` must clear the token
- `useAuth()` throw guard: calling the hook outside a provider must throw

#### Risk rationale (ISTQB)

**Critical.** The authentication context is the single point of truth for the session token and the `isConfigured`/`statusError` flags that gate what the entire application renders. A regression here — e.g., `login()` not writing to `sessionStorage`, or `logout()` failing silently and leaving a stale token — would constitute a security defect. The 401 event bridge connects `api.ts` to `AuthContext` and has never been tested end-to-end. Risk factors: high likelihood of impact if broken; maximum business impact (authentication bypass or infinite loading spinner blocking the app).

#### Recommended test approach

Vitest + `@testing-library/react` (`renderHook` + `act`). Mock `getAuthStatus` and `logoutAuth` from `../utils/api` with `vi.mock`. Use `sessionStorage` directly for assertion. No Playwright needed.

#### Test suggestion stubs

```typescript
// src/context/AuthContext.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import * as api from "../utils/api";

vi.mock("../utils/api", () => ({
  getAuthStatus: vi.fn(),
  logoutAuth:    vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext", () => {

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe("initial load", () => {
    it("sets loading=true until getAuthStatus resolves", async () => {
      /**
       * Verifies that the provider starts with loading=true and only
       * transitions to loading=false after the status fetch completes.
       */
      let resolve: (v: { configured: boolean }) => void;
      vi.mocked(api.getAuthStatus).mockReturnValue(
        new Promise((r) => { resolve = r; })
      );
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.loading).toBe(true);
      act(() => resolve!({ configured: true }));
      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("sets isConfigured=false when backend reports configured=false", async () => {
      /**
       * Verifies that the context exposes the correct isConfigured flag
       * used to decide whether to show the setup screen vs login screen.
       */
      vi.mocked(api.getAuthStatus).mockResolvedValue({ configured: false });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.isConfigured).toBe(false);
    });

    it("sets statusError=true when getAuthStatus rejects", async () => {
      /**
       * Verifies the error flag that triggers the 'Cannot reach backend'
       * error state in the UI.
       */
      vi.mocked(api.getAuthStatus).mockRejectedValue(new Error("network"));
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.statusError).toBe(true);
    });
  });

  describe("login()", () => {
    it("stores token in sessionStorage and sets isAuthenticated=true", async () => {
      /**
       * Verifies that calling login() makes the token available for
       * all subsequent API calls via authHeaders().
       */
      vi.mocked(api.getAuthStatus).mockResolvedValue({ configured: true });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.login("test-token-xyz"));
      expect(result.current.isAuthenticated).toBe(true);
      expect(sessionStorage.getItem("squeezypay_token")).toBe("test-token-xyz");
    });
  });

  describe("logout()", () => {
    it("clears token and sets isAuthenticated=false even if logoutAuth throws", async () => {
      /**
       * Verifies the fire-and-forget logout: errors from the backend
       * must never leave the user in a logged-in state client-side.
       */
      vi.mocked(api.getAuthStatus).mockResolvedValue({ configured: true });
      vi.mocked(api.logoutAuth).mockRejectedValue(new Error("network"));
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.login("tok"));
      await act(async () => result.current.logout());
      expect(result.current.isAuthenticated).toBe(false);
      expect(sessionStorage.getItem("squeezypay_token")).toBeNull();
    });
  });

  describe("401 global event bridge", () => {
    it("clears token when squeezypay:unauthorized event fires", async () => {
      /**
       * Verifies the bridge between api.ts (which dispatches the event)
       * and AuthContext (which clears the session) — the seam between
       * the two modules with the highest security implications.
       */
      vi.mocked(api.getAuthStatus).mockResolvedValue({ configured: true });
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.login("tok"));
      expect(result.current.isAuthenticated).toBe(true);
      act(() => window.dispatchEvent(new Event("squeezypay:unauthorized")));
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("useAuth() guard", () => {
    it("throws when used outside AuthProvider", () => {
      /**
       * Verifies the developer-facing guard that prevents silent null
       * reference bugs when a component is mounted outside the tree.
       */
      expect(() => renderHook(() => useAuth())).toThrow(
        "useAuth must be used within AuthProvider"
      );
    });
  });
});
```

---

### `src/utils/api.ts` — Critical (gaps in existing coverage)

#### What is untested

**Entirely untested mutation functions:**
- `createBill` / `updateBill` / `deleteBill` — snake_case serialisation, return type mapping, null-on-error
- `loginAuth` — 401 throws `"Incorrect passphrase"`, non-401 non-OK throws, success path returns token
- `changePassphrase` — 401 throws, success path (void), non-OK non-401 throws
- `setupAuth` — success and failure paths
- `saveCredential` — PUT vs POST branch (existingId null vs non-null), URL construction
- `createPlaidLinkToken` — error detail extraction from response body, throws on failure
- `exchangePlaidPublicToken` — maps `RawPlaidItem` to `PlaidItem`
- `syncPlaidTransactions` — throws on non-OK (no try/catch)
- `assignPlaidTransactionCategory` — throws on non-OK (no try/catch)
- `getPlaidBlame` — throws on non-OK (no try/catch), `mapBlameData` snake_case → camelCase
- `syncPlaidBalances` — throws on non-OK (no try/catch)

**Untested map functions (via untested callers):**
- `mapPayment` — partially tested via `logPayment`; `getAllPayments` / `getPaymentsByBill` not tested
- `mapIncome` — `updateIncome`, `reactivateIncome`, `deactivateIncome` not tested
- `mapPlaidTransaction` — `getPlaidTransactions` params serialisation (URLSearchParams construction) not tested
- `mapPlaidItem` — `getPlaidItems` not tested
- `mapPlaidAccount` — `getPlaidAccounts` not tested
- `mapBlameData` — not tested

**Parameter serialisation gaps:**
- `getIncome(includeInactive=true)` query string construction
- `getPlaidTransactions` — all query params (accountId, startDate, endDate, limit, offset)

#### Risk rationale (ISTQB)

**Critical.** The mutation paths (`createBill`, `deleteBill`, `changePassphrase`) are write operations — a serialisation bug here corrupts or loses data. The Plaid functions (`createPlaidLinkToken`, `exchangePlaidPublicToken`) have no safety net (no try/catch in some paths — they throw on error) and connect to a third-party financial service. The `saveCredential` PUT/POST branch is particularly risky: the wrong HTTP method being sent silently creates duplicates or fails with a 405.

#### Recommended test approach

Same pattern as existing `api.test.ts`: Vitest + jsdom, `vi.fn()` mock on `globalThis.fetch`. No React Testing Library required.

#### Test suggestion stubs

```typescript
// additions to src/utils/api.test.ts

describe("createBill", () => {
  it("sends snake_case body to POST /api/bills/", async () => {
    /**
     * Verifies the camelCase-to-snake_case serialisation that the backend
     * expects. A mismatch here silently creates bills with wrong fields.
     */
    const rawBill = { id: 1, name: "Internet", category: "Utilities",
      day_of_month: 5, expected_amount: 80, url: "https://isp.com",
      recurring: true, notes: null };
    mockFetch(200, rawBill);
    await createBill({ name: "Internet", category: "Utilities",
      url: "https://isp.com", expectedAmount: 80, dayOfMonth: 5, recurring: true });
    const body = JSON.parse(fetchBody());
    expect(body).toMatchObject({ name: "Internet", day_of_month: 5,
      expected_amount: 80, recurring: true });
  });

  it("returns null when the API responds with an error", async () => {
    /** Verifies the safe null-return contract used by ManageBillers to detect failure. */
    mockFetch(500, {});
    expect(await createBill({ name: "X", category: "Y", url: "u",
      dayOfMonth: 1, recurring: true })).toBeNull();
  });
});

describe("deleteBill", () => {
  it("returns true on 200", async () => {
    mockFetch(200, {});
    expect(await deleteBill(1)).toBe(true);
  });

  it("returns false on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("network"));
    expect(await deleteBill(1)).toBe(false);
  });
});

describe("loginAuth", () => {
  it("throws 'Incorrect passphrase' on 401", async () => {
    /**
     * Verifies that the LoginScreen receives the correct user-facing
     * error string when the passphrase is wrong.
     */
    mockFetch(401, {});
    await expect(loginAuth("wrong")).rejects.toThrow("Incorrect passphrase");
  });

  it("returns access_token on success", async () => {
    mockFetch(200, { access_token: "jwt-abc" });
    const result = await loginAuth("correct");
    expect(result.access_token).toBe("jwt-abc");
  });
});

describe("changePassphrase", () => {
  it("throws on 401 with user-facing message", async () => {
    mockFetch(401, {});
    await expect(changePassphrase("old", "new")).rejects.toThrow(
      "Current passphrase is incorrect."
    );
  });

  it("resolves without throwing on 200", async () => {
    mockFetch(200, {});
    await expect(changePassphrase("old", "newlong")).resolves.toBeUndefined();
  });
});

describe("saveCredential", () => {
  it("uses POST when existingId is null", async () => {
    /** Verifies that creating a new credential sends POST, not PUT. */
    mockFetch(200, { id: 1, bill_id: 5, username: "u", password: "p" });
    await saveCredential(5, "u", "p", null);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method)
      .toBe("POST");
  });

  it("uses PUT when existingId is provided", async () => {
    /** Verifies that updating a credential sends PUT to the existing resource URL. */
    mockFetch(200, { id: 7, bill_id: 5, username: "u2", password: "p2" });
    await saveCredential(5, "u2", "p2", 7);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(url).toContain("/api/credentials/7");
  });
});

describe("createPlaidLinkToken", () => {
  it("extracts link_token from response", async () => {
    mockFetch(200, { link_token: "link-sandbox-abc" });
    const token = await createPlaidLinkToken();
    expect(token).toBe("link-sandbox-abc");
  });

  it("throws with detail from response body on error", async () => {
    /**
     * Verifies that the user-facing error shown in PlaidLinkButton
     * contains the backend's detail string, not a generic HTTP status.
     */
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false, status: 400,
      json: () => Promise.resolve({ detail: "Plaid environment mismatch" }),
    });
    await expect(createPlaidLinkToken()).rejects.toThrow("Plaid environment mismatch");
  });
});

describe("getPlaidTransactions URL params", () => {
  it("serialises all filter params into the query string", async () => {
    /**
     * Verifies that account, date, limit, and offset filters are all
     * forwarded — omitting any of these would silently return unfiltered data.
     */
    mockFetch(200, { transactions: [], total: 0 });
    await getPlaidTransactions({ accountId: 3, startDate: "2026-01-01",
      endDate: "2026-01-31", limit: 50, offset: 100 });
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("account_id=3");
    expect(url).toContain("start_date=2026-01-01");
    expect(url).toContain("end_date=2026-01-31");
    expect(url).toContain("limit=50");
    expect(url).toContain("offset=100");
  });
});

describe("mapBlameData (via getPlaidBlame)", () => {
  it("maps snake_case blame fields to camelCase", async () => {
    /**
     * Verifies the response mapping — byCategory and byAccount are used
     * directly by SpendingBlame charts and breakdowns.
     */
    const raw = {
      period_start: "2026-05-01", period_end: "2026-05-31",
      total_spending: 1234,
      by_category: [{ category: "FOOD", amount: 400, count: 10, pct: 32 }],
      by_account:  [{ account_name: "Checking", amount: 1234, pct: 100 }],
    };
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200, json: () => Promise.resolve(raw),
    });
    const result = await getPlaidBlame(30);
    expect(result).toMatchObject({
      periodStart: "2026-05-01", periodEnd: "2026-05-31",
      totalSpending: 1234,
      byCategory: [{ category: "FOOD", amount: 400, count: 10, pct: 32 }],
    });
  });
});
```

---

### `src/components/LoginScreen.tsx` — Critical

#### What is untested

- Renders the passphrase input and Sign In button
- Successful submit: calls `loginAuth`, then `login(token)` from context
- Wrong passphrase: shows error message, clears the passphrase field, does not navigate
- Network failure: shows generic "Login failed" error
- Submit button shows "Signing in…" and is disabled during the request
- Form submission blocked while loading (disabled input)

#### Risk rationale (ISTQB)

**Critical.** This is the authentication gate for all users. An untested regression — e.g., the error state not clearing the passphrase field — could leak the passphrase in the DOM. The "clears field on error" behaviour is a specific security-relevant requirement that is only verified by a test.

#### Recommended test approach

Vitest + `@testing-library/react`. Mock `loginAuth` from `../utils/api` with `vi.mock`. Provide `AuthProvider` as wrapper or mock `useAuth`. Use `userEvent` for realistic interaction.

#### Test suggestion stubs

```typescript
// src/components/LoginScreen.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginScreen from "./LoginScreen";
import * as api from "../utils/api";

vi.mock("../utils/api", () => ({
  loginAuth: vi.fn(),
  getAuthStatus: vi.fn().mockResolvedValue({ configured: true }),
  logoutAuth: vi.fn(),
}));

// Provide a real or stub AuthProvider
import { AuthProvider } from "../context/AuthContext";
const wrap = (ui: React.ReactNode) =>
  render(<AuthProvider>{ui}</AuthProvider>);

describe("LoginScreen", () => {

  it("renders passphrase input and Sign In button", () => {
    /** Smoke test: confirms the login form is present in the DOM. */
    wrap(<LoginScreen />);
    expect(screen.getByLabelText(/passphrase/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls loginAuth with the entered passphrase on submit", async () => {
    /**
     * Verifies that the value typed into the input is forwarded verbatim
     * to loginAuth — a field name mismatch would silently send empty credentials.
     */
    vi.mocked(api.loginAuth).mockResolvedValue({ access_token: "tok" });
    wrap(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/passphrase/i), "mysecret");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(api.loginAuth).toHaveBeenCalledWith("mysecret");
  });

  it("shows error message and clears passphrase field on 401", async () => {
    /**
     * Verifies the security-relevant behaviour: passphrase must be cleared
     * so it does not remain in the input after a failed attempt.
     */
    vi.mocked(api.loginAuth).mockRejectedValue(new Error("Incorrect passphrase"));
    wrap(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/passphrase/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/incorrect passphrase/i)).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/passphrase/i)).toHaveValue("");
  });

  it("disables the submit button and shows loading text during request", async () => {
    /**
     * Verifies the loading state prevents double-submission.
     */
    let resolve: () => void;
    vi.mocked(api.loginAuth).mockReturnValue(
      new Promise((r) => { resolve = () => r({ access_token: "t" }); })
    );
    wrap(<LoginScreen />);
    await userEvent.type(screen.getByLabelText(/passphrase/i), "pass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    resolve!();
  });
});
```

---

### `src/utils/stalenessUtils.ts` — High

#### What is untested

- `null` / `undefined` input → `{ stale: true, label: "Never synced" }`
- A timestamp less than 12 hours ago → `{ stale: false, label: "" }`
- A timestamp exactly 12 hours ago (boundary) → stale (diffH is not < 12)
- A timestamp between 12 and 24 hours ago → label uses hours (`"Last synced 13h ago"`)
- A timestamp 24+ hours ago → label uses days (`"Last synced 2d ago"`)
- `Math.floor` truncation (e.g., 13.9h → "13h", not "14h")

#### Risk rationale (ISTQB)

**High.** This function drives the staleness warning shown on Dashboard and TransactionTable whenever Plaid data is stale. Incorrect boundary values (off-by-one at 12 hours) would either suppress warnings that should appear or show spurious warnings. The boundary at exactly 12h is a classic off-by-one: `diffH < STALE_HOURS` means 12.0h is stale, which is the intended behaviour but must be verified. Equivalence partitions: null, [0, 12), 12, (12, 24), ≥24.

#### Recommended test approach

Pure Vitest unit test. Use `vi.useFakeTimers()` + `vi.setSystemTime()` to control `Date.now()`. No React dependency.

#### Test suggestion stubs

```typescript
// src/utils/stalenessUtils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { staleness } from "./stalenessUtils";

const NOW = new Date("2026-06-08T12:00:00Z").getTime();

describe("staleness()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  describe("null / undefined input", () => {
    it("returns stale=true and 'Never synced' for null", () => {
      /** EP: null is the initial state before any Plaid sync. */
      expect(staleness(null)).toEqual({ stale: true, label: "Never synced" });
    });

    it("returns stale=true and 'Never synced' for undefined", () => {
      expect(staleness(undefined)).toEqual({ stale: true, label: "Never synced" });
    });
  });

  describe("fresh data (< 12h)", () => {
    it("returns stale=false and empty label for data 1 hour old", () => {
      /** EP: well inside the fresh zone. */
      const t = new Date(NOW - 1 * 60 * 60 * 1000).toISOString();
      expect(staleness(t)).toEqual({ stale: false, label: "" });
    });

    it("returns stale=false for data 11h 59m old", () => {
      /** BVA: just below the 12h boundary. */
      const t = new Date(NOW - (12 * 60 * 60 * 1000 - 60_000)).toISOString();
      expect(staleness(t)).toEqual({ stale: false, label: "" });
    });
  });

  describe("stale data (≥ 12h, < 24h) — hour label", () => {
    it("returns stale=true with hour label at exactly 12h", () => {
      /** BVA: the boundary value — diffH is not < 12, so it IS stale. */
      const t = new Date(NOW - 12 * 60 * 60 * 1000).toISOString();
      const result = staleness(t);
      expect(result.stale).toBe(true);
      expect(result.label).toBe("Last synced 12h ago");
    });

    it("truncates fractional hours with Math.floor", () => {
      /** Verifies floor behaviour: 13.9h is shown as '13h', not '14h'. */
      const t = new Date(NOW - 13.9 * 60 * 60 * 1000).toISOString();
      expect(staleness(t).label).toBe("Last synced 13h ago");
    });
  });

  describe("very stale data (≥ 24h) — day label", () => {
    it("returns day-based label at exactly 24h", () => {
      /** BVA: the boundary between hour-label and day-label. */
      const t = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
      expect(staleness(t)).toEqual({ stale: true, label: "Last synced 1d ago" });
    });

    it("returns correct day count for 48h old data", () => {
      const t = new Date(NOW - 48 * 60 * 60 * 1000).toISOString();
      expect(staleness(t)).toEqual({ stale: true, label: "Last synced 2d ago" });
    });
  });
});
```

---

### `src/context/ThemeContext.tsx` — High

#### What is untested

- Reads `localStorage.getItem("squeezypay-theme")` on init: `"dark"` → dark=true, `"light"` → dark=false
- Falls back to `window.matchMedia("(prefers-color-scheme: dark)")` when no stored value
- `toggle()` flips `dark` and writes to localStorage
- `useEffect` adds/removes `"dark"` class on `document.documentElement`
- `useTheme()` throws outside provider

#### Risk rationale (ISTQB)

**High.** Theme state persistence is a user-visible contract. If `toggle()` writes the wrong value or the `dark` class is not applied/removed correctly, all dark-mode users see broken styles. The `localStorage` initialiser and the `matchMedia` fallback have three distinct branches, each with a distinct outcome.

#### Recommended test approach

Vitest + `@testing-library/react`. Mock `localStorage` and `window.matchMedia` with `vi.stubGlobal` or `Object.defineProperty`.

#### Test suggestion stubs

```typescript
// src/context/ThemeContext.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  <ThemeProvider>{children}</ThemeProvider>;

describe("ThemeContext", () => {

  it("initialises to dark when localStorage has 'dark'", () => {
    /** Verifies that a returning user's dark preference is restored. */
    localStorage.setItem("squeezypay-theme", "dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.dark).toBe(true);
    localStorage.clear();
  });

  it("initialises to light when localStorage has 'light'", () => {
    localStorage.setItem("squeezypay-theme", "light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.dark).toBe(false);
    localStorage.clear();
  });

  it("falls back to matchMedia when no localStorage value is set", () => {
    /**
     * Verifies the OS preference fallback used for first-time visitors.
     */
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.dark).toBe(true);
  });

  it("toggle() flips dark state and writes to localStorage", () => {
    localStorage.setItem("squeezypay-theme", "light");
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggle());
    expect(result.current.dark).toBe(true);
    expect(localStorage.getItem("squeezypay-theme")).toBe("dark");
    localStorage.clear();
  });

  it("adds 'dark' class to documentElement when dark=true", () => {
    localStorage.setItem("squeezypay-theme", "dark");
    renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    localStorage.clear();
  });

  it("throws when used outside ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within ThemeProvider"
    );
  });
});
```

---

### `src/hooks/useFocusTrap.ts` — High

#### What is untested

- On mount: moves focus to the first focusable element inside the container
- Tab key on the last focusable element wraps focus to the first
- Shift+Tab on the first focusable element wraps focus to the last
- Tab key with no focusable elements: `preventDefault` is called, no crash
- On unmount: focus is restored to the previously focused element and the keydown listener is removed

#### Risk rationale (ISTQB)

**High.** This hook is used by `BillFormModal` — the highest-traffic data-entry component. Broken focus trapping is a WCAG 2.1 failure (SC 2.1.2 No Keyboard Trap) and an accessibility regression. The cyclic Tab wrapping logic has four branches, none of which are covered.

#### Recommended test approach

Vitest + `@testing-library/react` (`renderHook`). Use jsdom's real DOM and `userEvent` for keyboard simulation. Create a test component with known focusable elements.

#### Test suggestion stubs

```typescript
// src/hooks/useFocusTrap.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "./useFocusTrap";

function TrapFixture() {
  const ref = useFocusTrap<HTMLDivElement>();
  return (
    <div ref={ref}>
      <button data-testid="btn1">First</button>
      <button data-testid="btn2">Second</button>
      <button data-testid="btn3">Last</button>
    </div>
  );
}

describe("useFocusTrap", () => {

  it("focuses the first focusable element on mount", () => {
    /**
     * Verifies that opening a modal immediately puts focus on the first
     * interactive element, satisfying WCAG 2.4.3 Focus Order.
     */
    render(<TrapFixture />);
    expect(document.activeElement).toBe(screen.getByTestId("btn1"));
  });

  it("wraps Tab from the last element to the first", async () => {
    /**
     * Verifies forward Tab cycling: pressing Tab on the last button
     * must not escape the modal.
     */
    render(<TrapFixture />);
    screen.getByTestId("btn3").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByTestId("btn1"));
  });

  it("wraps Shift+Tab from the first element to the last", async () => {
    /**
     * Verifies backward Tab cycling.
     */
    render(<TrapFixture />);
    screen.getByTestId("btn1").focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId("btn3"));
  });

  it("restores focus to the previously focused element on unmount", () => {
    /**
     * Verifies focus restoration: when the modal closes, keyboard focus
     * must return to the trigger button that opened it.
     */
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<TrapFixture />);
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
```

---

### `src/components/BillFormModal.tsx` — High

#### What is untested

- Renders with `bill=null` → "Add Bill" title and empty fields
- Renders with an existing bill → "Edit Bill" title and pre-populated fields (via `reset()`)
- Validation: submitting with name empty shows "Required" error
- Validation: `dayOfMonth` < 1 or > 31 shows "Enter a day 1-31"
- Valid submit: calls `onSave` with correctly structured `BillPayload` (camelCase, `expectedAmount: null` when 0)
- Success state: shows "Bill added" / "Bill updated" confirmation after `onSave` resolves
- Close button calls `onClose`
- `useFocusTrap` ref is attached (integration: modal receives focus on open)

#### Risk rationale (ISTQB)

**High.** The modal is the primary data-entry path for all bill creation and editing. Validation failures here corrupt the bills table. The `expectedAmount` mapping (`0 → null`) is a non-obvious business rule that must be verified — sending `0` instead of `null` would display "$0.00" instead of "Amount varies".

#### Recommended test approach

Vitest + `@testing-library/react`. Mock `onSave` and `onClose` as `vi.fn()`. Use `userEvent` for input. No backend mock needed — the component is controlled by props.

#### Test suggestion stubs

```typescript
// src/components/BillFormModal.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillFormModal from "./BillFormModal";
import type { Bill } from "../types";

const noop = vi.fn().mockResolvedValue(undefined);

function renderModal(bill: Bill | null, onSave = noop, onClose = vi.fn()) {
  return render(<BillFormModal bill={bill} onSave={onSave} onClose={onClose} />);
}

describe("BillFormModal", () => {

  it("shows 'Add Bill' title when bill is null", () => {
    renderModal(null);
    expect(screen.getByRole("heading", { name: /add bill/i })).toBeInTheDocument();
  });

  it("pre-populates fields when editing an existing bill", () => {
    /**
     * Verifies that the react-hook-form reset() call with the bill data
     * actually populates the inputs.
     */
    const bill: Bill = { id: 1, name: "Electric", category: "Utilities",
      dayOfMonth: 15, expectedAmount: 80, amountLabel: "$80.00",
      url: "https://electric.com", recurring: true, notes: null };
    renderModal(bill);
    expect(screen.getByDisplayValue("Electric")).toBeInTheDocument();
    expect(screen.getByDisplayValue("15")).toBeInTheDocument();
  });

  it("shows validation error when name is empty on submit", async () => {
    /**
     * Verifies required-field validation for the most important field.
     */
    renderModal(null);
    await userEvent.click(screen.getByRole("button", { name: /add bill/i }));
    await waitFor(() => expect(screen.getByText(/required/i)).toBeInTheDocument());
  });

  it("shows validation error when dayOfMonth is out of range", async () => {
    renderModal(null);
    await userEvent.type(screen.getByLabelText(/biller name/i), "Test");
    await userEvent.clear(screen.getByLabelText(/due day/i));
    await userEvent.type(screen.getByLabelText(/due day/i), "32");
    await userEvent.click(screen.getByRole("button", { name: /add bill/i }));
    await waitFor(() =>
      expect(screen.getByText(/enter a day 1-31/i)).toBeInTheDocument()
    );
  });

  it("calls onSave with null expectedAmount when amount is 0", async () => {
    /**
     * Verifies the business rule: $0 means 'Amount varies', not a $0 bill.
     * Sending 0 to the API would display '$0.00' on all bill cards.
     */
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderModal(null, onSave);
    await userEvent.type(screen.getByLabelText(/biller name/i), "Internet");
    await userEvent.type(screen.getByLabelText(/payment url/i), "https://isp.com");
    await userEvent.type(screen.getByLabelText(/due day/i), "5");
    await userEvent.click(screen.getByRole("button", { name: /add bill/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].expectedAmount).toBeNull();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    renderModal(null, noop, onClose);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

---

### `src/components/Settings.tsx` (ChangePassphraseCard) — High

#### What is untested

- Client-side validation: new passphrase < 8 characters → error, no API call
- Client-side validation: confirm != new → "do not match" error, no API call
- Valid submit: calls `changePassphrase(current, next)` via mutation
- On success: clears all three fields, shows "Passphrase updated" briefly
- On error: shows the error message from the thrown Error

#### Risk rationale (ISTQB)

**High.** The passphrase change form has two client-side validation rules that are purely in component code, not in `api.ts`. These rules are the last line of defence against user error (submitting mismatched passphrases). Neither rule has any test coverage.

#### Recommended test approach

Vitest + `@testing-library/react`. Mock `changePassphrase` from `../utils/api`. Wrap with `QueryClientProvider` (required for `useMutation`).

#### Test suggestion stubs

```typescript
// src/components/Settings.test.tsx (ChangePassphraseCard)
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Settings from "./Settings";
import * as api from "../utils/api";

vi.mock("../utils/api", () => ({
  getSettings:      vi.fn().mockResolvedValue({ dueSoonDays: 7, largePaymentThreshold: 500 }),
  updateSettings:   vi.fn().mockResolvedValue({}),
  getCategories:    vi.fn().mockResolvedValue([]),
  createCategory:   vi.fn(),
  updateCategory:   vi.fn(),
  changePassphrase: vi.fn(),
}));

function renderSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}><Settings /></QueryClientProvider>
  );
}

describe("Settings — ChangePassphraseCard", () => {

  it("shows mismatch error without calling the API", async () => {
    /**
     * Verifies the client-side guard against submitting a mismatched
     * passphrase pair — the API must never be called in this case.
     */
    renderSettings();
    await userEvent.type(screen.getByLabelText(/current passphrase/i), "oldpass");
    await userEvent.type(screen.getByLabelText(/^new passphrase/i), "newpass1");
    await userEvent.type(screen.getByLabelText(/confirm new/i), "newpass2");
    await userEvent.click(screen.getByRole("button", { name: /update passphrase/i }));
    await waitFor(() =>
      expect(screen.getByText(/do not match/i)).toBeInTheDocument()
    );
    expect(api.changePassphrase).not.toHaveBeenCalled();
  });

  it("shows length error when new passphrase is less than 8 characters", async () => {
    renderSettings();
    await userEvent.type(screen.getByLabelText(/current passphrase/i), "old");
    await userEvent.type(screen.getByLabelText(/^new passphrase/i), "short");
    await userEvent.type(screen.getByLabelText(/confirm new/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /update passphrase/i }));
    await waitFor(() =>
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    );
    expect(api.changePassphrase).not.toHaveBeenCalled();
  });

  it("calls changePassphrase and shows success message on valid submit", async () => {
    vi.mocked(api.changePassphrase).mockResolvedValue(undefined);
    renderSettings();
    await userEvent.type(screen.getByLabelText(/current passphrase/i), "current123");
    await userEvent.type(screen.getByLabelText(/^new passphrase/i), "newpass123");
    await userEvent.type(screen.getByLabelText(/confirm new/i), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: /update passphrase/i }));
    await waitFor(() =>
      expect(screen.getByText(/passphrase updated/i)).toBeInTheDocument()
    );
    expect(api.changePassphrase).toHaveBeenCalledWith("current123", "newpass123");
  });
});
```

---

### `src/components/PlaidLinkButton.tsx` — High

#### What is untested

- Button is visible with default label "Connect Bank Account"
- Click calls `createPlaidLinkToken()` and shows loading state during fetch
- If `createPlaidLinkToken` throws, `tokenError` is shown
- `exchangePlaidPublicToken` mutation is invoked with the token returned by `onSuccess`
- During exchange, button shows "Connecting…"

#### Risk rationale (ISTQB)

**High.** Plaid is the sole bank connectivity path. If the link button does not correctly call `createPlaidLinkToken` or does not pass the public token to `exchangePlaidPublicToken`, the bank connection silently fails. The token error display is the only user-visible signal for a backend Plaid misconfiguration.

#### Recommended test approach

Vitest + `@testing-library/react`. Mock `react-plaid-link` (`usePlaidLink`) to expose `open` and `ready` as controllable `vi.fn()`. Mock `createPlaidLinkToken` and `exchangePlaidPublicToken` from `../utils/api`. Wrap with `QueryClientProvider`.

#### Test suggestion stubs

```typescript
// src/components/PlaidLinkButton.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlaidLinkButton from "./PlaidLinkButton";
import * as api from "../utils/api";

vi.mock("../utils/api", () => ({
  createPlaidLinkToken:    vi.fn(),
  exchangePlaidPublicToken: vi.fn(),
}));

vi.mock("react-plaid-link", () => ({
  usePlaidLink: vi.fn(() => ({ open: vi.fn(), ready: true })),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("PlaidLinkButton", () => {

  it("renders with default label", () => {
    wrap(<PlaidLinkButton />);
    expect(screen.getByRole("button", { name: /connect bank account/i })).toBeInTheDocument();
  });

  it("shows error message when createPlaidLinkToken throws", async () => {
    /**
     * Verifies that a backend Plaid misconfiguration produces a visible
     * error rather than a silent failure.
     */
    vi.mocked(api.createPlaidLinkToken).mockRejectedValue(new Error("Plaid not configured"));
    wrap(<PlaidLinkButton />);
    await userEvent.click(screen.getByRole("button", { name: /connect bank account/i }));
    await waitFor(() =>
      expect(screen.getByText(/could not open plaid/i)).toBeInTheDocument()
    );
  });

  it("shows loading state while fetching token", async () => {
    /**
     * Verifies the button is disabled and shows 'Loading…' while waiting
     * for the link token, preventing double-click.
     */
    let resolve: (v: string) => void;
    vi.mocked(api.createPlaidLinkToken).mockReturnValue(
      new Promise((r) => { resolve = r; })
    );
    wrap(<PlaidLinkButton />);
    await userEvent.click(screen.getByRole("button", { name: /connect bank account/i }));
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
    resolve!("link-sandbox-abc");
  });
});
```

---

### `src/components/Bills.tsx` — Medium

#### What is untested

Sub-view navigation:
- SubNav renders four tab buttons; clicking changes the active view
- `initialView` prop sets the correct starting sub-view

`BillsOverview`:
- Loading state shows spinner
- Zero bills shows the empty-state message
- Actionable bills: CTA card changes color and copy based on overdue/due-soon count

`BillPaymentHistory`:
- Search filters the payment list
- Clicking a column header toggles sort direction
- `aria-sort` attribute is set correctly on the sorted column

`ManageBillers`:
- "Add Biller" button opens the `BillFormModal`
- Confirm-delete dialog appears on delete icon click
- Confirming delete calls `deleteBill` mutation

#### Risk rationale (ISTQB)

**Medium.** The sub-view navigation, search, and sort are pure UI interactions with no data risk. The delete confirmation is Medium rather than High because `deleteBill` itself (the API call) is tested separately. The mutation orchestration in `ManageBillers` is High-value but complex to test due to QueryClient setup.

#### Recommended test approach

Vitest + `@testing-library/react`. Mock all API functions with `vi.mock`. Wrap with `QueryClientProvider`. Use `msw` (Mock Service Worker) as an alternative to per-test `mockFetch` for the query-heavy sub-views.

#### Test suggestion stubs

```typescript
// src/components/Bills.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Bills from "./Bills";
import * as api from "../utils/api";

vi.mock("../utils/api", () => ({
  getBills:      vi.fn().mockResolvedValue([]),
  getAllPayments: vi.fn().mockResolvedValue([]),
  createBill:    vi.fn(),
  updateBill:    vi.fn(),
  deleteBill:    vi.fn().mockResolvedValue(true),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Bills — SubNav", () => {

  it("renders all four sub-view tabs", () => {
    wrap(<Bills />);
    expect(screen.getByRole("button", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pay bills/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /payment history/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage billers/i })).toBeInTheDocument();
  });

  it("switches to Payment History view on tab click", async () => {
    /**
     * Verifies that clicking a sub-nav button renders the correct content.
     */
    wrap(<Bills />);
    await userEvent.click(screen.getByRole("button", { name: /payment history/i }));
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    );
  });

  it("initialises to the view specified by initialView prop", () => {
    wrap(<Bills initialView="manage" />);
    expect(screen.getByRole("button", { name: /add biller/i })).toBeInTheDocument();
  });
});

describe("Bills — ManageBillers delete flow", () => {

  it("shows confirm dialog before deleting a bill", async () => {
    /**
     * Verifies that the destructive delete action requires explicit confirmation.
     */
    vi.mocked(api.getBills).mockResolvedValue([{
      id: 1, name: "Electric", category: "Utilities", dayOfMonth: 15,
      expectedAmount: 80, amountLabel: "$80.00", url: "https://e.com",
      recurring: true, notes: null,
    }]);
    wrap(<Bills initialView="manage" />);
    await waitFor(() => screen.getByLabelText(/delete electric/i));
    await userEvent.click(screen.getByLabelText(/delete electric/i));
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
    expect(api.deleteBill).not.toHaveBeenCalled();
  });
});
```

---

### `src/components/SpendingBlame.tsx` — Medium

#### What is untested

- `EmptyState` renders when `totalSpending === 0` with correct copy based on `hasAccounts`
- Period selector (7d / 30d / 90d) is hidden when no data; visible when `totalSpending > 0`
- Clicking a period button changes `daysBack` and triggers a new `getPlaidBlame` query
- Category collapse: slices < 2% are rolled into "Other" in `pieData`
- `formatCategoryLabel`: underscores replaced, title-cased
- Error state shows the error message
- `StalenessWarning` is rendered when accounts exist

#### Risk rationale (ISTQB)

**Medium.** This is a read-only analytics view — no mutations, no financial state changes. The `< 2%` threshold collapse is a non-obvious transformation that could silently produce incorrect chart data if broken, but does not cause data loss.

#### Recommended test approach

Vitest + `@testing-library/react`. The `recharts` components (`PieChart`, `BarChart`) require a ResizeObserver mock in jsdom. Alternative: test the `formatCategoryLabel` and pie-data-collapse logic as pure functions extracted into a utility, then test the component integration with chart output mocked.

#### Test suggestion stubs

```typescript
// src/components/SpendingBlame.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SpendingBlame from "./SpendingBlame";
import * as api from "../utils/api";

// recharts uses ResizeObserver — must polyfill in jsdom
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver;

vi.mock("../utils/api", () => ({
  getPlaidBlame:    vi.fn(),
  getPlaidItems:    vi.fn().mockResolvedValue([]),
  getPlaidAccounts: vi.fn().mockResolvedValue([]),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("SpendingBlame", () => {

  it("shows empty state when totalSpending is 0 and no accounts", async () => {
    /**
     * Verifies the correct empty-state branch: no accounts → show
     * 'Connect a Bank Account' rather than 'Go to Accounts'.
     */
    vi.mocked(api.getPlaidBlame).mockResolvedValue({
      periodStart: "2026-05-01", periodEnd: "2026-05-31",
      totalSpending: 0, byCategory: [], byAccount: [],
    });
    wrap(<SpendingBlame />);
    await waitFor(() =>
      expect(screen.getByText(/connect a bank account/i)).toBeInTheDocument()
    );
  });

  it("hides the period selector when there is no spending data", async () => {
    vi.mocked(api.getPlaidBlame).mockResolvedValue({
      periodStart: "", periodEnd: "", totalSpending: 0, byCategory: [], byAccount: [],
    });
    wrap(<SpendingBlame />);
    await waitFor(() => expect(screen.queryByText("7d")).not.toBeInTheDocument());
  });

  it("shows error state when getPlaidBlame rejects", async () => {
    vi.mocked(api.getPlaidBlame).mockRejectedValue(new Error("network"));
    wrap(<SpendingBlame />);
    await waitFor(() =>
      expect(screen.getByText(/failed to load spending data/i)).toBeInTheDocument()
    );
  });
});
```

---

### `src/components/TransactionTable.tsx` — Medium

#### What is untested

- Loading state shows "Loading…" text
- Error state shows "Failed to load transactions"
- Transactions render in the table
- Sort toggle: clicking a header sorts asc, clicking again sorts desc; `aria-sort` attribute updates
- Filter: account, startDate, endDate values are forwarded to `getPlaidTransactions`
- Pagination: Previous/Next buttons update the page number; buttons are disabled at boundaries
- `CategorySelect` change calls `assignPlaidTransactionCategory` with the correct txId and categoryId
- "Clear filters" button appears only when a filter is active

#### Risk rationale (ISTQB)

**Medium.** The transaction table is a read-heavy view with a category assignment mutation. The `CategorySelect` mutation is the highest-risk item (it writes data), but its underlying API function is simple and the component logic is straightforward.

#### Recommended test approach

Vitest + `@testing-library/react`. Mock API functions. The `@testing-library/user-event` `selectOptions` helper simplifies `CategorySelect` testing.

#### Test suggestion stubs

```typescript
// src/components/TransactionTable.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TransactionTable from "./TransactionTable";
import * as api from "../utils/api";

vi.mock("../utils/api", () => ({
  getPlaidTransactions:          vi.fn(),
  getPlaidAccounts:              vi.fn().mockResolvedValue([]),
  getCategories:                 vi.fn().mockResolvedValue([]),
  assignPlaidTransactionCategory: vi.fn(),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const EMPTY_TX_RESPONSE = { transactions: [], total: 0 };

describe("TransactionTable", () => {

  it("shows 'No transactions found' when the response is empty", async () => {
    vi.mocked(api.getPlaidTransactions).mockResolvedValue(EMPTY_TX_RESPONSE);
    wrap(<TransactionTable />);
    await waitFor(() =>
      expect(screen.getAllByText(/no transactions found/i)[0]).toBeInTheDocument()
    );
  });

  it("shows error message when getPlaidTransactions rejects", async () => {
    vi.mocked(api.getPlaidTransactions).mockRejectedValue(new Error("network"));
    wrap(<TransactionTable />);
    await waitFor(() =>
      expect(screen.getByText(/failed to load transactions/i)).toBeInTheDocument()
    );
  });

  it("updates aria-sort on Date header after click", async () => {
    /**
     * Verifies that column sort state is properly exposed to assistive
     * technology via the aria-sort attribute.
     */
    vi.mocked(api.getPlaidTransactions).mockResolvedValue(EMPTY_TX_RESPONSE);
    wrap(<TransactionTable />);
    await waitFor(() => screen.getByRole("columnheader", { name: /date/i }));
    const header = screen.getByRole("columnheader", { name: /date/i });
    // Default is descending; first click → ascending
    await userEvent.click(header);
    expect(header).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(header);
    expect(header).toHaveAttribute("aria-sort", "descending");
  });
});
```

---

### `src/components/Dashboard.tsx` — Low

#### What is untested

- Renders heading "Dashboard" unconditionally
- Spend snapshot section only renders when `accounts.length > 0`
- Account balances section only renders when `accounts.length > 0`
- "No bills added yet" empty state renders when bills are empty
- Income empty state renders when both `incomeStreams` and `recentIncomeTxs` are empty
- `AccountBalances` — pending transaction delta calculation on balance display
- `BillsSection` — shows "No overdue or upcoming bills" when actionable list is empty

#### Risk rationale (ISTQB)

**Low.** Dashboard is a read-only aggregation view. All data processing happens in `billUtils` (tested) and `stalenessUtils` (not yet tested). The conditional rendering paths are simple boolean checks. The `pendingDelta` calculation on account balances is the most logic-heavy piece, but it is a simple sum.

#### Recommended test approach

Vitest + `@testing-library/react`. Mock all `useQuery` calls by mocking the API functions or by using `@tanstack/react-query`'s `QueryClient` with pre-loaded state. Avoid full E2E here.

#### Test suggestion stubs

```typescript
// src/components/Dashboard.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "./Dashboard";
import * as api from "../utils/api";

vi.mock("../utils/api", () => ({
  getBills:             vi.fn().mockResolvedValue([]),
  getSettings:          vi.fn().mockResolvedValue({ dueSoonDays: 7, largePaymentThreshold: 500 }),
  getPlaidAccounts:     vi.fn().mockResolvedValue([]),
  getPlaidTransactions: vi.fn().mockResolvedValue({ transactions: [], total: 0 }),
  getPlaidBlame:        vi.fn().mockResolvedValue({ totalSpending: 0, byCategory: [], byAccount: [] }),
  getIncome:            vi.fn().mockResolvedValue([]),
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Dashboard /></QueryClientProvider>);
}

describe("Dashboard", () => {

  it("renders the Dashboard heading", async () => {
    /** Smoke test: the page title is visible. */
    wrap();
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("shows 'No bills added yet' when bills list is empty", async () => {
    wrap();
    await waitFor(() =>
      expect(screen.getByText(/no bills added yet/i)).toBeInTheDocument()
    );
  });

  it("does not render the spending section when no Plaid accounts are connected", async () => {
    wrap();
    await waitFor(() =>
      expect(screen.queryByText(/last 24 hours/i)).not.toBeInTheDocument()
    );
  });
});
```

---

## Testing Strategy Assessment

### Is Vitest + jsdom the right tool for everything here?

**Yes — for the vast majority of gaps.** The following work cleanly with Vitest + jsdom + `@testing-library/react`:

| Module | Tool |
|---|---|
| `stalenessUtils.ts` | Vitest only (pure function, no DOM) |
| `api.ts` gaps | Vitest + jsdom (same pattern as existing tests) |
| `AuthContext.tsx` | Vitest + jsdom + `renderHook` |
| `ThemeContext.tsx` | Vitest + jsdom + `renderHook` |
| `useFocusTrap.ts` | Vitest + jsdom + `userEvent` (keyboard simulation) |
| `LoginScreen.tsx` | Vitest + jsdom + `userEvent` |
| `BillFormModal.tsx` | Vitest + jsdom + `userEvent` |
| `Settings.tsx` | Vitest + jsdom + `QueryClientProvider` + `userEvent` |
| `Bills.tsx` | Vitest + jsdom + `QueryClientProvider` + `userEvent` |
| `TransactionTable.tsx` | Vitest + jsdom + `QueryClientProvider` |
| `Dashboard.tsx` | Vitest + jsdom + `QueryClientProvider` |
| `SpendingBlame.tsx` | Vitest + jsdom + ResizeObserver polyfill |

**`PlaidLinkButton` requires a mock for `react-plaid-link`.** The `usePlaidLink` hook opens a third-party iframe that cannot run in jsdom. The `open()` function and `ready` flag must be mocked. This is straightforward but is a hard requirement — do not attempt to test Plaid Link's actual SDK in jsdom.

### Where Playwright is appropriate (and where it is not)

Playwright is **not required** for the gaps identified in this audit. All the gaps are either:
1. Pure logic functions (no browser environment needed)
2. Context/hook behaviour verifiable with `renderHook`
3. Component rendering and user interaction verifiable with `@testing-library/react`

Playwright **is** appropriate for these scenarios (not in scope for this audit but worth noting):
- Full authentication flow: navigate to app, enter passphrase, verify redirect to Dashboard
- Plaid Link end-to-end: click "Connect Bank Account", verify Plaid iframe opens (requires Plaid sandbox)
- Multi-step bill pay session: navigate Bills → Pay Bills, log a payment, verify it appears in history
- Theme persistence across page reload: set dark mode, reload, verify class is still applied

### Missing dependencies

The project currently has no `@testing-library/react` installed. Before any component tests can be written, the following must be added to `devDependencies`:

```
@testing-library/react    (renderHook, render, screen, waitFor, act)
@testing-library/user-event  (userEvent for realistic keyboard/click simulation)
@testing-library/jest-dom    (toBeInTheDocument, toHaveAttribute, toHaveValue matchers)
```

The `vite.config.js` also requires two changes:
1. `environment: 'jsdom'` (globally, or per-file via `// @vitest-environment jsdom` directive)
2. `coverage.include: ['src/**']` (not `src/utils/**`) to count component coverage

---

## Recommendations

Listed in priority order for maximum risk reduction per engineering effort.

**1. Fix the test infrastructure (blocker — do first)**

- Add `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom` to devDependencies.
- Change `vite.config.js` `environment` from `'node'` to `'jsdom'`.
- Change `coverage.include` from `['src/utils/**']` to `['src/**']`.
- Investigate why `billUtils.test.ts` does not appear in coverage output — likely the `node` environment causes the import of `../types` to fail silently. Confirm the 16 `billUtils` tests actually run with `vitest run --reporter=verbose`.

**2. Write `AuthContext.test.tsx` (Critical — highest risk per line of code)**

The 401 event bridge and the `logout()` error-tolerance path are the most dangerous untested behaviours in the codebase. A one-day effort produces 6–8 tests covering the entire context lifecycle.

**3. Write api.ts mutation tests (Critical — completes the existing test file)**

Add `createBill`, `updateBill`, `deleteBill`, `loginAuth`, `changePassphrase`, `saveCredential`, `createPlaidLinkToken`, `getPlaidTransactions` params, and `mapBlameData` tests. These follow the exact same pattern as the 22 existing tests — estimated 2–3 hours of work for 20+ additional tests.

**4. Write `stalenessUtils.test.ts` (High — pure function, 30 minutes)**

The cleanest test coverage win: 8 tests, zero mocking, zero React dependency.

**5. Write `LoginScreen.test.tsx` (Critical security — one day)**

Priority on the "clears passphrase on error" behaviour and the disabled-during-loading guard.

**6. Write `ThemeContext.test.tsx` and `useFocusTrap.test.tsx` (High — one day combined)**

Both are self-contained with minimal mocking requirements.

**7. Write `BillFormModal.test.tsx` (High — one day)**

Priority on the `expectedAmount: 0 → null` mapping test and the `dayOfMonth` out-of-range validation.

**8. Write `Settings.test.tsx` — ChangePassphraseCard (High — half day)**

Focus on the two client-side validation rules before the mutation tests.

**9. Write `PlaidLinkButton.test.tsx` (High — half day)**

Focus on the token-error display path and the loading-state disable guard.

**10. Component render/interaction tests for Bills, TransactionTable, SpendingBlame, Dashboard (Medium/Low — sprint)**

Lower risk, higher effort. Consider using `msw` (Mock Service Worker) instead of per-test `vi.fn()` mocks for the query-heavy components — it produces more realistic tests and reduces mock boilerplate significantly.

**Target coverage after recommendations 1–9:** approximately 65% statements, 60% branches. Recommendation 10 brings it to approximately 80%+.

---

*End of audit.*
