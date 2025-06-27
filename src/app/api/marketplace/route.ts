// src/app/api/marketplace/route.ts - Enhanced with proper pagination and catalog cards
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

// GET /api/marketplace - Enhanced with pagination and catalog cards
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(50, parseInt(searchParams.get('limit') || '20')); // Max 50 per page
        const search = searchParams.get('search') || '';
        const setName = searchParams.get('set') || '';
        const cardType = searchParams.get('type') || '';
        const rarity = searchParams.get('rarity') || '';
        const saleType = searchParams.get('sale_type') || '';
        const priceMin = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : null;
        const priceMax = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : null;
        const sortBy = searchParams.get('sort_by') || 'newest'; // newest, price_low, price_high, name

        const skip = (page - 1) * limit;

        console.log('Marketplace query:', { page, limit, search, setName, cardType, rarity, saleType, priceMin, priceMax, sortBy });

        // Build card filter
        const cardFilter: any = {};
        if (search) {
            cardFilter.name = { contains: search, mode: 'insensitive' };
        }
        if (setName) {
            cardFilter.set_name = setName;
        }
        if (cardType) {
            cardFilter.card_type = cardType;
        }
        if (rarity) {
            cardFilter.rarity = rarity;
        }

        // Get listings in parallel based on sale type filter
        let catalogCards: any[] = [];
        let userCardsForSale: any[] = [];
        let totalCatalogCount = 0;
        let totalUserCardsCount = 0;

        // Only fetch catalog cards if not filtering by user sale types
        if (!saleType || saleType === 'CATALOG') {
            [catalogCards, totalCatalogCount] = await Promise.all([
                prisma.card.findMany({
                    where: {
                        ...cardFilter,
                        market_price: { not: null, gt: 0 }, // Only cards with prices
                        // Only show cards that aren't owned by users yet (fresh catalog)
                        userCards: { none: {} }
                    },
                    include: {
                        pokemonSet: true,
                        rarity_ref: true,
                        subtype_ref: true,
                        supertype_ref: true,
                    },
                    skip: saleType === 'CATALOG' ? skip : 0,
                    take: saleType === 'CATALOG' ? limit : Math.ceil(limit / 2), // Split between catalog and user cards
                    orderBy: getSortOrder(sortBy)
                }),
                prisma.card.count({
                    where: {
                        ...cardFilter,
                        market_price: { not: null, gt: 0 },
                        userCards: { none: {} }
                    }
                })
            ]);
        }

        // Only fetch user cards if not filtering by catalog
        if (!saleType || saleType === 'FIXED' || saleType === 'AUCTION') {
            const userCardFilter: any = {
                is_for_sale: true,
                is_sold: false,
                card: cardFilter
            };

            // Add sale type filter
            if (saleType === 'FIXED') {
                userCardFilter.sale_type = 'FIXED';
            } else if (saleType === 'AUCTION') {
                userCardFilter.sale_type = 'AUCTION';
                userCardFilter.auction_end = { gt: new Date() }; // Active auctions only
            } else if (!saleType) {
                // Show both types, prioritizing active auctions
                userCardFilter.OR = [
                    { sale_type: 'FIXED' },
                    {
                        sale_type: 'AUCTION',
                        auction_end: { gt: new Date() }
                    }
                ];
            }

            [userCardsForSale, totalUserCardsCount] = await Promise.all([
                prisma.userCard.findMany({
                    where: userCardFilter,
                    include: {
                        card: {
                            include: {
                                pokemonSet: true,
                                rarity_ref: true,
                                subtype_ref: true,
                                supertype_ref: true,
                            }
                        },
                        owner: {
                            select: { id: true, name: true, role: true }
                        },
                        bids: {
                            where: { is_active: true },
                            orderBy: { amount: 'desc' },
                            take: 1,
                            include: {
                                bidder: {
                                    select: { id: true, name: true }
                                }
                            }
                        },
                        _count: {
                            select: {
                                bids: { where: { is_active: true } }
                            }
                        }
                    },
                    skip: (saleType === 'FIXED' || saleType === 'AUCTION') ? skip : 0,
                    take: (saleType === 'FIXED' || saleType === 'AUCTION') ? limit : Math.ceil(limit / 2),
                    orderBy: getUserCardSortOrder(sortBy)
                }),
                prisma.userCard.count({ where: userCardFilter })
            ]);
        }

        // Process and combine listings
        const listings = [];

        // Process catalog cards (new cards from marketplace)
        for (const card of catalogCards) {
            const price = Number(card.market_price);

            // Apply price filter
            if (priceMin !== null && price < priceMin) continue;
            if (priceMax !== null && price > priceMax) continue;

            listings.push({
                id: `catalog-${card.id}`,
                type: 'CATALOG',
                card: {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    set_number: card.set_number,
                    rarity: card.rarity,
                    card_type: card.card_type,
                    image_url: card.image_url,
                    small_image_url: card.small_image_url,
                },
                owner: {
                    id: 0,
                    name: 'TCG Market',
                    role: 'system'
                },
                condition: 'Mint',
                sale_type: 'FIXED',
                current_price: price,
                fixed_price: price,
                reserve_price: null,
                auction_end: null,
                highest_bid: null,
                bid_count: 0,
                time_remaining: null,
                is_auction_expired: false,
                notes: 'New card from Pokemon TCG catalog',
                availability: 'IN_STOCK',
                created_at: card.created_at
            });
        }

        // Process user cards for sale
        for (const userCard of userCardsForSale) {
            const highestBid = userCard.bids[0] ? Number(userCard.bids[0].amount) : null;
            const current_price = userCard.sale_type === 'FIXED'
                ? Number(userCard.fixed_price || 0)
                : (highestBid || Number(userCard.reserve_price || 0));

            // Apply price filter
            if (priceMin !== null && current_price < priceMin) continue;
            if (priceMax !== null && current_price > priceMax) continue;

            // Calculate auction time remaining
            let time_remaining = null;
            let is_auction_expired = false;

            if (userCard.sale_type === 'AUCTION' && userCard.auction_end) {
                const endTime = new Date(userCard.auction_end).getTime();
                const now = Date.now();
                time_remaining = Math.max(0, endTime - now);
                is_auction_expired = time_remaining <= 0;
            }

            listings.push({
                id: `user-${userCard.id}`,
                type: 'USER_CARD',
                user_card_id: userCard.id,
                card: {
                    id: userCard.card.id,
                    name: userCard.card.name,
                    set_name: userCard.card.set_name,
                    set_number: userCard.card.set_number,
                    rarity: userCard.card.rarity,
                    card_type: userCard.card.card_type,
                    image_url: userCard.card.image_url,
                    small_image_url: userCard.card.small_image_url,
                },
                owner: {
                    id: userCard.owner.id,
                    name: userCard.owner.name,
                    role: userCard.owner.role
                },
                condition: userCard.condition,
                sale_type: userCard.sale_type,
                current_price,
                fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
                reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
                auction_end: userCard.auction_end,
                highest_bid: highestBid,
                highest_bidder: userCard.bids[0]?.bidder || null,
                bid_count: userCard._count.bids,
                time_remaining,
                is_auction_expired,
                notes: userCard.notes,
                availability: 'FOR_SALE',
                created_at: userCard.created_at
            });
        }

        // Apply final sorting to combined listings
        listings.sort((a, b) => {
            switch (sortBy) {
                case 'price_low':
                    return a.current_price - b.current_price;
                case 'price_high':
                    return b.current_price - a.current_price;
                case 'name':
                    return a.card.name.localeCompare(b.card.name);
                case 'newest':
                default:
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
        });

        // Apply pagination to final sorted results
        const paginatedListings = listings.slice(0, limit);
        const totalCount = totalCatalogCount + totalUserCardsCount;

        console.log(`Marketplace: ${catalogCards.length} catalog + ${userCardsForSale.length} user cards = ${listings.length} total listings`);

        return NextResponse.json({
            listings: paginatedListings,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                catalog_cards: totalCatalogCount,
                user_cards: totalUserCardsCount,
                showing: paginatedListings.length
            },
            filters: {
                sets: await getAvailableSets(),
                types: await getAvailableTypes(),
                rarities: await getAvailableRarities(),
                price_range: await getPriceRange(),
                sort_options: [
                    { value: 'newest', label: 'Newest First' },
                    { value: 'price_low', label: 'Price: Low to High' },
                    { value: 'price_high', label: 'Price: High to Low' },
                    { value: 'name', label: 'Name A-Z' }
                ]
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

// Helper function to get sort order for cards
function getSortOrder(sortBy: string) {
    switch (sortBy) {
        case 'price_low':
            return { market_price: 'asc' as const };
        case 'price_high':
            return { market_price: 'desc' as const };
        case 'name':
            return { name: 'asc' as const };
        case 'newest':
        default:
            return { created_at: 'desc' as const };
    }
}

// Helper function to get sort order for user cards
function getUserCardSortOrder(sortBy: string) {
    switch (sortBy) {
        case 'price_low':
            return { fixed_price: 'asc' as const };
        case 'price_high':
            return { fixed_price: 'desc' as const };
        case 'name':
            return { card: { name: 'asc' as const } };
        case 'newest':
        default:
            return { created_at: 'desc' as const };
    }
}

// Helper functions for filter options
async function getAvailableSets() {
    const sets = await prisma.card.groupBy({
        by: ['set_name'],
        _count: { set_name: true },
        where: {
            OR: [
                { market_price: { not: null, gt: 0 } }, // Catalog cards with prices
                { userCards: { some: { is_for_sale: true, is_sold: false } } } // User cards for sale
            ]
        },
        orderBy: { set_name: 'asc' }
    });
    return sets.map(s => ({ name: s.set_name, count: s._count.set_name }));
}

async function getAvailableTypes() {
    const types = await prisma.card.groupBy({
        by: ['card_type'],
        _count: { card_type: true },
        where: {
            card_type: { not: null },
            OR: [
                { market_price: { not: null, gt: 0 } },
                { userCards: { some: { is_for_sale: true, is_sold: false } } }
            ]
        },
        orderBy: { card_type: 'asc' }
    });
    return types.map(t => ({ name: t.card_type, count: t._count.card_type }));
}

async function getAvailableRarities() {
    const rarities = await prisma.card.groupBy({
        by: ['rarity'],
        _count: { rarity: true },
        where: {
            OR: [
                { market_price: { not: null, gt: 0 } },
                { userCards: { some: { is_for_sale: true, is_sold: false } } }
            ]
        },
        orderBy: { rarity: 'asc' }
    });
    return rarities.map(r => ({ name: r.rarity, count: r._count.rarity }));
}

async function getPriceRange() {
    // Get price range from both catalog and user cards
    const [catalogPrices, userCardPrices] = await Promise.all([
        prisma.card.aggregate({
            _min: { market_price: true },
            _max: { market_price: true },
            _avg: { market_price: true },
            where: {
                market_price: { not: null, gt: 0 },
                userCards: { none: {} } // Catalog cards only
            }
        }),
        prisma.userCard.aggregate({
            _min: { fixed_price: true },
            _max: { fixed_price: true },
            _avg: { fixed_price: true },
            where: {
                is_for_sale: true,
                is_sold: false,
                fixed_price: { not: null, gt: 0 }
            }
        })
    ]);

    const allPrices = [
        catalogPrices._min.market_price ? Number(catalogPrices._min.market_price) : 0,
        catalogPrices._max.market_price ? Number(catalogPrices._max.market_price) : 0,
        userCardPrices._min.fixed_price ? Number(userCardPrices._min.fixed_price) : 0,
        userCardPrices._max.fixed_price ? Number(userCardPrices._max.fixed_price) : 0,
    ].filter(p => p > 0);

    return {
        min: allPrices.length > 0 ? Math.min(...allPrices) : 0,
        max: allPrices.length > 0 ? Math.max(...allPrices) : 1000,
        avg: catalogPrices._avg.market_price ? Number(catalogPrices._avg.market_price) : 50
    };
}