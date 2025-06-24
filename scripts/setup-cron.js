// src/app/api/admin/auctions/route.ts - Admin auction management
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check admin role
        const user = await prisma.user.findUnique({
            where: { id: parseInt(session.user.id) }
        });

        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { action, auction_id, winner_id } = body;

        switch (action) {
            case 'FORCE_END':
                return await forceEndAuction(auction_id, parseInt(session.user.id));

            case 'OVERRIDE_WINNER':
                return await overrideWinner(auction_id, winner_id, parseInt(session.user.id));

            case 'CANCEL_AUCTION':
                return await cancelAuction(auction_id, parseInt(session.user.id));

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Error in admin auction management:', error);
        return NextResponse.json(
            { error: 'Failed to process admin action' },
            { status: 500 }
        );
    }
}

async function forceEndAuction(auctionId: number, adminId: number) {
    const auction = await prisma.userCard.findUnique({
        where: { id: auctionId },
        include: { card: true, owner: true }
    });

    if (!auction || auction.sale_type !== 'AUCTION') {
        return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.is_sold) {
        return NextResponse.json({ error: 'Auction already completed' }, { status: 400 });
    }

    // Force end by updating auction_end to current time
    await prisma.userCard.update({
        where: { id: auctionId },
        data: { auction_end: new Date() }
    });

    // Log admin action
    await prisma.activityLog.create({
        data: {
            userId: adminId,
            action: `Force ended auction for ${auction.card.name} (ID: ${auctionId})`,
            timestamp: new Date()
        }
    });

    return NextResponse.json({
        success: true,
        message: 'Auction force ended successfully'
    });
}

async function overrideWinner(auctionId: number, winnerId: number, adminId: number) {
    // This would be a complex operation to override the auction winner
    // Implementation would involve transferring the card and handling payments

    const auction = await prisma.userCard.findUnique({
        where: { id: auctionId },
        include: { card: true }
    });

    if (!auction) {
        return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Cancel auction and unfreeze all bids
    await prisma.$transaction(async (tx) => {
        // Get all active bids
        const activeBids = await tx.bid.findMany({
            where: {
                user_card_id: auctionId,
                is_active: true
            }
        });

        // Unfreeze all bidder funds
        for (const bid of activeBids) {
            const bidderWallet = await tx.userWallet.findUnique({
                where: { user_id: bid.bidder_id }
            });

            if (bidderWallet) {
                await tx.userWallet.update({
                    where: { user_id: bid.bidder_id },
                    data: {
                        frozen_balance: { decrement: Number(bid.amount) }
                    }
                });

                // Record unfreeze transaction
                await tx.walletTransaction.create({
                    data: {
                        user_id: bid.bidder_id,
                        transaction_type: 'UNFREEZE_FUNDS',
                        amount: Number(bid.amount),
                        balance_before: Number(bidderWallet.balance),
                        balance_after: Number(bidderWallet.balance),
                        description: `Admin cancelled auction for ${auction.card.name}`,
                        reference_id: bid.id,
                        reference_type: 'ADMIN_AUCTION_CANCELLED',
                        admin_id: adminId
                    }
                });
            }

            // Deactivate bid
            await tx.bid.update({
                where: { id: bid.id },
                data: { is_active: false }
            });
        }

        // Remove from sale
        await tx.userCard.update({
            where: { id: auctionId },
            data: {
                is_for_sale: false,
                auction_end: null
            }
        });
    });

    // Log admin action
    await prisma.activityLog.create({
        data: {
            userId: adminId,
            action: `Admin cancelled auction for ${auction.card.name} (ID: ${auctionId})`,
            timestamp: new Date()
        }
    });

    return NextResponse.json({
        success: true,
        message: 'Auction cancelled successfully'
    });
}