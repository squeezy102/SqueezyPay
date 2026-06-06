import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllBills, createBill, updateBill, deleteBill } from "../utils/api";
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

function NotesPopover({ notes, billName, onEdit }: { notes: string | null; billName: string; onEdit: (note: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  function startEditing() {
    setDraft(notes ?? "");
    setEditing(true);
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
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          ) : (
            <>
              {notes ? (
                <p
                  onClick={startEditing}
                  title="Click to edit"
                  className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words cursor-text hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded px-1 -mx-1"
                >
                  {notes}
                </p>
              ) : (
                <p
                  onClick={startEditing}
                  title="Click to add a note"
                  className="text-sm text-slate-400 dark:text-slate-500 italic cursor-text hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded px-1 -mx-1"
                >
                  No note. Click to add one.
                </p>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export default function BillManagement() {
  const queryClient = useQueryClient();
  const [modalBill, setModalBill] = useState<Bill | null | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (modalBill) return updateBill(modalBill.id, payload);
      return createBill(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (billId: number) => deleteBill(billId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      setConfirmDeleteId(null);
    },
  });

  async function handleSave(payload: BillPayload) {
    setError(null);
    const result = await saveMutation.mutateAsync(payload);
    if (!result) { setError("Save failed — check backend logs."); return; }
    setModalBill(undefined);
  }

  function handleDeleteConfirm() {
    if (confirmDeleteId !== null) deleteMutation.mutate(confirmDeleteId);
  }

  async function handleNoteSave(bill: Bill, note: string | null) {
    const payload: BillPayload = {
      name:           bill.name,
      category:       bill.category,
      url:            bill.url,
      expectedAmount: bill.expectedAmount,
      dayOfMonth:     bill.dayOfMonth,
      recurring:      bill.recurring,
      notes:          note,
    };
    const result = await updateBill(bill.id, payload);
    if (!result) { setError("Save failed — check backend logs."); return; }
    queryClient.invalidateQueries({ queryKey: ["bills"] });
  }

  const bills = billsQuery.data ?? [];

  if (billsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-violet-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (billsQuery.isError) {
    return (
      <div className="min-h-screen bg-violet-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load bills. Check your connection and try refreshing.</p>
      </div>
    );
  }

  const confirmBill = bills.find((b) => b.id === confirmDeleteId);

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors px-6 py-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Bills</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{bills.length} biller{bills.length !== 1 ? "s" : ""}</p>
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

      {/* Delete confirmation dialog */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Delete biller?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
              <span className="font-medium text-slate-800 dark:text-slate-200">{confirmBill?.name}</span> and all its payment history will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bills list */}
      {bills.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">No bills yet. Add one to get started.</div>
      ) : (
        <>
          {/* Mobile card list (hidden on md+) */}
          <div className="flex flex-col gap-3 md:hidden">
            {bills.map((bill) => (
              <div key={bill.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{bill.name}</span>
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={bill.category} />
                      {!bill.recurring && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">One-time</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <NotesPopover notes={bill.notes ?? null} billName={bill.name} onEdit={(note) => handleNoteSave(bill, note)} />
                    <button
                      onClick={() => setModalBill(bill)}
                      aria-label={`Edit ${bill.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(bill.id)}
                      aria-label={`Delete ${bill.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                    >
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

          {/* Desktop table (hidden on mobile) */}
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
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {bill.name}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={bill.category} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      Day {bill.dayOfMonth}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {bill.amountLabel}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500 dark:text-slate-400">
                      {bill.recurring ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <NotesPopover notes={bill.notes ?? null} billName={bill.name} onEdit={(note) => handleNoteSave(bill, note)} />
                        <button
                          onClick={() => setModalBill(bill)}
                          aria-label={`Edit ${bill.name}`}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(bill.id)}
                          aria-label={`Delete ${bill.name}`}
                          title="Delete"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                        >
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
