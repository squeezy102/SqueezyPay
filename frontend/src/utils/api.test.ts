// @vitest-environment jsdom
// jsdom provides window, sessionStorage, and dispatchEvent natively.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  getSettings,
  updateSettings,
  getBills,
  createCategory,
  updateCategory,
  getMonthlyTotal,
  logPayment,
  createIncome,
  createBill,
  updateBill,
  deleteBill,
  changePassphrase,
  saveCredential,
  createPlaidLinkToken,
  getPlaidTransactions,
  getPlaidBlame,
  checkHealth,
} from "./api";

// ── Fetch mock helper ─────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("api.ts", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    vi.restoreAllMocks();
    globalThis.fetch = undefined as unknown as typeof fetch;
  });

  // ── authHeaders ─────────────────────────────────────────────────────────────

  describe("authHeaders (via request)", () => {
    it("sends no Authorization header when no token is stored", async () => {
      mockFetch(200, []);
      await getBills();
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
    });

    it("sends Bearer token when token is in sessionStorage", async () => {
      sessionStorage.setItem("squeezypay_token", "tok123");
      mockFetch(200, []);
      await getBills();
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok123");
    });
  });

  // ── handle401 ───────────────────────────────────────────────────────────────

  describe("handle401", () => {
    it("removes token and dispatches unauthorized event on 401", async () => {
      sessionStorage.setItem("squeezypay_token", "tok123");
      mockFetch(401, {});
      await getBills();
      expect(sessionStorage.getItem("squeezypay_token")).toBeNull();
      const unauthorizedCalls = dispatchSpy.mock.calls.filter(
        ([e]: [Event]) => e.type === "squeezypay:unauthorized"
      );
      expect(unauthorizedCalls).toHaveLength(1);
    });

    it("does not dispatch unauthorized event on non-401 errors", async () => {
      mockFetch(500, {});
      await getBills();
      const unauthorizedCalls = dispatchSpy.mock.calls.filter(
        ([e]: [Event]) => e.type === "squeezypay:unauthorized"
      );
expect(unauthorizedCalls).toHaveLength(0);
    });
  });

  // ── mapBill (snake_case → camelCase) ────────────────────────────────────────

  describe("mapBill", () => {
    const rawBill = {
      id: 1,
      name: "Electric",
      category: "Utilities",
      day_of_month: 15,
      expected_amount: 120.5,
      url: "https://example.com",
      recurring: true,
      notes: "auto-pay",
    };

    it("maps snake_case fields to camelCase", async () => {
      mockFetch(200, [rawBill]);
      const bills = await getBills();
      expect(bills[0]).toMatchObject({
        id: 1,
        name: "Electric",
        category: "Utilities",
        dayOfMonth: 15,
        expectedAmount: 120.5,
        url: "https://example.com",
        recurring: true,
        notes: "auto-pay",
      });
    });

    it("formats expectedAmount as currency in amountLabel", async () => {
      mockFetch(200, [rawBill]);
      const bills = await getBills();
      expect(bills[0].amountLabel).toBe("$120.50");
    });

    it("sets amountLabel to 'Amount varies' when expectedAmount is null", async () => {
      mockFetch(200, [{ ...rawBill, expected_amount: null }]);
      const bills = await getBills();
      expect(bills[0].amountLabel).toBe("Amount varies");
    });
  });

  // ── getSettings (snake_case → camelCase) ────────────────────────────────────

  describe("getSettings", () => {
    it("maps due_soon_days and large_payment_threshold to camelCase", async () => {
      mockFetch(200, { due_soon_days: 5, large_payment_threshold: 250 });
      const settings = await getSettings();
      expect(settings).toEqual({ dueSoonDays: 5, largePaymentThreshold: 250 });
    });

    it("returns null on API error", async () => {
      mockFetch(500, {});
      const settings = await getSettings();
      expect(settings).toBeNull();
    });
  });

  // ── updateSettings (camelCase → snake_case request body) ────────────────────

  describe("updateSettings", () => {
    it("sends snake_case body to the API", async () => {
      mockFetch(200, { due_soon_days: 10, large_payment_threshold: 500 });
      await updateSettings({ dueSoonDays: 10, largePaymentThreshold: 500 });
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body).toEqual({ due_soon_days: 10, large_payment_threshold: 500 });
    });

    it("maps response back to camelCase", async () => {
      mockFetch(200, { due_soon_days: 10, large_payment_threshold: 500 });
      const result = await updateSettings({ dueSoonDays: 10, largePaymentThreshold: 500 });
      expect(result).toEqual({ dueSoonDays: 10, largePaymentThreshold: 500 });
    });
  });

  // ── mapIncome (snake_case → camelCase) ──────────────────────────────────────

  describe("createIncome mapping", () => {
    const rawIncome = {
      id: 7,
      source_name: "Paycheck",
      amount: 3000,
      frequency: "bi-weekly",
      next_expected_date: "2026-06-13",
      active: true,
    };

    it("maps snake_case income fields to camelCase", async () => {
      mockFetch(200, rawIncome);
      const income = await createIncome({
        sourceName: "Paycheck",
        amount: 3000,
        frequency: "bi-weekly",
        nextExpectedDate: "2026-06-13",
      });
      expect(income).toMatchObject({
        id: 7,
        sourceName: "Paycheck",
        amount: 3000,
        frequency: "bi-weekly",
        nextExpectedDate: "2026-06-13",
        active: true,
      });
    });

    it("sends snake_case body to the API", async () => {
      mockFetch(200, rawIncome);
      await createIncome({
        sourceName: "Paycheck",
        amount: 3000,
        frequency: "bi-weekly",
        nextExpectedDate: "2026-06-13",
      });
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        source_name: "Paycheck",
        next_expected_date: "2026-06-13",
      });
    });
  });

  // ── logPayment mapping ───────────────────────────────────────────────────────

  describe("logPayment mapping", () => {
    const rawPayment = {
      id: 42,
      bill_id: 1,
      bill_name: "Electric",
      payment_date: "2026-06-03",
      amount_paid: 120.5,
      payment_method: "Visa 1234",
      confirmation_number: "CONF-ABC",
      notes: null,
      created_at: "2026-06-03T10:00:00",
    };

    it("maps snake_case payment fields to camelCase", async () => {
      mockFetch(200, rawPayment);
      const payment = await logPayment({
        billId: 1,
        paymentDate: "2026-06-03",
        amountPaid: 120.5,
        paymentMethod: "Visa 1234",
        confirmationNumber: "CONF-ABC",
      });
      expect(payment).toMatchObject({
        id: 42,
        billId: 1,
        billName: "Electric",
        paymentDate: "2026-06-03",
        amountPaid: 120.5,
        paymentMethod: "Visa 1234",
        confirmationNumber: "CONF-ABC",
        createdAt: "2026-06-03T10:00:00",
      });
    });

    it("sends snake_case body to the API", async () => {
      mockFetch(200, rawPayment);
      await logPayment({
        billId: 1,
        paymentDate: "2026-06-03",
        amountPaid: 120.5,
        confirmationNumber: "CONF-ABC",
      });
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        bill_id: 1,
        payment_date: "2026-06-03",
        amount_paid: 120.5,
        confirmation_number: "CONF-ABC",
      });
    });
  });

  // ── getMonthlyTotal ──────────────────────────────────────────────────────────

  describe("getMonthlyTotal", () => {
    it("extracts monthly_total from response", async () => {
      mockFetch(200, { monthly_total: 6000 });
      const total = await getMonthlyTotal();
      expect(total).toBe(6000);
    });

    it("returns null on API error", async () => {
      mockFetch(500, {});
      const total = await getMonthlyTotal();
      expect(total).toBeNull();
    });
  });

  // ── createCategory ───────────────────────────────────────────────────────────

  describe("createCategory", () => {
    it("returns conflict: true on 409", async () => {
      mockFetch(409, {});
      const result = await createCategory("Utilities");
      expect(result).toEqual({ conflict: true });
    });

    it("returns the created category on success", async () => {
      mockFetch(200, { id: 5, name: "Utilities" });
      const result = await createCategory("Utilities");
      expect(result).toMatchObject({ id: 5, name: "Utilities" });
    });
  });

  // ── updateCategory ───────────────────────────────────────────────────────────

  describe("updateCategory", () => {
    it("returns conflict: true on 409", async () => {
      mockFetch(409, {});
      const result = await updateCategory(5, "Utilities");
      expect(result).toEqual({ conflict: true });
    });

    it("returns notFound: true on 404", async () => {
      mockFetch(404, {});
      const result = await updateCategory(99, "Utilities");
      expect(result).toEqual({ notFound: true });
    });

    it("returns the updated category on success", async () => {
      mockFetch(200, { id: 5, name: "Utilities" });
      const result = await updateCategory(5, "Utilities");
      expect(result).toMatchObject({ id: 5, name: "Utilities" });
    });
  });
});

