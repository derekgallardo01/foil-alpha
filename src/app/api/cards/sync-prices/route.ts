// src/app/api/cards/sync-prices/route.ts - Updated with proper price_history table
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';

interface PriceSyncResult {
    total_cards: number;
    successful_updates: number;
    failed_updates: number;
    skipped_cards: number;
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

        // Remove old requests outside time window
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
            maxAgeHours = 24
        } = body;

        console.log('Starting price sync operation...', {
            cardIds: cardIds?.length || 'all',
            force,
            batchSize,
            maxAgeHours
        });

        const rateLimiter = new RateLimiter(60, 60000); // 60 requests per minute
        const result: PriceSyncResult = {
            total_cards: 0,
            successful_updates: 0,
            failed_updates: 0,
            skipped_cards: 0,
            errors: [],
            pricing_summary: {
                total_market_value: 0,
                avg_price_change: 0,
                cards_with_increases: 0,
                cards_with_decreases: 0,
                highest_value_card: null,
            }
        };

        // Build query to get cards that need pricing updates
        let whereClause: any = {
            api_id: { not: null }, // Only cards with API IDs
            sync_enabled: true, // Only sync enabled cards
        };

        if (cardIds && Array.isArray(cardIds)) {
            whereClause.id = { in: cardIds };
        }

        if (!force) {
            // Only update cards that haven't been updated recently
            const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
            whereClause.OR = [
                { last_price_update: null },
                { last_price_update: { lt: cutoffTime } }
            ];
        }

        // Get cards that need price updates
        const cardsToUpdate = await prisma.card.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                api_id: true,
                set_id: true,
                set_number: true,
                market_price: true,
                last_price_update: true,
            },
            orderBy: [
                { last_price_update: 'asc' }, // Prioritize cards never updated
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

        // Process cards in batches
        for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
            const batch = cardsToUpdate.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsToUpdate.length / batchSize)}`);

            // Prepare price tracker IDs for batch
            const priceTrackerIds = batch
                .map(card => {
                    if (!card.set_id || !card.set_number) return null;
                    return PokemonPriceTrackerAPI.convertTCGCardIdToPriceTrackerId(card.set_id, card.set_number);
                })
                .filter(Boolean) as string[];

            if (priceTrackerIds.length === 0) {
                result.skipped_cards += batch.length;
                continue;
            }

            // Rate limiting
            await rateLimiter.waitIfNeeded();

            // Fetch pricing data
            const pricingResponse = await pokemonPriceTrackerAPI.getBatchPricing(priceTrackerIds, false);

            if (!pricingResponse.success || !pricingResponse.data) {
                console.error('Failed to fetch pricing data:', pricingResponse.error);

                // Mark these cards as failed
                for (const card of batch) {
                    result.errors.push({
                        card_id: card.id,
                        card_name: card.name,
                        error: pricingResponse.error || 'Failed to fetch pricing'
                    });
                }
                result.failed_updates += batch.length;
                continue;
            }

            // Process each card in the batch
            for (const card of batch) {
                try {
                    const priceTrackerId = card.set_id && card.set_number ?
                        PokemonPriceTrackerAPI.convertTCGCardIdToPriceTrackerId(card.set_id, card.set_number) : null;

                    if (!priceTrackerId) {
                        result.skipped_cards++;
                        continue;
                    }

                    // Find pricing data for this card
                    const pricingData = pricingResponse.data.find(p => p.id === priceTrackerId);

                    if (!pricingData) {
                        result.skipped_cards++;
                        continue;
                    }

                    // Extract pricing information
                    const marketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(pricingData);
                    const priceSummary = PokemonPriceTrackerAPI.getPricingSummary(pricingData);

                    if (!marketPrice || marketPrice <= 0) {
                        result.skipped_cards++;
                        continue;
                    }

                    // Calculate price change
                    const oldPrice = card.market_price ? Number(card.market_price) : 0;
                    const priceChange = oldPrice > 0 ? ((marketPrice - oldPrice) / oldPrice) * 100 : 0;

                    if (priceChange !== 0) {
                        priceChanges.push(priceChange);
                        if (priceChange > 0) result.pricing_summary.cards_with_increases++;
                        if (priceChange < 0) result.pricing_summary.cards_with_decreases++;
                    }

                    // Track highest value card
                    if (!highestValueCard || marketPrice > highestValueCard.price) {
                        highestValueCard = { name: card.name, price: marketPrice };
                    }

                    // Update card in database
                    await prisma.card.update({
                        where: { id: card.id },
                        data: {
                            market_price: marketPrice,
                            price_trend: priceSummary.trend,
                            last_price_update: new Date(),
                            tcgplayer_prices: pricingData.prices.tcgplayer ?
                                JSON.parse(JSON.stringify(pricingData.prices.tcgplayer)) : null,
                            cardmarket_prices: pricingData.prices.cardmarket ?
                                JSON.parse(JSON.stringify(pricingData.prices.cardmarket)) : null,
                        }
                    });

                    // Create price history entry using the correct price_history table
                    await prisma.price_history.create({
                        data: {
                            card_id: card.id,
                            price: marketPrice,
                            source: 'pokemon_price_tracker',
                            recorded_at: new Date(),
                            metadata: {
                                price_change_24h: pricingData.price_change_24h,
                                price_change_7d: pricingData.price_change_7d,
                                volume_24h: pricingData.volume_24h,
                                sources: priceSummary.sources,
                                price_change_percent: priceChange,
                                old_price: oldPrice,
                                new_price: marketPrice,
                                sync_batch: true
                            }
                        }
                    });

                    result.successful_updates++;
                    result.pricing_summary.total_market_value += marketPrice;

                } catch (error) {
                    console.error(`Error updating card ${card.id}:`, error);
                    result.errors.push({
                        card_id: card.id,
                        card_name: card.name,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                    result.failed_updates++;
                }
            }

            // Small delay between batches to be respectful
            if (i + batchSize < cardsToUpdate.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Calculate summary statistics
        if (priceChanges.length > 0) {
            result.pricing_summary.avg_price_change = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
        }
        result.pricing_summary.highest_value_card = highestValueCard;

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

// GET endpoint for manual sync status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        if (status === 'summary') {
            // Get pricing summary statistics using correct table names
            const result = await prisma.$queryRaw`
                SELECT 
                  COUNT(*) as total_cards,
                  COUNT(CASE WHEN market_price IS NOT NULL THEN 1 END) as cards_with_prices,
                  COUNT(CASE WHEN last_price_update IS NULL THEN 1 END) as never_updated,
                  COUNT(CASE WHEN last_price_update < DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as stale_prices,
                  AVG(market_price) as avg_market_price,
                  MAX(market_price) as max_price,
                  MIN(market_price) as min_price
                FROM cards 
                WHERE api_id IS NOT NULL AND sync_enabled = 1
            ` as any[];

            const stats = result[0];

            return NextResponse.json({
                success: true,
                stats: {
                    total_cards: Number(stats.total_cards),
                    cards_with_prices: Number(stats.cards_with_prices),
                    never_updated: Number(stats.never_updated),
                    stale_prices: Number(stats.stale_prices),
                    avg_market_price: stats.avg_market_price ? Number(stats.avg_market_price) : 0,
                    price_range: {
                        min: stats.min_price ? Number(stats.min_price) : 0,
                        max: stats.max_price ? Number(stats.max_price) : 0,
                    }
                }
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Price sync API ready. Use POST to start sync, GET with ?status=summary for statistics.'
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