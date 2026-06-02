import { useState, useEffect } from "react";
import { sortBillsByDueDate, getBillStatus, filterActionableBills } from "../utils/billUtils";
import { getBills, getSettings } from "../utils/api";
import { alertBannerTokens } from "../theme/tokens";
import BillCard from "./BillCard";

function AlertBanner({ type, children }) {
  const t = alertBannerTokens[type];
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${t.bar}`}>
      <AlertIcon type={type} className={`w-4 h-4 shrink-0 ${t.icon}`} />
      <span className={t.text}>{children}</span>
    </div>
  );
}

function AlertIcon({ type, className }) {
  if (type === "overdue") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === "due-soon") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.87s.137.578.33.824zm9.068-7.873A.75.75 0 0118 1.25v15.5a.75.75 0 01-1.25.56l-4.5-4.5h-7A2.25 2.25 0 013 10.5V5.25A2.25 2.25 0 015.25 3h7l4.5-4.5a.75.75 0 011.148.247z" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  );
}

export default function BillDashboard() {
  const [bills, setBills] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [thresholds, setThresholds] = useState({ dueSoonDays: 7, largePaymentThreshold: 500 });

  useEffect(() => {
    getBills().then(setBills);
    getSettings().then((s) => { if (s) setThresholds(s); });
  }, []);

  const sorted     = sortBillsByDueDate(bills);
  const actionable = filterActionableBills(sorted, thresholds.dueSoonDays);
  const upcoming   = sorted.filter((b) => !actionable.includes(b));

  const overdue      = actionable.filter((b) => getBillStatus(b.dayOfMonth, thresholds.dueSoonDays) === "overdue");
  const dueSoon      = actionable.filter((b) => getBillStatus(b.dayOfMonth, thresholds.dueSoonDays) === "due-soon");
  const largePending = actionable.filter(
    (b) => getBillStatus(b.dayOfMonth) !== "paid" &&
           b.expectedAmount >= thresholds.largePaymentThreshold
  );

  const hasAlerts = overdue.length > 0 || dueSoon.length > 0 || largePending.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <main className="px-6 py-5 flex flex-col gap-4">

        {hasAlerts && (
          <div className="flex flex-col gap-2">
            {overdue.length > 0 && (
              <AlertBanner type="overdue">
                {overdue.length === 1
                  ? `${overdue[0].name} is overdue`
                  : `${overdue.length} bills are overdue`}
              </AlertBanner>
            )}
            {dueSoon.length > 0 && (
              <AlertBanner type="due-soon">
                {dueSoon.length === 1
                  ? `${dueSoon[0].name} is due within 7 days`
                  : `${dueSoon.length} bills are due within 7 days`}
              </AlertBanner>
            )}
            {largePending.length > 0 && (
              <AlertBanner type="large-payment">
                {largePending.length === 1
                  ? `${largePending[0].name} has a large payment due ($${largePending[0].expectedAmount?.toLocaleString()})`
                  : `${largePending.length} large payments coming up`}
              </AlertBanner>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {actionable.map((bill) => (
            <BillCard key={bill.id} bill={bill} dueSoonDays={thresholds.dueSoonDays} />
          ))}
        </div>

        {upcoming.length > 0 && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="group w-full flex items-center gap-3 py-1"
            >
              <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 transition-colors" />
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 group-hover:border-indigo-400 dark:group-hover:border-indigo-500 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                <ChevronIcon open={showAll} />
                {showAll
                  ? "Hide upcoming bills"
                  : `${upcoming.length} upcoming ${upcoming.length === 1 ? "bill" : "bills"}`}
              </span>
              <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700 group-hover:bg-gray-300 dark:group-hover:bg-gray-600 transition-colors" />
            </button>

            {showAll && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {upcoming.map((bill) => (
                  <BillCard key={bill.id} bill={bill} dueSoonDays={thresholds.dueSoonDays} />
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
