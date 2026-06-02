import { useState, useEffect, useCallback } from "react";
import { getIncome, deactivateIncome, reactivateIncome, getMonthlyTotal } from "../utils/api";
import type { Income, IncomeFrequency } from "../types";
import IncomeFormModal from "./IncomeFormModal";

const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  "weekly":       "Weekly",
  "bi-weekly":    "Bi-Weekly",
  "semi-monthly": "Semi-Monthly",
  "monthly":      "Monthly",
};

function formatCurrency(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  // ISO datetime — take only the date portion before "T" to avoid UTC offset shifting the day
  const [year, month, day] = dateStr.split("T")[0].split("-");
  return new Date(Number(year), Number(month) - 1, Number(day))
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function IncomeManagement() {
  const [sources, setSources]           = useState<Income[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  // undefined = closed, null = add new, Income = edit existing
  const [modalIncome, setModalIncome]   = useState<Income | null | undefined>(undefined);
  const [error, setError]               = useState<string | null>(null);

  const loadTotal = useCallback(async () => {
    const total = await getMonthlyTotal();
    setMonthlyTotal(total);
  }, []);

  const load = useCallback(async () => {
    const data = await getIncome(showInactive);
    data.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    setSources(data);
    await loadTotal();
  }, [showInactive, loadTotal]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setModalIncome(undefined);
    setError(null);
    await load();
  }

  async function handleToggleActive(source: Income) {
    setError(null);
    if (source.active) {
      await deactivateIncome(source.id);
    } else {
      const result = await reactivateIncome(source.id);
      if (!result) { setError("Reactivate failed — check backend logs."); return; }
    }
    await load();
  }

  const active   = sources.filter((s) => s.active);
  const inactive = sources.filter((s) => !s.active);
  const visible  = showInactive ? sources : active;

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors px-6 py-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Income Sources</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {active.length} active{inactive.length > 0 ? `, ${inactive.length} inactive` : ""}
          </p>
        </div>
        <button
          onClick={() => setModalIncome(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Income Source
        </button>
      </div>

      {/* Monthly total summary bar */}
      <div className="mb-5 flex items-center gap-4 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-green-800 dark:text-green-300">Monthly Total:</span>
        </div>
        <span className="text-lg font-semibold text-green-700 dark:text-green-400">
          {monthlyTotal != null ? formatCurrency(monthlyTotal) : "—"}
        </span>
        <span className="ml-auto text-xs text-green-600 dark:text-green-500">Active sources only</span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Show inactive toggle */}
      {inactive.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-violet-500"
            />
            Show inactive sources
          </label>
        </div>
      )}

      {/* Table or empty state */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">No income sources added yet</p>
          <button
            onClick={() => setModalIncome(null)}
            className="mt-3 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            Add your first income source
          </button>
        </div>
      ) : (
        <IncomeTable
          sources={visible}
          onEdit={setModalIncome}
          onToggle={handleToggleActive}
        />
      )}

      {/* Modal */}
      {modalIncome !== undefined && (
        <IncomeFormModal
          income={modalIncome}
          onSave={handleSave}
          onClose={() => { setModalIncome(undefined); setError(null); }}
        />
      )}
    </div>
  );
}

interface IncomeTableProps {
  sources: Income[];
  onEdit: (income: Income) => void;
  onToggle: (income: Income) => void;
}

function IncomeTable({ sources, onEdit, onToggle }: IncomeTableProps) {
  if (!sources.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 hidden sm:table-cell">Amount</th>
            <th className="px-4 py-3 hidden md:table-cell">Frequency</th>
            <th className="px-4 py-3 hidden md:table-cell">Next Date</th>
            <th className="px-4 py-3 hidden lg:table-cell">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
          {sources.map((source) => (
            <tr
              key={source.id}
              className={`hover:bg-violet-50/60 dark:hover:bg-slate-700/50 transition-colors ${!source.active ? "opacity-60" : ""}`}
            >
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                {source.sourceName}
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-slate-600 dark:text-slate-400">
                {formatCurrency(source.amount)}
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-slate-600 dark:text-slate-400">
                {FREQUENCY_LABELS[source.frequency] ?? source.frequency}
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-slate-600 dark:text-slate-400">
                {formatDate(source.nextExpectedDate)}
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                {source.active ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(source)}
                    title="Edit"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onToggle(source)}
                    title={source.active ? "Deactivate" : "Reactivate"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      source.active
                        ? "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30"
                        : "text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-900/30"
                    }`}
                  >
                    {source.active ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
