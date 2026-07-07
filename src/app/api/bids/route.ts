// src/app/api/bids/route.ts - Updated with new bidding flow (no fund freezing)
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { createBidNotifications, createBidOutbidNotification } from '../../lib/notification';
import { emitAppEvent } from '../../lib/events';
import { resolveProxyBid, BID_INCREMENT } from '../../lib/bid-resolution';
import type { Prisma } from '@prisma/client';

/** Round to cents to keep escrow math free of float dust. */
const round2 = (n: number) => Math.round(n * 100) / 100;
const clampAmt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A user-facing (400) bid rejection, as opposed to an unexpected 500. */
class BidError extends Error {}

/**
 * Atomically move `delta` (> 0) from a user's available balance into escrow,
 * only if their available balance covers it. This locking conditional write is
 * the concurrency gate for every escrow hold. Returns true on success.
 */
async function freezeFunds(tx: Prisma.TransactionClient, userId: number, delta: number): Promise<boolean> {
    const affected = await tx.$executeRaw`
        UPDATE user_wallets
        SET frozen_balance = frozen_balance + ${delta}
        WHERE user_id = ${userId} AND (balance - frozen_balance) >= ${delta}`;
    return affected === 1;
}

// GET /api/bids - Get bids for a card or user's bids
export async function GET(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const { searchParams } = new URL(request.url);
        const userCardId = searchParams.get('user_card_id');
        const userId = searchParams.get('user_id');

        let where: any = {};

        if (userCardId) {
            where.userCardId = parseInt(userCardId);
        } else if (userId) {
            // A user may only read their own bids by id; admins may read anyone's.
            // Otherwise this leaks another user's bid history (incl. their email).
            if (Number(userId) !== user.id && user.role !== 'admin') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            where.bidderId = parseInt(userId);
        } else {
            where.bidderId = user.id;
        }

        const bids = await prisma.bid.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        // Batch-load related data to avoid the per-bid N+1 queries.
        const userCardIds = [...new Set(bids.map((bid) => bid.userCardId))];
        const userCards = userCardIds.length
            ? await prisma.userCard.findMany({ where: { id: { in: userCardIds } } })
            : [];
        const userCardById = new Map(userCards.map((uc) => [uc.id, uc]));

        const cardIds = [...new Set(userCards.map((uc) => uc.card_id))];
        const cards = cardIds.length
            ? await prisma.card.findMany({ where: { id: { in: cardIds } } })
            : [];
        const cardById = new Map(cards.map((c) => [c.id, c]));

        const userIds = [
            ...new Set([
                ...userCards.map((uc) => uc.owner_id),
                ...bids.map((bid) => bid.bidderId),
            ]),
        ];
        const users = userIds.length
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, email: true }
            })
            : [];
        const userById = new Map(users.map((u) => [u.id, u]));

        const bidsWithDetails = bids.map((bid) => {
            const userCard = userCardById.get(bid.userCardId) ?? null;

            const card = userCard ? cardById.get(userCard.card_id) ?? null : null;

            const owner = userCard ? userById.get(userCard.owner_id) ?? null : null;

            const bidder = userById.get(bid.bidderId) ?? null;

            return {
                id: bid.id,
                user_card_id: bid.userCardId,
                bidder: bidder,
                amount: Number(bid.amount),
                is_active: bid.is_active,
                created_at: bid.createdAt,
                card: card ? {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    image_url: card.image_url
                } : null,
                owner: owner,
                auction_end: userCard?.auction_end,
                current_highest_bid: Number(bid.amount)
            };
        });

        return NextResponse.json(bidsWithDetails.filter(bid => bid.card !== null));

    } catch (error) {
        console.error('Error fetching bids:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bids' },
            { status: 500 }
        );
    }
}

