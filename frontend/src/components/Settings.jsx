import { useState, useEffect, useCallback, useRef } from "react";
import { getSettings, updateSettings, getCategories, createCategory, updateCategory } from "../utils/api";

// ── Pencil icon ───────────────────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

// ── Alert Thresholds section ──────────────────────────────────────────────────
function AlertThresholdsCard() {
  const [dueSoonDays, setDueSoonDays]               = useState("");
  const [largePaymentThreshold, setLargePayment]    = useState("");
  const [loading, setLoading]                       = useState(true);
  const [saving, setSaving]                         = useState(false);
  const [saved, setSaved]                           = useState(false);
  const [error, setError]                           = useState(null);
  const savedTimerRef                               = useRef(null);

  useEffect(() => {
    getSettings().then((data) => {
      if (data) {
        setDueSoonDays(String(data.dueSoonDays));
        setLargePayment(String(data.largePaymentThreshold));
      }
      setLoading(false);
    });
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await updateSettings({
      dueSoonDays:           Number(dueSoonDays),
      largePaymentThreshold: Number(largePaymentThreshold),
    });
    setSaving(false);
    if (!result) {
      setError("Save failed — check backend logs.");
      return;
    }
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alert Thresholds</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Controls when warnings appear on your dashboard
        </p>
      </div>

      <form onSubmit={handleSave} className="px-5 py-5 space-y-5">
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="w-52 shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
                Due Soon Warning
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={dueSoonDays}
                  onChange={(e) => setDueSoonDays(e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">days before due date</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="w-52 shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
                Large Payment Alert
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Flag payments over $</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={largePaymentThreshold}
                  onChange={(e) => setLargePayment(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
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
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors disabled:opacity-60"
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

// ── Category row (view or inline-edit) ────────────────────────────────────────
function CategoryRow({ category, onSaved }) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(category.name);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const inputRef                = useRef(null);

  function startEdit() {
    setDraft(category.name);
    setError(null);
    setEditing(true);
    // Focus after render
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
      if (result?.conflict) { setError("A category with that name already exists."); return; }
      if (result?.notFound)  { setError("Category not found."); return; }
      setEditing(false);
      onSaved();
    } catch {
      setSaving(false);
      setError("Save failed — check backend logs.");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter")  { e.preventDefault(); save(); }
    if (e.key === "Escape") { cancel(); }
  }

  if (editing) {
    return (
      <li className="px-4 py-3 flex flex-col gap-1.5 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={cancel}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
    <li className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 last:border-b-0 group">
      <span className="text-sm text-gray-800 dark:text-gray-200">{category.name}</span>
      <button
        onClick={startEdit}
        title="Edit category"
        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <PencilIcon />
      </button>
    </li>
  );
}

// ── Add category inline form ──────────────────────────────────────────────────
function AddCategoryForm({ onSaved, onCancel }) {
  const [name, setName]     = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const inputRef            = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    try {
      const result = await createCategory(trimmed);
      setSaving(false);
      if (result?.conflict) { setError("A category with that name already exists."); return; }
      setName("");
      onSaved();
    } catch {
      setSaving(false);
      setError("Save failed — check backend logs.");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter")  { e.preventDefault(); save(); }
    if (e.key === "Escape") { onCancel(); }
  }

  return (
    <li className="px-4 py-3 flex flex-col gap-1.5 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
        />
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [adding, setAdding]           = useState(false);

  const load = useCallback(async () => {
    const data = await getCategories();
    data.sort((a, b) => a.name.localeCompare(b.name));
    setCategories(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved() {
    setAdding(false);
    load();
  }

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Transaction Categories</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Used to classify bills and payments
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Category
          </button>
        )}
      </div>

      {loading ? (
        <p className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500">Loading…</p>
      ) : (
        <ul>
          {adding && (
            <AddCategoryForm onSaved={handleSaved} onCancel={() => setAdding(false)} />
          )}
          {categories.length === 0 && !adding ? (
            <li className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500 text-center">
              No categories yet.{" "}
              <button onClick={() => setAdding(true)} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Add the first one
              </button>
            </li>
          ) : (
            categories.map((cat) => (
              <CategoryRow key={cat.id} category={cat} onSaved={load} />
            ))
          )}
        </ul>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors px-6 py-5">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          App configuration and reference data
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <AlertThresholdsCard />
        <CategoriesCard />
      </div>
    </div>
  );
}
