import type {
  Bill,
  Payment,
  Income,
  IncomeFrequency,
  AppSettings,
  Category,
  Credential,
  PaymentMethod,
  AuthStatus,
  AuthTokenResponse,
  CategoryResult,
  CategoryUpdateResult,
  PlaidItem,
  PlaidAccount,
  PlaidTransaction,
  BlameData,
} from "../types";

export const API_BASE = `http://${window.location.hostname}:8000`;

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("squeezypay_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function handle401(response: Response): Response {
  if (response.status === 401) {
    sessionStorage.removeItem("squeezypay_token");
    window.dispatchEvent(new Event("squeezypay:unauthorized"));
  }
  return response;
}

function logApiError(context: string, error: unknown): void {
  console.error(`[API] ${context}:`, error);
}

// ── Auth API ──────────────────────────────────────────────────────────────────

export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await fetch(`${API_BASE}/api/auth/status`);
  return response.json() as Promise<AuthStatus>;
}

export async function setupAuth(passphrase: string): Promise<AuthTokenResponse> {
  const response = await fetch(`${API_BASE}/api/auth/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase }),
  });
  if (!response.ok) throw new Error(`Setup failed: ${response.status}`);
  return response.json() as Promise<AuthTokenResponse>;
}

export async function loginAuth(passphrase: string): Promise<AuthTokenResponse> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase }),
  });
  if (response.status === 401) throw new Error("Incorrect passphrase");
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  return response.json() as Promise<AuthTokenResponse>;
}

export async function logoutAuth(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
}

export async function changePassphrase(currentPassphrase: string, newPassphrase: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/auth/change-passphrase`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ current_passphrase: currentPassphrase, new_passphrase: newPassphrase }),
  });
  if (response.status === 401) throw new Error("Current passphrase is incorrect.");
  if (!response.ok) throw new Error(`Change passphrase failed: ${response.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────

function formatAmount(amount: number | null): string {
  if (amount == null) return "Amount varies";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

interface RawBill {
  id: number;
  name: string;
  category: string;
  day_of_month: number;
  expected_amount: number | null;
  url: string;
  recurring: boolean;
  notes: string | null;
}

function mapBill(raw: RawBill): Bill {
  return {
    id:             raw.id,
    name:           raw.name,
    category:       raw.category,
    dayOfMonth:     raw.day_of_month,
    expectedAmount: raw.expected_amount,
    amountLabel:    formatAmount(raw.expected_amount),
    url:            raw.url,
    recurring:      raw.recurring,
    notes:          raw.notes,
  };
}

interface RawPayment {
  id: number;
  bill_id: number;
  bill_name: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string | null;
  confirmation_number: string | null;
  notes: string | null;
  created_at: string;
}

function mapPayment(raw: RawPayment): Payment {
  return {
    id:                 raw.id,
    billId:             raw.bill_id,
    billName:           raw.bill_name,
    paymentDate:        raw.payment_date,
    amountPaid:         raw.amount_paid,
    paymentMethod:      raw.payment_method,
    confirmationNumber: raw.confirmation_number,
    notes:              raw.notes,
    createdAt:          raw.created_at,
  };
}

interface RawIncome {
  id: number;
  source_name: string;
  amount: number;
  frequency: IncomeFrequency;
  next_expected_date: string;
  active: boolean;
}

function mapIncome(raw: RawIncome): Income {
  return {
    id:               raw.id,
    sourceName:       raw.source_name,
    amount:           raw.amount,
    frequency:        raw.frequency,
    nextExpectedDate: raw.next_expected_date,
    active:           raw.active,
  };
}

export interface LogPaymentPayload {
  billId: number;
  paymentDate: string;
  amountPaid: number;
  paymentMethod?: string | null;
  confirmationNumber?: string | null;
  notes?: string | null;
}

export interface BillPayload {
  name: string;
  category: string;
  url: string;
  expectedAmount?: number | null;
  dayOfMonth: number;
  recurring: boolean;
  notes?: string | null;
}

export interface IncomePayload {
  sourceName: string;
  amount: number;
  frequency: IncomeFrequency;
  nextExpectedDate: string;
}

// ── Bills ─────────────────────────────────────────────────────────────────────

export async function getBills(): Promise<Bill[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as RawBill[];
    return data.map(mapBill);
  } catch (error) {
    logApiError("Failed to fetch bills", error);
    return [];
  }
}

export async function getAllBills(): Promise<Bill[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as RawBill[];
    return data.map(mapBill);
  } catch (error) {
    logApiError("Failed to fetch all bills", error);
    return [];
  }
}

export async function createBill(payload: BillPayload): Promise<Bill | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        name:            payload.name,
        category:        payload.category,
        url:             payload.url,
        expected_amount: payload.expectedAmount ?? null,
        day_of_month:    payload.dayOfMonth,
        recurring:       payload.recurring,
        notes:           payload.notes ?? null,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json() as RawBill);
  } catch (error) {
    logApiError("Failed to create bill", error);
    return null;
  }
}

export async function updateBill(billId: number, payload: BillPayload): Promise<Bill | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/${billId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        name:            payload.name,
        category:        payload.category,
        url:             payload.url,
        expected_amount: payload.expectedAmount ?? null,
        day_of_month:    payload.dayOfMonth,
        recurring:       payload.recurring,
        notes:           payload.notes ?? null,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapBill(await response.json() as RawBill);
  } catch (error) {
    logApiError("Failed to update bill", error);
    return null;
  }
}

export async function deleteBill(billId: number): Promise<boolean> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/bills/${billId}`, { method: "DELETE", headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return true;
  } catch (error) {
    logApiError("Failed to delete bill", error);
    return false;
  }
}

