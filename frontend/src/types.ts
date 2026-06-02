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
  active: boolean;
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
  username: string;
  password: string;
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
