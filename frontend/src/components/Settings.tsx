import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings, getCategories, createCategory, updateCategory, changePassphrase } from "../utils/api";
import type { Category } from "../types";

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

// ── Alert Thresholds section ──────────────────────────────────────────────────
function AlertThresholdsCard() {
  const queryClient = useQueryClient();
  const [dueSoonDays, setDueSoonDays]            = useState("");
  const [largePaymentThreshold, setLargePayment] = useState("");
  const [saving, setSaving]                      = useState(false);
  const [saved, setSaved]                        = useState(false);
  const [error, setError]                        = useState<string | null>(null);
  const savedTimerRef                            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized                              = useRef(false);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn:  getSettings,
  });

  useEffect(() => {
    if (settingsQuery.data && !initialized.current) {
      setDueSoonDays(String(settingsQuery.data.dueSoonDays));
      setLargePayment(String(settingsQuery.data.largePaymentThreshold));
      initialized.current = true;
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const saveMutation = useMutation({
    mutationFn: (payload: { dueSoonDays: number; largePaymentThreshold: number }) =>
      updateSettings(payload),
    onSuccess: (result) => {
      setSaving(false);
      if (!result) {
        setError("Save failed — check backend logs.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      setSaving(false);
      setError("Save failed — check backend logs.");
    },
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    saveMutation.mutate({
      dueSoonDays:           Number(dueSoonDays),
      largePaymentThreshold: Number(largePaymentThreshold),
    });
  }

  const loading = settingsQuery.isLoading;

  return (
    <section className="rounded-xl border border-violet-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-violet-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Alert Thresholds</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Controls when warnings appear on your dashboard
        </p>
      </div>

      <form onSubmit={handleSave} className="px-5 py-5 space-y-5">
        {loading ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label htmlFor="settings-due-soon-days" className="w-52 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
                Due Soon Warning
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="settings-due-soon-days"
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={dueSoonDays}
                  onChange={(e) => setDueSoonDays(e.target.value)}
                  className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">days before due date</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label htmlFor="settings-large-payment-threshold" className="w-52 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
                Large Payment Alert
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Flag payments over $</span>
                <input
                  id="settings-large-payment-threshold"
                  type="number"
                  min="1"
                  required
                  value={largePaymentThreshold}
                  onChange={(e) => setLargePayment(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Saved</span>
              )}
            </div>
          </>
        )}
      </form>
    </section>
  );
}

// ── Category row ──────────────────────────────────────────────────────────────
interface CategoryRowProps {
  category: Category;
  onSaved: () => void;
}

function CategoryRow({ category, onSaved }: CategoryRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(category.name);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(category.name);
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === category.name) { cancel(); return; }
    setError(null);
    setSaving(true);
    try {
      const result = await updateCategory(category.id, trimmed);
      setSaving(false);
      if (result && "conflict" in result) { setError("A category with that name already exists."); return; }
      if (result && "notFound" in result) { setError("Category not found."); return; }
      setEditing(false);
      onSaved();
    } catch {
      setSaving(false);
      setError("Save failed — check backend logs.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter")  { e.preventDefault(); save(); }
    if (e.key === "Escape") { cancel(); }
  }

  if (editing) {
    return (
      <li className="px-4 py-3 flex flex-col gap-1.5 border-b border-violet-100 dark:border-slate-700 last:border-b-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400"
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={cancel}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 ml-1">{error}</p>
        )}
      </li>
    );
  }

  return (
    <li className="px-4 py-3 flex items-center justify-between border-b border-violet-100 dark:border-slate-700 last:border-b-0 group">
      <span className="text-sm text-slate-800 dark:text-slate-200">{category.name}</span>
      <button
        onClick={startEdit}
        title="Edit category"
        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-400 dark:hover:bg-violet-900/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <PencilIcon />
      </button>
    </li>
  );
}

// ── Add category inline form ──────────────────────────────────────────────────
interface AddCategoryFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

function AddCategoryForm({ onSaved, onCancel }: AddCategoryFormProps) {
  const [name, setName]     = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    try {
      const result = await createCategory(trimmed);
      setSaving(false);
      if (result && "conflict" in result) { setError("A category with that name already exists."); return; }
      setName("");
      onSaved();
    } catch {
      setSaving(false);
      setError("Save failed — check backend logs.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter")  { e.preventDefault(); save(); }
    if (e.key === "Escape") { onCancel(); }
  }

  return (
    <li className="px-4 py-3 flex flex-col gap-1.5 border-b border-violet-100 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400"
        />
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 ml-1">{error}</p>
      )}
    </li>
  );
}

// ── Transaction Categories section ────────────────────────────────────────────
function CategoriesCard() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn:  async () => {
      const data = await getCategories();
      data.sort((a, b) => a.name.localeCompare(b.name));
      return data;
    },
  });

  const categories = categoriesQuery.data ?? [];
  const loading    = categoriesQuery.isLoading;

  function handleSaved() {
    setAdding(false);
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <section className="rounded-xl border border-violet-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-violet-100 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Transaction Categories</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Used to classify bills and payments
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Category
          </button>
        )}
      </div>

      {loading ? (
        <p className="px-5 py-4 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
      ) : (
        <ul>
          {adding && (
            <AddCategoryForm onSaved={handleSaved} onCancel={() => setAdding(false)} />
          )}
          {categories.length === 0 && !adding ? (
            <li className="px-5 py-6 text-sm text-slate-400 dark:text-slate-500 text-center">
              No categories yet.{" "}
              <button onClick={() => setAdding(true)} className="text-violet-600 dark:text-violet-400 hover:underline">
                Add the first one
              </button>
            </li>
          ) : (
            categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["categories"] })}
              />
            ))
          )}
        </ul>
      )}
    </section>
  );
}

// ── Change Passphrase section ─────────────────────────────────────────────────
function ChangePassphraseCard() {
  const [current, setCurrent]       = useState("");
  const [next, setNext]             = useState("");
  const [confirm, setConfirm]       = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const savedTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const changeMutation = useMutation({
    mutationFn: () => changePassphrase(current, next),
    onSuccess: () => {
      setSaving(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: Error) => {
      setSaving(false);
      setError(err.message ?? "Change failed — check backend logs.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New passphrases do not match.");
      return;
    }
    if (next.length < 8) {
      setError("New passphrase must be at least 8 characters.");
      return;
    }
    setSaving(true);
    changeMutation.mutate();
  }

  return (
    <section className="rounded-xl border border-violet-100 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-violet-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Change Passphrase</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Update the household passphrase used to log in
        </p>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off" className="px-5 py-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="settings-current-passphrase" className="w-52 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
            Current Passphrase
          </label>
          <input
            id="settings-current-passphrase"
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full sm:w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="settings-new-passphrase" className="w-52 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
            New Passphrase
          </label>
          <input
            id="settings-new-passphrase"
            type="password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full sm:w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="settings-confirm-passphrase" className="w-52 shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
            Confirm New Passphrase
          </label>
          <input
            id="settings-confirm-passphrase"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full sm:w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors disabled:opacity-60"
          >
            {saving ? "Updating…" : "Update Passphrase"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">Passphrase updated</span>
          )}
        </div>
      </form>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 transition-colors px-6 py-5">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          App configuration and reference data
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <AlertThresholdsCard />
        <CategoriesCard />
        <ChangePassphraseCard />
      </div>
    </div>
  );
}
