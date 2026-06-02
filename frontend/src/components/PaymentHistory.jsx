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

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    getAllPayments().then((data) => {
      setPayments(data);
      setLoading(false);
    });
  }, []);

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.billName?.toLowerCase().includes(q) ||
      p.confirmationNumber?.toLowerCase().includes(q) ||
      p.paymentMethod?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <main className="px-6 py-5 flex flex-col gap-4 max-w-4xl">
        {/* Search */}
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by biller, confirmation, or method"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Results */}
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-12">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">
            {search ? "No payments match your search." : "No payments logged yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-5 py-4 flex flex-col gap-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.billName}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">{formatAmount(p.amountPaid)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatDate(p.paymentDate)}</span>
                  {p.paymentMethod && <span>{p.paymentMethod}</span>}
                </div>
                {p.confirmationNumber && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Conf. <span className="font-mono text-gray-700 dark:text-gray-300">{p.confirmationNumber}</span>
                  </div>
                )}
                {p.notes && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">{p.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
