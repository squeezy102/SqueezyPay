import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sortBillsByDueDate, getBillStatus, filterActionableBills } from "../utils/billUtils";
import { getBills, getSettings } from "../utils/api";
import { alertBannerTokens } from "../theme/tokens";
import type { Bill, AppSettings } from "../types";
import BillCard from "./BillCard";
import Spinner from "./Spinner";

type AlertType = "overdue" | "due-soon" | "large-payment";

interface AlertBannerProps {
  type: AlertType;
  children: React.ReactNode;
}

function AlertBanner({ type, children }: AlertBannerProps) {
  const t = alertBannerTokens[type];
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${t.bar}`}>
      <AlertIcon type={type} className={`w-4 h-4 shrink-0 ${t.icon}`} />
      <span className={t.text}>{children}</span>
    </div>
  );
}

function AlertIcon({ type, className }: { type: AlertType; className: string }) {
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

function ChevronIcon({ open }: { open: boolean }) {
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
  const [showAll, setShowAll] = useState(false);

  const { data: bills, isLoading: billsLoading, isError: billsError } = useQuery<Bill[]>({
    queryKey: ["bills"],
    queryFn: getBills,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<AppSettings | null>({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  if (billsLoading || settingsLoading) {
    return <Spinner />;
  }

  if (billsError) {
    return (
      <div className="min-h-screen bg-violet-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load bills. Check your connection and try refreshing.</p>
      </div>
    );
  }

  const thresholds: AppSettings = settings ?? { dueSoonDays: 7, largePaymentThreshold: 500 };
  const allBills = bills ?? [];

  if (allBills.length === 0) {
    return (
      <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors flex flex-col items-center justify-center gap-3 px-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No bills added yet</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Add your first bill from the Bills tab to get started.</p>
      </div>
    );
  }

  const sorted     = sortBillsByDueDate(allBills);
  const actionable = filterActionableBills(sorted, thresholds.dueSoonDays);
  const upcoming   = sorted.filter((b) => !actionable.includes(b));

  const overdue      = actionable.filter((b) => getBillStatus(b.dayOfMonth, thresholds.dueSoonDays) === "overdue");
  const dueSoon      = actionable.filter((b) => getBillStatus(b.dayOfMonth, thresholds.dueSoonDays) === "due-soon");
  const largePending = actionable.filter(
    (b) => (b.expectedAmount ?? 0) >= thresholds.largePaymentThreshold
  );

  const hasAlerts = overdue.length > 0 || dueSoon.length > 0 || largePending.length > 0;

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors">
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
                  ? `${dueSoon[0].name} is due within ${thresholds.dueSoonDays} day${thresholds.dueSoonDays === 1 ? "" : "s"}`
                  : `${dueSoon.length} bills are due within ${thresholds.dueSoonDays} day${thresholds.dueSoonDays === 1 ? "" : "s"}`}
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
              <span className="flex-1 h-px bg-violet-200 dark:bg-slate-700 group-hover:bg-violet-300 dark:group-hover:bg-slate-600 transition-colors" />
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-200 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:border-violet-400 dark:group-hover:border-violet-500 group-hover:bg-violet-50 dark:group-hover:bg-violet-900/20 transition-colors text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-violet-700 dark:group-hover:text-violet-400">
                <ChevronIcon open={showAll} />
                {showAll
                  ? "Hide upcoming bills"
                  : `${upcoming.length} upcoming ${upcoming.length === 1 ? "bill" : "bills"}`}
              </span>
              <span className="flex-1 h-px bg-violet-200 dark:bg-slate-700 group-hover:bg-violet-300 dark:group-hover:bg-slate-600 transition-colors" />
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
