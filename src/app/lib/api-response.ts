import { NextResponse } from "next/server";

/**
 * Standard API envelope helpers. New routes should use these so the whole API
 * speaks one shape:
 *   success → { success: true, ...payload }
 *   failure → { success: false, error }   (with an HTTP status)
 *
 * Clients can branch on `res.ok` and/or `json.success`. Prefer `ok`/`fail` over
 * hand-building `NextResponse.json(...)` in new code.
 */

export function ok(payload: Record<string, unknown> = {}, init?: number | ResponseInit) {
  const opts = typeof init === "number" ? { status: init } : init;
  return NextResponse.json({ success: true, ...payload }, opts);
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
