import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPlaidTransactions, getPlaidAccounts, assignPlaidTransactionCategory, getCategories } from "../utils/api";
import type { PlaidTransaction, PlaidAccount, Category } from "../types";

type SortKey = "date" | "name" | "amount";
type SortDir = "asc" | "desc";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(amount));
}

function AmountCell({ amount }: { amount: number }) {
  const isCredit = amount < 0;
  return (
    <span className={isCredit ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"}>
      {isCredit ? `+${formatAmount(amount)}` : formatAmount(amount)}
    </span>
  );
}

interface CategorySelectProps {
  txId: number;
  categoryId: number | null;
  categories: Category[];
}

function CategorySelect({ txId, categoryId, categories }: CategorySelectProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (catId: number) => assignPlaidTransactionCategory(txId, catId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plaid", "transactions"] }),
  });

  return (
    <select
      value={categoryId ?? ""}
      onChange={(e) => {
        const val = Number(e.target.value);
        if (val) mutation.mutate(val);
      }}
      disabled={mutation.isPending}
      className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
    >
      <option value="">Uncategorized</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}

interface FilterState {
  accountId: string;
  startDate: string;
  endDate: string;
}

const PAGE_SIZE = 50;

export default function TransactionTable() {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<FilterState>({ accountId: "", startDate: "", endDate: "" });

  const { data: accounts = [] } = useQuery<PlaidAccount[]>({
    queryKey: ["plaid", "accounts"],
    queryFn: getPlaidAccounts,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["plaid", "transactions", { page, sortKey, sortDir, filters }],
    queryFn: () =>
      getPlaidTransactions({
        accountId: filters.accountId ? Number(filters.accountId) : undefined,
        startDate: filters.startDate || undefined,
        endDate:   filters.endDate   || undefined,
        limit:     PAGE_SIZE,
        offset:    page * PAGE_SIZE,
      }),
  });

  const transactions: PlaidTransaction[] = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-slate-400">↕</span>;
    return <span className="text-violet-500">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  if (isError) {
    return <p className="text-sm text-red-600 dark:text-red-400 px-4 py-3">Failed to load transactions.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Account</label>
          <select
            value={filters.accountId}
            onChange={(e) => { setFilters((f) => ({ ...f, accountId: e.target.value })); setPage(0); }}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} {a.mask ? `(···${a.mask})` : ""}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">From</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => { setFilters((f) => ({ ...f, startDate: e.target.value })); setPage(0); }}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">To</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => { setFilters((f) => ({ ...f, endDate: e.target.value })); setPage(0); }}
            className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        {(filters.accountId || filters.startDate || filters.endDate) && (
          <button
            onClick={() => { setFilters({ accountId: "", startDate: "", endDate: "" }); setPage(0); }}
            className="text-xs text-violet-600 dark:text-violet-400 hover:underline self-end pb-1.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden flex flex-col gap-2">
        {isLoading && <p className="text-sm text-slate-500 py-4 text-center">Loading…</p>}
        {!isLoading && transactions.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No transactions found.</p>
        )}
        {transactions.map((tx) => {
          const acct = accountMap.get(tx.plaidAccountId);
          return (
            <div key={tx.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{tx.merchantName ?? tx.name}</p>
                  {acct && <p className="text-xs text-slate-500 dark:text-slate-400">{acct.name}</p>}
                </div>
                <AmountCell amount={tx.amount} />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{tx.date}</span>
                {tx.pending && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Pending</span>}
              </div>
              <CategorySelect txId={tx.id} categoryId={tx.categoryId} categories={categories} />
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-violet-600 select-none whitespace-nowrap"
                onClick={() => toggleSort("date")}
                aria-sort={sortKey === "date" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Date <SortIcon col="date" />
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-violet-600 select-none"
                onClick={() => toggleSort("name")}
                aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Merchant <SortIcon col="name" />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Account</th>
              <th
                className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-violet-600 select-none whitespace-nowrap"
                onClick={() => toggleSort("amount")}
                aria-sort={sortKey === "amount" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Amount <SortIcon col="amount" />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Category</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Channel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading…</td>
              </tr>
            )}
            {!isLoading && transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No transactions found.
                </td>
              </tr>
            )}
            {transactions.map((tx) => {
              const acct = accountMap.get(tx.plaidAccountId);
              return (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{tx.date}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900 dark:text-white font-medium">{tx.merchantName ?? tx.name}</p>
                    {tx.merchantName && tx.merchantName !== tx.name && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{tx.name}</p>
                    )}
                    {tx.pending && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {acct ? `${acct.name}${acct.mask ? ` ···${acct.mask}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <AmountCell amount={tx.amount} />
                  </td>
                  <td className="px-4 py-3 min-w-[150px]">
                    <CategorySelect txId={tx.id} categoryId={tx.categoryId} categories={categories} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 capitalize">
                    {tx.paymentChannel?.replace("_", " ") ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>{total} transactions</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Previous
            </button>
            <span>Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