// ── createBill ────────────────────────────────────────────────────────────────

describe("createBill", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  const rawBill = {
    id: 10,
    name: "Water",
    category: "Utilities",
    day_of_month: 5,
    expected_amount: 55.0,
    url: "https://water.example.com",
    recurring: true,
    notes: null,
  };

  it("sends snake_case body to the API", async () => {
    /**
     * Scenario: createBill is called with a camelCase BillPayload
     * EP class: valid input — body serialisation check
     * Expected: fetch body contains snake_case keys (expected_amount, day_of_month)
     */
    mockFetch(200, rawBill);
    await createBill({
      name: "Water",
      category: "Utilities",
      url: "https://water.example.com",
      expectedAmount: 55.0,
      dayOfMonth: 5,
      recurring: true,
    });
    const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      name: "Water",
      category: "Utilities",
      expected_amount: 55.0,
      day_of_month: 5,
      recurring: true,
    });
  });

  it("returns mapped Bill on success", async () => {
    /**
     * Scenario: API returns a valid RawBill on 200
     * EP class: success path — mapping from snake_case to camelCase
     * Expected: returned Bill has camelCase fields including amountLabel
     */
    mockFetch(200, rawBill);
    const bill = await createBill({
      name: "Water",
      category: "Utilities",
      url: "https://water.example.com",
      expectedAmount: 55.0,
      dayOfMonth: 5,
      recurring: true,
    });
    expect(bill).toMatchObject({
      id: 10,
      name: "Water",
      category: "Utilities",
      dayOfMonth: 5,
      expectedAmount: 55.0,
      url: "https://water.example.com",
      recurring: true,
      notes: null,
    });
    expect(bill?.amountLabel).toBe("$55.00");
  });

  it("returns null on API error", async () => {
    /**
     * Scenario: API returns 500
     * EP class: error path — non-2xx status triggers catch
     * Expected: null returned (no throw)
     */
    mockFetch(500, {});
    const bill = await createBill({
      name: "Water",
      category: "Utilities",
      url: "",
      dayOfMonth: 5,
      recurring: true,
    });
    expect(bill).toBeNull();
  });
});

