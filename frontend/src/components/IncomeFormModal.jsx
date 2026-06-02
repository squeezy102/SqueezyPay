import { useState, useEffect } from "react";
import { createIncome, updateIncome } from "../utils/api";

const FREQUENCIES = [
  { value: "weekly",       label: "Weekly" },
  { value: "bi-weekly",    label: "Bi-Weekly" },
  { value: "semi-monthly", label: "Semi-Monthly" },
  { value: "monthly",      label: "Monthly" },
];

const EMPTY_FORM = {
  sourceName:       "",
  amount:           "",
  frequency:        "monthly",
  nextExpectedDate: "",
};

function fieldClass(hasError) {
  const base =
    "w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors";
  return hasError
    ? `${base} border-red-400 dark:border-red-500`
    : `${base} border-slate-300 dark:border-slate-600`;
}

export default function IncomeFormModal({ income, onSave, onClose }) {
  const isEdit = !!income;

  const [form, setForm]     = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    if (income) {
      setForm({
        sourceName:       income.sourceName ?? "",
        amount:           income.amount != null ? String(income.amount) : "",
        frequency:        income.frequency ?? "monthly",
        nextExpectedDate: income.nextExpectedDate ?? "",
      });
    }
  }, [income]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }

  function validate() {
    const e = {};
    if (!form.sourceName.trim()) e.sourceName = "Required";
    const amt = Number(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = "Enter a positive amount";
    if (!form.frequency) e.frequency = "Required";
    if (!form.nextExpectedDate) e.nextExpectedDate = "Required";
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setApiError(null);

    const payload = {
      sourceName:       form.sourceName.trim(),
      amount:           Number(form.amount),
      frequency:        form.frequency,
      nextExpectedDate: form.nextExpectedDate,
    };

    const result = isEdit
      ? await updateIncome(income.id, payload)
      : await createIncome(payload);

    setSaving(false);

    if (!result) {
      setApiError("Save failed — check backend logs.");
      return;
    }

    onSave();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit Income Source" : "Add Income Source"}
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

          {apiError && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
              {apiError}
            </div>
          )}

          {/* Source Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Source Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.sourceName}
              onChange={(e) => set("sourceName", e.target.value)}
              placeholder="e.g. Main Job, Freelance, Side Business"
              className={fieldClass(errors.sourceName)}
            />
            {errors.sourceName && <p className="mt-1 text-xs text-red-500">{errors.sourceName}</p>}
          </div>

          {/* Amount + Frequency row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500 pointer-events-none">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  placeholder="0.00"
                  className={fieldClass(errors.amount) + " pl-7"}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Frequency <span className="text-red-500">*</span>
              </label>
              <select
                value={form.frequency}
                onChange={(e) => set("frequency", e.target.value)}
                className={fieldClass(errors.frequency)}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {errors.frequency && <p className="mt-1 text-xs text-red-500">{errors.frequency}</p>}
            </div>
          </div>

          {/* Next Expected Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Next Expected Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.nextExpectedDate}
              onChange={(e) => set("nextExpectedDate", e.target.value)}
              className={fieldClass(errors.nextExpectedDate)}
            />
            {errors.nextExpectedDate && <p className="mt-1 text-xs text-red-500">{errors.nextExpectedDate}</p>}
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
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Income Source"}
          </button>
        </div>

      </div>
    </div>
  );
}
