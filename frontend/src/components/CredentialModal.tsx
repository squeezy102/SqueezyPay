import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCredentialByBill, saveCredential, deleteCredential } from "../utils/api";
import type { Bill } from "../types";
import Spinner from "./Spinner";

interface Props {
  bill: Bill;
  onClose: () => void;
}

export default function CredentialModal({ bill, onClose }: Props) {
  const queryClient                     = useQueryClient();
  const [username, setUsername]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const credQuery = useQuery({
    queryKey: ["credentials", "bill", bill.id],
    queryFn:  () => getCredentialByBill(bill.id),
  });

  useEffect(() => {
    if (credQuery.data) {
      setUsername(credQuery.data.username ?? "");
      setPassword(credQuery.data.password ?? "");
    }
  }, [credQuery.data]);

  const existingId = credQuery.data?.id ?? null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError("Username and password are required."); return; }
    setSaving(true);
    setError(null);
    const result = await saveCredential(bill.id, username.trim(), password, existingId);
    setSaving(false);
    if (!result) { setError("Save failed — check backend logs."); return; }
    queryClient.invalidateQueries({ queryKey: ["credentials", "bill", bill.id] });
    onClose();
  }

  async function handleDelete() {
    if (!existingId) return;
    setSaving(true);
    await deleteCredential(existingId);
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["credentials", "bill", bill.id] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Credentials</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{bill.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {credQuery.isLoading ? (
          <div className="px-5 py-8 flex justify-center"><Spinner /></div>
        ) : (
          <form onSubmit={handleSave} autoComplete="off" className="px-5 py-4 flex flex-col gap-4">
            {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Username / Email</label>
              <input
                autoFocus
                type="text"
                autoComplete="one-time-code"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Password</label>
              <div className="relative">
                <input
                  type="text"
                  autoComplete="one-time-code"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={showPassword ? undefined : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {existingId ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:underline disabled:opacity-50"
                >
                  Remove credentials
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-60">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
