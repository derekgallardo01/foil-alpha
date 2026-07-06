/**
 * Price forecasting engine (statistical baseline).
 *
 * This is the in-app baseline that produces a forecast + confidence band from a
 * card's stored price history. It defines the forecast CONTRACT that the UI and
 * the (upcoming) dedicated Python ML service both speak — the ML service will
 * later serve richer models (ARIMA/Prophet/gradient-boosted with volume & graded
 * features) behind the same shape, so the frontend doesn't change.
 *
 * Model: ordinary-least-squares linear trend over time, with a prediction
 * interval that widens with the forecast horizon; R² is reported as a rough
 * confidence signal. Deliberately simple and dependency-free.
 */

export interface PricePoint {
  date: string; // ISO date (YYYY-MM-DD or full ISO)
  price: number;
}

export interface ForecastPoint {
  date: string; // YYYY-MM-DD
  predicted: number;
  lower: number;
  upper: number;
}

export interface ForecastResult {
  forecast: ForecastPoint[];
  model: string;
  /** slope of the fitted trend, in price units per day */
  trendPerDay: number;
  /** 0..1 goodness-of-fit (R²) of the trend line */
  confidence: number;
  /** projected % change over the full horizon vs the last observed price */
  projectedChangePct: number | null;
}

const DAY_MS = 86_400_000;

export function forecastPrices(history: PricePoint[], horizonDays = 90): ForecastResult {
  const pts = history
    .filter((p) => p.price != null && !Number.isNaN(Number(p.price)))
    .map((p) => ({ t: new Date(p.date).getTime(), y: Number(p.price) }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  const empty: ForecastResult = {
    forecast: [],
    model: "insufficient-data",
    trendPerDay: 0,
    confidence: 0,
    projectedChangePct: null,
  };
  if (pts.length < 3) return empty;

  const t0 = pts[0].t;
  const xs = pts.map((p) => (p.t - t0) / DAY_MS);
  const ys = pts.map((p) => p.y);
  const n = xs.length;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - meanX) ** 2;
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;

  let sse = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    sse += (ys[i] - pred) ** 2;
    sst += (ys[i] - meanY) ** 2;
  }
  const resStd = Math.sqrt(sse / Math.max(1, n - 2));
  const r2 = sst === 0 ? 0 : Math.max(0, Math.min(1, 1 - sse / sst));

  const lastX = xs[n - 1];
  const lastT = pts[n - 1].t;
  const lastY = ys[n - 1];

  const forecast: ForecastPoint[] = [];
  for (let d = 1; d <= horizonDays; d++) {
    const x = lastX + d;
    const predicted = intercept + slope * x;
    // Prediction interval widens with distance from observed data.
    const band = 1.96 * resStd * Math.sqrt(1 + d / Math.max(1, n));
    forecast.push({
      date: new Date(lastT + d * DAY_MS).toISOString().slice(0, 10),
      predicted: round2(Math.max(0, predicted)),
      lower: round2(Math.max(0, predicted - band)),
      upper: round2(Math.max(0, predicted + band)),
    });
  }

  const finalPredicted = forecast[forecast.length - 1]?.predicted ?? lastY;
  const projectedChangePct = lastY > 0 ? round2(((finalPredicted - lastY) / lastY) * 100) : null;

  return { forecast, model: "linear-trend", trendPerDay: round2(slope), confidence: round2(r2), projectedChangePct };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