// ── updateBill ────────────────────────────────────────────────────────────────

describe("updateBill", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  const rawBill = {
    id: 10,
    name: "Water Updated",
    category: "Utilities",
    day_of_month: 7,
    expected_amount: 60.0,
    url: "https://water.example.com",
    recurring: true,
    notes: "new notes",
  };

  it("sends snake_case body with correct method PUT", async () => {
    /**
     * Scenario: updateBill is called with billId and updated payload
     * EP class: valid input — HTTP method and body serialisation check
     * Expected: fetch uses PUT method and body contains snake_case keys
     */
    mockFetch(200, rawBill);
    await updateBill(10, {
      name: "Water Updated",
      category: "Utilities",
      url: "https://water.example.com",
      expectedAmount: 60.0,
      dayOfMonth: 7,
      recurring: true,
      notes: "new notes",
    });
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(url).toContain("/api/bills/10");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      name: "Water Updated",
      day_of_month: 7,
      expected_amount: 60.0,
    });
  });

  it("returns null on API error", async () => {
    /**
     * Scenario: API returns 404 during update
     * EP class: error path — non-2xx triggers catch, null returned
     * Expected: null returned (no throw)
     */
    mockFetch(404, {});
    const result = await updateBill(99, {
      name: "Ghost",
      category: "None",
      url: "",
      dayOfMonth: 1,
      recurring: false,
    });
    expect(result).toBeNull();
  });
});

