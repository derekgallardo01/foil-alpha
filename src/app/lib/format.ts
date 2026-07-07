/**
 * Shared display formatters. Previously copy-pasted per page — import from here.
 */

export function formatPrice(
  value: number | string | null | undefined,
  opts?: { decimals?: number; emptyLabel?: string }
): string {
  const n = Number(value);
  // `emptyLabel` (e.g. "N/A") is returned for null/undefined/NaN; a real 0 still
  // formats as "$0.00". This replaces the local `!price ? 'N/A'` copies, which
  // also (incorrectly) hid a genuine $0 — the shared version is the more correct.
  if (!Number.isFinite(n)) return opts?.emptyLabel ?? "$0.00";
  const decimals = opts?.decimals ?? 2;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Price that shows "N/A" (not "$0.00") when the value is missing. This is the
 * policy the dashboard/marketplace components used via their local copies; a
 * real 0 still formats as "$0.00".
 */
export function formatPriceNA(value: number | string | null | undefined): string {
  return formatPrice(value, { emptyLabel: "N/A" });
}

/** Compact currency, e.g. $12.3K, for tight stat tiles. */
export function formatCompactPrice(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })}`;
}

/** Human-readable countdown to a future date/timestamp. */
export function formatTimeLeft(end: string | number | Date | null | undefined): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - Date.now();
  if (Number.isNaN(ms)) return "—";
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Signed percentage, e.g. +3.1% / −0.8%. */
export function formatPct(value: number | string | null | undefined, decimals = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(decimals)}%`;
}

/**
 * Countdown from a milliseconds-remaining value (as opposed to `formatTimeLeft`,
 * which takes an end timestamp). Returns "Ended" for null/<=0, else "1d 2h" /
 * "3h 4m" / "5m". Drop-in for the local `formatTimeLeft(ms)` copies.
 */
export function formatDuration(msRemaining: number | null | undefined): string {
  if (!msRemaining || msRemaining <= 0) return "Ended";
  const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Locale date+time string. Replaces the local `new Date(x).toLocaleString()` copies. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
