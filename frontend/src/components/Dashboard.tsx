import { useQuery } from "@tanstack/react-query";
import {
  getBills, getSettings, getPlaidAccounts, getPlaidTransactions,
  getIncome, getPlaidBlame,
} from "../utils/api";
import { sortBillsByDueDate, getBillStatus, filterActionableBills } from "../utils/billUtils";
import type { Bill, AppSettings, PlaidAccount, PlaidTransaction, Income } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number | null | undefined, opts?: { abs?: boolean }): string {
  if (amount == null) return "—";
  const v = opts?.abs ? Math.abs(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function fmtExact(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOf30Days(): string {
  return daysAgo(30);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${className}`}>
      {children}
    </div>
  );
}

// ── Account Balances ──────────────────────────────────────────────────────────

function accountTypeOrder(type: string): number {
  switch (type.toLowerCase()) {
    case "depository": return 0;
    case "credit":     return 1;
    case "loan":       return 2;
    default:           return 3;
  }
}

function AccountBalances({ accounts, pendingTxs }: { accounts: PlaidAccount[]; pendingTxs: PlaidTransaction[] }) {
  if (accounts.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
          No accounts connected. Go to Accounts to link a bank.
        </p>
      </Card>
    );
  }

  const sorted = [...accounts].sort((a, b) => accountTypeOrder(a.type) - accountTypeOrder(b.type));

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((acct) => {
        const pending = pendingTxs.filter((tx) => tx.plaidAccountId === acct.id);
        const pendingDelta = pending.reduce((s, tx) => s + tx.amount, 0);
        const calculatedBalance =
          acct.currentBalance != null ? acct.currentBalance - pendingDelta : null;

        const isCredit = acct.type.toLowerCase() === "credit";

        return (
          <Card key={acct.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {acct.name}
                  {acct.mask && <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-normal">···{acct.mask}</span>}
                </p>
                {acct.institutionName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{acct.institutionName}</p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 capitalize mt-0.5">
                  {acct.subtype ?? acct.type}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Posted</p>
                <p className={`text-base font-bold ${isCredit ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                  {fmtExact(acct.currentBalance)}
                </p>
                {pending.length > 0 && (
                  <div className="mt-1.5">
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">
                      Calculated ({pending.length} pending)
                    </p>
                    <p className={`text-sm font-semibold ${isCredit ? "text-red-500 dark:text-red-400" : "text-teal-600 dark:text-teal-400"}`}>
                      {fmtExact(calculatedBalance)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Spend Snapshot ────────────────────────────────────────────────────────────

function SpendSnapshot({ last24Spend, monthlySpend }: { last24Spend: number; monthlySpend: number }) {
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const thirtyDaysAgoLabel = new Date(daysAgo(30) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Last 24 Hours</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{todayLabel}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(last24Spend)}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">Last 30 Days</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{thirtyDaysAgoLabel} – {todayLabel}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(monthlySpend)}</p>
      </Card>
    </div>
  );
}

// ── Bills: Overdue + Upcoming ─────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === "overdue")  return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
  if (status === "due-soon") return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
  return "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
}

function BillRow({ bill, dueSoonDays }: { bill: Bill; dueSoonDays: number }) {
  const status = getBillStatus(bill.dayOfMonth, dueSoonDays);
  const label = status === "overdue" ? "Overdue" : status === "due-soon" ? "Due soon" : `Day ${bill.dayOfMonth}`;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{bill.name}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{bill.category}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(status)}`}>
          {label}
        </span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {bill.amountLabel}
        </span>
      </div>
    </div>
  );
}

function BillsSection({ bills, settings }: { bills: Bill[]; settings: AppSettings }) {
  const sorted     = sortBillsByDueDate(bills);
  const actionable = filterActionableBills(sorted, settings.dueSoonDays);
  const overdue    = actionable.filter((b) => getBillStatus(b.dayOfMonth, settings.dueSoonDays) === "overdue");
  const upcoming   = actionable.filter((b) => getBillStatus(b.dayOfMonth, settings.dueSoonDays) !== "overdue").slice(0, 5);

  if (overdue.length === 0 && upcoming.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">No overdue or upcoming bills.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {overdue.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
            {overdue.length === 1 ? "1 bill overdue" : `${overdue.length} bills overdue`}
          </p>
          {overdue.map((b) => <BillRow key={b.id} bill={b} dueSoonDays={settings.dueSoonDays} />)}
        </Card>
      )}
      {upcoming.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">Upcoming</p>
          {upcoming.map((b) => <BillRow key={b.id} bill={b} dueSoonDays={settings.dueSoonDays} />)}
        </Card>
      )}
    </div>
  );
}

// ── Income ────────────────────────────────────────────────────────────────────

function IncomeSection({
  incomeStreams,
  recentIncomeTxs,
}: {
  incomeStreams: Income[];
  recentIncomeTxs: PlaidTransaction[];
}) {
  const hasStreams = incomeStreams.length > 0;
  const hasTxs    = recentIncomeTxs.length > 0;

  if (!hasStreams && !hasTxs) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
          No income configured. Add income sources in the Income tab.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Configured income streams with next expected date */}
      {hasStreams && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-2">Expected</p>
          {incomeStreams.slice(0, 4).map((src) => (
            <div key={src.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{src.sourceName}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Next: {fmtDate(src.nextExpectedDate)}
                </p>
              </div>
              <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 shrink-0">
                +{fmtExact(src.amount)}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Recent Plaid income transactions (credits = negative amount in Plaid) */}
      {hasTxs && (
        <Card className="p-4">
          <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-2">Recent deposits</p>
          {recentIncomeTxs.slice(0, 5).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {tx.merchantName ?? tx.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(tx.date)}</span>
                  {tx.pending && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 shrink-0">
                +{fmtExact(Math.abs(tx.amount))}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── AI Callouts placeholder ───────────────────────────────────────────────────

function AICallouts() {
  return (
    <Card className="p-5 border-dashed opacity-60">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">AI Insights</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Coming soon — connect your own API key for personalized financial callouts.</p>
        </div>
      </div>
    </Card>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: accounts = [] } = useQuery<PlaidAccount[]>({
    queryKey: ["plaid", "accounts"],
    queryFn: getPlaidAccounts,
  });

  const { data: pendingData } = useQuery({
    queryKey: ["plaid", "transactions", "pending"],
    queryFn: () => getPlaidTransactions({ limit: 200 }),
    select: (d) => d.transactions.filter((tx) => tx.pending),
  });
  const pendingTxs: PlaidTransaction[] = pendingData ?? [];

  const { data: last24Data } = useQuery({
    queryKey: ["plaid", "transactions", "last-24h"],
    queryFn: () => getPlaidTransactions({ startDate: daysAgo(1), endDate: today(), limit: 200 }),
  });
  const last24Spend = (last24Data?.transactions ?? [])
    .filter((tx) => tx.amount > 0)
    .reduce((s, tx) => s + tx.amount, 0);

  const { data: blameData } = useQuery({
    queryKey: ["plaid", "blame", { daysBack: 30 }],
    queryFn: () => getPlaidBlame(30),
    staleTime: 5 * 60 * 1000,
  });
  const monthlySpend = blameData?.totalSpending ?? 0;

  // Income transactions from Plaid (credits = negative amount in Plaid's sign convention)
  const { data: recentTxData } = useQuery({
    queryKey: ["plaid", "transactions", "recent-income"],
    queryFn: () => getPlaidTransactions({ startDate: startOf30Days(), endDate: today(), limit: 200 }),
    select: (d) => d.transactions
      .filter((tx) => tx.amount < 0)
      .sort((a, b) => b.date.localeCompare(a.date)),
  });
  const recentIncomeTxs: PlaidTransaction[] = recentTxData ?? [];

  const { data: incomeStreams = [] } = useQuery<Income[]>({
    queryKey: ["income"],
    queryFn: () => getIncome(false),
  });

  const { data: bills = [] } = useQuery<Bill[]>({
    queryKey: ["bills"],
    queryFn: getBills,
  });

  const { data: settings } = useQuery<AppSettings | null>({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const thresholds: AppSettings = settings ?? { dueSoonDays: 7, largePaymentThreshold: 500 };

  const hasPlaid = accounts.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>

      {/* Spend snapshot — only if we have Plaid data */}
      {hasPlaid && (
        <section>
          <SectionHeading>Spending</SectionHeading>
          <SpendSnapshot last24Spend={last24Spend} monthlySpend={monthlySpend} />
        </section>
      )}

      {/* Main grid: two columns on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left column */}
        <div className="flex flex-col gap-6">
          {hasPlaid && (
            <section>
              <SectionHeading>Account Balances</SectionHeading>
              <AccountBalances accounts={accounts} pendingTxs={pendingTxs} />
            </section>
          )}

          <section>
            <SectionHeading>Bills</SectionHeading>
            {bills.length === 0 ? (
              <Card className="p-5">
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
                  No bills added yet. Go to Bills to get started.
                </p>
              </Card>
            ) : (
              <BillsSection bills={bills} settings={thresholds} />
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <section>
            <SectionHeading>Income</SectionHeading>
            <IncomeSection incomeStreams={incomeStreams} recentIncomeTxs={recentIncomeTxs} />
          </section>

          <section>
            <SectionHeading>Insights</SectionHeading>
            <AICallouts />
          </section>
        </div>

      </div>
    </div>
  );
}
