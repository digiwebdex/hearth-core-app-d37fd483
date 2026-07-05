// Shared frontend formatting helpers. Consolidates copies that were duplicated
// across components (see docs/v2-master/104-Codebase-Review.md §4).

/** Relative "time ago" label (was duplicated in NotificationBell + AdminNotificationBell). */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Format a money amount in BDT (৳) — the app's default currency. */
export function formatCurrency(amount: number | string | null | undefined, currency = "৳"): string {
  const n = Number(amount);
  return `${currency}${(Number.isFinite(n) ? n : 0).toLocaleString()}`;
}
