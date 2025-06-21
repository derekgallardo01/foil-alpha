// // src/app/api/marketplace/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '../../lib/prisma';

// // GET /api/marketplace - Browse cards for sale
// export async function GET(request: NextRequest) {
//     try {
//         const { searchParams } = new URL(request.url);
//         const page = parseInt(searchParams.get('page') || '1');
//         const limit = parseInt(searchParams.get('limit') || '20');
//         const search = searchParams.get('search') || '';
//         const setName = searchParams.get('set') || '';
//         const cardType = searchParams.get('type') || '';
//         const saleType = searchParams.get('saleType') || ''; // 'FIXED' or 'AUCTION'
//         const condition = searchParams.get('condition') || '';
//         const minPrice = searchParams.get('minPrice');
//         const maxPrice = searchParams.get('maxPrice');
//         const sortBy = searchParams.get('sortBy') || 'created_at'; // 'price', 'created_at', 'auction_end'
//         const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc' or 'desc'

//         const skip = (page - 1) * limit;

//         // Build where clause for filtering
//         const where: any = {
//             is_for_sale: true,
//             is_sold: false
//         };

//         // Card filters with MySQL-compatible syntax
//         if (search || setName || cardType) {
//             where.card = {};

//             if (search) {
//                 // Use case-insensitive search with raw SQL
//                 where.card.name = {
//                     contains: search
//                 };
//             }

//             if (setName) {
//                 where.card.set_name = setName;
//             }

//             if (cardType) {
//                 where.card.card_type = cardType;
//             }
//         }

//         // Sale type filter
//         if (saleType) {
//             where.sale_type = saleType;
//         }

//         // Condition filter
//         if (condition) {
//             where.condition = condition;
//         }

//         // Price filters
//         if (minPrice || maxPrice) {
//             where.OR = [];

//             // For fixed price cards
//             const fixedPriceCondition: any = {
//                 sale_type: 'FIXED',
//                 fixed_price: {}
//             };

//             if (minPrice) {
//                 fixedPriceCondition.fixed_price.gte = parseFloat(minPrice);
//             }
//             if (maxPrice) {
//                 fixedPriceCondition.fixed_price.lte = parseFloat(maxPrice);
//             }

//             where.OR.push(fixedPriceCondition);

//             // For auction cards (use reserve price)
//             const auctionCondition: any = {
//                 sale_type: 'AUCTION'
//             };

//             if (minPrice || maxPrice) {
//                 auctionCondition.reserve_price = {};
//                 if (minPrice) {
//                     auctionCondition.reserve_price.gte = parseFloat(minPrice);
//                 }
//                 if (maxPrice) {
//                     auctionCondition.reserve_price.lte = parseFloat(maxPrice);
//                 }
//             }

//             where.OR.push(auctionCondition);
//         }

//         // Build orderBy clause
//         let orderBy: any = {};

//         switch (sortBy) {
//             case 'price':
//                 orderBy = { fixed_price: sortOrder };
//                 break;
//             case 'auction_end':
//                 orderBy = { auction_end: sortOrder };
//                 break;
//             default:
//                 orderBy = { created_at: sortOrder };
//         }

//         // Get cards for sale with current bids
//         const [userCards, totalCount] = await Promise.all([
//             prisma.userCard.findMany({
//                 where,
//                 skip,
//                 take: limit,
//                 orderBy,
//                 include: {
//                     card: true,
//                     owner: {
//                         select: { id: true, name: true }
//                     },
//                     bids: {
//                         where: { is_active: true },
//                         orderBy: { amount: 'desc' },
//                         take: 5, // Get top 5 bids
//                         include: {
//                             bidder: {
//                                 select: { id: true, name: true }
//                             }
//                         }
//                     }
//                 }
//             }),
//             prisma.userCard.count({ where })
//         ]);

//         // Process results to add computed fields
//         const processedCards = userCards.map(userCard => {
//             const currentHighestBid = userCard.bids[0];
//             const currentPrice = userCard.sale_type === 'FIXED'
//                 ? userCard.fixed_price
//                 : currentHighestBid?.amount || userCard.reserve_price || 0;

//             const timeLeft = userCard.auction_end
//                 ? Math.max(0, userCard.auction_end.getTime() - Date.now())
//                 : null;

//             return {
//                 ...userCard,
//                 current_price: currentPrice,
//                 current_highest_bid: currentHighestBid?.amount || null,
//                 bid_count: userCard.bids.length,
//                 time_left_ms: timeLeft,
//                 is_auction_active: userCard.sale_type === 'AUCTION' &&
//                     (!userCard.auction_end || userCard.auction_end > new Date())
//             };
//         });

