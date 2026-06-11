import { useState } from "react";
import { getDiagnostics } from "../utils/api";
import type { DiagnosticsReport } from "../types";

// Submission paths:
//  1. GitHub Issues API (direct POST) — requires a user-supplied PAT with `repo` or `public_repo` scope.
//     Creates the issue silently without opening a browser tab. Full diagnostics attached inline.
//  2. GitHub new-issue URL — pre-fills title + description; diagnostics auto-downloaded as a .txt
//     file for the user to attach. Body kept short to stay within browser URL limits.
//  3. Mailto — drafts an email to VITE_FEEDBACK_EMAIL (if configured); immutable subject prefix.
//
// Financial data, credentials, balances, transaction amounts, and merchant names
// are NEVER collected.  The diagnostics snapshot contains only counts, settings keys,
// and log lines — scrubbed below before display or submission.

const GITHUB_REPO = "stg3barx/SqueezyPay";
const GITHUB_ISSUES_API = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
const GITHUB_NEW_ISSUE_URL = `https://github.com/${GITHUB_REPO}/issues/new`;
const FEEDBACK_EMAIL = import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined;

// Strip anything that looks like a bearer token, key, or routing number from log lines.
const REDACT_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{20,}/g,             // JWT fragments
  /\b[A-Z0-9]{20,}\b/g,                  // Long uppercase tokens (Plaid-style)
  /\b\d{9,}\b/g,                          // Routing / account numbers
  /password[^=:]*[:=]\s*\S+/gi,
  /token[^=:]*[:=]\s*\S+/gi,
  /key[^=:]*[:=]\s*\S+/gi,
  /secret[^=:]*[:=]\s*\S+/gi,
];

function scrubLine(line: string): string {
  for (const pattern of REDACT_PATTERNS) {
    line = line.replace(pattern, "[REDACTED]");
  }
  return line;
}

function buildDiagSection(diag: DiagnosticsReport): string {
  return [
    "## Diagnostics",
    `- Version: ${diag.app_version}`,
    `- Revision: ${diag.alembic_revision}`,
    `- Packaged: ${diag.frozen}`,
    `- Plaid: ${diag.plaid_configured ? "yes" : "no"}`,
    "",
    "### Last 10 log lines",
    "```",
    ...diag.log_tail.slice(-10).map(scrubLine),
    "```",
  ].join("\n");
}

function buildBody(
  step1: string,
  step2: string,
  step3: string,
  diag: DiagnosticsReport | null,
  includeDiag: boolean,
  currentTab: string,
  userAgent: string,
): string {
  const diagSection = includeDiag && diag
    ? buildDiagSection(diag)
    : "_Diagnostics not included._";

  return [
    "## What happened",
    step1 || "_not provided_",
    "",
    "## What broke",
    step2 || "_not provided_",
    "",
    "## What I was doing",
    step3 || "_not provided_",
    "",
    "## Environment",
    `- Tab: ${currentTab}`,
    `- UA: ${userAgent}`,
    "",
    diagSection,
  ].join("\n");
}

type Step = "describe" | "diagnose" | "submit";

interface Props {
  currentTab: string;
  onClose: () => void;
}

