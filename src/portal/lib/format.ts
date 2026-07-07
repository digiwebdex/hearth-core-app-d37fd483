// Shared portal formatting helpers (single source — was duplicated per page).
export function formatMoney(n: number | null | undefined): string {
  return `৳${Number(n || 0).toLocaleString()}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString();
}
