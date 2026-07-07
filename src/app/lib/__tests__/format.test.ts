import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatCompactPrice,
  formatPct,
  formatDuration,
  formatTimeLeft,
  formatDateTime,
} from "../format";

describe("formatPrice", () => {
  it("formats numbers with two decimals", () => {
    expect(formatPrice(1234.5)).toBe("$1,234.50");
    expect(formatPrice(0)).toBe("$0.00");
  });
  it("returns $0.00 for null/undefined/non-numeric", () => {
    expect(formatPrice(null)).toBe("$0.00");
    expect(formatPrice(undefined)).toBe("$0.00");
    expect(formatPrice("abc")).toBe("$0.00");
  });
  it("honors the decimals option", () => {
    expect(formatPrice(1000, { decimals: 0 })).toBe("$1,000");
  });
});

describe("formatCompactPrice", () => {
  it("compacts large values", () => {
    expect(formatCompactPrice(12300)).toBe("$12.3K");
  });
  it("returns $0 for invalid input", () => {
    expect(formatCompactPrice(null)).toBe("$0");
    expect(formatCompactPrice("x")).toBe("$0");
  });
});

describe("formatPct", () => {
  it("signs positive/negative with a unicode minus", () => {
    expect(formatPct(3.14)).toBe("+3.1%");
    expect(formatPct(-0.8)).toBe("−0.8%"); // U+2212
    expect(formatPct(0)).toBe("0.0%"); // no sign, still one decimal
  });
  it("returns 0% only for non-numeric (NaN); null coerces to 0 → 0.0%", () => {
    expect(formatPct("abc")).toBe("0%");
    expect(formatPct(null)).toBe("0.0%");
  });
});

describe("formatDuration", () => {
  it("returns Ended for null/<=0", () => {
    expect(formatDuration(null)).toBe("Ended");
    expect(formatDuration(0)).toBe("Ended");
    expect(formatDuration(-5)).toBe("Ended");
  });
  it("formats day/hour/minute granularity", () => {
    const d = 24 * 60 * 60 * 1000;
    const h = 60 * 60 * 1000;
    const m = 60 * 1000;
    expect(formatDuration(2 * d + 3 * h)).toBe("2d 3h");
    expect(formatDuration(3 * h + 4 * m)).toBe("3h 4m");
    expect(formatDuration(5 * m)).toBe("5m");
  });
});

describe("formatTimeLeft", () => {
  it("handles empty and invalid input", () => {
    expect(formatTimeLeft(null)).toBe("—");
    expect(formatTimeLeft("not-a-date")).toBe("—");
  });
  it("returns Ended for a past time", () => {
    expect(formatTimeLeft(Date.now() - 10_000)).toBe("Ended");
  });
  it("formats a future time", () => {
    expect(formatTimeLeft(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60_000)).toBe("2d 0h");
  });
});

describe("formatDateTime", () => {
  it("handles empty/invalid", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("nope")).toBe("—");
  });
  it("renders a real date", () => {
    expect(formatDateTime("2026-01-02T03:04:05Z")).not.toBe("—");
  });
});
