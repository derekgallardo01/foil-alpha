// src/app/api/user-cards/my-sales/route.ts - FIXED for updated schema
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const userId = user.id;

        console.log(`Fetching sales data for user ${userId}`);

        // FIXED: Use correct field names from schema
        const [activeSales, soldTransactions] = await Promise.all([
            // Active sales query
            prisma.userCard.findMany({
                where: {
                    owner_id: userId,
                    is_for_sale: true,
                    is_sold: false
                },
                orderBy: { created_at: 'desc' },
                take: 50
            }),

            // Sold items query  
            prisma.transaction.findMany({
                where: {
                    seller_id: userId,
                    status: 'COMPLETED'
                },
                orderBy: { created_at: 'desc' },
                take: 50
            })
        ]);

        console.log(`Found ${activeSales.length} active sales and ${soldTransactions.length} sold transactions`);

        // Batch-load everything both lists reference (replaces per-item N+1:
        // was ~1 card + 1 bids + N bidders per active sale, and 1 userCard +
        // 1 card + 1 buyer per sold item).
        const soldUserCardIds = [...new Set(soldTransactions.map((t) => t.user_card_id))];
        const soldUserCards = soldUserCardIds.length
            ? await prisma.userCard.findMany({ where: { id: { in: soldUserCardIds } } })
            : [];
        const soldUserCardById = new Map(soldUserCards.map((uc) => [uc.id, uc]));

        const cardIds = [...new Set([
            ...activeSales.map((s) => s.card_id),
            ...soldUserCards.map((uc) => uc.card_id),
        ])];
        const cards = cardIds.length
            ? await prisma.card.findMany({
                where: { id: { in: cardIds } },
                select: { id: true, name: true, set_name: true, card_number: true, rarity: true, image_url: true },
            })
            : [];
        const cardById = new Map(cards.map((c) => [c.id, c]));

        const activeSaleIds = activeSales.map((s) => s.id);
        const activeBids = activeSaleIds.length
            ? await prisma.bid.findMany({
                where: { userCardId: { in: activeSaleIds }, is_active: true },
                orderBy: { amount: 'desc' },
            })
            : [];
        const bidsByUserCard = new Map<number, typeof activeBids>();
        for (const bid of activeBids) {
            const list = bidsByUserCard.get(bid.userCardId) ?? [];
            list.push(bid);
            bidsByUserCard.set(bid.userCardId, list);
        }

        const userIds = [...new Set([
            ...soldTransactions.map((t) => t.buyer_id),
            ...activeBids.map((b) => b.bidderId),
        ])];
        const users = userIds.length
            ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
            : [];
        const userById = new Map(users.map((u) => [u.id, u]));

        // Process active sales with related data
        const now = new Date();
        const activeSalesProcessed = activeSales.map((sale) => {
            const card = cardById.get(sale.card_id);
            if (!card) {
                console.warn(`Card not found for sale ${sale.id}`);
                return null;
            }

            // Top 10 active bids for this sale (matches the previous take: 10).
            const bidsWithBidders = (bidsByUserCard.get(sale.id) ?? []).slice(0, 10).map((bid) => ({
                id: bid.id,
                amount: Number(bid.amount),
                bidder: userById.get(bid.bidderId) || { id: 0, name: 'Unknown', email: '' },
                created_at: bid.createdAt.toISOString(),
                is_active: bid.is_active,
            }));

            const auctionEnd = sale.auction_end ? new Date(sale.auction_end) : null;
            const timeRemaining = auctionEnd ? Math.max(0, auctionEnd.getTime() - now.getTime()) : null;
            const highestBid = bidsWithBidders.length > 0 ? bidsWithBidders[0].amount : null;

            return {
                id: sale.id,
                card: {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_number: card.card_number, // FIXED: Map card_number to set_number for frontend
                    rarity: card.rarity,
                    image_url: card.image_url,
                    small_image_url: card.image_url // Use same image for both
                },
                condition: sale.condition || 'Unknown',
                sale_type: sale.sale_type || 'FIXED',
                fixed_price: sale.fixed_price ? Number(sale.fixed_price) : null,
                reserve_price: sale.reserve_price ? Number(sale.reserve_price) : null,
                auction_end: sale.auction_end?.toISOString() || null,
                bids: bidsWithBidders,
                highest_bid: highestBid,
                bid_count: bidsWithBidders.length,
                time_remaining: timeRemaining,
                created_at: sale.created_at.toISOString()
            };
        });

        // Process sold items with related data
        const soldItemsProcessed = soldTransactions.map((transaction) => {
            const userCard = soldUserCardById.get(transaction.user_card_id);
            if (!userCard) {
                console.warn(`UserCard not found for transaction ${transaction.id}`);
                return null;
            }

            const card = cardById.get(userCard.card_id);
            if (!card) {
                console.warn(`Card not found for transaction ${transaction.id}`);
                return null;
            }

            const buyer = userById.get(transaction.buyer_id) || { id: 0, name: 'Unknown', email: '' };

            return {
                id: transaction.id,
                card: {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_number: card.card_number, // FIXED: Map card_number to set_number for frontend
                    rarity: card.rarity,
                    image_url: card.image_url,
                    small_image_url: card.image_url // Use same image for both
                },
                condition: userCard.condition || 'Unknown',
                sale_type: transaction.transaction_type,
                sale_price: Number(transaction.amount),
                buyer: buyer,
                completed_at: transaction.updated_at.toISOString(), // Use updated_at as completion date
                created_at: transaction.created_at.toISOString(),
                notes: transaction.notes
            };
        });

        // Filter out null items and log results
        const validActiveSales = activeSalesProcessed.filter(sale => sale !== null);
        const validSoldItems = soldItemsProcessed.filter(item => item !== null);

        console.log(`Processed ${validActiveSales.length} valid active sales and ${validSoldItems.length} valid sold items`);

        const result = {
            activeSales: validActiveSales,
            soldItems: validSoldItems
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error fetching sales data:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch sales data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}