/**
 * Client for the (Phase 2b) Python ML forecasting service.
 *
 * The service serves the SAME contract as the in-app statistical baseline
 * (`lib/forecast.ts`), so `/api/forecast` can prefer it and transparently fall
 * back to the baseline when the service is unset, unreachable, slow, or returns
 * a low-confidence/empty result. Enabled by setting `ML_FORECAST_SERVICE_URL`.
 */

import type { ForecastResult } from "./forecast";

const SERVICE_URL = process.env.ML_FORECAST_SERVICE_URL;
const SERVICE_SECRET = process.env.ML_FORECAST_SERVICE_SECRET;
const TIMEOUT_MS = Number(process.env.ML_FORECAST_TIMEOUT_MS || 2500);

export function mlForecastEnabled(): boolean {
  return !!SERVICE_URL;
}

/**
 * Ask the ML service to forecast a card. Returns the contract result, or `null`
 * on any failure so the caller can fall back to the baseline. Never throws.
 */
export async function mlForecast(cardId: number, days: number): Promise<ForecastResult | null> {
  if (!SERVICE_URL) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SERVICE_URL.replace(/\/$/, "")}/forecast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_SECRET ? { Authorization: `Bearer ${SERVICE_SECRET}` } : {}),
      },
      body: JSON.stringify({ card_id: cardId, days }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Partial<ForecastResult> | null;
    // Minimal shape validation — a malformed/empty response falls back.
    if (!data || !Array.isArray(data.forecast) || data.forecast.length === 0) return null;

    return {
      forecast: data.forecast,
      model: data.model ?? "ml-service",
      trendPerDay: data.trendPerDay ?? 0,
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
      projectedChangePct: data.projectedChangePct ?? null,
    };
  } catch {
    // timeout / network / parse — fall back to the baseline
    return null;
  } finally {
    clearTimeout(timer);
  }
}