// ── deleteBill ────────────────────────────────────────────────────────────────

describe("deleteBill", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  it("returns true on 204", async () => {
    /**
     * Scenario: server responds 204 No Content after successful deletion
     * EP class: success path — 204 is ok=true in mock; function returns true
     * Expected: true returned
     */
    mockFetch(204, null);
    const result = await deleteBill(10);
    expect(result).toBe(true);
  });

  it("returns false on API error", async () => {
    /**
     * Scenario: server responds 500 during delete
     * EP class: error path — non-2xx triggers catch, false returned
     * Expected: false returned (no throw)
     */
    mockFetch(500, {});
    const result = await deleteBill(10);
    expect(result).toBe(false);
  });
});

// ── changePassphrase ──────────────────────────────────────────────────────────

describe("changePassphrase", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  it("throws with message 'Current passphrase is incorrect.' on 401", async () => {
    /**
     * Scenario: wrong current passphrase results in 401 from the server
     * EP class: authentication failure — 401 maps to specific error message
     * Expected: Error thrown with message "Current passphrase is incorrect."
     */
    mockFetch(401, {});
    await expect(changePassphrase("wrongpass", "newpass"))
      .rejects.toThrow("Current passphrase is incorrect.");
  });

  it("does not throw on 200", async () => {
    /**
     * Scenario: correct passphrase submitted, server returns 200
     * EP class: success path — no exception, function resolves void
     * Expected: promise resolves without throwing
     */
    mockFetch(200, {});
    await expect(changePassphrase("correctpass", "newpass"))
      .resolves.toBeUndefined();
  });
});

// ── saveCredential ────────────────────────────────────────────────────────────

describe("saveCredential (PUT branch)", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  const credentialResponse = { id: 5, bill_id: 1, username: "user1" };

  it("uses PUT when existingId is provided", async () => {
    /**
     * Scenario: existingId is a non-null number — updating an existing credential
     * EP class: update path — existingId truthy → PUT to /api/credentials/{id}
     * Expected: fetch called with PUT method and URL containing the existingId
     */
    mockFetch(200, credentialResponse);
    await saveCredential(1, "user1", "pass1", 5);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(url).toContain("/api/credentials/5");
  });

  it("uses POST when existingId is null", async () => {
    /**
     * Scenario: existingId is null — creating a new credential
     * EP class: create path — existingId null → POST to /api/credentials/
     * Expected: fetch called with POST method and body contains bill_id
     */
    mockFetch(200, credentialResponse);
    await saveCredential(1, "user1", "pass1", null);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(url).toContain("/api/credentials/");
    const body = JSON.parse(init.body as string);
    expect(body.bill_id).toBe(1);
  });
});

// ── createPlaidLinkToken ──────────────────────────────────────────────────────

