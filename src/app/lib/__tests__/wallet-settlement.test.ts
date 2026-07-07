import { describe, it, expect } from "vitest";
import { releaseBidHolds } from "../wallet-settlement";

/** A minimal fake Prisma transaction client that records the calls made. */
function fakeTx(bids: { bidderId: number; amount: number | string }[]) {
  const calls = { findMany: [] as any[], update: [] as any[] };
  const tx = {
    bid: {
      findMany: async (args: any) => {
        calls.findMany.push(args);
        return bids;
      },
    },
    userWallet: {
      update: async (args: any) => {
        calls.update.push(args);
        return {};
      },
    },
  };
  return { tx: tx as any, calls };
}

describe("releaseBidHolds", () => {
  it("releases each active bidder's frozen hold by their bid amount", async () => {
    const { tx, calls } = fakeTx([
      { bidderId: 2, amount: 100 },
      { bidderId: 3, amount: "60" }, // Decimal often arrives as a string
    ]);
    const released = await releaseBidHolds(tx, { auctionId: 5 });

    expect(released).toEqual([2, 3]);
    expect(calls.update).toEqual([
      { where: { user_id: 2 }, data: { frozen_balance: { decrement: 100 } } },
      { where: { user_id: 3 }, data: { frozen_balance: { decrement: 60 } } },
    ]);
  });

  it("queries only active bids on the auction (no bidder filter by default)", async () => {
    const { tx, calls } = fakeTx([]);
    await releaseBidHolds(tx, { auctionId: 9 });
    expect(calls.findMany[0].where).toMatchObject({ userCardId: 9, is_active: true });
    expect(calls.findMany[0].where.bidderId).toBeUndefined();
  });

  it("excludes the excepted bidder (the winner keeps their hold)", async () => {
    const { tx, calls } = fakeTx([{ bidderId: 3, amount: 60 }]);
    const released = await releaseBidHolds(tx, { auctionId: 9, exceptBidderId: 2 });
    expect(calls.findMany[0].where.bidderId).toEqual({ not: 2 });
    expect(released).toEqual([3]);
  });

  it("does nothing when there are no active bids", async () => {
    const { tx, calls } = fakeTx([]);
    const released = await releaseBidHolds(tx, { auctionId: 1 });
    expect(released).toEqual([]);
    expect(calls.update).toHaveLength(0);
  });
});
