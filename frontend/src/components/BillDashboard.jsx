import { useState, useEffect } from "react";
import { sortBillsByDueDate, getBillStatus } from "../utils/billUtils";
import { getBills } from "../utils/api";
import { useTheme } from "../context/ThemeContext";
import { statusTokens } from "../theme/tokens";
import BillCard from "./BillCard";

function DarkModeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-full p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {dark ? (
        // Sun icon
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.166 17.834a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06l-1.59-1.591zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 6.166a.75.75 0 001.06 1.06l1.59-1.59a.75.75 0 00-1.06-1.061L6.166 6.166z" />
        </svg>
      ) : (
        // Moon icon
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

export default function BillDashboard() {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    getBills().then(setBills);
  }, []);

  const sorted = sortBillsByDueDate(bills);
  const overdue = sorted.filter((b) => getBillStatus(b.dayOfMonth) === "overdue");
  const dueSoon = sorted.filter((b) => getBillStatus(b.dayOfMonth) === "due-soon");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">SqueezyPay</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Household Bills</p>
          </div>
          <div className="flex items-center gap-2">
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
            <DarkModeToggle />
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
