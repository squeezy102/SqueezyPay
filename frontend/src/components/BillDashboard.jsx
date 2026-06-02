import { useState, useEffect } from "react";
import { sortBillsByDueDate, getBillStatus, filterActionableBills } from "../utils/billUtils";
import { getBills } from "../utils/api";
import { statusTokens } from "../theme/tokens";
import BillCard from "./BillCard";

export default function BillDashboard() {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    getBills().then(setBills);
  }, []);

  const sorted     = sortBillsByDueDate(bills);
  const actionable = filterActionableBills(sorted);
  const hidden     = sorted.length - actionable.length;
  const overdue    = actionable.filter((b) => getBillStatus(b.dayOfMonth) === "overdue");
  const dueSoon    = actionable.filter((b) => getBillStatus(b.dayOfMonth) === "due-soon");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <div className="px-6 pt-5 flex gap-2">
          {overdue.length > 0 && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusTokens.overdue.header}`}>
              {overdue.length} overdue
            </span>
          )}
          {dueSoon.length > 0 && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusTokens["due-soon"].header}`}>
              {dueSoon.length} due soon
            </span>
          )}
        </div>
      )}

      <main className="px-6 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {actionable.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
        {hidden > 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
            {hidden} upcoming {hidden === 1 ? "bill" : "bills"} not due within 7 days
          </p>
        )}
      </main>
    </div>
  );
}
