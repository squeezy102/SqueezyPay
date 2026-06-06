import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useRef, useEffect } from "react";
import {
  getAllBills,
  getAllPayments,
  createBill,
  updateBill,
  deleteBill,
  getCredentialByBill,
  saveCredential,
  deleteCredential,
} from "../utils/api";
import type { Bill, Payment } from "../types";
import type { BillPayload } from "../utils/api";
import {
  getBillStatus,
  getDaysUntilDue,
  formatDueDate,
  sortBillsByDueDate,
} from "../utils/billUtils";
import { categoryTokens, defaultCategoryToken, statusTokens } from "../theme/tokens";
import BillCard from "./BillCard";
import BillFormModal from "./BillFormModal";
import Spinner from "./Spinner";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubView = "overview" | "pay" | "history" | "manage";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

// ── Sub-nav pill bar ──────────────────────────────────────────────────────────

const SUB_VIEWS: { id: SubView; label: string }[] = [
  { id: "overview", label: "Overview"       },
  { id: "pay",      label: "Pay Bills"      },
  { id: "history",  label: "Payment History"},
  { id: "manage",   label: "Manage Billers" },
];

function SubNav({
  active,
  onChange,
}: {
  active: SubView;
  onChange: (v: SubView) => void;
}) {
  return (
    <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit flex-wrap">
      {SUB_VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => onChange(v.id)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            active === v.id
              ? "bg-violet-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

// ── Overview sub-view ─────────────────────────────────────────────────────────

function OverviewSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{title}</h2>
      {children}
    </div>
  );
}

function OverviewBillRow({ bill }: { bill: Bill }) {
  const status    = getBillStatus(bill.dayOfMonth);
  const daysUntil = getDaysUntilDue(bill.dayOfMonth);
  const dueDate   = formatDueDate(bill.dayOfMonth);
  const tokens    = statusTokens[status];

  const daysLabel =
    status === "overdue"
      ? "Overdue"
      : daysUntil === 0
      ? "Due today"
      : `Due in ${daysUntil}d`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{bill.name}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{dueDate}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{bill.amountLabel}</span>
        {tokens.badge && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tokens.badge}`}>
            {daysLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function RecentPaymentRow({ payment }: { payment: Payment }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{payment.billName}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(payment.paymentDate)}</span>
      </div>
      <span className="text-sm font-semibold text-teal-700 dark:text-teal-400 shrink-0">
        {formatAmount(payment.amountPaid)}
      </span>
    </div>
  );
}

function BillsOverview({ onStartSession }: { onStartSession: () => void }) {
  const billsQuery    = useQuery({ queryKey: ["bills", "all"], queryFn: getAllBills });
  const paymentsQuery = useQuery({ queryKey: ["payments"],    queryFn: getAllPayments });

  if (billsQuery.isLoading || paymentsQuery.isLoading) return <Spinner />;

  const bills    = billsQuery.data    ?? [];
  const payments = paymentsQuery.data ?? [];

  const overdue   = bills.filter((b) => getBillStatus(b.dayOfMonth) === "overdue");
  const dueSoon   = bills.filter((b) => getBillStatus(b.dayOfMonth) === "due-soon");
  const upcoming  = bills.filter((b) => getBillStatus(b.dayOfMonth) === "upcoming");

  // 5 most recent payments, newest first
  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    .slice(0, 5);

  const actionableBills = sortBillsByDueDate([...overdue, ...dueSoon]);
  const hasActionable   = actionableBills.length > 0;

  return (
    <div className="flex flex-col gap-8 max-w-3xl">

      {/* ── Primary CTA ────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
        hasActionable
          ? "bg-violet-600 dark:bg-violet-700"
          : "bg-teal-600 dark:bg-teal-700"
      }`}>
        <div>
          <p className="text-white font-bold text-lg leading-snug">
            {hasActionable
              ? `${actionableBills.length} bill${actionableBills.length !== 1 ? "s" : ""} need${actionableBills.length === 1 ? "s" : ""} attention`
              : "You're all caught up"}
          </p>
          <p className="text-white/75 text-sm mt-0.5">
            {hasActionable
              ? `${overdue.length} overdue · ${dueSoon.length} due soon`
              : "No overdue or due-soon bills right now"}
          </p>
        </div>
        <button
          onClick={onStartSession}
          className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-violet-700 font-bold text-sm hover:bg-violet-50 transition-colors shadow-sm whitespace-nowrap"
        >
          Start Bill Pay Session
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── Overdue ────────────────────────────────────────────────────────── */}
      {overdue.length > 0 && (
        <OverviewSection title="Overdue" accent="text-red-600 dark:text-red-400">
          {overdue.map((b) => <OverviewBillRow key={b.id} bill={b} />)}
        </OverviewSection>
      )}

      {/* ── Due soon ───────────────────────────────────────────────────────── */}
      {dueSoon.length > 0 && (
        <OverviewSection title="Due Soon" accent="text-amber-600 dark:text-amber-400">
          {dueSoon.map((b) => <OverviewBillRow key={b.id} bill={b} />)}
        </OverviewSection>
      )}

      {/* ── Upcoming ───────────────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <OverviewSection title="Upcoming" accent="text-slate-500 dark:text-slate-400">
          {sortBillsByDueDate(upcoming).map((b) => <OverviewBillRow key={b.id} bill={b} />)}
        </OverviewSection>
      )}

      {/* ── Recently paid ──────────────────────────────────────────────────── */}
      {recentPayments.length > 0 && (
        <OverviewSection title="Recently Paid" accent="text-teal-600 dark:text-teal-400">
          {recentPayments.map((p) => <RecentPaymentRow key={p.id} payment={p} />)}
        </OverviewSection>
      )}

      {bills.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-12">
          No bills configured yet. Go to <strong>Manage Billers</strong> to add your first biller.
        </p>
      )}
    </div>
  );
}

