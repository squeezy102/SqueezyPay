import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllBills, createBill, updateBill, deactivateBill, reactivateBill } from "../utils/api";
import { categoryTokens, defaultCategoryToken } from "../theme/tokens";
import type { Bill } from "../types";
import type { BillPayload } from "../utils/api";
import BillFormModal from "./BillFormModal";

function CategoryBadge({ category }: { category: string }) {
  const cls = categoryTokens[category] ?? defaultCategoryToken;
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {category}
    </span>
  );
}

export default function BillManagement() {
  const queryClient = useQueryClient();
  // undefined = closed, null = add new, Bill = edit existing
  const [modalBill, setModalBill] = useState<Bill | null | undefined>(undefined);
  const [error, setError]         = useState<string | null>(null);

  const billsQuery = useQuery({
    queryKey: ["bills", "all"],
    queryFn: async () => {
      const data = await getAllBills();
      data.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: BillPayload) => {
      if (modalBill) {
        return updateBill(modalBill.id, payload);
      }
      return createBill(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (bill: Bill) =>
      bill.active ? deactivateBill(bill.id) : reactivateBill(bill.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  async function handleSave(payload: BillPayload) {
    setError(null);
    const result = await saveMutation.mutateAsync(payload);
    if (!result) { setError("Save failed - check backend logs."); return; }
    setModalBill(undefined);
  }

  function handleToggleActive(bill: Bill) {
    toggleMutation.mutate(bill);
  }

  const bills    = billsQuery.data ?? [];
  const active   = bills.filter((b) => b.active);
  const inactive = bills.filter((b) => !b.active);

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors px-6 py-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bills</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {active.length} active{inactive.length > 0 ? `, ${inactive.length} inactive` : ""}
          </p>
        </div>
        <button
          onClick={() => setModalBill(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Bill
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Active bills */}
      <BillTable bills={active} onEdit={setModalBill} onToggle={handleToggleActive} />

      {/* Inactive bills */}
      {inactive.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
            Inactive
          </h2>
          <BillTable bills={inactive} onEdit={setModalBill} onToggle={handleToggleActive} dimmed />
        </div>
      )}

      {/* Modal */}
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

interface BillTableProps {
  bills: Bill[];
  onEdit: (bill: Bill) => void;
  onToggle: (bill: Bill) => void;
  dimmed?: boolean;
}

function BillTable({ bills, onEdit, onToggle, dimmed = false }: BillTableProps) {
  if (!bills.length) return null;

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${dimmed ? "opacity-60" : ""}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
            <th className="px-4 py-3">Biller</th>
            <th className="px-4 py-3 hidden sm:table-cell">Category</th>
            <th className="px-4 py-3 hidden md:table-cell">Due</th>
            <th className="px-4 py-3 hidden md:table-cell">Amount</th>
            <th className="px-4 py-3 hidden lg:table-cell">Recurring</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
          {bills.map((bill) => (
            <tr key={bill.id} className="hover:bg-violet-50/60 dark:hover:bg-slate-700/50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                {bill.name}
                {bill.notes && (
                  <span className="block text-xs text-slate-400 dark:text-slate-500 font-normal mt-0.5 truncate max-w-[180px]">
                    {bill.notes}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <CategoryBadge category={bill.category} />
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-slate-600 dark:text-slate-400">
                Day {bill.dayOfMonth}
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-slate-600 dark:text-slate-400">
                {bill.amountLabel}
              </td>
              <td className="px-4 py-3 hidden lg:table-cell text-slate-500 dark:text-slate-400">
                {bill.recurring ? "Yes" : "No"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onEdit(bill)}
                    title="Edit"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onToggle(bill)}
                    title={bill.active ? "Deactivate" : "Reactivate"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      bill.active
                        ? "text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30"
                        : "text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:text-green-400 dark:hover:bg-green-900/30"
                    }`}
                  >
                    {bill.active ? (
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
