// src/app/api/marketplace/route.ts - Enhanced version showing both catalog and user cards
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

// GET /api/marketplace - Get cards available for purchase
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const setName = searchParams.get('set') || '';
        const cardType = searchParams.get('type') || '';
        const rarity = searchParams.get('rarity') || '';
        const priceMin = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : null;
        const priceMax = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : null;

        const skip = (page - 1) * limit;

        // Build card filter for both types of listings
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

        console.log('Marketplace query filters:', { search, setName, cardType, rarity, priceMin, priceMax });

        // Get two types of listings in parallel:
        // 1. Cards from catalog that aren't owned yet (new cards available for purchase)
        // 2. User cards that are for sale (resales)

        const [catalogCards, userCardsForSale, totalCatalogCount, totalUserCardsCount] = await Promise.all([
            // 1. Catalog cards not owned by anyone yet
            prisma.card.findMany({
                where: {
                    ...cardFilter,
                    userCards: {
                        none: {} // Cards that have NO UserCard entries (not owned yet)
                    }
                },
                include: {
                    pokemonSet: true,
                    rarity_ref: true,
                    subtype_ref: true,
                    supertype_ref: true,
                    _count: {
                        select: { userCards: true }
                    }
                },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' }
            }),

            // 2. User cards for sale
            prisma.userCard.findMany({
                where: {
                    is_for_sale: true,
                    is_sold: false,
                    // Add auction filter if needed
                    OR: [
                        { sale_type: 'FIXED' },
                        {
                            sale_type: 'AUCTION',
                            auction_end: { gt: new Date() }
                        }
                    ],
                    card: cardFilter
                },
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
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
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
                            bids: {
                                where: { is_active: true }
                            }
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' }
            }),

            // Count totals
            prisma.card.count({
                where: {
                    ...cardFilter,
                    userCards: { none: {} }
                }
            }),

            prisma.userCard.count({
                where: {
                    is_for_sale: true,
                    is_sold: false,
                    OR: [
                        { sale_type: 'FIXED' },
                        {
                            sale_type: 'AUCTION',
                            auction_end: { gt: new Date() }
                        }
                    ],
                    card: cardFilter
                }
            })
        ]);

        console.log(`Found ${catalogCards.length} catalog cards and ${userCardsForSale.length} user cards for sale`);

        // Process listings
        const listings = [];

        // Process catalog cards (new cards from admin/system)
        for (const card of catalogCards) {
            // Apply price filter if specified
            if (priceMin !== null && (!card.market_price || Number(card.market_price) < priceMin)) continue;
            if (priceMax !== null && (!card.market_price || Number(card.market_price) > priceMax)) continue;

            const listing = {
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
                    set: card.pokemonSet,
                    rarity_info: card.rarity_ref,
                    subtype_info: card.subtype_ref,
                    supertype_info: card.supertype_ref,
                },
                owner: {
                    id: null,
                    name: 'TCG Market',
                    role: 'system'
                },
                condition: 'Mint',
                sale_type: 'FIXED',
                current_price: card.market_price ? Number(card.market_price) : 0,
                fixed_price: card.market_price ? Number(card.market_price) : null,
                reserve_price: null,
                auction_end: null,
                highest_bid: null,
                bid_count: 0,
                time_remaining: null,
                is_auction_expired: false,
                notes: 'New card from Pokemon TCG catalog',
                availability: 'IN_STOCK'
            };

            listings.push(listing);
        }

        // Process user cards for sale
        for (const userCard of userCardsForSale) {
            try {
                // Calculate current price
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

                const listing = {
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
                        set: userCard.card.pokemonSet,
                        rarity_info: userCard.card.rarity_ref,
                        subtype_info: userCard.card.subtype_ref,
                        supertype_info: userCard.card.supertype_ref,
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
                    availability: 'FOR_SALE'
                };

                listings.push(listing);

            } catch (error) {
                console.error('Error processing user card listing:', error);
                continue;
            }
        }

        // Sort all listings by price, date, or other criteria
        listings.sort((a, b) => {
            // Prioritize catalog cards (new) over user cards, then by price
            if (a.type === 'CATALOG' && b.type === 'USER_CARD') return -1;
            if (a.type === 'USER_CARD' && b.type === 'CATALOG') return 1;
            return a.current_price - b.current_price;
        });

        const totalCount = totalCatalogCount + totalUserCardsCount;

        console.log(`Returning ${listings.length} processed listings (${catalogCards.length} catalog + ${userCardsForSale.length} user)`);

        return NextResponse.json({
            listings,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                catalog_cards: totalCatalogCount,
                user_cards: totalUserCardsCount
            },
            filters: {
                sets: await getAvailableSets(),
                types: await getAvailableTypes(),
                rarities: await getAvailableRarities(),
                price_range: await getPriceRange()
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
    return types.map(t => ({ name: t.card_type, count: t._count.card_type }));
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