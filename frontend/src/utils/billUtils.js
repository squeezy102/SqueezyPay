export function getDueDate(dayOfMonth) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (thisMonth < today) {
    return new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
  }
  return thisMonth;
}

// Returns the due date anchored to the current calendar month — no rollover.
// Used to detect overdue status (past this month's due day, unpaid).
function getCurrentCycleDueDate(dayOfMonth) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
}

export function getBillStatus(dayOfMonth, dueSoonDays = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentCycleDue = getCurrentCycleDueDate(dayOfMonth);
  if (currentCycleDue < today) return "overdue";
  const daysUntil = Math.ceil((currentCycleDue - today) / (1000 * 60 * 60 * 24));
  if (daysUntil <= dueSoonDays) return "due-soon";
  return "upcoming";
}

export function getDaysUntilDue(dayOfMonth) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = getDueDate(dayOfMonth);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

export function formatDueDate(dayOfMonth) {
  const due = getDueDate(dayOfMonth);
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function sortBillsByDueDate(bills) {
  return [...bills].sort((a, b) => getDaysUntilDue(a.dayOfMonth) - getDaysUntilDue(b.dayOfMonth));
}

// Returns bills that are overdue or due within windowDays. Default 7.
export function filterActionableBills(bills, windowDays = 7) {
  return bills.filter((b) => {
    const days = getDaysUntilDue(b.dayOfMonth);
    return days <= windowDays;
  });
}
