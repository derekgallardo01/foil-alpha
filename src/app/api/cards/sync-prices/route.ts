// src/app/api/cards/sync-prices/route.ts - FIXED VERSION FOR YOUR SCHEMA
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';

interface PriceSyncResult {
    total_cards: number;
    successful_updates: number;
    failed_updates: number;
    skipped_cards: number;
    price_changes: number;
    notifications_sent: number;
    errors: Array<{
        card_id: number;
        card_name: string;
        error: string;
    }>;
    pricing_summary: {
        total_market_value: number;
        avg_price_change: number;
        cards_with_increases: number;
        cards_with_decreases: number;
        price_range: {
            min: number;
            max: number;
        };
        highest_value_card: {
            name: string;
            price: number;
        } | null;
    };
}

// Rate limiting helper
class RateLimiter {
    private requests: number[] = [];
    private readonly maxRequests: number;
    private readonly timeWindow: number;

    constructor(maxRequests = 60, timeWindowMs = 60000) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindowMs;
    }

    async waitIfNeeded(): Promise<void> {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);

        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.timeWindow - (now - oldestRequest);

            if (waitTime > 0) {
                console.log(`Rate limiting: waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        this.requests.push(now);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            cardIds,
            force = false,
            batchSize = 20,
            maxAgeHours = 24,
            priceChangeThreshold = 5
        } = body;

        console.log('Starting price sync operation with Pokemon Price Tracker API...', {
            cardIds: cardIds?.length || 'all',
            force,
            batchSize,
            maxAgeHours,
            priceChangeThreshold
        });

        const rateLimiter = new RateLimiter(60, 60000);
        const result: PriceSyncResult = {
            total_cards: 0,
            successful_updates: 0,
            failed_updates: 0,
            skipped_cards: 0,
            price_changes: 0,
            notifications_sent: 0,
            errors: [],
            pricing_summary: {
                total_market_value: 0,
                avg_price_change: 0,
                cards_with_increases: 0,
                cards_with_decreases: 0,
                price_range: { min: 0, max: 0 },
                highest_value_card: null,
            }
        };

        // Build query to get cards that need pricing updates
        let whereClause: any = {
            price_tracker_id: { not: { equals: "" } }, // Only cards with Pokemon Price Tracker IDs
            sync_enabled: true,
        };

        if (cardIds && Array.isArray(cardIds)) {
            whereClause.id = { in: cardIds };
        }

        if (!force) {
            const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
            whereClause.OR = [
                { last_updated: { equals: null } },
                { last_updated: { lt: cutoffTime } }
            ];
        }

        // Get cards that need price updates
        const cardsToUpdate = await prisma.card.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                price_tracker_id: true,
                market_price: true,
                last_updated: true,
                image_small: true,
            },
            orderBy: [
                { last_updated: 'asc' },
                { id: 'asc' }
            ]
        });

        result.total_cards = cardsToUpdate.length;
        console.log(`Found ${result.total_cards} cards to update`);

        if (result.total_cards === 0) {
            return NextResponse.json({
                success: true,
                message: 'No cards need price updates',
                result
            });
        }

        const priceChanges: number[] = [];
        let highestValueCard: { name: string; price: number } | null = null;
        let minPrice = Infinity;
        let maxPrice = 0;

        // Process cards in batches
        for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
            const batch = cardsToUpdate.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsToUpdate.length / batchSize)}`);

            // Rate limiting
            await rateLimiter.waitIfNeeded();

            // Process each card in the batch
            for (const card of batch) {
                try {
                    if (!card.price_tracker_id) {
                        result.skipped_cards++;
                        continue;
                    }

                    // Fetch updated card pricing from Pokemon Price Tracker API
                    const pricingResponse = await pokemonPriceTrackerAPI.getCardPricing(card.price_tracker_id);

                    if (!pricingResponse.success || !pricingResponse.data) {
                        console.warn(`Failed to get pricing for card ${card.id}: ${pricingResponse.error}`);
                        result.errors.push({
                            card_id: card.id,
                            card_name: card.name,
                            error: pricingResponse.error || 'Failed to fetch pricing'
                        });
                        result.failed_updates++;
                        continue;
                    }

                    // Extract new market price
                    const newMarketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(pricingResponse.data);

                    if (!newMarketPrice || newMarketPrice <= 0) {
                        console.warn(`No valid price found for card ${card.id}`);
                        result.skipped_cards++;
                        continue;
                    }

                    // Calculate price change
                    const oldPrice = card.market_price ? Number(card.market_price) : 0;
                    const priceChange = oldPrice > 0 ? ((newMarketPrice - oldPrice) / oldPrice) * 100 : 0;

                    // Track price changes
                    if (priceChange !== 0) {
                        priceChanges.push(priceChange);
                        if (priceChange > 0) result.pricing_summary.cards_with_increases++;
                        if (priceChange < 0) result.pricing_summary.cards_with_decreases++;

                        // Check if price change is significant
                        if (Math.abs(priceChange) >= priceChangeThreshold) {
                            result.price_changes++;
                        }
                    }

                    // Track price range
                    if (newMarketPrice < minPrice) minPrice = newMarketPrice;
                    if (newMarketPrice > maxPrice) maxPrice = newMarketPrice;

                    // Track highest value card
                    if (!highestValueCard || newMarketPrice > highestValueCard.price) {
                        highestValueCard = { name: card.name, price: newMarketPrice };
                    }

                    // Update card in database - using your schema fields
                    await prisma.card.update({
                        where: { id: card.id },
                        data: {
                            market_price: newMarketPrice,
                            last_updated: new Date(),
                            sync_errors: 0,
                            // Store pricing data in existing JSON fields
                            tcgplayer_data: pricingResponse.data.prices?.tcgplayer || undefined,
                            cardmarket_data: pricingResponse.data.prices?.cardmarket || undefined,
                            ebay_data: pricingResponse.data.prices?.ebay || undefined,
                        }
                    });

                    // Create price history entry
                    await prisma.price_history.create({
                        data: {
                            card_id: card.id,
                            price: newMarketPrice,
                            source: 'pokemon_price_tracker',
                            price_type: 'market',
                            metadata: {
                                price_change_percent: priceChange,
                                old_price: oldPrice,
                                new_price: newMarketPrice,
                                sync_batch: true,
                                pricing_sources: pricingResponse.data.prices || null
                            }
                        }
                    });

                    result.successful_updates++;
                    result.pricing_summary.total_market_value += newMarketPrice;

                    console.log(`Updated ${card.name}: $${oldPrice} -> $${newMarketPrice} (${priceChange.toFixed(1)}%)`);

                } catch (error) {
                    console.error(`Error updating card ${card.id}:`, error);
                    result.errors.push({
                        card_id: card.id,
                        card_name: card.name,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    result.failed_updates++;

                    // Increment sync_errors for this card
                    await prisma.card.update({
                        where: { id: card.id },
                        data: { sync_errors: { increment: 1 } }
                    });
                }
            }

            // Small delay between batches to respect rate limits
            if (i + batchSize < cardsToUpdate.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Calculate summary statistics
        if (priceChanges.length > 0) {
            result.pricing_summary.avg_price_change = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
        }

        result.pricing_summary.highest_value_card = highestValueCard;
        result.pricing_summary.price_range = {
            min: minPrice === Infinity ? 0 : minPrice,
            max: maxPrice
        };

        console.log('Price sync completed:', result);

        return NextResponse.json({
            success: true,
            message: `Price sync completed: ${result.successful_updates} updated, ${result.failed_updates} failed, ${result.skipped_cards} skipped`,
            result
        });

    } catch (error) {
        console.error('Error in price sync operation:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to sync prices',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// GET endpoint for sync status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        if (status === 'summary') {
            // Get current stats
            const stats = await prisma.card.aggregate({
                where: {
                    price_tracker_id: { not: { equals: "" } },
                    sync_enabled: true
                },
                _count: { id: true },
                _avg: { market_price: true },
                _min: { market_price: true },
                _max: { market_price: true }
            });

            const staleCards = await prisma.card.count({
                where: {
                    price_tracker_id: { not: { equals: "" } },
                    sync_enabled: true,
                    OR: [
                        { last_updated: { equals: null } },
                        {
                            last_updated: {
                                lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
                            }
                        }
                    ]
                }
            });

            const recentUpdates = await prisma.card.count({
                where: {
                    last_updated: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            });

            const totalCards = stats._count ? stats._count.id : 0;
            const avgPrice = stats._avg ? stats._avg.market_price : null;
            const minPrice = stats._min ? stats._min.market_price : null;
            const maxPrice = stats._max ? stats._max.market_price : null;

            return NextResponse.json({
                success: true,
                stats: {
                    total_cards: totalCards,
                    cards_with_prices: await prisma.card.count({
                        where: {
                            price_tracker_id: { not: { equals: "" } },
                            market_price: { not: { equals: null } }
                        }
                    }),
                    never_updated: await prisma.card.count({
                        where: {
                            price_tracker_id: { not: { equals: "" } },
                            last_updated: { equals: null }
                        }
                    }),
                    stale_prices: staleCards,
                    cards_updated_24h: recentUpdates,
                    avg_market_price: avgPrice || 0,
                    price_range: {
                        min: minPrice || 0,
                        max: maxPrice || 0,
                    }
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Price sync API ready. Using Pokemon Price Tracker API only.'
        });

    } catch (error) {
        console.error('Error getting sync status:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to get sync status',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}