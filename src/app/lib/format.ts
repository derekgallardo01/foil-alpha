/**
 * Shared display formatters. Previously copy-pasted per page — import from here.
 */

export function formatPrice(
  value: number | string | null | undefined,
  opts?: { decimals?: number }
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  const decimals = opts?.decimals ?? 2;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
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
