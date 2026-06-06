import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPlaidItems,
  getPlaidAccounts,
  syncPlaidBalances,
  syncPlaidTransactions,
  disconnectPlaidItem,
} from "../utils/api";
import type { PlaidItem, PlaidAccount } from "../types";
import PlaidLinkButton from "./PlaidLinkButton";
import TransactionTable from "./TransactionTable";
import SpendingBlame from "./SpendingBlame";

function formatBalance(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  return `Synced ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// ── Connected Banks section ───────────────────────────────────────────────────

function ConnectedBanks({ items }: { items: PlaidItem[] }) {
  const queryClient = useQueryClient();
  const [syncingBalances, setSyncingBalances] = useState<number | null>(null);
  const [syncingTx, setSyncingTx] = useState<number | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: number; msg: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<number | null>(null);

  const disconnectMutation = useMutation({
    mutationFn: (id: number) => disconnectPlaidItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plaid"] });
      setConfirmDisconnect(null);
    },
  });

  async function handleSyncBalances(item: PlaidItem) {
    setSyncingBalances(item.id);
    try {
      await syncPlaidBalances(item.id);
      void queryClient.invalidateQueries({ queryKey: ["plaid", "accounts"] });
    } finally {
      setSyncingBalances(null);
    }
  }

  async function handleSyncTransactions(item: PlaidItem) {
    setSyncingTx(item.id);
    setSyncResult(null);
    try {
      const result = await syncPlaidTransactions(item.id, 30);
      setSyncResult({ id: item.id, msg: `+${result.added} new, ${result.updated} updated` });
      void queryClient.invalidateQueries({ queryKey: ["plaid", "transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["plaid", "blame"] });
    } finally {
      setSyncingTx(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-8 flex flex-col items-center gap-3 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
        <p className="text-sm text-slate-500 dark:text-slate-400">No banks connected yet</p>
        <PlaidLinkButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {item.institutionName ?? "Connected Institution"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Connected {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</p>
            {syncResult?.id === item.id && (
              <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">{syncResult.msg}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSyncBalances(item)}
              disabled={syncingBalances === item.id}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {syncingBalances === item.id ? "Syncing…" : "Sync Balances"}
            </button>
            <button
              onClick={() => handleSyncTransactions(item)}
              disabled={syncingTx === item.id}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {syncingTx === item.id ? "Syncing…" : "Sync Transactions"}
            </button>
            {confirmDisconnect === item.id ? (
              <>
                <button
                  onClick={() => disconnectMutation.mutate(item.id)}
                  disabled={disconnectMutation.isPending}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDisconnect(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDisconnect(item.id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="pt-1">
        <PlaidLinkButton label="Connect Another Bank" />
      </div>
    </div>
  );
}

// ── Account Balances section ──────────────────────────────────────────────────

function AccountBalances({ accounts }: { accounts: PlaidAccount[] }) {
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
        No accounts to display. Connect a bank and sync balances.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {accounts.map((acct) => (
        <div key={acct.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{acct.name}</p>
              {acct.institutionName && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{acct.institutionName}</p>
              )}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 capitalize shrink-0">
              {acct.subtype ?? acct.type}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Current</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatBalance(acct.currentBalance)}</span>
            </div>
            {acct.availableBalance != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Available</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{formatBalance(acct.availableBalance)}</span>
              </div>
            )}
            {acct.mask && (
              <p className="text-xs text-slate-400 dark:text-slate-500">···{acct.mask}</p>
            )}
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">{formatSyncTime(acct.balanceSyncedAt)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

// ── Main Accounts tab ─────────────────────────────────────────────────────────

type AccountsTab = "overview" | "transactions" | "spending";

export default function Accounts() {
  const [activeTab, setActiveTab] = useState<AccountsTab>("overview");

  const { data: items = [], isLoading: itemsLoading } = useQuery<PlaidItem[]>({
    queryKey: ["plaid", "items"],
    queryFn: getPlaidItems,
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<PlaidAccount[]>({
    queryKey: ["plaid", "accounts"],
    queryFn: getPlaidAccounts,
  });

  const subTabs: { id: AccountsTab; label: string }[] = [
    { id: "overview",     label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "spending",     label: "Spending" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bank Accounts</h1>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-violet-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <Section title="Connected Banks">
            {itemsLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <ConnectedBanks items={items} />
            )}
          </Section>

          <Section title="Account Balances">
            {accountsLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <AccountBalances accounts={accounts} />
            )}
          </Section>
        </>
      )}

      {activeTab === "transactions" && (
        <Section title="Transaction History">
          <TransactionTable />
        </Section>
      )}

      {activeTab === "spending" && (
        <Section title="Spending Analysis">
          <SpendingBlame />
        </Section>
      )}
    </div>
  );
}
