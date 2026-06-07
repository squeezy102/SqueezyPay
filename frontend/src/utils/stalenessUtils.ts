const STALE_HOURS = 12;

export function staleness(lastSyncedAt: string | null | undefined): { stale: boolean; label: string } {
  if (!lastSyncedAt) return { stale: true, label: "Never synced" };
  const diffH = (Date.now() - new Date(lastSyncedAt).getTime()) / (1000 * 60 * 60);
  if (diffH < STALE_HOURS) return { stale: false, label: "" };
  const label = diffH < 24
    ? `Last synced ${Math.floor(diffH)}h ago`
    : `Last synced ${Math.floor(diffH / 24)}d ago`;
  return { stale: true, label };
}
