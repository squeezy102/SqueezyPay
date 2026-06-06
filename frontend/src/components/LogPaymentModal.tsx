import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logPayment, getCredentialByBill, getPaymentMethods } from "../utils/api";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { Bill, Payment, Credential, PaymentMethod } from "../types";
import MoneyInput from "./MoneyInput";

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } else {
      // Fallback for non-HTTPS (local IP on mobile)
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface FormValues {
  paymentDate: string;
  amountPaid: number;
  confirmationNumber: string;
  paymentMethod: string;
  notes: string;
}

interface Props {
  bill: Bill;
  onClose: () => void;
  onLogged: (payment: Payment) => void;
}

export default function LogPaymentModal({ bill, onClose, onLogged }: Props) {
  const today = new Date().toISOString().split("T")[0];
  const queryClient = useQueryClient();
  const trapRef = useFocusTrap<HTMLDivElement>();

  const credQuery = useQuery<Credential | null>({
    queryKey: ["credentials", "bill", bill.id],
    queryFn: () => getCredentialByBill(bill.id),
  });

  const pmQuery = useQuery<PaymentMethod[]>({
    queryKey: ["paymentMethods"],
    queryFn: getPaymentMethods,
  });

  const credential      = credQuery.data ?? null;
  const paymentMethods  = pmQuery.data ?? [];
  const credsLoading    = credQuery.isLoading;
  const credsError      = credQuery.isError;
  const pmLoading       = pmQuery.isLoading;

  const [showCreds, setShowCreds] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: {
      paymentDate:        today,
      amountPaid:         bill.expectedAmount ?? 0,
      confirmationNumber: "",
      paymentMethod:      "",
      notes:              "",
    },
  });

  const logMutation = useMutation({
    mutationFn: (payload: Parameters<typeof logPayment>[0]) => logPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  function handleGoToBiller() {
    window.open(bill.url, "_blank", "noopener,noreferrer");
  }

  async function onSubmit(data: FormValues) {
    setError(null);
    const result = await logMutation.mutateAsync({
      billId:             bill.id,
      paymentDate:        data.paymentDate,
      amountPaid:         data.amountPaid,
      confirmationNumber: data.confirmationNumber || null,
      paymentMethod:      data.paymentMethod || null,
      notes:              data.notes || null,
    });
    if (!result) {
      setError("Failed to save. Please try again.");
      return;
    }
    setSuccess(true);
    setTimeout(() => onLogged(result), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={`Log payment for ${bill.name}`} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md flex flex-col">

        {/* ── TOP HALF - GO PAY ───────────────────────────────────── */}
        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">

          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400">Step 1 — Go pay</p>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">{bill.name}</h2>
              {bill.amountLabel && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{bill.amountLabel} expected</p>
              )}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-0.5" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Credentials */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => !credsLoading && setShowCreds((v) => !v)}
              disabled={credsLoading}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-60 disabled:cursor-default"
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                </svg>
                {credsLoading ? "Loading credentials…" : credsError ? "Could not load credentials" : credential ? "Show credentials" : "No credentials stored"}
              </span>
              {!credsLoading && !credsError && credential && (
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-slate-400 transition-transform ${showCreds ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {showCreds && credential && (
              <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-20 shrink-0">Username</span>
                  <span className="flex-1 text-sm text-slate-900 dark:text-white font-mono truncate">{credential.username}</span>
                  <CopyButton text={credential.username} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-20 shrink-0">Password</span>
                  <span className="flex-1 text-sm text-slate-900 dark:text-white font-mono">••••••••</span>
                  <CopyButton text={credential.password} />
                </div>
              </div>
            )}
          </div>

          {/* Go to biller button */}
          <button
            type="button"
            onClick={handleGoToBiller}
            className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-sm font-semibold py-3 flex items-center justify-center gap-2 transition-colors"
          >
            Go to {bill.name}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── DIVIDER ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-violet-500 dark:text-violet-400">Step 2 — Log it</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* ── BOTTOM HALF - LOG PAYMENT ───────────────────────────── */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pt-4 pb-5 flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Date Paid</label>
              <input
                type="date"
                {...register("paymentDate", { required: true })}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Amount Paid</label>
              <Controller
                name="amountPaid"
                control={control}
                rules={{ validate: (v) => v > 0 || "Please enter the amount paid." }}
                render={({ field }) => (
                  <MoneyInput
                    value={field.value}
                    onChange={field.onChange}
                    required
                    className="w-full"
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Confirmation Number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              {...register("confirmationNumber")}
              placeholder="Enter after paying"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Payment Method <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            {pmLoading ? (
              <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-400 dark:text-slate-500">Loading…</div>
            ) : paymentMethods.length > 0 ? (
              <select
                {...register("paymentMethod")}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select a payment method</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.nickname}>
                    {m.nickname} (••••{m.last_four})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                {...register("paymentMethod")}
                placeholder="e.g. Visa, Joint Checking"
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Anything worth noting"
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          {(errors.amountPaid || error) && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.amountPaid?.message ?? error}
            </p>
          )}

          {success ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold">Payment saved!</span>
            </div>
          ) : (
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Skip documentation
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                {isSubmitting ? "Saving…" : "Save Payment"}
              </button>
            </div>
          )}
        </form>

      </div>
    </div>
  );
}
