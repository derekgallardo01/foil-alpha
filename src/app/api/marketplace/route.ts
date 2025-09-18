// src/app/api/marketplace/route.ts - FIXED URL DECODING
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const showAll = searchParams.get('show_all') === 'true';

        let limit = showAll ? 10000 : parseInt(searchParams.get('limit') || '500');
        let skip = showAll ? 0 : (page - 1) * limit;

        // Extract and decode all filter parameters
        const search = decodeURIComponent(searchParams.get('search') || '');
        const setName = decodeURIComponent(searchParams.get('set') || '');
        const cardType = decodeURIComponent(searchParams.get('type') || '');
        const saleType = searchParams.get('sale_type') || '';
        const rarity = decodeURIComponent(searchParams.get('rarity') || '');
        const priceMin = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : null;
        const priceMax = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : null;
        const priceStatus = searchParams.get('price_status') || '';
        const sortBy = searchParams.get('sort_by') || 'newest';

        console.log('🔍 Incoming filters (decoded):', {
            search: search || 'NONE',
            setName: setName || 'NONE',
            cardType: cardType || 'NONE',
            rarity: rarity || 'NONE',
            saleType: saleType || 'NONE',
            priceMin,
            priceMax,
            priceStatus: priceStatus || 'NONE',
            sortBy
        });

        // Build the WHERE clause for cards
        const whereConditions: any[] = [
            { market_price: { not: null } },
            { market_price: { gt: 0 } }
        ];

        // Add search conditions
        if (search.trim()) {
            whereConditions.push({
                OR: [
                    { name: { contains: search.trim() } },
                    { set_name: { contains: search.trim() } },
                    { rarity: { contains: search.trim() } },
                    { card_number: { contains: search.trim() } }
                ]
            });
        }

        // Add exact match filters
        if (setName.trim()) {
            whereConditions.push({ set_name: setName.trim() });
        }

        if (rarity.trim()) {
            whereConditions.push({ rarity: rarity.trim() });
        }

        if (cardType.trim()) {
            whereConditions.push({ card_type: cardType.trim() });
        }

        // Add price range filter
        if (priceMin !== null || priceMax !== null) {
            const priceCondition: any = {};
            if (priceMin !== null) priceCondition.gte = priceMin;
            if (priceMax !== null) priceCondition.lte = priceMax;
            whereConditions.push({ market_price: priceCondition });
        }

        // Combine all conditions
        const cardWhere: Prisma.CardWhereInput = {
            AND: whereConditions
        };

        console.log('📋 Card filter:', JSON.stringify(cardWhere, null, 2));

        // Fetch catalog cards
        const catalogCards = await prisma.card.findMany({
            where: cardWhere,
            orderBy: getOrderBy(sortBy),
        });

        console.log(`✅ Found ${catalogCards.length} catalog cards`);

        // Let's also log a few card examples to verify the data
        if (catalogCards.length > 0 && catalogCards.length < 10) {
            console.log('Sample cards found:', catalogCards.slice(0, 3).map(c => ({
                name: c.name,
                set_name: c.set_name,
                rarity: c.rarity,
                card_type: c.card_type
            })));
        }

        // Fetch user cards
        const userCardWhere: Prisma.UserCardWhereInput = {
            is_for_sale: true,
            is_sold: false,
        };

        if (saleType) {
            userCardWhere.sale_type = saleType;
        } else {
            userCardWhere.OR = [
                { sale_type: 'FIXED' },
                { sale_type: 'AUCTION', auction_end: { gt: new Date() } }
            ];
        }

        // Get user cards first
        const userCards = await prisma.userCard.findMany({
            where: userCardWhere,
            orderBy: { created_at: 'desc' }
        });

        console.log(`📊 Found ${userCards.length} user cards for sale`);

        // Get the card data for user cards
        let filteredUserCards: any[] = [];
        if (userCards.length > 0) {
            const userCardIds = userCards.map(uc => uc.card_id);

            // Get cards that match both user ownership and our filters
            const userCardData = await prisma.card.findMany({
                where: {
                    AND: [
                        { id: { in: userCardIds } },
                        ...whereConditions // Apply same filters as catalog cards
                    ]
                }
            });

            console.log(`🎯 Found ${userCardData.length} cards matching filters from user cards`);

            // Create a map of card data
            const cardDataMap = new Map(userCardData.map(c => [c.id, c]));

            // Filter user cards to only those with matching card data
            filteredUserCards = userCards
                .filter(uc => cardDataMap.has(uc.card_id))
                .map(uc => ({
                    ...uc,
                    card: cardDataMap.get(uc.card_id)!
                }));
        }

        // Get related data
        const ownerIds = [...new Set(filteredUserCards.map(uc => uc.owner_id))];
        const userCardIds = filteredUserCards.map(uc => uc.id);

        const [owners, bids] = await Promise.all([
            ownerIds.length > 0
                ? prisma.user.findMany({
                    where: { id: { in: ownerIds } },
                    select: { id: true, name: true, role: true }
                })
                : [],
            userCardIds.length > 0
                ? prisma.bid.findMany({
                    where: { userCardId: { in: userCardIds }, is_active: true },
                    orderBy: { amount: 'desc' }
                })
                : []
        ]);

        // Get bidder data
        const bidderIds = [...new Set(bids.map(b => b.bidderId))];
        const bidders = bidderIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: bidderIds } },
                select: { id: true, name: true }
            })
            : [];

        // Create lookup maps
        const ownerMap = new Map(owners.map(o => [o.id, o]));
        const bidderMap = new Map(bidders.map(b => [b.id, b]));

        // Group bids
        const bidsByUserCard = new Map<number, any[]>();
        bids.forEach(bid => {
            const userCardId = bid.userCardId;
            if (!bidsByUserCard.has(userCardId)) {
                bidsByUserCard.set(userCardId, []);
            }
            bidsByUserCard.get(userCardId)!.push({
                ...bid,
                bidder: bidderMap.get(bid.bidderId)
            });
        });

        // Create listings
        const listings: any[] = [];

        // Add catalog cards
        for (const card of catalogCards) {
            const marketPrice = Number(card.market_price || 0);

            if (priceStatus && !matchesPriceStatus({
                card: { market_price: marketPrice },
                fixed_price: marketPrice,
                reserve_price: null,
                current_price: marketPrice
            }, priceStatus)) continue;

            listings.push({
                id: `catalog-${card.id}`,
                type: 'CATALOG',
                card: {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_number: card.card_number,
                    rarity: card.rarity,
                    card_type: card.card_type || 'Pokemon',
                    image_url: card.image_url,
                    small_image_url: card.image_url,
                    market_price: marketPrice,
                    price_trend: 'stable',
                    last_price_update: card.last_updated,
                },
                owner: { id: null, name: 'TCG Market', role: 'system' },
                condition: 'Mint',
                sale_type: 'FIXED',
                current_price: marketPrice,
                fixed_price: marketPrice,
                reserve_price: null,
                auction_end: null,
                highest_bid: null,
                bid_count: 0,
                time_remaining: null,
                is_auction_expired: false,
                notes: 'New card from Pokemon TCG catalog',
                availability: 'IN_STOCK',
            });
        }

        // Add user cards
        for (const userCard of filteredUserCards) {
            const card = userCard.card;
            const userCardBids = bidsByUserCard.get(userCard.id) || [];
            const highestBid = userCardBids.length > 0 ? Number(userCardBids[0].amount) : null;
            const current_price = userCard.sale_type === 'FIXED'
                ? Number(userCard.fixed_price || 0)
                : highestBid || Number(userCard.reserve_price || 0);

            let time_remaining = null;
            let is_auction_expired = false;
            if (userCard.sale_type === 'AUCTION' && userCard.auction_end) {
                const endTime = new Date(userCard.auction_end).getTime();
                const now = Date.now();
                time_remaining = Math.max(0, endTime - now);
                is_auction_expired = time_remaining <= 0;
                if (is_auction_expired) continue;
            }

            if (priceStatus && !matchesPriceStatus({
                card: { market_price: Number(card.market_price || 0) },
                fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
                reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
                current_price
            }, priceStatus)) continue;

            listings.push({
                id: `user-${userCard.id}`,
                type: 'USER_CARD',
                user_card_id: userCard.id,
                card: {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_number: card.card_number,
                    rarity: card.rarity,
                    card_type: card.card_type || 'Pokemon',
                    image_url: card.image_url,
                    small_image_url: card.image_url,
                    market_price: card.market_price ? Number(card.market_price) : null,
                    price_trend: 'stable',
                    last_price_update: card.last_updated,
                },
                owner: ownerMap.get(userCard.owner_id) || { id: userCard.owner_id, name: 'Unknown', role: 'user' },
                condition: userCard.condition || 'Near Mint',
                sale_type: userCard.sale_type,
                current_price,
                fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
                reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
                auction_end: userCard.auction_end,
                highest_bid: highestBid,
                highest_bidder: userCardBids[0]?.bidder || null,
                bid_count: userCardBids.length,
                time_remaining,
                is_auction_expired,
                notes: userCard.notes,
                availability: 'FOR_SALE',
            });
        }

        // Sort listings
        listings.sort((a, b) => sortListings(a, b, sortBy));

        // Paginate
        const totalListings = listings.length;
        const paginatedListings = showAll
            ? listings
            : listings.slice(skip, skip + limit);

        console.log(`📦 Returning ${paginatedListings.length} of ${totalListings} total listings`);

        // Get filter options
        const [sets, types, rarities, priceRange] = await Promise.all([
            getAvailableSets(),
            getAvailableTypes(),
            getAvailableRarities(),
            getPriceRange()
        ]);

        return NextResponse.json({
            listings: paginatedListings,
            pagination: {
                page: showAll ? 1 : page,
                limit: showAll ? totalListings : limit,
                total: totalListings,
                totalPages: showAll ? 1 : Math.ceil(totalListings / limit),
                catalog_cards: listings.filter(l => l.type === 'CATALOG').length,
                user_cards: listings.filter(l => l.type === 'USER_CARD').length,
                showAll: showAll,
            },
            filters: {
                sets,
                types,
                rarities,
                price_range: priceRange,
            },
        });

    } catch (error: any) {
        console.error('❌ Marketplace API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch marketplace listings', details: error.message },
            { status: 500 }
        );
    }
}

