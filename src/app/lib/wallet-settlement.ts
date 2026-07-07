import type { Prisma } from "@prisma/client";

/**
 * Auction escrow release.
 *
 * When a bid is placed, the bid amount is held in the bidder's
 * `UserWallet.frozen_balance` (see `api/bids`). The bidding code keeps exactly
 * **one active bid per bidder per auction**, and that active bid's amount equals
 * the bidder's held (frozen) amount for the auction. So releasing a bidder's
 * escrow means decrementing `frozen_balance` by their active bid amount.
 *
 * This helper releases the holds of every active bidder on an auction (optionally
 * excluding one — e.g. the winner, whose hold is settled by the purchase itself).
 * Consistent with the rest of the code, frozen-only movements are NOT recorded in
 * the balance-based `WalletTransaction` ledger. Call inside a `prisma.$transaction`.
 *
 * @returns the bidder ids whose holds were released.
 */
export async function releaseBidHolds(
  tx: Prisma.TransactionClient,
  opts: { auctionId: number; exceptBidderId?: number }
): Promise<number[]> {
  const holds = await tx.bid.findMany({
    where: {
      userCardId: opts.auctionId,
      is_active: true,
      ...(opts.exceptBidderId != null ? { bidderId: { not: opts.exceptBidderId } } : {}),
    },
    select: { bidderId: true, amount: true },
  });

  for (const hold of holds) {
    await tx.userWallet.update({
      where: { user_id: hold.bidderId },
      data: { frozen_balance: { decrement: Number(hold.amount) } },
    });
  }

  return holds.map((h) => h.bidderId);
}
