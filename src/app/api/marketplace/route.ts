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
        const saleType = searchParams.get('sale_type') || ''; // Add sale_type
        const rarity = searchParams.get('rarity') || '';
        const priceMin = searchParams.get('price_min') ? parseFloat(searchParams.get('price_min')!) : null;
        const priceMax = searchParams.get('price_max') ? parseFloat(searchParams.get('price_max')!) : null;

        if (page < 1 || limit < 1) {
            return NextResponse.json(
                { error: 'Invalid pagination parameters' },
                { status: 400 }
            );
        }

        const skip = (page - 1) * limit;

        const cardFilter: any = {};
        if (search) cardFilter.name = { contains: search, mode: 'insensitive' };
        if (setName) cardFilter.set_name = setName;
        if (cardType) cardFilter.card_type = cardType;
        if (rarity) cardFilter.rarity = rarity;

        const userCardFilter: any = {
            is_for_sale: true,
            is_sold: false,
        };
        if (saleType) {
            userCardFilter.sale_type = saleType;
        } else {
            userCardFilter.OR = [
                { sale_type: 'FIXED' },
                { sale_type: 'AUCTION', auction_end: { gt: new Date() } },
            ];
        }

        console.log('Marketplace query filters:', {
            search,
            setName,
            cardType,
            saleType,
            rarity,
            priceMin,
            priceMax,
            page,
            limit,
        });

        const [catalogCards, userCardsForSale, totalCatalogCount, totalUserCardsCount] = await Promise.all([
            prisma.card.findMany({
                where: {
                    ...cardFilter,
                    userCards: { none: {} },
                },
                include: {
                    pokemonSet: true,
                    rarity_ref: true,
                    subtype_ref: true,
                    supertype_ref: true,
                    _count: { select: { userCards: true } },
                },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
            }),
            prisma.userCard.findMany({
                where: {
                    ...userCardFilter,
                    card: cardFilter,
                },
                include: {
                    card: {
                        include: {
                            pokemonSet: true,
                            rarity_ref: true,
                            subtype_ref: true,
                            supertype_ref: true,
                        },
                    },
                    owner: {
                        select: { id: true, name: true, role: true },
                    },
                    bids: {
                        where: { is_active: true },
                        orderBy: { amount: 'desc' },
                        take: 1,
                        include: {
                            bidder: { select: { id: true, name: true } },
                        },
                    },
                    _count: {
                        select: { bids: { where: { is_active: true } } },
                    },
                },
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
            }),
            prisma.card.count({
                where: {
                    ...cardFilter,
                    userCards: { none: {} },
                },
            }),
            prisma.userCard.count({
                where: {
                    ...userCardFilter,
                    card: cardFilter,
                },
            }),
        ]);

        const listings = [];
        for (const card of catalogCards) {
            if (priceMin !== null && (!card.market_price || Number(card.market_price) < priceMin)) continue;
            if (priceMax !== null && (!card.market_price || Number(card.market_price) > priceMax)) continue;

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
                    set: card.pokemonSet,
                    rarity_info: card.rarity_ref,
                    subtype_info: card.subtype_ref,
                    supertype_info: card.supertype_ref,
                },
                owner: { id: null, name: 'TCG Market', role: 'system' },
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
                availability: 'IN_STOCK',
            });
        }

        for (const userCard of userCardsForSale) {
            try {
                const highestBid = userCard.bids[0] ? Number(userCard.bids[0].amount) : null;
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
                        set: userCard.card.pokemonSet,
                        rarity_info: userCard.card.rarity_ref,
                        subtype_info: userCard.card.subtype_ref,
                        supertype_info: userCard.card.supertype_ref,
                    },
                    owner: {
                        id: userCard.owner.id,
                        name: userCard.owner.name,
                        role: userCard.owner.role,
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
                });
            } catch (error) {
                console.error(`Error processing userCard ${userCard.id}:`, error);
                continue;
            }
        }

        listings.sort((a, b) => {
            if (a.type === 'CATALOG' && b.type === 'USER_CARD') return -1;
            if (a.type === 'USER_CARD' && b.type === 'CATALOG') return 1;
            return a.current_price - b.current_price;
        });

        const totalCount = totalCatalogCount + totalUserCardsCount;

        console.log(`Returning ${listings.length} listings (Catalog: ${catalogCards.length}, User: ${userCardsForSale.length})`);

        return NextResponse.json({
            listings,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                catalog_cards: totalCatalogCount,
                user_cards: totalUserCardsCount,
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