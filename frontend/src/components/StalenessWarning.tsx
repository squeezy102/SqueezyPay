interface StalenessWarningProps {
  lastSyncedAt: string | null | undefined;
  thresholdHours?: number;
  className?: string;
}

const STALE_HOURS = 12;

export function isStale(lastSyncedAt: string | null | undefined, thresholdHours = STALE_HOURS): boolean {
  if (!lastSyncedAt) return true;
  const diff = (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60);
  return diff >= thresholdHours;
}

export default function StalenessWarning({ lastSyncedAt, thresholdHours = STALE_HOURS, className = "" }: StalenessWarningProps) {
  if (!isStale(lastSyncedAt, thresholdHours)) return null;

  const label = lastSyncedAt
    ? (() => {
        const diffH = (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60);
        if (diffH < 24) return `Last synced ${Math.floor(diffH)}h ago`;
        const diffD = Math.floor(diffH / 24);
        return `Last synced ${diffD}d ago`;
      })()
    : "Never synced";

  return (
    <div className={`flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 ${className}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Data may be outdated — <span className="font-medium">{label}</span>. Go to Accounts to sync.
      </p>
    </div>
  );
}
