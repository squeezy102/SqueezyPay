import { useState } from "react";
import { loginAuth } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { cardClass, actionTokens } from "../theme/tokens";

export default function LoginScreen() {
  const { login } = useAuth();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginAuth(passphrase);
      login(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setPassphrase("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className={`${cardClass} rounded-2xl shadow-lg w-full max-w-sm p-8`}>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center mb-1">
          SqueezyPay
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          Enter your household passphrase to continue.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="login-passphrase"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Passphrase
            </label>
            <input
              id="login-passphrase"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter your passphrase"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
              disabled={loading}
              autoFocus
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
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
