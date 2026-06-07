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
