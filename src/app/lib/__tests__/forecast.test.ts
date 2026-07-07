import { describe, it, expect } from "vitest";
import { forecastPrices, PricePoint } from "../forecast";

const series = (prices: number[], startDay = 0): PricePoint[] =>
  prices.map((price, i) => ({
    date: new Date(2026, 0, 1 + startDay + i).toISOString(),
    price,
  }));

describe("forecastPrices", () => {
  it("reports insufficient-data for fewer than 3 points", () => {
    const r = forecastPrices(series([10, 11]), 30);
    expect(r.model).toBe("insufficient-data");
    expect(r.forecast).toEqual([]);
    expect(r.projectedChangePct).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it("produces a horizon-length forecast with an ordered band", () => {
    const r = forecastPrices(series([10, 12, 14, 16, 18]), 30);
    expect(r.model).toBe("linear-trend");
    expect(r.forecast).toHaveLength(30);
    for (const p of r.forecast) {
      expect(p).toHaveProperty("date");
      expect(p.lower).toBeLessThanOrEqual(p.predicted);
      expect(p.predicted).toBeLessThanOrEqual(p.upper);
      expect(p.predicted).toBeGreaterThanOrEqual(0);
    }
  });

  it("detects an upward trend", () => {
    const r = forecastPrices(series([10, 20, 30, 40, 50]), 10);
    expect(r.trendPerDay).toBeGreaterThan(0);
    expect(r.projectedChangePct).not.toBeNull();
    expect(r.projectedChangePct!).toBeGreaterThan(0);
    expect(r.confidence).toBeGreaterThan(0.9); // near-perfect linear fit
  });

  it("detects a downward trend", () => {
    const r = forecastPrices(series([50, 40, 30, 20, 10]), 10);
    expect(r.trendPerDay).toBeLessThan(0);
    expect(r.projectedChangePct!).toBeLessThan(0);
  });

  it("never predicts a negative price (clamps at 0)", () => {
    const r = forecastPrices(series([5, 4, 3, 2, 1]), 365);
    expect(Math.min(...r.forecast.map((p) => p.predicted))).toBeGreaterThanOrEqual(0);
  });
});