describe("createPlaidLinkToken", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  it("returns link_token string on success", async () => {
    /**
     * Scenario: Plaid link token endpoint returns a valid token
     * EP class: success path — response ok, data.link_token extracted and returned
     * Expected: resolved string equals the link_token value from the response body
     */
    mockFetch(200, { link_token: "link-sandbox-abc123" });
    const token = await createPlaidLinkToken();
    expect(token).toBe("link-sandbox-abc123");
  });

  it("throws with error detail from body on non-ok response", async () => {
    /**
     * Scenario: Plaid endpoint returns 400 with a detail field in the JSON body
     * EP class: error path — non-ok status reads body.detail as error message
     * Expected: Error thrown with message matching body.detail
     */
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: "Plaid credentials not configured" }),
    } as unknown as Response);
    await expect(createPlaidLinkToken())
      .rejects.toThrow("Plaid credentials not configured");
  });
});

// ── getPlaidTransactions ──────────────────────────────────────────────────────

describe("getPlaidTransactions", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  it("sends accountId as account_id query param", async () => {
    /**
     * Scenario: params.accountId is provided and must be forwarded as account_id
     * EP class: query parameter serialisation — accountId → account_id in URL
     * Expected: fetch URL contains "account_id=3"
     */
    mockFetch(200, { transactions: [], total: 0 });
    await getPlaidTransactions({ accountId: 3 });
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("account_id=3");
  });

  it("returns empty transactions array on error", async () => {
    /**
     * Scenario: API returns 500 during transaction fetch
     * EP class: error path — exception caught, safe default returned
     * Expected: { transactions: [], total: 0 } returned without throwing
     */
    mockFetch(500, {});
    const result = await getPlaidTransactions({ accountId: 3 });
    expect(result).toEqual({ transactions: [], total: 0 });
  });
});

// ── checkHealth ───────────────────────────────────────────────────────────────

describe("checkHealth", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns true when fetch responds 200", async () => {
    /**
     * Scenario: backend is healthy and returns HTTP 200
     * EP class: valid/success — response.ok is true
     * Expected: checkHealth resolves to true
     */
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as unknown as Response);
    const result = await checkHealth();
    expect(result).toBe(true);
  });

  it("returns false when fetch responds 503", async () => {
    /**
     * Scenario: backend is unavailable and returns HTTP 503
     * EP class: invalid/error — response.ok is false for non-2xx
     * Expected: checkHealth resolves to false
     */
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as unknown as Response);
    const result = await checkHealth();
    expect(result).toBe(false);
  });

  it("returns false when fetch throws a network error", async () => {
    /**
     * Scenario: network is unreachable and fetch rejects with TypeError
     * EP class: invalid/boundary — exception in fetch, no response at all
     * Expected: checkHealth resolves to false (no unhandled rejection)
     */
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await checkHealth();
    expect(result).toBe(false);
  });
});

// ── mapBlameData (via getPlaidBlame) ──────────────────────────────────────────

describe("mapBlameData (via getPlaidBlame)", () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    sessionStorage.clear();
    dispatchSpy = vi.spyOn(window, "dispatchEvent").mockImplementation(() => true);
  });
  afterEach(() => { dispatchSpy.mockRestore(); });

  it("maps snake_case blame response to camelCase", async () => {
    /**
     * Scenario: getPlaidBlame returns a valid RawBlameData object from the server
     * EP class: success path — snake_case mapping for period_start, total_spending
     * Expected: returned BlameData has camelCase fields periodStart and totalSpending
     */
    const rawBlame = {
      period_start: "2026-05-01",
      period_end: "2026-05-31",
      total_spending: 1234.56,
      by_category: [{ category: "Food", amount: 400.0, count: 10, pct: 32.4 }],
      by_account: [{ account_name: "Checking", amount: 1234.56, pct: 100.0 }],
    };
    mockFetch(200, rawBlame);
    const result = await getPlaidBlame(30);
    expect(result).toMatchObject({
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      totalSpending: 1234.56,
    });
    expect(result.byCategory[0].category).toBe("Food");
    // byAccount is passed through as-is from the API (no sub-mapping)
    expect(result.byAccount[0].account_name).toBe("Checking");
  });
});
