// src/app/api/marketplace/route.ts - Updated with proper inventory management
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const setName = searchParams.get('set') || '';
        const cardType = searchParams.get('type') || '';
        const saleType = searchParams.get('sale_type') || '';
        const rarity = searchParams.get('rarity') || '';
        const priceMin = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : null;
        const priceMax = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : null;
        const priceStatus = searchParams.get('price_status') || '';
        const sortBy = searchParams.get('sort_by') || 'newest';

        if (page < 1 || limit < 1) {
            return NextResponse.json(
                { error: 'Invalid pagination parameters' },
                { status: 400 }
            );
        }

        const skip = (page - 1) * limit;

        // Build card filter
        const cardFilter: Prisma.CardWhereInput = {};
        if (search) {
            cardFilter.OR = [
                { name: { contains: search } },
                { set_name: { contains: search } },
                { card_type: { contains: search } }
            ];
        }
        if (setName) cardFilter.set_name = setName;
        if (cardType) cardFilter.card_type = cardType;
        if (rarity) cardFilter.rarity = rarity;

        // Updated user card filter - only show available cards
        const userCardFilter: Prisma.UserCardWhereInput = {
            is_for_sale: true,
            is_sold: false, // IMPORTANT: Only show unsold cards
            // Add additional checks to ensure card is still available
        };

        if (saleType) {
            userCardFilter.sale_type = saleType;
        } else {
            userCardFilter.OR = [
                { sale_type: 'FIXED' },
                {
                    sale_type: 'AUCTION',
                    auction_end: { gt: new Date() } // Only active auctions
                },
            ];
        }

        console.log('Marketplace query filters:', {
            search, setName, cardType, saleType, rarity, priceMin, priceMax, priceStatus, sortBy, page, limit,
        });

        // Get catalog cards - these have unlimited stock
        const catalogCards = await prisma.card.findMany({
            where: {
                ...cardFilter,
                market_price: { not: null, gt: 0 },
                // Add a flag to identify catalog cards (you might need to add this field)
                // OR check if this card has any active user listings to avoid duplicates
            },
            take: limit * 2,
            orderBy: getOrderBy(sortBy),
        });

        // Get AVAILABLE user cards for sale (not sold, not expired)
        const userCardsForSale = await prisma.userCard.findMany({
            where: userCardFilter,
            take: limit * 2,
            orderBy: { created_at: 'desc' },
        });

        // Double-check that user cards are still available
        const availableUserCards = [];
        for (const userCard of userCardsForSale) {
            // Extra validation to ensure card is really available
            if (!userCard.is_sold && userCard.is_for_sale) {
                // For auctions, check if not expired
                if (userCard.sale_type === 'AUCTION' && userCard.auction_end) {
                    if (new Date(userCard.auction_end) > new Date()) {
                        availableUserCards.push(userCard);
                    }
                } else if (userCard.sale_type === 'FIXED') {
                    availableUserCards.push(userCard);
                }
            }
        }

        // Filter user cards that match our card filter
        const userCardsWithMatchingCards = [];
        if (availableUserCards.length > 0) {
            const userCardIds = availableUserCards.map(uc => uc.card_id);
            const matchingCards = await prisma.card.findMany({
                where: {
                    id: { in: userCardIds },
                    ...cardFilter
                }
            });
            const matchingCardIds = new Set(matchingCards.map(c => c.id));

            for (const userCard of availableUserCards) {
                if (matchingCardIds.has(userCard.card_id)) {
                    userCardsWithMatchingCards.push(userCard);
                }
            }
        }

        // Get related data separately
        const allCardIds = [
            ...catalogCards.map(c => c.id),
            ...userCardsWithMatchingCards.map(uc => uc.card_id)
        ];
        const uniqueCardIds = [...new Set(allCardIds)];

        const ownerIds = [...new Set(userCardsWithMatchingCards.map(uc => uc.owner_id))];
        const userCardIds = userCardsWithMatchingCards.map(uc => uc.id);

        // Fetch related data in parallel
        const [
            pokemonSets,
            rarities,
            subtypes,
            supertypes,
            owners,
            allBids,
            totalCatalogCount,
            totalUserCardsCount
        ] = await Promise.all([
            prisma.pokemonSet.findMany(),
            uniqueCardIds.length > 0 ? prisma.rarity.findMany() : [],
            uniqueCardIds.length > 0 ? prisma.subtype.findMany() : [],
            uniqueCardIds.length > 0 ? prisma.supertype.findMany() : [],
            ownerIds.length > 0 ? prisma.user.findMany({
                where: { id: { in: ownerIds } },
                select: { id: true, name: true, role: true }
            }) : [],
            userCardIds.length > 0 ? prisma.bid.findMany({
                where: {
                    userCardId: { in: userCardIds },
                    is_active: true
                },
                orderBy: { amount: 'desc' }
            }) : [],
            prisma.card.count({
                where: {
                    ...cardFilter,
                    market_price: { not: null, gt: 0 },
                },
            }),
            // Updated count to only include available cards
            prisma.userCard.count({
                where: {
                    ...userCardFilter,
                    is_sold: false, // Ensure we only count unsold cards
                },
            })
        ]);

        // Get bidders for the bids
        const bidderIds = [...new Set(allBids.map(bid => bid.bidderId))];
        const bidders = bidderIds.length > 0 ? await prisma.user.findMany({
            where: { id: { in: bidderIds } },
            select: { id: true, name: true }
        }) : [];

        // Create lookup maps
        const pokemonSetMap = new Map(pokemonSets.map(ps => [ps.id, ps]));
        const rarityMap = new Map(rarities.map(r => [r.id, r]));
        const subtypeMap = new Map(subtypes.map(st => [st.id, st]));
        const supertypeMap = new Map(supertypes.map(st => [st.id, st]));
        const ownerMap = new Map(owners.map(o => [o.id, o]));
        const bidderMap = new Map(bidders.map(b => [b.id, b]));

        // Group bids by user card ID
        const bidsByUserCard = new Map();
        allBids.forEach(bid => {
            if (!bidsByUserCard.has(bid.userCardId)) {
                bidsByUserCard.set(bid.userCardId, []);
            }
            bidsByUserCard.get(bid.userCardId).push({
                ...bid,
                bidder: bidderMap.get(bid.bidderId)
            });
        });

        // Convert to listings format
        const listings = [];

        // Process catalog cards - these are always available
        for (const card of catalogCards) {
            const marketPrice = Number(card.market_price || 0);

            if (priceMin !== null && marketPrice < priceMin) continue;
            if (priceMax !== null && marketPrice > priceMax) continue;

            // Check if this card is already being sold by users to avoid confusion
            const hasUserListings = userCardsWithMatchingCards.some(uc => uc.card_id === card.id);

            const listing = {
                id: `catalog-${card.id}`,
                type: 'CATALOG' as const,
                card: {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_number: card.set_number,
                    rarity: card.rarity,
                    card_type: card.card_type,
                    image_url: card.image_url,
                    small_image_url: card.small_image_url,
                    market_price: marketPrice,
                    price_trend: card.price_trend,
                    last_price_update: card.last_price_update,
                    set: card.set_id ? pokemonSetMap.get(card.set_id) : null,
                    rarity_info: card.rarity_id ? rarityMap.get(card.rarity_id) : null,
                    subtype_info: card.subtype_id ? subtypeMap.get(card.subtype_id) : null,
                    supertype_info: card.supertype_id ? supertypeMap.get(card.supertype_id) : null,
                },
                owner: { id: null, name: 'TCG Market', role: 'system' },
                condition: 'Mint',
                sale_type: 'FIXED' as const,
                current_price: marketPrice,
                fixed_price: marketPrice,
                reserve_price: null,
                auction_end: null,
                highest_bid: null,
                bid_count: 0,
                time_remaining: null,
                is_auction_expired: false,
                notes: 'New card from Pokemon TCG catalog',
                availability: 'IN_STOCK' as const,
                has_user_listings: hasUserListings, // Flag to indicate user competition
            };

            // Apply price status filter for catalog cards
            if (priceStatus && !matchesPriceStatus(listing, priceStatus)) continue;

            listings.push(listing);
        }

        // Process available user cards
        for (const userCard of userCardsWithMatchingCards) {
            try {
                // Get the card data
                const card = catalogCards.find(c => c.id === userCard.card_id) ||
                    await prisma.card.findUnique({ where: { id: userCard.card_id } });

                if (!card) continue;

                // Extra check: verify this card is really still available
                const cardStillAvailable = await prisma.userCard.findUnique({
                    where: {
                        id: userCard.id,
                        is_for_sale: true,
                        is_sold: false
                    }
                });

                if (!cardStillAvailable) {
                    console.log(`Skipping card ${userCard.id} - no longer available`);
                    continue;
                }

                const userCardBids = bidsByUserCard.get(userCard.id) || [];
                const highestBid = userCardBids.length > 0 ? Number(userCardBids[0].amount) : null;
                const current_price =
                    userCard.sale_type === 'FIXED'
                        ? Number(userCard.fixed_price || 0)
                        : highestBid || Number(userCard.reserve_price || 0);

                if (priceMin !== null && current_price < priceMin) continue;
                if (priceMax !== null && current_price > priceMax) continue;

                let time_remaining = null;
                let is_auction_expired = false;
                if (userCard.sale_type === 'AUCTION' && userCard.auction_end) {
                    const endTime = new Date(userCard.auction_end).getTime();
                    const now = Date.now();
                    time_remaining = Math.max(0, endTime - now);
                    is_auction_expired = time_remaining <= 0;

                    // Skip expired auctions
                    if (is_auction_expired) {
                        console.log(`Skipping expired auction ${userCard.id}`);
                        continue;
                    }
                }

                const listing = {
                    id: `user-${userCard.id}`,
                    type: 'USER_CARD' as const,
                    user_card_id: userCard.id,
                    card: {
                        id: card.id,
                        name: card.name,
                        set_name: card.set_name,
                        set_number: card.set_number,
                        rarity: card.rarity,
                        card_type: card.card_type,
                        image_url: card.image_url,
                        small_image_url: card.small_image_url,
                        market_price: card.market_price ? Number(card.market_price) : null,
                        price_trend: card.price_trend,
                        last_price_update: card.last_price_update,
                        set: card.set_id ? pokemonSetMap.get(card.set_id) : null,
                        rarity_info: card.rarity_id ? rarityMap.get(card.rarity_id) : null,
                        subtype_info: card.subtype_id ? subtypeMap.get(card.subtype_id) : null,
                        supertype_info: card.supertype_id ? supertypeMap.get(card.supertype_id) : null,
                    },
                    owner: ownerMap.get(userCard.owner_id),
                    condition: userCard.condition,
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
                    availability: 'FOR_SALE' as const,
                };

                // Apply price status filter for user cards
                if (priceStatus && !matchesPriceStatus(listing, priceStatus)) continue;

                listings.push(listing);
            } catch (error) {
                console.error(`Error processing userCard ${userCard.id}:`, error);
                continue;
            }
        }

        // Sort listings
        listings.sort((a, b) => sortListings(a, b, sortBy));

        // Apply pagination
        const paginatedListings = listings.slice(skip, skip + limit);

        console.log(`Returning ${paginatedListings.length} available listings (Total found: ${listings.length})`);

        return NextResponse.json({
            listings: paginatedListings,
            pagination: {
                page,
                limit,
                total: listings.length,
                totalPages: Math.ceil(listings.length / limit),
                catalog_cards: listings.filter(l => l.type === 'CATALOG').length,
                user_cards: listings.filter(l => l.type === 'USER_CARD').length,
            },
            filters: {
                sets: await getAvailableSets().catch((err) => {
                    console.error('Error fetching sets:', err);
                    return [];
                }),
                types: await getAvailableTypes().catch((err) => {
                    console.error('Error fetching types:', err);
                    return [];
                }),
                rarities: await getAvailableRarities().catch((err) => {
                    console.error('Error fetching rarities:', err);
                    return [];
                }),
                price_range: await getPriceRange().catch((err) => {
                    console.error('Error fetching price range:', err);
                    return { min: 0, max: 1000, avg: 50 };
                }),
            },
        });
    } catch (error: any) {
        console.error('Marketplace API error:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
        });
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

