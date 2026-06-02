import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBillStatus, getDaysUntilDue, formatDueDate } from "../utils/billUtils";
import { statusTokens, actionTokens, cardClass } from "../theme/tokens";
import type { Bill, BillStatus } from "../types";
import LogPaymentModal from "./LogPaymentModal";

interface StatusBadgeProps {
  status: BillStatus;
  daysUntil: number;
}

function StatusBadge({ status, daysUntil }: StatusBadgeProps) {
  const tokens = statusTokens[status];
  if (!tokens.badge) return null;

  const label =
    status === "overdue"
      ? "Overdue"
      : daysUntil === 0
      ? "Due today"
      : `Due in ${daysUntil}d`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${tokens.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${tokens.dot ?? ""}`} />
      {label}
    </span>
  );
}

interface Props {
  bill: Bill;
  dueSoonDays?: number;
}

export default function BillCard({ bill, dueSoonDays = 7 }: Props) {
  const status      = getBillStatus(bill.dayOfMonth, dueSoonDays);
  const daysUntil   = getDaysUntilDue(bill.dayOfMonth);
  const dueDate     = formatDueDate(bill.dayOfMonth);
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  function handlePayClick(e: React.MouseEvent) {
    e.preventDefault();
    setShowModal(true);
  }

  return (
    <>
      <div className={`rounded-2xl ${cardClass} p-5 flex flex-col gap-3 shadow-sm transition-shadow hover:shadow-md`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">{bill.name}</h2>
          </div>
          <StatusBadge status={status} daysUntil={daysUntil} />
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Due {dueDate}</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{bill.amountLabel}</span>
        </div>

        <button
          onClick={handlePayClick}
          className={`mt-1 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-4 py-2.5 transition-colors ${actionTokens.primary}`}
        >
          Start Workflow
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {showModal && (
        <LogPaymentModal
          bill={bill}
          onClose={() => setShowModal(false)}
          onLogged={() => {
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