//         return NextResponse.json({
//             cards: processedCards,
//             pagination: {
//                 page,
//                 limit,
//                 total: totalCount,
//                 totalPages: Math.ceil(totalCount / limit)
//             },
//             filters: {
//                 available_sets: await getAvailableSets(),
//                 available_types: await getAvailableTypes(),
//                 available_conditions: ['NM', 'LP', 'MP', 'HP', 'DMG']
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching marketplace cards:', error);
//         return NextResponse.json(
//             {
//                 error: 'Failed to fetch marketplace cards',
//                 details: error instanceof Error ? error.message : 'Unknown error'
//             },
//             { status: 500 }
//         );
//     }
// }

// // Helper function to get available sets
// async function getAvailableSets() {
//     try {
//         const sets = await prisma.card.findMany({
//             select: { set_name: true },
//             distinct: ['set_name'],
//             where: {
//                 userCards: {
//                     some: {
//                         is_for_sale: true,
//                         is_sold: false
//                     }
//                 }
//             }
//         });
//         return sets.map(s => s.set_name);
//     } catch {
//         return [];
//     }
// }

// // Helper function to get available card types
// async function getAvailableTypes() {
//     try {
//         const types = await prisma.card.findMany({
//             select: { card_type: true },
//             distinct: ['card_type'],
//             where: {
//                 userCards: {
//                     some: {
//                         is_for_sale: true,
//                         is_sold: false
//                     }
//                 }
//             }
//         });
//         return types.map(t => t.card_type);
//     } catch {
//         return [];
//     }
// }
// src/app/api/marketplace/route.ts - Ultra simplified version
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

// GET /api/marketplace - Get cards for sale
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const saleType = searchParams.get('sale_type') || '';
        const condition = searchParams.get('condition') || '';

        const skip = (page - 1) * limit;

        // Build basic where clause
        const where: any = {
            is_for_sale: true,
            is_sold: false,
        };

        if (saleType) {
            where.sale_type = saleType;
        }

        if (condition) {
            where.condition = condition;
        }

        // Active auctions only
        if (saleType === 'AUCTION') {
            where.auction_end = {
                gt: new Date()
            };
        }

        // Get user cards that are for sale (no includes)
        const [userCards, totalCount] = await Promise.all([
            prisma.userCard.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    created_at: 'desc'
                }
            }),
            prisma.userCard.count({ where })
        ]);

        // Build listings array step by step
        const listings = [];

        for (const userCard of userCards) {
            try {
                // Get card details
                const card = await prisma.card.findUnique({
                    where: { id: userCard.card_id }
                });

                if (!card) continue;

                // Apply search filter
                if (search && !card.name.toLowerCase().includes(search.toLowerCase())) {
                    continue;
                }

                // Get owner details
                const owner = await prisma.user.findUnique({
                    where: { id: userCard.owner_id }
                });

                if (!owner) continue;

                // Get bid count for auctions (simple count, no includes)
                const bidCount = userCard.sale_type === 'AUCTION' ?
                    await prisma.bid.count({
                        where: {
                            user_card_id: userCard.id,
                            is_active: true
                        }
                    }) : 0;

                // Get highest bid amount for auctions
                let highestBid = null;
                if (userCard.sale_type === 'AUCTION') {
                    const topBid = await prisma.bid.findFirst({
                        where: {
                            user_card_id: userCard.id,
                            is_active: true
                        },
                        orderBy: { amount: 'desc' }
                    });
                    highestBid = topBid ? Number(topBid.amount) : null;
                }

                // Calculate current price
                const current_price = userCard.sale_type === 'FIXED'
                    ? Number(userCard.fixed_price || 0)
                    : (highestBid || Number(userCard.reserve_price || 0));

                // Calculate time remaining for auctions
                const time_remaining = userCard.sale_type === 'AUCTION' && userCard.auction_end
                    ? Math.max(0, new Date(userCard.auction_end).getTime() - Date.now())
                    : null;

                // Build listing object
                const listing = {
                    id: userCard.id,
                    card: {
                        id: card.id,
                        name: card.name,
                        set_name: card.set_name,
                        set_number: card.set_number,
                        rarity: card.rarity,
                        card_type: card.card_type,
                        image_url: card.image_url,
                        small_image_url: card.small_image_url
                    },
                    owner: {
                        id: owner.id,
                        name: owner.name
                    },
                    condition: userCard.condition,
                    sale_type: userCard.sale_type,
                    fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
                    reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
                    auction_end: userCard.auction_end,
                    current_price,
                    highest_bid: highestBid,
                    bid_count: bidCount,
                    time_remaining,
                    notes: userCard.notes
                };

                listings.push(listing);

            } catch (error) {
                console.error('Error processing listing:', error);
                // Continue with next listing if one fails
                continue;
            }
        }

        return NextResponse.json({
            listings,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching marketplace:', error);
        return NextResponse.json(
            { error: 'Failed to fetch marketplace listings' },
            { status: 500 }
        );
    }
}