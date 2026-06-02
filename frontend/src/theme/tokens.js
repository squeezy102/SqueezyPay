// Design token definitions for SqueezyPay.
// All visual decisions live here. Components import from this file.
// To customize the look of the app, edit this file — not the components.

export const categoryTokens = {
  "Loans / Debt":              "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "Internet / Phone":          "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "Utilities":                 "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Healthcare / Medical":      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Education":                 "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "Housing":                   "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "Groceries":                 "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
  "Insurance":                 "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "Subscriptions / Streaming": "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  "Fast Food / Dining Out":    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "Convenience / Gas Station": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Online Shopping":           "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "Entertainment":             "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "Travel":                    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Personal Care":             "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "Kids":                      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "Miscellaneous":             "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export const defaultCategoryToken = "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

export const cardClass = "border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800";

export const statusTokens = {
  overdue: {
    badge:  "text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-400",
    dot:    "bg-red-500 dark:bg-red-400",
  },
  "due-soon": {
    badge:  "text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400",
    dot:    "bg-amber-500 dark:bg-amber-400",
  },
  upcoming: {},
};

// SNES teal-green for primary actions (the A button)
export const actionTokens = {
  primary: "bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white",
};

export const alertThresholds = {
  dueSoonDays: 7,
  largePaymentAmount: 500,
};

export const alertBannerTokens = {
  overdue: {
    bar:  "bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700",
    icon: "text-red-500 dark:text-red-400",
    text: "text-slate-700 dark:text-slate-300",
  },
  "due-soon": {
    bar:  "bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700",
    icon: "text-amber-500 dark:text-amber-400",
    text: "text-slate-700 dark:text-slate-300",
  },
  "large-payment": {
    bar:  "bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700",
    icon: "text-violet-500 dark:text-violet-400",
    text: "text-slate-700 dark:text-slate-300",
  },
};
