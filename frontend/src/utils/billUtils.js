export function getDueDate(dayOfMonth) {
  const today = new Date();
  const due = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (due < today) {
    due.setMonth(due.getMonth() + 1);
  }
  return due;
}

export function getBillStatus(dayOfMonth) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = getDueDate(dayOfMonth);
  const daysUntil = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 7) return "due-soon";
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
