import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { createIncome, updateIncome } from "../utils/api";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { Income, IncomeFrequency } from "../types";

const FREQUENCIES: { value: IncomeFrequency; label: string }[] = [
  { value: "weekly",       label: "Weekly" },
  { value: "bi-weekly",    label: "Bi-Weekly" },
  { value: "semi-monthly", label: "Semi-Monthly" },
  { value: "monthly",      label: "Monthly" },
];

function fieldClass(hasError: string | undefined) {
  const base =
    "w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors";
  return hasError
    ? `${base} border-red-400 dark:border-red-500`
    : `${base} border-slate-300 dark:border-slate-600`;
}

interface Props {
  income: Income | null;
  onSave: () => void;
  onClose: () => void;
}

interface FormFields {
  sourceName: string;
  amount: string;
  frequency: string;
  nextExpectedDate: string;
}

export default function IncomeFormModal({ income, onSave, onClose }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!income;
  const [saved, setSaved] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormFields>({
    defaultValues: {
      sourceName: "",
      amount: "",
      frequency: "monthly",
      nextExpectedDate: "",
    },
  });

  useEffect(() => {
    if (income) {
      reset({
        sourceName:       income.sourceName,
        amount:           income.amount != null ? String(income.amount) : "",
        frequency:        income.frequency,
        nextExpectedDate: income.nextExpectedDate,
      });
    }
  }, [income, reset]);

  const saveMutation = useMutation({
    mutationFn: (payload: { sourceName: string; amount: number; frequency: IncomeFrequency; nextExpectedDate: string }) =>
      isEdit && income
        ? updateIncome(income.id, payload)
        : createIncome(payload),
    onSuccess: (result) => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: ["income"] });
      setSaved(true);
      setTimeout(() => onSave(), 1200);
    },
  });

  function onSubmit(data: FormFields) {
    saveMutation.mutate({
      sourceName:       data.sourceName.trim(),
      amount:           Number(data.amount),
      frequency:        data.frequency as IncomeFrequency,
      nextExpectedDate: data.nextExpectedDate,
    });
  }

  const apiError = saveMutation.isError
    ? "Save failed — check backend logs."
    : saveMutation.data === null
      ? "Save failed — check backend logs."
      : null;

  const saving = saveMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={isEdit ? "Edit Income Source" : "Add Income Source"} className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex flex-col max-h-[90vh]">

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
        <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">

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
              placeholder="e.g. Main Job, Freelance, Side Business"
              className={fieldClass(errors.sourceName?.message)}
              {...register("sourceName", { required: "Required" })}
            />
            {errors.sourceName && <p className="mt-1 text-xs text-red-500">{errors.sourceName.message}</p>}
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
                  placeholder="0.00"
                  className={`${fieldClass(errors.amount?.message)} pl-7`}
                  {...register("amount", {
                    required: "Enter a positive amount",
                    validate: (v) => Number(v) > 0 || "Enter a positive amount",
                  })}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Frequency <span className="text-red-500">*</span>
              </label>
              <select
                className={fieldClass(errors.frequency?.message)}
                {...register("frequency", { required: "Required" })}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {errors.frequency && <p className="mt-1 text-xs text-red-500">{errors.frequency.message}</p>}
            </div>
          </div>

          {/* Next Expected Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Next Expected Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className={fieldClass(errors.nextExpectedDate?.message)}
              {...register("nextExpectedDate", { required: "Required" })}
            />
            {errors.nextExpectedDate && <p className="mt-1 text-xs text-red-500">{errors.nextExpectedDate.message}</p>}
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          {saved ? (
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 py-2 px-3 rounded-lg bg-green-50 dark:bg-green-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {isEdit ? "Income source updated" : "Income source added"}
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
                onClick={handleSubmit(onSubmit)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Income Source"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
