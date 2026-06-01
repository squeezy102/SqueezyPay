import { useState, useEffect } from "react";
import { sortBillsByDueDate, getBillStatus } from "../utils/billUtils";
import { getBills } from "../utils/api";
import BillCard from "./BillCard";

export default function BillDashboard() {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    getBills().then(setBills);
  }, []);

  const sorted = sortBillsByDueDate(bills);
  const overdue = sorted.filter((b) => getBillStatus(b.dayOfMonth) === "overdue");
  const dueSoon = sorted.filter((b) => getBillStatus(b.dayOfMonth) === "due-soon");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">SqueezyPay</h1>
            <p className="text-xs text-gray-400 mt-0.5">Household Bills</p>
          </div>
          <div className="flex gap-2">
            {overdue.length > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                {overdue.length} overdue
              </span>
            )}
            {dueSoon.length > 0 && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                {dueSoon.length} due soon
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      </main>
    </div>
  );
}
