// src/app/api/admin/auctions/end/route.ts - End auction manually
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import {
    createAuctionWonNotifications,
    createAuctionLostNotifications
} from '../../../../lib/notification';
import { releaseBidHolds } from '../../../../lib/wallet-settlement';
import { emitAppEvent } from '../../../../lib/events';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const body = await request.json();
        const { auction_id } = body;

        if (!auction_id) {
            return NextResponse.json({ error: 'auction_id is required' }, { status: 400 });
        }

        // Get the auction with explicit typing
        const auction = await prisma.userCard.findUnique({
            where: { id: auction_id }
        });

        if (!auction) {
            return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
        }

        if (auction.sale_type !== 'AUCTION' || !auction.is_for_sale) {
            return NextResponse.json({ error: 'Card is not an active auction' }, { status: 400 });
        }

        // Get the card and owner separately to avoid type issues
        const card = await prisma.card.findUnique({
            where: { id: auction.card_id }
        });

        const owner = await prisma.user.findUnique({
            where: { id: auction.owner_id }
        });

        if (!card || !owner) {
            return NextResponse.json({ error: 'Card or owner not found' }, { status: 404 });
        }

        // Everything that decides the outcome runs under a per-auction row lock,
        // so a bid landing mid-request (a manual end can happen before auction_end)
        // is either fully counted or blocked — never settled against a stale read.
        const outcome = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT id FROM user_cards WHERE id = ${auction_id} FOR UPDATE`;

            const fresh = await tx.userCard.findUnique({ where: { id: auction_id } });
            if (!fresh || fresh.is_sold || !fresh.is_for_sale || fresh.sale_type !== 'AUCTION') {
                return { kind: 'already' as const };
            }
            const reservePrice = Number(fresh.reserve_price) || 0;

            const highestBid = await tx.bid.findFirst({
                where: { userCardId: auction_id, is_active: true },
                orderBy: [{ amount: 'desc' }, { createdAt: 'asc' }],
            });

            if (!highestBid) {
                await tx.userCard.update({
                    where: { id: auction_id },
                    data: { is_for_sale: false, notes: `Manually ended by admin ${user.name} - No bids received` },
                });
                return { kind: 'nobid' as const };
            }

            if (Number(highestBid.amount) < reservePrice) {
                await tx.userCard.update({
                    where: { id: auction_id },
                    data: { is_for_sale: false, notes: `Manually ended by admin ${user.name} - Reserve not met (${reservePrice})` },
                });
                // No sale: release every bidder's escrow, then deactivate the bids.
                await releaseBidHolds(tx, { auctionId: auction_id });
                await tx.bid.updateMany({ where: { userCardId: auction_id, is_active: true }, data: { is_active: false } });
                return { kind: 'reserve' as const, highestAmount: Number(highestBid.amount), reservePrice };
            }

            // Winner: claim the card and open the pending confirmation. Losing bids
            // stay ACTIVE (escrow held) until the winner confirms or declines.
            await tx.userCard.update({ where: { id: auction_id }, data: { is_for_sale: false } });
            const pendingTransaction = await tx.transaction.create({
                data: {
                    user_card_id: auction_id,
                    buyer_id: highestBid.bidderId,
                    seller_id: fresh.owner_id,
                    amount: highestBid.amount,
                    transaction_type: 'AUCTION_WIN_PENDING',
                    status: 'PENDING_BUYER_CONFIRMATION',
                    notes: `Auction manually ended by admin ${user.name}. Winner has 24 hours to confirm.`,
                },
            });
            await tx.userCard.update({
                where: { id: auction_id },
                data: { notes: `Manually ended by admin - Pending winner confirmation (Transaction #${pendingTransaction.id})` },
            });
            const losingBids = await tx.bid.findMany({
                where: { userCardId: auction_id, is_active: true, id: { not: highestBid.id } },
                select: { bidderId: true },
            });
            return {
                kind: 'winner' as const,
                transaction: pendingTransaction,
                winnerId: highestBid.bidderId,
                winningAmount: Number(highestBid.amount),
                losingBidders: losingBids.map((b) => b.bidderId),
            };
        });

        if (outcome.kind === 'already') {
            return NextResponse.json({ error: 'Auction is no longer available (already ended)' }, { status: 409 });
        }

        if (outcome.kind === 'nobid') {
            return NextResponse.json({ success: true, message: 'Auction ended - no bids received', auction_id, card_name: card.name });
        }

        if (outcome.kind === 'reserve') {
            return NextResponse.json({
                success: true,
                message: 'Auction ended - reserve price not met',
                auction_id,
                card_name: card.name,
                highest_bid: outcome.highestAmount,
                reserve_price: outcome.reservePrice,
            });
        }

        // Winner path — notifications + real-time push.
        const winner = await prisma.user.findUnique({ where: { id: outcome.winnerId }, select: { name: true } });
        try {
            await createAuctionWonNotifications(outcome.winnerId, auction.owner_id, card.name, outcome.winningAmount, auction_id);
            if (outcome.losingBidders.length > 0) {
                await createAuctionLostNotifications(outcome.losingBidders, card.name, outcome.winningAmount, auction_id);
            }
        } catch (notificationError) {
            console.error('Error creating notifications:', notificationError);
        }

        emitAppEvent({ type: 'auction_ended', auctionId: auction_id });

        return NextResponse.json({
            success: true,
            message: 'Auction ended successfully',
            auction_id,
            card_name: card.name,
            winner: winner?.name ?? 'Unknown',
            winning_bid: outcome.winningAmount,
            transaction_id: outcome.transaction.id,
        });

    } catch (error) {
        console.error('Error ending auction:', error);
        return NextResponse.json(
            {
                error: 'Failed to end auction',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}