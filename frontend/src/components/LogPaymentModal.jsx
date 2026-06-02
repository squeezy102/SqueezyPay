import { useState, useEffect } from "react";
import { logPayment, getCredentialByBill, getPaymentMethods } from "../utils/api";
import MoneyInput from "./MoneyInput";

function CopyButton({ text }) {
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
      className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function LogPaymentModal({ bill, onClose, onLogged }) {
  const today = new Date().toISOString().split("T")[0];

  const [credential, setCredential]         = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showCreds, setShowCreds]           = useState(false);
  const [form, setForm] = useState({
    paymentDate:        today,
    amountPaid:         bill.expectedAmount ?? 0,
    confirmationNumber: "",
    paymentMethod:      "",
    notes:              "",
  });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    getCredentialByBill(bill.id).then(setCredential);
    getPaymentMethods().then(setPaymentMethods);
  }, [bill.id]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleGoToBiller() {
    window.open(bill.url, "_blank", "noopener,noreferrer");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.amountPaid || form.amountPaid <= 0) {
      setError("Please enter the amount paid.");
      return;
    }
    setSaving(true);
    const result = await logPayment({
      billId:             bill.id,
      paymentDate:        form.paymentDate,
      amountPaid:         form.amountPaid,
      confirmationNumber: form.confirmationNumber || null,
      paymentMethod:      form.paymentMethod || null,
      notes:              form.notes || null,
    });
    setSaving(false);
    if (!result) {
      setError("Failed to save. Please try again.");
      return;
    }
    setSuccess(true);
    setTimeout(() => onLogged(result), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md flex flex-col">

        {/* ── TOP HALF - GO PAY ───────────────────────────────────── */}
        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">

          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">Step 1 — Go pay</p>

              <h2 className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">{bill.name}</h2>
              {bill.amountLabel && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{bill.amountLabel} expected</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mt-0.5" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Credentials */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCreds((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                </svg>
                {credential ? "Show credentials" : "No credentials stored"}
              </span>
              {credential && (
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-gray-400 transition-transform ${showCreds ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {showCreds && credential && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-col gap-2 bg-gray-50 dark:bg-gray-900/40">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">Username</span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-white font-mono truncate">{credential.username}</span>
                  <CopyButton text={credential.username} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0">Password</span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-white font-mono">••••••••</span>
                  <CopyButton text={credential.password} />
                </div>
              </div>
            )}
          </div>

          {/* Go to biller button */}
          <button
            type="button"
            onClick={handleGoToBiller}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold py-3 flex items-center justify-center gap-2 transition-colors"
          >
            Go to {bill.name}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── DIVIDER ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">Step 2 — Log it</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* ── BOTTOM HALF - LOG PAYMENT ───────────────────────────── */}
        <form onSubmit={handleSubmit} className="px-6 pt-4 pb-5 flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Date Paid</label>
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) => set("paymentDate", e.target.value)}
                required
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Amount Paid</label>
              <MoneyInput
                value={form.amountPaid}
                onChange={(v) => set("amountPaid", v)}
                required
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Confirmation Number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.confirmationNumber}
              onChange={(e) => set("confirmationNumber", e.target.value)}
              placeholder="Enter after paying"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Payment Method <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            {paymentMethods.length > 0 ? (
              <select
                value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                value={form.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value)}
                placeholder="e.g. ECU Visa, Joint Checking"
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Anything worth noting"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

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
                className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Skip documentation
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                {saving ? "Saving…" : "Save Payment"}
              </button>
            </div>
          )}
        </form>

      </div>
    </div>
  );
}
