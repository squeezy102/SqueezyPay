import { useState, useEffect } from "react";
import { getAllPayments } from "../utils/api";

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount) {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

const COLUMNS = [
  { key: "paymentDate",        label: "Date" },
  { key: "billName",           label: "Biller" },
  { key: "amountPaid",         label: "Amount" },
  { key: "paymentMethod",      label: "Method" },
  { key: "confirmationNumber", label: "Confirmation #" },
  { key: "notes",              label: "Notes" },
];

function SortIcon({ direction }) {
  if (!direction) return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" viewBox="0 0 20 20" fill="currentColor">
      <path d="M5 8l5-5 5 5H5zm0 4l5 5 5-5H5z" />
    </svg>
  );
  return direction === "asc" ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState("paymentDate");
  const [sortDir, setSortDir]   = useState("desc");

  useEffect(() => {
    getAllPayments().then((data) => { setPayments(data); setLoading(false); });
  }, []);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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
    let av = a[sortKey] ?? "";
    let bv = b[sortKey] ?? "";
    if (sortKey === "amountPaid") return sortDir === "asc" ? av - bv : bv - av;
    if (sortKey === "paymentDate") { av = new Date(av); bv = new Date(bv); }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  function cellValue(p, key) {
    switch (key) {
      case "paymentDate": return formatDate(p.paymentDate);
      case "amountPaid":  return formatAmount(p.amountPaid);
      default:            return p[key] || <span className="text-gray-300 dark:text-gray-600">-</span>;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="px-6 py-5 flex flex-col gap-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-80">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search biller, confirmation, method, notes..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {sorted.length} {sorted.length === 1 ? "record" : "records"}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-16">Loading...</p>
          ) : sorted.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">
              {search ? "No payments match your search." : "No payments logged yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 select-none whitespace-nowrap"
                      >
                        <div className="flex items-center gap-1.5">
                          {col.label}
                          <SortIcon direction={sortKey === col.key ? sortDir : null} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sorted.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
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