// Helper function to check if listing matches price status filter
function matchesPriceStatus(listing: any, priceStatus: string): boolean {
    const marketPrice = listing.card.market_price;
    const userPrice = listing.fixed_price || listing.reserve_price || listing.current_price;

    if (!marketPrice || !userPrice) return true;

    const priceDiff = ((userPrice - marketPrice) / marketPrice) * 100;

    switch (priceStatus) {
        case 'below_market':
            return priceDiff < -5;
        case 'at_market':
            return Math.abs(priceDiff) <= 5;
        case 'above_market':
            return priceDiff > 5;
        case 'good_deals':
            return priceDiff <= -10;
        default:
            return true;
    }
}

// Helper function for sorting
function sortListings(a: any, b: any, sortBy: string): number {
    switch (sortBy) {
        case 'price_low':
            return a.current_price - b.current_price;
        case 'price_high':
            return b.current_price - a.current_price;
        case 'market_value':
            return (b.card.market_price || 0) - (a.card.market_price || 0);
        case 'best_deals':
            const aDiff = a.card.market_price ? ((a.card.market_price - a.current_price) / a.card.market_price) : 0;
            const bDiff = b.card.market_price ? ((b.card.market_price - b.current_price) / b.card.market_price) : 0;
            return bDiff - aDiff;
        case 'ending_soon':
            if (a.time_remaining && b.time_remaining) return a.time_remaining - b.time_remaining;
            if (a.time_remaining) return -1;
            if (b.time_remaining) return 1;
            return 0;
        case 'newest':
        default:
            if (a.type === 'CATALOG' && b.type === 'USER_CARD') return -1;
            if (a.type === 'USER_CARD' && b.type === 'CATALOG') return 1;
            return 0;
    }
}

