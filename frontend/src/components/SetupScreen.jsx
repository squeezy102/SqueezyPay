import { useState } from "react";
import { setupAuth } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { cardClass, actionTokens } from "../theme/tokens";

export default function SetupScreen() {
  const { login, setIsConfigured } = useAuth();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases do not match.");
      return;
    }

    setLoading(true);
    try {
      const data = await setupAuth(passphrase);
      setIsConfigured(true);
      login(data.access_token);
    } catch (err) {
      setError(err.message || "Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className={`${cardClass} rounded-2xl shadow-lg w-full max-w-sm p-8`}>
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="SqueezyPay" className="h-16 object-contain" />
        </div>

        {/* Headings */}
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center mb-1">
          Welcome to SqueezyPay
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          Create a household passphrase to secure your financial data.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="setup-passphrase"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Passphrase
            </label>
            <input
              id="setup-passphrase"
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label
              htmlFor="setup-confirm"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Confirm Passphrase
            </label>
            <input
              id="setup-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your passphrase"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`${actionTokens.primary} w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? "Creating…" : "Create Passphrase"}
          </button>
        </form>
      </div>
    </div>
  );
}