// ── Pay Bills sub-view ────────────────────────────────────────────────────────

function PayBills() {
  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["bills", "all"],
    queryFn:  getAllBills,
  });

  if (isLoading) return <Spinner />;

  const sorted = sortBillsByDueDate(bills.filter((b) => b.recurring !== false || getBillStatus(b.dayOfMonth) !== "upcoming"));

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-16">
        No bills configured. Add billers in <strong>Manage Billers</strong> to get started.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl">
      {sorted.map((bill) => (
        <BillCard key={bill.id} bill={bill} />
      ))}
    </div>
  );
}

// ── Payment History sub-view ──────────────────────────────────────────────────

type SortKey = keyof Payment;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "paymentDate",        label: "Date"           },
  { key: "billName",           label: "Biller"         },
  { key: "amountPaid",         label: "Amount"         },
  { key: "paymentMethod",      label: "Method"         },
  { key: "confirmationNumber", label: "Confirmation #" },
  { key: "notes",              label: "Notes"          },
];

function SortIcon({ direction }: { direction: SortDir | null }) {
  if (!direction) return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z" />
    </svg>
  );
  return direction === "asc" ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-violet-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-violet-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function cellValue(p: Payment, key: SortKey): React.ReactNode {
  switch (key) {
    case "paymentDate": return formatDate(p.paymentDate);
    case "amountPaid":  return formatAmount(p.amountPaid);
    default: {
      const val = p[key];
      return val != null && val !== "" ? String(val) : <span className="text-slate-300 dark:text-slate-600">-</span>;
    }
  }
}

