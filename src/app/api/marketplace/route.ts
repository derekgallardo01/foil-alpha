// src/app/api/marketplace/route.ts - Fixed to properly hide sold cards
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

        // 🔥 CRITICAL FIX: Strict filtering for AVAILABLE user cards only
        const userCardFilter: Prisma.UserCardWhereInput = {
            is_for_sale: true,
            is_sold: false, // ✅ Must be unsold
            // 🚨 Additional safety checks
            AND: [
                { is_for_sale: { equals: true } },
                { is_sold: { equals: false } }
            ]
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

        console.log('🔍 Marketplace query filters:', {
            search, setName, cardType, saleType, rarity, priceMin, priceMax, priceStatus, sortBy, page, limit,
            userCardFilter
        });

        // Get catalog cards - these have unlimited stock
        const catalogCards = await prisma.card.findMany({
            where: {
                ...cardFilter,
                market_price: { not: null, gt: 0 },
            },
            take: limit * 2,
            orderBy: getOrderBy(sortBy),
        });

        // 🔥 CRITICAL: Get ONLY truly available user cards
        console.log('📋 Fetching user cards with filter:', userCardFilter);
        const userCardsForSale = await prisma.userCard.findMany({
            where: userCardFilter,
            take: limit * 2,
            orderBy: { created_at: 'desc' }
        });

        console.log(`📊 Found ${userCardsForSale.length} user cards for sale`);

        // Get card names for debugging
        if (userCardsForSale.length > 0) {
            const cardIds = userCardsForSale.map(uc => uc.card_id);
            const debugCards = await prisma.card.findMany({
                where: { id: { in: cardIds } },
                select: { id: true, name: true }
            });
            const cardNameMap = new Map(debugCards.map(c => [c.id, c.name]));

            userCardsForSale.forEach(uc => {
                const cardName = cardNameMap.get(uc.card_id) || 'Unknown';
                console.log(`  - Card ${uc.id}: ${cardName} | For Sale: ${uc.is_for_sale} | Sold: ${uc.is_sold} | Sale Type: ${uc.sale_type}`);
            });
        }

        // 🔥 CRITICAL: Double-check each card individually to ensure it's really available
        const trulyAvailableUserCards = [];
        for (const userCard of userCardsForSale) {
            // 🚨 Real-time verification that card is still available
            const currentStatus = await prisma.userCard.findUnique({
                where: { id: userCard.id },
                select: {
                    id: true,
                    is_for_sale: true,
                    is_sold: true,
                    sale_type: true,
                    auction_end: true,
                    owner_id: true
                }
            });

            if (!currentStatus) {
                console.log(`⚠️  Card ${userCard.id} no longer exists, skipping`);
                continue;
            }

            // ✅ Strict availability check
            if (currentStatus.is_for_sale && !currentStatus.is_sold) {
                // For auctions, check if not expired
                if (currentStatus.sale_type === 'AUCTION' && currentStatus.auction_end) {
                    if (new Date(currentStatus.auction_end) > new Date()) {
                        trulyAvailableUserCards.push(userCard);
                        console.log(`✅ Card ${userCard.id} is available for auction`);
                    } else {
                        console.log(`⏰ Card ${userCard.id} auction expired, skipping`);
                    }
                } else if (currentStatus.sale_type === 'FIXED') {
                    trulyAvailableUserCards.push(userCard);
                    console.log(`✅ Card ${userCard.id} is available for fixed price`);
                }
            } else {
                console.log(`❌ Card ${userCard.id} is NOT available: for_sale=${currentStatus.is_for_sale}, sold=${currentStatus.is_sold}`);
            }
        }

        console.log(`🎯 Final available user cards: ${trulyAvailableUserCards.length} out of ${userCardsForSale.length} initially found`);

        // Filter user cards that match our card filter
        const userCardsWithMatchingCards = [];
        if (trulyAvailableUserCards.length > 0) {
            const userCardIds = trulyAvailableUserCards.map(uc => uc.card_id);
            const matchingCards = await prisma.card.findMany({
                where: {
                    id: { in: userCardIds },
                    ...cardFilter
                }
            });
            const matchingCardIds = new Set(matchingCards.map(c => c.id));

            for (const userCard of trulyAvailableUserCards) {
                if (matchingCardIds.has(userCard.card_id)) {
                    userCardsWithMatchingCards.push(userCard);
                }
            }
        }

        console.log(`🎯 User cards matching filters: ${userCardsWithMatchingCards.length}`);

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
            // 🔥 CRITICAL: Count only truly available cards
            prisma.userCard.count({
                where: {
                    is_for_sale: true,
                    is_sold: false, // ✅ Only unsold cards
                    OR: [
                        { sale_type: 'FIXED' },
                        {
                            sale_type: 'AUCTION',
                            auction_end: { gt: new Date() }
                        }
                    ]
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
                has_user_listings: hasUserListings,
            };

            // Apply price status filter for catalog cards
            if (priceStatus && !matchesPriceStatus(listing, priceStatus)) continue;

            listings.push(listing);
        }

        // 🔥 CRITICAL: Process ONLY verified available user cards
        for (const userCard of userCardsWithMatchingCards) {
            try {
                // 🚨 FINAL verification - check one more time that card is available
                const finalCheck = await prisma.userCard.findUnique({
                    where: { id: userCard.id },
                    select: {
                        id: true,
                        is_for_sale: true,
                        is_sold: true,
                        sale_type: true,
                        auction_end: true
                    }
                });

                if (!finalCheck || !finalCheck.is_for_sale || finalCheck.is_sold) {
                    console.log(`🚫 FINAL CHECK FAILED: Card ${userCard.id} is no longer available`);
                    continue;
                }

                // Check auction expiry one more time
                if (finalCheck.sale_type === 'AUCTION' && finalCheck.auction_end) {
                    if (new Date(finalCheck.auction_end) <= new Date()) {
                        console.log(`🚫 FINAL CHECK: Card ${userCard.id} auction has expired`);
                        continue;
                    }
                }

                // Get the card data
                const card = catalogCards.find(c => c.id === userCard.card_id) ||
                    await prisma.card.findUnique({ where: { id: userCard.card_id } });

                if (!card) {
                    console.log(`🚫 Card data not found for userCard ${userCard.id}`);
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

                    // Skip expired auctions (should already be filtered, but double-check)
                    if (is_auction_expired) {
                        console.log(`🚫 Skipping expired auction ${userCard.id} (final check)`);
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
                console.log(`✅ Added listing for card ${userCard.id}: ${card.name}`);
            } catch (error) {
                console.error(`❌ Error processing userCard ${userCard.id}:`, error);
                continue;
            }
        }

        // Sort listings
        listings.sort((a, b) => sortListings(a, b, sortBy));

        // Apply pagination
        const paginatedListings = listings.slice(skip, skip + limit);

        console.log(`📦 Returning ${paginatedListings.length} available listings (Total found: ${listings.length})`);
        console.log(`📊 Stats: ${listings.filter(l => l.type === 'CATALOG').length} catalog cards, ${listings.filter(l => l.type === 'USER_CARD').length} user cards`);

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