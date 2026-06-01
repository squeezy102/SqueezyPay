import { getBillStatus, getDaysUntilDue, formatDueDate } from "../utils/billUtils";
import { categoryTokens, defaultCategoryToken, statusTokens, actionTokens } from "../theme/tokens";

function StatusBadge({ status, daysUntil }) {
  const tokens = statusTokens[status];
  if (!tokens?.badge) return null;

  const label =
    status === "overdue"
      ? "Overdue"
      : daysUntil === 0
      ? "Due today"
      : `Due in ${daysUntil}d`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${tokens.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${tokens.dot}`} />
      {label}
    </span>
  );
}

export default function BillCard({ bill }) {
  const status = getBillStatus(bill.dayOfMonth);
  const daysUntil = getDaysUntilDue(bill.dayOfMonth);
  const dueDate = formatDueDate(bill.dayOfMonth);

  const cardClass = statusTokens[status]?.card ?? statusTokens.upcoming.card;
  const categoryClass = categoryTokens[bill.category] ?? defaultCategoryToken;

  return (
    <div className={`rounded-2xl border ${cardClass} p-5 flex flex-col gap-3 shadow-sm transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">{bill.name}</h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${categoryClass}`}>
            {bill.category}
          </span>
        </div>
        <StatusBadge status={status} daysUntil={daysUntil} />
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>Due {dueDate}</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">{bill.amountLabel}</span>
      </div>

      <a
        href={bill.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-1 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-4 py-2.5 transition-colors ${actionTokens.primary}`}
      >
        Pay Bill
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
        </svg>
      </a>
    </div>
  );
}
