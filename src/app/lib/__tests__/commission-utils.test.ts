import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client so we don't touch a real DB.
vi.mock("../prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

import { calculateCommission } from "../commission-utils";
import { prisma } from "../prisma";

const q = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

describe("calculateCommission", () => {
  beforeEach(() => q.mockReset());

  it("uses a rarity-specific rate when one exists", async () => {
    q.mockResolvedValueOnce([{ commission_rate: 10 }]); // rarity lookup hits
    const r = await calculateCommission(200, "Rare");
    expect(r.commission_rate).toBe(10);
    expect(r.commission_amount).toBeCloseTo(20);
    expect(r.seller_receives).toBeCloseTo(180);
    expect(r.buyer_pays).toBeCloseTo(220);
    expect(r.admin_receives).toBeCloseTo(20);
    expect(q).toHaveBeenCalledTimes(1); // no global fallback needed
  });

  it("falls back to the global rate when no rarity match", async () => {
    q.mockResolvedValueOnce([]); // rarity: none
    q.mockResolvedValueOnce([{ commission_rate: 7 }]); // global
    const r = await calculateCommission(100, "Common");
    expect(r.commission_rate).toBe(7);
    expect(r.commission_amount).toBeCloseTo(7);
    expect(q).toHaveBeenCalledTimes(2);
  });

  it("defaults to 5% when neither rarity nor global settings exist", async () => {
    q.mockResolvedValueOnce([]); // rarity none
    q.mockResolvedValueOnce([]); // global none
    const r = await calculateCommission(50, "Common");
    expect(r.commission_rate).toBe(5);
    expect(r.commission_amount).toBeCloseTo(2.5);
    expect(r.seller_receives).toBeCloseTo(47.5);
  });
});