// ── Payment History ───────────────────────────────────────────────────────────

export async function getPaymentsByBill(billId: number): Promise<Payment[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/payment-history/bill/${billId}`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as RawPayment[];
    return data.map(mapPayment);
  } catch (error) {
    logApiError("Failed to fetch payment history", error);
    return [];
  }
}

export async function getAllPayments(): Promise<Payment[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/payment-history/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as RawPayment[];
    return data.map(mapPayment);
  } catch (error) {
    logApiError("Failed to fetch all payments", error);
    return [];
  }
}

export async function logPayment(payload: LogPaymentPayload): Promise<Payment | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/payment-history/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        bill_id:             payload.billId,
        payment_date:        payload.paymentDate,
        amount_paid:         payload.amountPaid,
        payment_method:      payload.paymentMethod ?? null,
        confirmation_number: payload.confirmationNumber ?? null,
        notes:               payload.notes ?? null,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapPayment(await response.json() as RawPayment);
  } catch (error) {
    logApiError("Failed to log payment", error);
    return null;
  }
}

// ── Credentials & Payment Methods ─────────────────────────────────────────────

export async function getCredentialByBill(billId: number): Promise<Credential | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/credentials/by-bill/${billId}`, { headers: { ...authHeaders() } }));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as Credential;
  } catch (error) {
    logApiError("Failed to fetch credential", error);
    return null;
  }
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/payment-methods/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as PaymentMethod[];
  } catch (error) {
    logApiError("Failed to fetch payment methods", error);
    return [];
  }
}

// ── Income ────────────────────────────────────────────────────────────────────

export async function getIncome(includeInactive = false): Promise<Income[]> {
  try {
    const qs = includeInactive ? "?include_inactive=true" : "";
    const response = handle401(await fetch(`${API_BASE}/api/income/${qs}`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as RawIncome[];
    return data.map(mapIncome);
  } catch (error) {
    logApiError("Failed to fetch income", error);
    return [];
  }
}

export async function createIncome(payload: IncomePayload): Promise<Income | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        source_name:        payload.sourceName,
        amount:             payload.amount,
        frequency:          payload.frequency,
        next_expected_date: payload.nextExpectedDate,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapIncome(await response.json() as RawIncome);
  } catch (error) {
    logApiError("Failed to create income", error);
    return null;
  }
}

export async function updateIncome(id: number, payload: IncomePayload): Promise<Income | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        source_name:        payload.sourceName,
        amount:             payload.amount,
        frequency:          payload.frequency,
        next_expected_date: payload.nextExpectedDate,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapIncome(await response.json() as RawIncome);
  } catch (error) {
    logApiError("Failed to update income", error);
    return null;
  }
}