// Fixed helper function for order by with proper Prisma types
function getOrderBy(sortBy: string): Prisma.CardOrderByWithRelationInput {
    switch (sortBy) {
        case 'price_low':
            return { market_price: 'asc' };
        case 'price_high':
            return { market_price: 'desc' };
        case 'market_value':
            return { market_price: 'desc' };
        case 'newest':
        default:
            return { created_at: 'desc' };
    }
}

// Helper functions to get available filter options
async function getAvailableSets() {
    try {
        const sets = await prisma.card.groupBy({
            by: ['set_name'],
            _count: true,
            where: {
                set_name: { not: '' },
                market_price: { not: null, gt: 0 }
            },
            orderBy: {
                _count: {
                    set_name: 'desc'
                }
            }
        });

        return sets
            .filter(s => s.set_name)
            .map(s => ({
                name: s.set_name!,
                count: s._count
            }));
    } catch (error) {
        console.error('Error fetching available sets:', error);
        return [];
    }
}

async function getAvailableTypes() {
    try {
        const types = await prisma.card.groupBy({
            by: ['card_type'],
            _count: true,
            where: {
                card_type: { not: '' },
                market_price: { not: null, gt: 0 }
            },
            orderBy: {
                _count: {
                    card_type: 'desc'
                }
            }
        });

        return types
            .filter(t => t.card_type)
            .map(t => ({
                name: t.card_type!,
                count: t._count
            }));
    } catch (error) {
        console.error('Error fetching available types:', error);
        return [];
    }
}

async function getAvailableRarities() {
    try {
        const rarities = await prisma.card.groupBy({
            by: ['rarity'],
            _count: true,
            where: {
                rarity: { not: '' },
                market_price: { not: null, gt: 0 }
            },
            orderBy: {
                _count: {
                    rarity: 'desc'
                }
            }
        });

        return rarities
            .filter(r => r.rarity)
            .map(r => ({
                name: r.rarity!,
                count: r._count
            }));
    } catch (error) {
        console.error('Error fetching available rarities:', error);
        return [];
    }
}

async function getPriceRange() {
    try {
        const priceData = await prisma.card.aggregate({
            _min: { market_price: true },
            _max: { market_price: true },
            _avg: { market_price: true },
            where: {
                market_price: {
                    not: null,
                    gt: 0
                }
            }
        });

        return {
            min: priceData._min.market_price ? Math.floor(Number(priceData._min.market_price)) : 0,
            max: priceData._max.market_price ? Math.ceil(Number(priceData._max.market_price)) : 1000,
            avg: priceData._avg.market_price ? Math.round(Number(priceData._avg.market_price)) : 50
        };
    } catch (error) {
        console.error('Error fetching price range:', error);
        return { min: 0, max: 1000, avg: 50 };
    }
}