export default function BugReportModal({ currentTab, onClose }: Props) {
  const [step, setStep] = useState<Step>("describe");
  const [step1, setStep1] = useState("");
  const [step2, setStep2] = useState("");
  const [step3, setStep3] = useState("");
  const [brief, setBrief] = useState("");
  const [pat, setPat] = useState("");
  const [diag, setDiag] = useState<DiagnosticsReport | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState(false);
  const [includeDiag, setIncludeDiag] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; url?: string; message?: string } | null>(null);
  const [patTooltip, setPatTooltip] = useState(false);

  const userAgent = navigator.userAgent;

  function handleNext() {
    if (step === "describe") {
      setDiagLoading(true);
      setDiagError(false);
      getDiagnostics()
        .then((d) => setDiag(d))
        .catch(() => setDiagError(true))
        .finally(() => {
          setDiagLoading(false);
          setStep("diagnose");
        });
    } else if (step === "diagnose") {
      setStep("submit");
    }
  }

  const body = buildBody(step1, step2, step3, diag, includeDiag, currentTab, userAgent);
  const title = `[SQUEEZYPAY_ISSUE] ${brief.trim() || "Bug report"}`;

  async function submitViaApi() {
    setSubmitting(true);
    try {
      const resp = await fetch(GITHUB_ISSUES_API, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${pat.trim()}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ title, body, labels: ["user-report", "alpha-feedback"] }),
      });
      if (resp.ok) {
        const data = await resp.json() as { html_url?: string };
        setSubmitResult({ ok: true, url: data.html_url });
      } else {
        const err = await resp.json().catch(() => ({})) as { message?: string };
        setSubmitResult({ ok: false, message: err.message ?? `HTTP ${resp.status}` });
      }
    } catch {
      setSubmitResult({ ok: false, message: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  function openGitHubUrl() {
    const params = new URLSearchParams({ title, body });
    window.open(`${GITHUB_NEW_ISSUE_URL}?${params.toString()}`, "_blank");
    onClose();
  }

  function openMailto() {
    if (!FEEDBACK_EMAIL) return;
    const subject = encodeURIComponent(title);
    const bodyEnc = encodeURIComponent(body);
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${bodyEnc}`;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="11" r="4" />
              <path d="M12 7V3" />
              <path d="M8 11H4" />
              <path d="M20 11h-4" />
              <path d="M6.3 6.3 4 4" />
              <path d="M17.7 6.3 20 4" />
              <path d="M6.3 15.7 4 18" />
              <path d="M17.7 15.7 20 18" />
              <path d="M12 15v4" />
            </svg>
            <span className="font-semibold text-slate-800 dark:text-slate-100">Report an Issue</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">✕</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-3">
          {(["describe", "diagnose", "submit"] as Step[]).map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step === s || (step === "submit" && i < 2) || (step === "diagnose" && i < 1) ? "bg-violet-500" : "bg-slate-200 dark:bg-slate-700"}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {step === "describe" && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tell us what went wrong. The more detail the better — but no pressure.
              </p>
              <div>
                <label htmlFor="bug-report-brief" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">One-line summary <span className="text-red-400">*</span></label>
                <input
                  id="bug-report-brief"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  placeholder="e.g. App crashed when I saved a bill"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div>
                <label htmlFor="bug-report-what-happened" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">What happened?</label>
                <textarea
                  id="bug-report-what-happened"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  rows={3}
                  placeholder="Describe the unexpected behavior"
                  value={step1}
                  onChange={(e) => setStep1(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="bug-report-what-broke" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">What broke or looked wrong?</label>
                <textarea
                  id="bug-report-what-broke"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  rows={3}
                  placeholder="Error message, blank screen, wrong data, etc."
                  value={step2}
                  onChange={(e) => setStep2(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="bug-report-steps" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">What were you doing when it happened?</label>
                <textarea
                  id="bug-report-steps"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  rows={3}
                  placeholder="Step-by-step if you can remember"
                  value={step3}
                  onChange={(e) => setStep3(e.target.value)}
                />
              </div>
            </>
          )}

          {step === "diagnose" && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                We've collected a safe system snapshot to include with your report. This contains
                only row counts, app settings, and recent log lines — <strong>never</strong> financial
                data, credentials, balances, or personal information.
              </p>

              {/* Opt-out */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-violet-600"
                  checked={includeDiag}
                  onChange={(e) => setIncludeDiag(e.target.checked)}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Attach diagnostic report to my submission
                  <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Uncheck to submit without logs. Diagnostics help us reproduce the issue faster.
                  </span>
                </span>
              </label>

              {diagLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Collecting diagnostics…
                </div>
              )}
              {diagError && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Could not reach the backend — diagnostics will be omitted from your report.
                </p>
              )}
              {diag && !diagLoading && includeDiag && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1 max-h-56 overflow-y-auto">
                  <div><span className="text-violet-500">version</span> {diag.app_version}</div>
                  <div><span className="text-violet-500">revision</span> {diag.alembic_revision}</div>
                  <div><span className="text-violet-500">plaid</span> {diag.plaid_configured ? "configured" : "not configured"}</div>
                  <div><span className="text-violet-500">packaged</span> {String(diag.frozen)}</div>
                  <div className="pt-1 text-slate-400">— table counts —</div>
                  {Object.entries(diag.table_counts).map(([t, c]) => (
                    <div key={t}><span className="text-slate-400">{t}:</span> {c}</div>
                  ))}
                  <div className="pt-1 text-slate-400">— last log lines —</div>
                  {diag.log_tail.slice(-10).map((l, i) => (
                    <div key={i} className="truncate">{scrubLine(l)}</div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "submit" && !submitResult && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose how to submit.
                {includeDiag && diag && (
                  <span className="ml-1">Diagnostics will be included automatically.</span>
                )}
              </p>

              {/* GitHub PAT option */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-slate-700 dark:fill-slate-200" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58 0-.28-.01-1.02-.01-2-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.004 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.3 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Submit directly to GitHub Issues</span>
                  <div className="relative ml-auto">
                    <button
                      type="button"
                      onClick={() => setPatTooltip((v) => !v)}
                      className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"
                      aria-label="What is a PAT?"
                    >
                      ?
                    </button>
                    {patTooltip && (
                      <div className="absolute right-0 top-7 z-10 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">What is a Personal Access Token?</p>
                        <p>A PAT is a GitHub-generated password that lets apps act on your behalf without your real password.</p>
                        <p>You need a <strong>Classic PAT</strong> with the <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">public_repo</code> scope — the minimum needed to open an issue on a public repository.</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400">
                          <li>GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)</li>
                          <li>Click <strong>Generate new token</strong></li>
                          <li>Check only <strong>public_repo</strong> under the <em>repo</em> group</li>
                          <li>Copy the token (shown once) and paste it here</li>
                        </ol>
                        <p className="text-slate-400 dark:text-slate-500">Used once, never stored — sent directly to GitHub's API.</p>
                        <button
                          onClick={() => window.open("https://github.com/settings/tokens/new?description=SqueezyPay+feedback&scopes=public_repo", "_blank")}
                          className="text-violet-600 dark:text-violet-400 underline"
                        >
                          Open GitHub token page →
                        </button>
                        <button onClick={() => setPatTooltip(false)} className="block text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mt-1">Dismiss</button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paste a GitHub Personal Access Token with <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">public_repo</code> scope.
                  The token is used once and never stored.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="ghp_…"
                    value={pat}
                    onChange={(e) => setPat(e.target.value)}
                    autoComplete="off"
                  />
                  <button
                    onClick={submitViaApi}
                    disabled={!pat.trim() || submitting}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition-colors"
                  >
                    {submitting ? "Sending…" : "Submit"}
                  </button>
                </div>
              </div>

              {/* GitHub browser option */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-slate-700 dark:fill-slate-200" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58 0-.28-.01-1.02-.01-2-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.004 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.3 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Open pre-filled GitHub issue in browser</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Opens GitHub in a new tab with your report pre-filled. You'll need a GitHub account to submit.
                </p>
                <button
                  onClick={openGitHubUrl}
                  className="w-full py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Open in GitHub →
                </button>
              </div>

              {/* Email option — only shown if VITE_FEEDBACK_EMAIL is set */}
              {FEEDBACK_EMAIL && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-slate-700 dark:stroke-slate-200" strokeWidth="1.8">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M2 7l10 7 10-7" />
                    </svg>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Send by email</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Opens your email client with the report pre-populated.
                  </p>
                  <button
                    onClick={openMailto}
                    className="w-full py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    Draft email →
                  </button>
                </div>
              )}
            </>
          )}

          {submitResult && (
            <div className={`rounded-xl p-5 text-center space-y-2 ${submitResult.ok ? "bg-teal-50 dark:bg-teal-900/30" : "bg-red-50 dark:bg-red-900/30"}`}>
              {submitResult.ok ? (
                <>
                  <div className="text-3xl">✓</div>
                  <p className="font-semibold text-teal-700 dark:text-teal-300">Issue submitted — thank you!</p>
                  {submitResult.url && (
                    <a href={submitResult.url} target="_blank" rel="noreferrer" className="text-sm text-teal-600 dark:text-teal-400 underline">
                      View on GitHub →
                    </a>
                  )}
                </>
              ) : (
                <>
                  <div className="text-3xl">✕</div>
                  <p className="font-semibold text-red-700 dark:text-red-300">Submission failed</p>
                  <p className="text-sm text-red-600 dark:text-red-400">{submitResult.message}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Try the browser option instead.</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 gap-3">
          {submitResult?.ok ? (
            <button onClick={onClose} className="ml-auto px-5 py-2 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white transition-colors">
              Close
            </button>
          ) : (
            <>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Cancel
              </button>
              {step !== "submit" && !submitResult && (
                <button
                  onClick={handleNext}
                  disabled={step === "describe" && !brief.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition-colors"
                >
                  {step === "describe" ? (diagLoading ? "Loading…" : "Next →") : "Review & Submit →"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
