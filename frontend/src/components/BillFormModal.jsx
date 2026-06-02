import { useState, useEffect } from "react";
import { categoryTokens } from "../theme/tokens";
import MoneyInput from "./MoneyInput";

const CATEGORIES = Object.keys(categoryTokens);

const EMPTY_FORM = {
  name: "",
  category: CATEGORIES[0],
  url: "",
  expectedAmount: "",
  dayOfMonth: "",
  recurring: true,
  notes: "",
};

function fieldClass(error) {
  const base =
    "w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors";
  return error
    ? `${base} border-red-400 dark:border-red-500`
    : `${base} border-slate-300 dark:border-slate-600`;
}

export default function BillFormModal({ bill, onSave, onClose }) {
  const isEdit = !!bill;

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bill) {
      setForm({
        name:           bill.name ?? "",
        category:       bill.category ?? CATEGORIES[0],
        url:            bill.url ?? "",
        expectedAmount: bill.expectedAmount ?? "",
        dayOfMonth:     bill.dayOfMonth ?? "",
        recurring:      bill.recurring ?? true,
        notes:          bill.notes ?? "",
      });
    }
  }, [bill]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())          e.name       = "Required";
    if (!form.category)             e.category   = "Required";
    if (!form.url.trim())           e.url        = "Required";
    const day = Number(form.dayOfMonth);
    if (!form.dayOfMonth || isNaN(day) || day < 1 || day > 31)
      e.dayOfMonth = "Enter a day 1-31";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    const payload = {
      ...form,
      expectedAmount: form.expectedAmount === "" ? null : Number(form.expectedAmount),
      dayOfMonth:     Number(form.dayOfMonth),
    };
    await onSave(payload);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit Bill" : "Add Bill"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Biller Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Example Electric Co"
              className={fieldClass(errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className={fieldClass(errors.category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
          </div>

          {/* Payment URL */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Payment URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
              className={fieldClass(errors.url)}
            />
            {errors.url && <p className="mt-1 text-xs text-red-500">{errors.url}</p>}
          </div>

          {/* Amount + Day row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Expected Amount
              </label>
              <MoneyInput
                value={form.expectedAmount}
                onChange={(v) => set("expectedAmount", v)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Due Day of Month <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={(e) => set("dayOfMonth", e.target.value)}
                placeholder="1-31"
                className={fieldClass(errors.dayOfMonth)}
              />
              {errors.dayOfMonth && <p className="mt-1 text-xs text-red-500">{errors.dayOfMonth}</p>}
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.recurring}
              onClick={() => set("recurring", !form.recurring)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                ${form.recurring ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-600"}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform
                  ${form.recurring ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
            <span className="text-sm text-slate-700 dark:text-slate-300">Recurring bill</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className={fieldClass(false) + " resize-none"}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}
