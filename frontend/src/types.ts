// Shared domain types for SqueezyPay frontend.

export interface Bill {
  id: number;
  name: string;
  category: string;
  dayOfMonth: number;
  expectedAmount: number | null;
  amountLabel: string;
  url: string;
  recurring: boolean;
  notes: string | null;
}

export interface Payment {
  id: number;
  billId: number;
  billName: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: string | null;
  confirmationNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export type IncomeFrequency = "weekly" | "bi-weekly" | "semi-monthly" | "monthly";

export interface Income {
  id: number;
  sourceName: string;
  amount: number;
  frequency: IncomeFrequency;
  nextExpectedDate: string;
  active: boolean;
}

export interface AppSettings {
  dueSoonDays: number;
  largePaymentThreshold: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface Credential {
  id: number;
  bill_id: number;
  username: string;
  password: string;
  notes?: string | null;
}

export interface PaymentMethod {
  id: number;
  nickname: string;
  last_four: string;
}

export interface AuthStatus {
  configured: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

// API result types for operations that can return conflict/notFound signals
export type CategoryResult = Category | { conflict: true } | null;
export type CategoryUpdateResult = Category | { conflict: true } | { notFound: true } | null;

export type BillStatus = "overdue" | "due-soon" | "upcoming";

// ── Plaid ─────────────────────────────────────────────────────────────────────

export interface PlaidItem {
  id: number;
  itemId: string;
  institutionName: string | null;
  createdAt: string | null;
}

export interface PlaidAccount {
  id: number;
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  balanceSyncedAt: string | null;
  institutionName: string | null;
}

export interface PlaidTransaction {
  id: number;
  transactionId: string;
  plaidAccountId: number;
  amount: number;
  date: string;
  name: string;
  merchantName: string | null;
  plaidCategoryPrimary: string | null;
  plaidCategoryDetailed: string | null;
  categoryId: number | null;
  paymentChannel: string | null;
  pending: boolean;
  logoUrl: string | null;
  isoCurrencyCode: string | null;
  createdAt: string | null;
}

export interface BlameCategory {
  category: string;
  amount: number;
  count: number;
  pct: number;
}

export interface BlameAccount {
  account_name: string;
  amount: number;
  pct: number;
}

export interface BlameData {
  periodStart: string;
  periodEnd: string;
  totalSpending: number;
  byCategory: BlameCategory[];
  byAccount: BlameAccount[];
}
