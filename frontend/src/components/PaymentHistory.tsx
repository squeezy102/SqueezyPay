import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllPayments } from "../utils/api";
import type { Payment } from "../types";
import Spinner from "./Spinner";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

type SortKey = keyof Payment;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "paymentDate",        label: "Date" },
  { key: "billName",           label: "Biller" },
  { key: "amountPaid",         label: "Amount" },
  { key: "paymentMethod",      label: "Method" },
  { key: "confirmationNumber", label: "Confirmation #" },
  { key: "notes",              label: "Notes" },
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

export default function PaymentHistory() {
  const query   = useQuery({ queryKey: ["payments"], queryFn: getAllPayments });
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState<SortKey>("paymentDate");
  const [sortDir, setSortDir]   = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (query.isLoading) return <Spinner />;

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
    if (sortKey === "amountPaid") {
      return sortDir === "asc" ? a.amountPaid - b.amountPaid : b.amountPaid - a.amountPaid;
    }
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
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors">
      <div className="px-6 py-5 flex flex-col gap-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-80">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search biller, confirmation, method, notes..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-violet-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
            {sorted.length} {sorted.length === 1 ? "record" : "records"}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-violet-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
          {sorted.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-16">
              {search ? "No payments match your search." : "No payments logged yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-violet-100 dark:border-slate-700 bg-violet-50 dark:bg-slate-900/50">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
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
          )}
        </div>

      </div>
    </div>
  );
}
