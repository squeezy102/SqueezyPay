import type { Bill, BillStatus } from "../types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function getDueDate(dayOfMonth: number): Date {
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
function getCurrentCycleDueDate(dayOfMonth: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
}

export function getBillStatus(dayOfMonth: number, dueSoonDays = 7 /* fallback until settings load */): BillStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentCycleDue = getCurrentCycleDueDate(dayOfMonth);
  if (currentCycleDue < today) return "overdue";
  const daysUntil = Math.ceil((currentCycleDue.getTime() - today.getTime()) / MS_PER_DAY);
  if (daysUntil <= dueSoonDays) return "due-soon";
  return "upcoming";
}

export function getDaysUntilDue(dayOfMonth: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = getDueDate(dayOfMonth);
  return Math.ceil((due.getTime() - today.getTime()) / MS_PER_DAY);
}

export function formatDueDate(dayOfMonth: number): string {
  const due = getDueDate(dayOfMonth);
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function sortBillsByDueDate(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => getDaysUntilDue(a.dayOfMonth) - getDaysUntilDue(b.dayOfMonth));
}

export function filterActionableBills(bills: Bill[], windowDays = 7): Bill[] {
  return bills.filter((b) => {
    const days = getDaysUntilDue(b.dayOfMonth);
    return days <= windowDays;
  });
}