export async function deactivateIncome(id: number): Promise<void> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/${id}`, { method: "DELETE", headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
  } catch (error) {
    logApiError("Failed to deactivate income", error);
  }
}

export async function reactivateIncome(id: number): Promise<Income | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/${id}/reactivate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return mapIncome(await response.json() as RawIncome);
  } catch (error) {
    logApiError("Failed to reactivate income", error);
    return null;
  }
}

export async function getMonthlyTotal(): Promise<number | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/income/monthly-total`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as { monthly_total: number };
    return data.monthly_total;
  } catch (error) {
    logApiError("Failed to fetch monthly total", error);
    return null;
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/settings/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as { due_soon_days: number; large_payment_threshold: number };
    return {
      dueSoonDays:           data.due_soon_days,
      largePaymentThreshold: data.large_payment_threshold,
    };
  } catch (error) {
    logApiError("Failed to fetch settings", error);
    return null;
  }
}

export async function updateSettings(payload: AppSettings): Promise<AppSettings | null> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/settings/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        due_soon_days:           payload.dueSoonDays,
        large_payment_threshold: payload.largePaymentThreshold,
      }),
    }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as { due_soon_days: number; large_payment_threshold: number };
    return {
      dueSoonDays:           data.due_soon_days,
      largePaymentThreshold: data.large_payment_threshold,
    };
  } catch (error) {
    logApiError("Failed to update settings", error);
    return null;
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/categories/`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json() as Category[];
  } catch (error) {
    logApiError("Failed to fetch categories", error);
    return [];
  }
}

export async function createCategory(name: string): Promise<CategoryResult> {
  const response = handle401(await fetch(`${API_BASE}/api/categories/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  }));
  if (response.status === 409) return { conflict: true };
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json() as Category;
}

export async function updateCategory(id: number, name: string): Promise<CategoryUpdateResult> {
  const response = handle401(await fetch(`${API_BASE}/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  }));
  if (response.status === 409) return { conflict: true };
  if (response.status === 404) return { notFound: true };
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json() as Category;
}

// ── Plaid ─────────────────────────────────────────────────────────────────────

interface RawPlaidItem {
  id: number;
  item_id: string;
  institution_name: string | null;
  created_at: string | null;
}

interface RawPlaidAccount {
  id: number;
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  available_balance: number | null;
  balance_synced_at: string | null;
  institution_name: string | null;
}

interface RawPlaidTransaction {
  id: number;
  transaction_id: string;
  plaid_account_id: number;
  amount: number;
  date: string;
  name: string;
  merchant_name: string | null;
  plaid_category_primary: string | null;
  plaid_category_detailed: string | null;
  category_id: number | null;
  payment_channel: string | null;
  pending: boolean;
  logo_url: string | null;
  iso_currency_code: string | null;
  created_at: string | null;
}

interface RawBlameData {
  period_start: string;
  period_end: string;
  total_spending: number;
  by_category: Array<{ category: string; amount: number; count: number; pct: number }>;
  by_account: Array<{ account_name: string; amount: number; pct: number }>;
}

function mapPlaidItem(raw: RawPlaidItem): PlaidItem {
  return {
    id:              raw.id,
    itemId:          raw.item_id,
    institutionName: raw.institution_name,
    createdAt:       raw.created_at,
  };
}

function mapPlaidAccount(raw: RawPlaidAccount): PlaidAccount {
  return {
    id:               raw.id,
    accountId:        raw.account_id,
    name:             raw.name,
    officialName:     raw.official_name,
    type:             raw.type,
    subtype:          raw.subtype,
    mask:             raw.mask,
    currentBalance:   raw.current_balance,
    availableBalance: raw.available_balance,
    balanceSyncedAt:  raw.balance_synced_at,
    institutionName:  raw.institution_name,
  };
}

function mapPlaidTransaction(raw: RawPlaidTransaction): PlaidTransaction {
  return {
    id:                   raw.id,
    transactionId:        raw.transaction_id,
    plaidAccountId:       raw.plaid_account_id,
    amount:               raw.amount,
    date:                 raw.date,
    name:                 raw.name,
    merchantName:         raw.merchant_name,
    plaidCategoryPrimary: raw.plaid_category_primary,
    plaidCategoryDetailed: raw.plaid_category_detailed,
    categoryId:           raw.category_id,
    paymentChannel:       raw.payment_channel,
    pending:              raw.pending,
    logoUrl:              raw.logo_url,
    isoCurrencyCode:      raw.iso_currency_code,
    createdAt:            raw.created_at,
  };
}

function mapBlameData(raw: RawBlameData): BlameData {
  return {
    periodStart:   raw.period_start,
    periodEnd:     raw.period_end,
    totalSpending: raw.total_spending,
    byCategory:    raw.by_category,
    byAccount:     raw.by_account,
  };
}

export async function createPlaidLinkToken(): Promise<string> {
  const response = handle401(await fetch(`${API_BASE}/api/plaid/link-token`, {
    method: "POST",
    headers: { ...authHeaders() },
  }));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json() as { link_token: string };
  return data.link_token;
}

export async function exchangePlaidPublicToken(publicToken: string): Promise<PlaidItem> {
  const response = handle401(await fetch(`${API_BASE}/api/plaid/exchange-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ public_token: publicToken }),
  }));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return mapPlaidItem(await response.json() as RawPlaidItem);
}

