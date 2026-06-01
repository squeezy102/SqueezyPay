import { getBillStatus, getDaysUntilDue, formatDueDate } from "../utils/billUtils";

const categoryColors = {
  "Loans / Debt": "bg-purple-100 text-purple-700",
  "Internet / Phone": "bg-blue-100 text-blue-700",
  "Utilities": "bg-yellow-100 text-yellow-700",
  "Healthcare / Medical": "bg-green-100 text-green-700",
  "Education": "bg-indigo-100 text-indigo-700",
  "Housing": "bg-orange-100 text-orange-700",
  "Groceries": "bg-lime-100 text-lime-700",
  "Insurance": "bg-teal-100 text-teal-700",
  "Subscriptions / Streaming": "bg-pink-100 text-pink-700",
};

function getCategoryColor(category) {
  return categoryColors[category] ?? "bg-gray-100 text-gray-600";
}

function StatusBadge({ status, daysUntil }) {
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Overdue
      </span>
    );
  }
  if (status === "due-soon") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        {daysUntil === 0 ? "Due today" : `Due in ${daysUntil}d`}
      </span>
    );
  }
  return null;
}

export default function BillCard({ bill }) {
  const status = getBillStatus(bill.dayOfMonth);
  const daysUntil = getDaysUntilDue(bill.dayOfMonth);
  const dueDate = formatDueDate(bill.dayOfMonth);

  const borderClass =
    status === "overdue"
      ? "border-red-300 bg-red-50"
      : status === "due-soon"
      ? "border-amber-300 bg-amber-50"
      : "border-gray-200 bg-white";

  return (
    <div className={`rounded-2xl border ${borderClass} p-5 flex flex-col gap-3 shadow-sm transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-900 leading-tight">{bill.name}</h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${getCategoryColor(bill.category)}`}>
            {bill.category}
          </span>
        </div>
        <StatusBadge status={status} daysUntil={daysUntil} />
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Due {dueDate}</span>
        <span className="font-medium text-gray-700">{bill.amountLabel}</span>
      </div>

      <a
        href={bill.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
      >
        Pay Bill
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
        </svg>
      </a>
    </div>
  );
}