// POST /api/bids - Place a bid. Optionally include `max_amount` to set a proxy
// (auto) bid: the system raises your effective bid toward that ceiling to keep
// you winning, but never above it. A bid with no max is a plain first-price bid.
export async function POST(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const bidderId = auth.user.id;

        const body = await request.json();
        const { user_card_id, amount, max_amount } = body;

        if (!user_card_id || !amount || amount <= 0) {
            return NextResponse.json({ error: 'user_card_id and positive amount are required' }, { status: 400 });
        }

        const bidAmount = round2(Number(amount));
        const maxAmount = max_amount != null ? round2(Number(max_amount)) : bidAmount;
        const isProxy = maxAmount > bidAmount;
        if (!Number.isFinite(maxAmount) || maxAmount < bidAmount) {
            return NextResponse.json({ error: 'Your maximum bid must be at least your bid amount.' }, { status: 400 });
        }

        const userCard = await prisma.userCard.findUnique({ where: { id: user_card_id } });
        if (!userCard) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

        const card = await prisma.card.findUnique({ where: { id: userCard.card_id } });
        const owner = await prisma.user.findUnique({ where: { id: userCard.owner_id }, select: { id: true, name: true } });
        if (!card || !owner) return NextResponse.json({ error: 'Card or owner not found' }, { status: 404 });

        if (userCard.owner_id === bidderId) {
            return NextResponse.json({ error: 'Cannot bid on your own card' }, { status: 400 });
        }
        if (!userCard.is_for_sale || userCard.sale_type !== 'AUCTION') {
            return NextResponse.json({ error: 'Card is not available for auction' }, { status: 400 });
        }

        const reservePrice = Number(userCard.reserve_price) || 0;
        if (bidAmount < reservePrice) {
            return NextResponse.json({ error: `Bid must be at least $${reservePrice.toFixed(2)} (reserve price)` }, { status: 400 });
        }

        // All price/escrow logic runs under a per-auction row lock so concurrent
        // bids on the same auction are serialized (read → resolve → write is atomic).
        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT id FROM user_cards WHERE id = ${user_card_id} FOR UPDATE`;

            // Re-check liveness under the lock (sold/ended can race the request).
            const uc = await tx.userCard.findUnique({ where: { id: user_card_id } });
            if (!uc || uc.is_sold) throw new BidError('Card has already been sold');
            // Re-check under the lock: a manual admin-end sets is_for_sale=false
            // (possibly before auction_end), so this catches a bid racing an end.
            if (!uc.is_for_sale || uc.sale_type !== 'AUCTION') throw new BidError('Auction is no longer available');
            if (uc.auction_end && new Date() > uc.auction_end) throw new BidError('Auction has ended');

            // The challenger's existing hold (they may be raising their own max).
            const ownBid = await tx.bid.findFirst({ where: { userCardId: user_card_id, bidderId, is_active: true } });
            const priorHold = ownBid ? Number(ownBid.amount) : 0;

            // Current highest OTHER active bid.
            const topOther = await tx.bid.findFirst({
                where: { userCardId: user_card_id, is_active: true, bidderId: { not: bidderId } },
                // Deterministic tiebreaker: on equal amounts the earliest bid leads.
                orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }],
            });
            const top = topOther
                ? { effective: Number(topOther.amount), max: Number(topOther.max_amount ?? topOther.amount) }
                : null;

            if (top && bidAmount <= top.effective) {
                throw new BidError(`Bid must be higher than the current bid of $${top.effective.toFixed(2)}`);
            }

            // Resolve the proxy war (pure).
            const res = resolveProxyBid({ challengerAmount: bidAmount, challengerMax: maxAmount, reserve: reservePrice, top });
            let challengerWins = res.challengerWins;
            let challengerEffective = round2(res.challengerEffective);
            let topEffective = round2(res.topEffective);

            // Escalate the standing top bidder if the resolution calls for it —
            // all-or-nothing: if they can't afford the full jump they don't defend,
            // and the challenger wins at just over the standing price instead.
            if (topOther && top && topEffective > top.effective) {
                const topDelta = round2(topEffective - top.effective);
                if (await freezeFunds(tx, topOther.bidderId, topDelta)) {
                    await tx.bid.update({ where: { id: topOther.id }, data: { amount: topEffective } });
                } else {
                    topEffective = top.effective;
                    challengerWins = true;
                    challengerEffective = round2(clampAmt(top.effective + BID_INCREMENT, bidAmount, maxAmount));
                }
            }

            // Place the challenger's bid, keeping frozen escrow == effective amount.
            const challengerDelta = round2(challengerEffective - priorHold);
            if (challengerDelta > 0) {
                if (!(await freezeFunds(tx, bidderId, challengerDelta))) {
                    throw new BidError('Insufficient available balance to place this bid.');
                }
            } else if (challengerDelta < 0) {
                await tx.userWallet.update({
                    where: { user_id: bidderId },
                    data: { frozen_balance: { increment: challengerDelta } },
                });
            }

            if (ownBid) await tx.bid.update({ where: { id: ownBid.id }, data: { is_active: false } });
            const newBid = await tx.bid.create({
                data: {
                    userCardId: user_card_id,
                    bidderId,
                    amount: challengerEffective,
                    max_amount: isProxy ? maxAmount : null,
                    is_active: true,
                },
            });

            return {
                newBid,
                challengerWins,
                challengerEffective,
                currentHighest: challengerWins ? challengerEffective : topEffective,
                // Only the previous top bidder is newly outbid, and only when the challenger takes the lead.
                outbid: challengerWins && topOther ? { bidderId: topOther.bidderId, prevAmount: top!.effective } : null,
            };
        });

        // Notifications (best-effort, outside the transaction).
        try {
            await createBidNotifications(userCard.owner_id, bidderId, card.name, result.challengerEffective, result.newBid.id);
            if (result.outbid && result.outbid.bidderId !== bidderId) {
                await createBidOutbidNotification(
                    result.outbid.bidderId,
                    card.name,
                    result.outbid.prevAmount,
                    result.currentHighest,
                    result.newBid.id,
                    user_card_id
                );
            }
        } catch (notificationError) {
            console.error('Error creating notifications:', notificationError);
        }

        emitAppEvent({ type: 'bid', auctionId: user_card_id });

        return NextResponse.json({
            success: true,
            winning: result.challengerWins,
            current_bid: result.currentHighest,
            your_max: isProxy ? maxAmount : null,
            bid: {
                id: result.newBid.id,
                user_card_id,
                amount: result.challengerEffective,
                max_amount: isProxy ? maxAmount : null,
                card_name: card.name,
                created_at: result.newBid.createdAt,
            },
            message: result.challengerWins
                ? `You're the highest bidder at $${result.currentHighest.toFixed(2)}.`
                : `You've been outbid — the current bid is now $${result.currentHighest.toFixed(2)}. Raise your maximum to bid again.`,
        });

    } catch (error) {
        if (error instanceof BidError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        console.error('Error placing bid:', error);
        return NextResponse.json(
            { error: 'Failed to place bid', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// DELETE /api/bids - Cancel a bid (no fund unfreezing needed)
export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const userId = user.id;
        const { searchParams } = new URL(request.url);
        const bidId = searchParams.get('bid_id');

        if (!bidId) {
            return NextResponse.json({ error: 'bid_id is required' }, { status: 400 });
        }

        const bid = await prisma.bid.findUnique({
            where: { id: parseInt(bidId) }
        });

        if (!bid) {
            return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
        }

        if (bid.bidderId !== userId) {
            return NextResponse.json({ error: 'Can only cancel your own bids' }, { status: 403 });
        }

        if (!bid.is_active) {
            return NextResponse.json({ error: 'Bid is not active' }, { status: 400 });
        }

        // Get the user card to check auction end
        const userCard = await prisma.userCard.findUnique({
            where: { id: bid.userCardId }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Associated card not found' }, { status: 404 });
        }

        // Check if auction has ended
        if (userCard.auction_end && new Date() > userCard.auction_end) {
            return NextResponse.json({ error: 'Cannot cancel bid after auction has ended' }, { status: 400 });
        }

        // Deactivate the bid and release its escrow hold.
        await prisma.$transaction(async (tx) => {
            // Serialize with concurrent bids (proxy escalation can change the
            // amount), then release exactly the current hold — only if THIS call
            // is the one that deactivates the bid.
            await tx.$executeRaw`SELECT id FROM user_cards WHERE id = ${bid.userCardId} FOR UPDATE`;
            const fresh = await tx.bid.findUnique({ where: { id: parseInt(bidId) } });
            if (!fresh) return;
            const flipped = await tx.bid.updateMany({
                where: { id: fresh.id, is_active: true },
                data: { is_active: false },
            });
            if (flipped.count === 1) {
                await tx.userWallet.update({
                    where: { user_id: userId },
                    data: { frozen_balance: { decrement: Number(fresh.amount) } },
                });
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Bid cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling bid:', error);
        return NextResponse.json(
            {
                error: 'Failed to cancel bid',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}