function PaymentHistoryCard({ payment }: { payment: Payment }) {
  return (
    <div className="rounded-xl border border-violet-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">{payment.billName}</span>
        <span className="font-semibold text-teal-700 dark:text-teal-400 text-sm whitespace-nowrap">{formatAmount(payment.amountPaid)}</span>
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(payment.paymentDate)}</span>
      {(payment.paymentMethod || payment.confirmationNumber || payment.notes) && (
        <div className="border-t border-violet-50 dark:border-slate-700 pt-2 flex flex-col gap-1">
          {payment.paymentMethod && (
            <div className="flex gap-2 text-xs">
              <span className="text-slate-400 dark:text-slate-500 w-20 shrink-0">Method</span>
              <span className="text-slate-700 dark:text-slate-300">{payment.paymentMethod}</span>
            </div>
          )}
          {payment.confirmationNumber && (
            <div className="flex gap-2 text-xs">
              <span className="text-slate-400 dark:text-slate-500 w-20 shrink-0">Confirm #</span>
              <span className="text-slate-700 dark:text-slate-300 font-mono">{payment.confirmationNumber}</span>
            </div>
          )}
          {payment.notes && (
            <div className="flex gap-2 text-xs">
              <span className="text-slate-400 dark:text-slate-500 w-20 shrink-0">Notes</span>
              <span className="text-slate-700 dark:text-slate-300">{payment.notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BillPaymentHistory() {
  const query = useQuery({ queryKey: ["payments"], queryFn: getAllPayments });
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("paymentDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  if (query.isLoading) return <Spinner />;
  if (query.isError) return (
    <p className="text-sm text-red-600 dark:text-red-400">Failed to load payment history.</p>
  );

  const payments = query.data ?? [];

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.billName?.toLowerCase().includes(q) ||
      p.confirmationNumber?.toLowerCase().includes(q) ||
      p.paymentMethod?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "amountPaid") return sortDir === "asc" ? a.amountPaid - b.amountPaid : b.amountPaid - a.amountPaid;
    if (sortKey === "paymentDate") {
      const ad = new Date(a.paymentDate).getTime();
      const bd = new Date(b.paymentDate).getTime();
      return sortDir === "asc" ? ad - bd : bd - ad;
    }
    const av = String(a[sortKey] ?? "");
    const bv = String(b[sortKey] ?? "");
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 sm:flex-none sm:w-80">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-violet-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
          {sorted.length} {sorted.length === 1 ? "record" : "records"}
        </span>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-3 md:hidden">
        {sorted.length === 0
          ? <p className="text-center text-sm text-slate-400 py-12">{search ? "No payments match your search." : "No payments logged yet."}</p>
          : sorted.map((p) => <PaymentHistoryCard key={p.id} payment={p} />)
        }
      </div>

      {/* Desktop */}
      <div className="hidden md:block rounded-xl border border-violet-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
        {sorted.length === 0
          ? <p className="text-center text-sm text-slate-400 py-16">{search ? "No payments match your search." : "No payments logged yet."}</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-violet-100 dark:border-slate-700 bg-violet-50 dark:bg-slate-900/50">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          {col.label}
                          <SortIcon direction={sortKey === col.key ? sortDir : null} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-50 dark:divide-slate-700">
                  {sorted.map((p) => (
                    <tr key={p.id} className="hover:bg-violet-50/60 dark:hover:bg-slate-700/40 transition-colors">
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {col.key === "confirmationNumber"
                            ? <span className="font-mono">{cellValue(p, col.key)}</span>
                            : cellValue(p, col.key)
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  );
}

// ── Credential modal ─────────────────────────────────────────────────────────

function CredentialModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const queryClient                     = useQueryClient();
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const credQuery = useQuery({
    queryKey: ["credentials", "bill", bill.id],
    queryFn:  () => getCredentialByBill(bill.id),
  });

  // Pre-fill once loaded
  useEffect(() => {
    if (credQuery.data) {
      setUsername(credQuery.data.username ?? "");
      setPassword(credQuery.data.password ?? "");
    }
  }, [credQuery.data]);

  const existingId = credQuery.data?.id ?? null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError("Username and password are required."); return; }
    setSaving(true);
    setError(null);
    const result = await saveCredential(bill.id, username.trim(), password, existingId);
    setSaving(false);
    if (!result) { setError("Save failed — check backend logs."); return; }
    queryClient.invalidateQueries({ queryKey: ["credentials", "bill", bill.id] });
    onClose();
  }

  async function handleDelete() {
    if (!existingId) return;
    setSaving(true);
    await deleteCredential(existingId);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["credentials", "bill", bill.id] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Credentials</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{bill.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {credQuery.isLoading ? (
          <div className="px-5 py-8 flex justify-center"><Spinner /></div>
        ) : (
          <form onSubmit={handleSave} className="px-5 py-4 flex flex-col gap-4">
            {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Username / Email</label>
              <input
                autoFocus
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {existingId ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:underline disabled:opacity-50"
                >
                  Remove credentials
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Manage Billers sub-view ───────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const cls = categoryTokens[category] ?? defaultCategoryToken;
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {category}
    </span>
  );
}

function NotesPopover({ notes, billName, onEdit }: {
  notes: string | null;
  billName: string;
  onEdit: (note: string | null) => Promise<void>;
}) {
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const btnRef                = useRef<HTMLButtonElement>(null);
  const popoverRef            = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
      setEditing(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 4, left: r.right + window.scrollX });
    setEditing(false);
    setOpen((v) => !v);
  }

  async function handleSave() {
    setSaving(true);
    await onEdit(draft.trim() || null);
    setSaving(false);
    setEditing(false);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title={notes ? "View note" : "No note"}
        className={`p-1.5 rounded-lg transition-colors ${
          notes
            ? "text-violet-500 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:text-violet-300 dark:hover:bg-violet-900/30"
            : "text-slate-300 hover:text-slate-400 hover:bg-slate-50 dark:text-slate-600 dark:hover:text-slate-500 dark:hover:bg-slate-700/50"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "absolute", top: pos.top, left: pos.left, transform: "translateX(-100%)", zIndex: 9999 }}
          className="w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg p-3"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Note — {billName}
          </p>
          {editing ? (
            <>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setEditing(false)} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          ) : (
            notes
              ? <p onClick={() => { setDraft(notes); setEditing(true); }} title="Click to edit" className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words cursor-text hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded px-1 -mx-1">{notes}</p>
              : <p onClick={() => { setDraft(""); setEditing(true); }} title="Click to add a note" className="text-sm text-slate-400 dark:text-slate-500 italic cursor-text hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded px-1 -mx-1">No note. Click to add one.</p>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function ManageBillers() {
  const queryClient = useQueryClient();
  const [modalBill, setModalBill]           = useState<Bill | null | undefined>(undefined);
  const [credBill, setCredBill]             = useState<Bill | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  const billsQuery = useQuery({
    queryKey: ["bills", "all"],
    queryFn: async () => {
      const data = await getAllBills();
      data.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: BillPayload) =>
      modalBill ? updateBill(modalBill.id, payload) : createBill(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBill(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bills"] }); setConfirmDeleteId(null); },
  });

  async function handleSave(payload: BillPayload) {
    setError(null);
    const result = await saveMutation.mutateAsync(payload);
    if (!result) { setError("Save failed — check backend logs."); return; }
    setModalBill(undefined);
  }

  async function handleNoteSave(bill: Bill, note: string | null) {
    const payload: BillPayload = {
      name: bill.name, category: bill.category, url: bill.url,
      expectedAmount: bill.expectedAmount, dayOfMonth: bill.dayOfMonth,
      recurring: bill.recurring, notes: note,
    };
    const result = await updateBill(bill.id, payload);
    if (!result) { setError("Save failed — check backend logs."); return; }
    queryClient.invalidateQueries({ queryKey: ["bills"] });
  }

  if (billsQuery.isLoading) return <Spinner />;

  const bills       = billsQuery.data ?? [];
  const confirmBill = bills.find((b) => b.id === confirmDeleteId);

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{bills.length} biller{bills.length !== 1 ? "s" : ""} configured</p>
        <button
          onClick={() => setModalBill(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Biller
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">{error}</div>
      )}

      {/* Delete confirm */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Delete biller?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
              <span className="font-medium text-slate-800 dark:text-slate-200">{confirmBill?.name}</span> and all its payment history will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={() => confirmDeleteId !== null && deleteMutation.mutate(confirmDeleteId)} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60">
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bills.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">No billers yet. Add one to get started.</div>
      ) : (
        <>
          {/* Mobile */}
          <div className="flex flex-col gap-3 md:hidden">
            {bills.map((bill) => (
              <div key={bill.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{bill.name}</span>
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={bill.category} />
                      {!bill.recurring && <span className="text-xs text-slate-400 dark:text-slate-500">One-time</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <NotesPopover notes={bill.notes ?? null} billName={bill.name} onEdit={(note) => handleNoteSave(bill, note)} />
                    <button onClick={() => setCredBill(bill)} aria-label={`Credentials for ${bill.name}`} title="Set credentials" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                    </button>
                    <button onClick={() => setModalBill(bill)} aria-label={`Edit ${bill.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button onClick={() => setConfirmDeleteId(bill.id)} aria-label={`Delete ${bill.name}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>Due day {bill.dayOfMonth}</span>
                  {bill.amountLabel && <span>{bill.amountLabel}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Biller</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Recurring</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-violet-50/60 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{bill.name}</td>
                    <td className="px-4 py-3"><CategoryBadge category={bill.category} /></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Day {bill.dayOfMonth}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{bill.amountLabel}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500 dark:text-slate-400">{bill.recurring ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <NotesPopover notes={bill.notes ?? null} billName={bill.name} onEdit={(note) => handleNoteSave(bill, note)} />
                        <button onClick={() => setCredBill(bill)} aria-label={`Credentials for ${bill.name}`} title="Set credentials" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/30 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                        </button>
                        <button onClick={() => setModalBill(bill)} aria-label={`Edit ${bill.name}`} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button onClick={() => setConfirmDeleteId(bill.id)} aria-label={`Delete ${bill.name}`} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {credBill && (
        <CredentialModal bill={credBill} onClose={() => setCredBill(null)} />
      )}

      {modalBill !== undefined && (
        <BillFormModal
          bill={modalBill}
          onSave={handleSave}
          onClose={() => { setModalBill(undefined); setError(null); }}
        />
      )}
    </div>
  );
}

// ── Root Bills component ──────────────────────────────────────────────────────

export default function Bills({ initialView = "overview" }: { initialView?: SubView }) {
  const [view, setView] = useState<SubView>(initialView);

  const titles: Record<SubView, string> = {
    overview: "Bills",
    pay:      "Pay Bills",
    history:  "Payment History",
    manage:   "Manage Billers",
  };

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors px-4 sm:px-6 py-5">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Page header + sub-nav */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{titles[view]}</h1>
          <SubNav active={view} onChange={setView} />
        </div>

        {/* Sub-view content */}
        {view === "overview" && <BillsOverview onStartSession={() => setView("pay")} />}
        {view === "pay"      && <PayBills />}
        {view === "history"  && <BillPaymentHistory />}
        {view === "manage"   && <ManageBillers />}
      </div>
    </div>
  );
}
