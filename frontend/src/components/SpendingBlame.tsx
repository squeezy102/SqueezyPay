import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { getPlaidBlame, getPlaidItems, getPlaidAccounts } from "../utils/api";
import type { BlameData, PlaidItem, PlaidAccount } from "../types";
import StalenessWarning from "./StalenessWarning";

const DAYS_OPTIONS = [7, 30, 90] as const;
type DaysOption = typeof DAYS_OPTIONS[number];

const CHART_COLORS = [
  "#e63946", // red
  "#2a9d8f", // teal
  "#e9c46a", // gold
  "#264653", // dark teal
  "#f4a261", // sandy orange
  "#457b9d", // steel blue
  "#a8dadc", // pale cyan
  "#c77dff", // lavender
  "#6a994e", // olive green
  "#bc6c25", // burnt sienna
  "#48cae4", // sky blue
  "#ff6b6b", // coral
];

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function formatCategoryLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface EmptyStateProps {
  hasAccounts: boolean;
  onGoToAccounts: () => void;
}

function EmptyState({ hasAccounts, onGoToAccounts }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No spending data yet</p>
        {hasAccounts ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Your bank is connected. Go to Accounts and use "Sync Transactions" to pull in your transaction history.
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Connect a bank account or import a CSV/OFX file to see your spending breakdown here.
          </p>
        )}
      </div>
      <button
        onClick={onGoToAccounts}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
      >
        {hasAccounts ? "Go to Accounts" : "Connect a Bank Account"}
      </button>
    </div>
  );
}

interface SpendingBlameProps {
  onNavigate?: (tab: string) => void;
}

export default function SpendingBlame({ onNavigate }: SpendingBlameProps) {
  const [daysBack, setDaysBack] = useState<DaysOption>(30);

  const { data: items = [] } = useQuery<PlaidItem[]>({
    queryKey: ["plaid", "items"],
    queryFn: getPlaidItems,
  });

  const { data: accounts = [] } = useQuery<PlaidAccount[]>({
    queryKey: ["plaid", "accounts"],
    queryFn: getPlaidAccounts,
  });

  const oldestSync = accounts.length === 0
    ? null
    : accounts.map((a) => a.balanceSyncedAt).filter((s): s is string => !!s).sort()[0] ?? null;

  const { data, isLoading, isError } = useQuery<BlameData>({
    queryKey: ["plaid", "blame", { daysBack }],
    queryFn: () => getPlaidBlame(daysBack),
    staleTime: 5 * 60 * 1000,
  });

  const byCategory = data?.byCategory ?? [];
  const byAccount = data?.byAccount ?? [];
  const totalSpending = data?.totalSpending ?? 0;
  const hasAccounts = items.length > 0;

  // Collapse slices < 2% into "Other"
  const THRESHOLD = 2;
  const mainSlices = byCategory.filter((c) => c.pct >= THRESHOLD);
  const otherAmt = byCategory.filter((c) => c.pct < THRESHOLD).reduce((s, c) => s + c.amount, 0);
  const pieData = [
    ...mainSlices.map((c) => ({ name: formatCategoryLabel(c.category), value: c.amount })),
    ...(otherAmt > 0 ? [{ name: "Other", value: otherAmt }] : []),
  ];

  const barData = byAccount.map((a) => ({
    name: a.account_name.length > 22 ? a.account_name.slice(0, 22) + "…" : a.account_name,
    amount: a.amount,
  }));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Spending</h1>
        {/* Period selector — only shown when there's data */}
        {totalSpending > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Period:</span>
            <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              {DAYS_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDaysBack(d)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    daysBack === d
                      ? "bg-violet-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-slate-500 py-8 text-center">Loading…</p>}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          Failed to load spending data. Check that the backend is running.
        </p>
      )}

      {!isLoading && !isError && totalSpending === 0 && (
        <EmptyState hasAccounts={hasAccounts} onGoToAccounts={() => onNavigate?.("accounts")} />
      )}

      {!isLoading && !isError && totalSpending > 0 && (
        <>
          {accounts.length > 0 && <StalenessWarning lastSyncedAt={oldestSync} />}
          {/* Headline */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400 mb-1">
              Total spending — last {daysBack} days
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalSpending)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {data?.periodStart} – {data?.periodEnd}
            </p>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category donut */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">By Category</h3>
              <div role="img" aria-label="Spending by category donut chart">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
                      contentStyle={{
                        borderRadius: "0.75rem",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "0.75rem" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Account bar */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">By Account</h3>
              {barData.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No account data</p>
              ) : (
                <div role="img" aria-label="Spending by account bar chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), "Spending"]}
                        contentStyle={{ borderRadius: "0.75rem", border: "1px solid #e2e8f0", fontSize: "0.75rem" }}
                      />
                      <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                        {barData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Category breakdown table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Category Breakdown</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Txns</th>
                  <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {byCategory.map((row, i) => (
                  <tr key={row.category} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-slate-900 dark:text-white">{formatCategoryLabel(row.category)}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">{formatCurrency(row.amount)}</td>
                    <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">{row.count}</td>
                    <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
