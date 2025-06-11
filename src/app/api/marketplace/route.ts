// src/app/api/marketplace/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

// GET /api/marketplace - Browse cards for sale
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const setName = searchParams.get('set') || '';
        const cardType = searchParams.get('type') || '';
        const saleType = searchParams.get('saleType') || ''; // 'FIXED' or 'AUCTION'
        const condition = searchParams.get('condition') || '';
        const minPrice = searchParams.get('minPrice');
        const maxPrice = searchParams.get('maxPrice');
        const sortBy = searchParams.get('sortBy') || 'created_at'; // 'price', 'created_at', 'auction_end'
        const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc' or 'desc'

        const skip = (page - 1) * limit;

        // Build where clause for filtering
        const where: any = {
            is_for_sale: true,
            is_sold: false
        };

        // Card filters with MySQL-compatible syntax
        if (search || setName || cardType) {
            where.card = {};

            if (search) {
                // Use case-insensitive search with raw SQL
                where.card.name = {
                    contains: search
                };
            }

            if (setName) {
                where.card.set_name = setName;
            }

            if (cardType) {
                where.card.card_type = cardType;
            }
        }

        // Sale type filter
        if (saleType) {
            where.sale_type = saleType;
        }

        // Condition filter
        if (condition) {
            where.condition = condition;
        }

        // Price filters
        if (minPrice || maxPrice) {
            where.OR = [];

            // For fixed price cards
            const fixedPriceCondition: any = {
                sale_type: 'FIXED',
                fixed_price: {}
            };

            if (minPrice) {
                fixedPriceCondition.fixed_price.gte = parseFloat(minPrice);
            }
            if (maxPrice) {
                fixedPriceCondition.fixed_price.lte = parseFloat(maxPrice);
            }

            where.OR.push(fixedPriceCondition);

            // For auction cards (use reserve price)
            const auctionCondition: any = {
                sale_type: 'AUCTION'
            };

            if (minPrice || maxPrice) {
                auctionCondition.reserve_price = {};
                if (minPrice) {
                    auctionCondition.reserve_price.gte = parseFloat(minPrice);
                }
                if (maxPrice) {
                    auctionCondition.reserve_price.lte = parseFloat(maxPrice);
                }
            }

            where.OR.push(auctionCondition);
        }

        // Build orderBy clause
        let orderBy: any = {};

        switch (sortBy) {
            case 'price':
                orderBy = { fixed_price: sortOrder };
                break;
            case 'auction_end':
                orderBy = { auction_end: sortOrder };
                break;
            default:
                orderBy = { created_at: sortOrder };
        }

        // Get cards for sale with current bids
        const [userCards, totalCount] = await Promise.all([
            prisma.userCard.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    card: true,
                    owner: {
                        select: { id: true, name: true }
                    },
                    bids: {
                        where: { is_active: true },
                        orderBy: { amount: 'desc' },
                        take: 5, // Get top 5 bids
                        include: {
                            bidder: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            }),
            prisma.userCard.count({ where })
        ]);

        // Process results to add computed fields
        const processedCards = userCards.map(userCard => {
            const currentHighestBid = userCard.bids[0];
            const currentPrice = userCard.sale_type === 'FIXED'
                ? userCard.fixed_price
                : currentHighestBid?.amount || userCard.reserve_price || 0;

            const timeLeft = userCard.auction_end
                ? Math.max(0, userCard.auction_end.getTime() - Date.now())
                : null;

            return {
                ...userCard,
                current_price: currentPrice,
                current_highest_bid: currentHighestBid?.amount || null,
                bid_count: userCard.bids.length,
                time_left_ms: timeLeft,
                is_auction_active: userCard.sale_type === 'AUCTION' &&
                    (!userCard.auction_end || userCard.auction_end > new Date())
            };
        });

        return NextResponse.json({
            cards: processedCards,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            },
            filters: {
                available_sets: await getAvailableSets(),
                available_types: await getAvailableTypes(),
                available_conditions: ['NM', 'LP', 'MP', 'HP', 'DMG']
            }
        });

    } catch (error) {
        console.error('Error fetching marketplace cards:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch marketplace cards',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// Helper function to get available sets
async function getAvailableSets() {
    try {
        const sets = await prisma.card.findMany({
            select: { set_name: true },
            distinct: ['set_name'],
            where: {
                userCards: {
                    some: {
                        is_for_sale: true,
                        is_sold: false
                    }
                }
            }
        });
        return sets.map(s => s.set_name);
    } catch {
        return [];
    }
}

// Helper function to get available card types
async function getAvailableTypes() {
    try {
        const types = await prisma.card.findMany({
            select: { card_type: true },
            distinct: ['card_type'],
            where: {
                userCards: {
                    some: {
                        is_for_sale: true,
                        is_sold: false
                    }
                }
            }
        });
        return types.map(t => t.card_type);
    } catch {
        return [];
    }
}