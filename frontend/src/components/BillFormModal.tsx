import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { categoryTokens } from "../theme/tokens";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { Bill } from "../types";
import type { BillPayload } from "../utils/api";
import MoneyInput from "./MoneyInput";

const CATEGORIES = Object.keys(categoryTokens);

interface FormValues {
  name: string;
  category: string;
  url: string;
  expectedAmount: number;
  dayOfMonth: number | "";
  recurring: boolean;
  notes: string;
}

function fieldClass(error: string | undefined) {
  const base =
    "w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors";
  return error
    ? `${base} border-red-400 dark:border-red-500`
    : `${base} border-slate-300 dark:border-slate-600`;
}

interface Props {
  bill: Bill | null;
  onSave: (payload: BillPayload) => Promise<void>;
  onClose: () => void;
}

export default function BillFormModal({ bill, onSave, onClose }: Props) {
  const isEdit = !!bill;
  const [saved, setSaved] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      category: CATEGORIES[0] ?? "",
      url: "",
      expectedAmount: 0,
      dayOfMonth: "",
      recurring: true,
      notes: "",
    },
  });

  useEffect(() => {
    if (bill) {
      reset({
        name:           bill.name,
        category:       bill.category || CATEGORIES[0] || "",
        url:            bill.url,
        expectedAmount: bill.expectedAmount ?? 0,
        dayOfMonth:     bill.dayOfMonth,
        recurring:      bill.recurring,
        notes:          bill.notes ?? "",
      });
    }
  }, [bill, reset]);

  async function onValid(data: FormValues) {
    const payload: BillPayload = {
      name:           data.name,
      category:       data.category,
      url:            data.url,
      expectedAmount: data.expectedAmount === 0 ? null : Number(data.expectedAmount),
      dayOfMonth:     Number(data.dayOfMonth),
      recurring:      data.recurring,
      notes:          data.notes || null,
    };
    await onSave(payload);
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={isEdit ? "Edit Bill" : "Add Bill"} className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

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
        <form onSubmit={handleSubmit(onValid)} className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">

          {/* Name */}
          <div>
            <label htmlFor="bill-form-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Biller Name <span className="text-red-500">*</span>
            </label>
            <input
              id="bill-form-name"
              type="text"
              placeholder="e.g. Example Electric Co"
              className={fieldClass(errors.name?.message)}
              {...register("name", { required: "Required" })}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="bill-form-category" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="bill-form-category"
              className={fieldClass(errors.category?.message)}
              {...register("category", { required: "Required" })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>}
          </div>

          {/* Payment URL */}
          <div>
            <label htmlFor="bill-form-url" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Payment URL <span className="text-red-500">*</span>
            </label>
            <input
              id="bill-form-url"
              type="url"
              placeholder="https://..."
              className={fieldClass(errors.url?.message)}
              {...register("url", { required: "Required" })}
            />
            {errors.url && <p className="mt-1 text-xs text-red-500">{errors.url.message}</p>}
          </div>

          {/* Amount + Day row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bill-form-expected-amount" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Expected Amount
              </label>
              <Controller
                name="expectedAmount"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    id="bill-form-expected-amount"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div>
              <label htmlFor="bill-form-day-of-month" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Due Day of Month <span className="text-red-500">*</span>
              </label>
              <input
                id="bill-form-day-of-month"
                type="number"
                min={1}
                max={31}
                placeholder="1-31"
                className={fieldClass(errors.dayOfMonth?.message)}
                {...register("dayOfMonth", {
                  required: "Enter a day 1-31",
                  min: { value: 1, message: "Enter a day 1-31" },
                  max: { value: 31, message: "Enter a day 1-31" },
                  validate: (v) =>
                    v === "" || Number.isInteger(Number(v)) || "Enter a day 1-31",
                })}
              />
              {errors.dayOfMonth && <p className="mt-1 text-xs text-red-500">{errors.dayOfMonth.message}</p>}
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <Controller
              name="recurring"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                    ${field.value ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform
                      ${field.value ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
              )}
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Recurring bill</span>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="bill-form-notes" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              id="bill-form-notes"
              placeholder="Optional notes..."
              rows={2}
              className={`${fieldClass(undefined)} resize-none`}
              {...register("notes")}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          {saved ? (
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 py-2 px-3 rounded-lg bg-green-50 dark:bg-green-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {isEdit ? "Bill updated" : "Bill added"}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit(onValid)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Add Bill"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
