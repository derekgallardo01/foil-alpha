/**
 * Tiny dependency-free CSV helpers for client-side "Export" buttons: build a CSV
 * string from row objects, then trigger a browser download. Raw values are
 * exported (not display-formatted) so the output is spreadsheet-friendly.
 */

export interface CsvColumn<T> {
  key: keyof T;
  header: string;
}

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize `rows` to CSV text using the given column order + headers. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(",")).join("\n");
  return body ? `${header}\n${body}` : header;
}

/** Trigger a download of `content` as `filename` (client-side only). */
export function downloadCsv(filename: string, content: string): void {
  // Leading BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