export async function getPlaidItems(): Promise<PlaidItem[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/plaid/items`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return (await response.json() as RawPlaidItem[]).map(mapPlaidItem);
  } catch (error) {
    logApiError("Failed to fetch Plaid items", error);
    return [];
  }
}

export async function disconnectPlaidItem(itemId: number): Promise<boolean> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/plaid/items/${itemId}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    }));
    return response.ok || response.status === 204;
  } catch (error) {
    logApiError("Failed to disconnect Plaid item", error);
    return false;
  }
}

export async function getPlaidAccounts(): Promise<PlaidAccount[]> {
  try {
    const response = handle401(await fetch(`${API_BASE}/api/plaid/accounts`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return (await response.json() as RawPlaidAccount[]).map(mapPlaidAccount);
  } catch (error) {
    logApiError("Failed to fetch Plaid accounts", error);
    return [];
  }
}

export async function syncPlaidBalances(plaidItemId: number): Promise<PlaidAccount[]> {
  const response = handle401(await fetch(`${API_BASE}/api/plaid/accounts/sync-balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ plaid_item_id: plaidItemId }),
  }));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return (await response.json() as RawPlaidAccount[]).map(mapPlaidAccount);
}

export interface PlaidTransactionParams {
  accountId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function getPlaidTransactions(params: PlaidTransactionParams = {}): Promise<{ transactions: PlaidTransaction[]; total: number }> {
  try {
    const qs = new URLSearchParams();
    if (params.accountId != null) qs.set("account_id", String(params.accountId));
    if (params.startDate)         qs.set("start_date", params.startDate);
    if (params.endDate)           qs.set("end_date", params.endDate);
    if (params.limit != null)     qs.set("limit", String(params.limit));
    if (params.offset != null)    qs.set("offset", String(params.offset));
    const response = handle401(await fetch(`${API_BASE}/api/plaid/transactions?${qs}`, { headers: { ...authHeaders() } }));
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json() as { transactions: RawPlaidTransaction[]; total: number };
    return {
      transactions: data.transactions.map(mapPlaidTransaction),
      total:        data.total,
    };
  } catch (error) {
    logApiError("Failed to fetch Plaid transactions", error);
    return { transactions: [], total: 0 };
  }
}

export async function syncPlaidTransactions(plaidItemId: number, daysBack = 30): Promise<{ added: number; updated: number }> {
  const response = handle401(await fetch(`${API_BASE}/api/plaid/transactions/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ plaid_item_id: plaidItemId, days_back: daysBack }),
  }));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json() as { added: number; updated: number };
}

export async function assignPlaidTransactionCategory(txId: number, categoryId: number): Promise<PlaidTransaction> {
  const response = handle401(await fetch(`${API_BASE}/api/plaid/transactions/${txId}/category`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ category_id: categoryId }),
  }));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return mapPlaidTransaction(await response.json() as RawPlaidTransaction);
}

export async function getPlaidBlame(daysBack = 30): Promise<BlameData> {
  const response = handle401(await fetch(`${API_BASE}/api/plaid/blame?days_back=${daysBack}`, { headers: { ...authHeaders() } }));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return mapBlameData(await response.json() as RawBlameData);
}
