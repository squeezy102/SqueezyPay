// Design token definitions for SqueezyPay.
// All visual decisions live here. Components import from this file.
// To customize the look of the app, edit this file — not the components.

export const categoryTokens = {
  "Loans / Debt":              "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "Internet / Phone":          "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Utilities":                 "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Healthcare / Medical":      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "Education":                 "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "Housing":                   "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "Groceries":                 "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
  "Insurance":                 "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "Subscriptions / Streaming": "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  "Fast Food / Dining Out":    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "Convenience / Gas Station": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Online Shopping":           "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "Entertainment":             "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "Travel":                    "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "Personal Care":             "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "Kids":                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Miscellaneous":             "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

export const defaultCategoryToken = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";

export const statusTokens = {
  overdue: {
    card:   "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
    badge:  "text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-400",
    dot:    "bg-red-500 dark:bg-red-400",
    header: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    label:  "Overdue",
  },
  "due-soon": {
    card:   "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
    badge:  "text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400",
    dot:    "bg-amber-500 dark:bg-amber-400",
    header: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  upcoming: {
    card:   "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
  },
};

export const actionTokens = {
  primary: "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white",
};