// Helper functions to get filter options
async function getAvailableSets() {
    const sets = await prisma.card.groupBy({
        by: ['set_name'],
        _count: { set_name: true },
        orderBy: { set_name: 'asc' }
    });
    return sets.map(s => ({ name: s.set_name, count: s._count.set_name }));
}

async function getAvailableTypes() {
    const types = await prisma.card.groupBy({
        by: ['card_type'],
        _count: { card_type: true },
        where: { card_type: { not: null } },
        orderBy: { card_type: 'asc' }
    });
    return types.map(t => ({ name: t.card_type!, count: t._count.card_type }));
}

async function getAvailableRarities() {
    const rarities = await prisma.card.groupBy({
        by: ['rarity'],
        _count: { rarity: true },
        orderBy: { rarity: 'asc' }
    });
    return rarities.map(r => ({ name: r.rarity, count: r._count.rarity }));
}

async function getPriceRange() {
    const priceData = await prisma.card.aggregate({
        _min: { market_price: true },
        _max: { market_price: true },
        _avg: { market_price: true },
        where: { market_price: { not: null } }
    });
    return {
        min: priceData._min.market_price ? Number(priceData._min.market_price) : 0,
        max: priceData._max.market_price ? Number(priceData._max.market_price) : 1000,
        avg: priceData._avg.market_price ? Number(priceData._avg.market_price) : 50
    };
}