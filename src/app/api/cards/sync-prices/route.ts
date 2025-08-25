// src/app/api/cards/sync-prices/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { pokemonTCGAPI, PokemonTCGAPI } from '../../../lib/pokemon-tcg-api';
import { createPriceChangeNotification, createBulkPriceChangeNotifications } from '../../../lib/notification';

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
            priceChangeThreshold = 5 // Notify if price changes by more than 5%
        } = body;

        console.log('Starting price sync operation...', {
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
                highest_value_card: null,
            }
        };

        // Build query to get cards that need pricing updates
        let whereClause: any = {
            api_id: { not: null },
            sync_enabled: true,
        };

        if (cardIds && Array.isArray(cardIds)) {
            whereClause.id = { in: cardIds };
        }

        if (!force) {
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
                image_url: true,
                small_image_url: true,
            },
            orderBy: [
                { last_price_update: 'asc' },
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
        const cardsWithSignificantChanges: Array<{
            cardId: number;
            cardName: string;
            oldPrice: number;
            newPrice: number;
            changePercent: number;
            imageUrl: string | null;
        }> = [];

        let highestValueCard: { name: string; price: number } | null = null;

        // Process cards in batches
        for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
            const batch = cardsToUpdate.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsToUpdate.length / batchSize)}`);

            // Rate limiting
            await rateLimiter.waitIfNeeded();

            // Process each card in the batch
            for (const card of batch) {
                try {
                    if (!card.api_id) {
                        result.skipped_cards++;
                        continue;
                    }

                    // Fetch updated card data from Pokemon TCG API
                    const updatedCardData = await pokemonTCGAPI.getCard(card.api_id);

                    if (!updatedCardData) {
                        result.skipped_cards++;
                        continue;
                    }

                    // Extract new market price
                    const newMarketPrice = PokemonTCGAPI.getMarketPrice(updatedCardData);

                    if (!newMarketPrice || newMarketPrice <= 0) {
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

                        // Check if price change is significant enough for notification
                        if (Math.abs(priceChange) >= priceChangeThreshold) {
                            cardsWithSignificantChanges.push({
                                cardId: card.id,
                                cardName: card.name,
                                oldPrice,
                                newPrice: newMarketPrice,
                                changePercent: priceChange,
                                imageUrl: card.small_image_url || card.image_url
                            });
                            result.price_changes++;
                        }
                    }

                    // Track highest value card
                    if (!highestValueCard || newMarketPrice > highestValueCard.price) {
                        highestValueCard = { name: card.name, price: newMarketPrice };
                    }

                    // Determine price trend
                    let priceTrend = 'stable';
                    if (priceChange > 5) priceTrend = 'up';
                    else if (priceChange < -5) priceTrend = 'down';

                    // Update card in database - FIXED: Only use fields that exist in your schema
                    await prisma.card.update({
                        where: { id: card.id },
                        data: {
                            market_price: newMarketPrice,
                            price_trend: priceTrend,
                            last_price_update: new Date(),
                            tcgplayer_prices: updatedCardData.tcgplayer ?
                                JSON.parse(JSON.stringify(updatedCardData.tcgplayer)) : undefined,
                            cardmarket_prices: updatedCardData.cardmarket ?
                                JSON.parse(JSON.stringify(updatedCardData.cardmarket)) : undefined,
                        }
                    });

                    // Create price history entry with price change in metadata
                    await prisma.price_history.create({
                        data: {
                            card_id: card.id,
                            price: newMarketPrice,
                            source: 'pokemon_tcg_api',
                            recorded_at: new Date(),
                            metadata: {
                                price_change_percent: priceChange,
                                price_change_24h: priceChange, // Store in metadata instead
                                old_price: oldPrice,
                                new_price: newMarketPrice,
                                trend: priceTrend,
                                sync_batch: true,
                                tcgplayer_data: updatedCardData.tcgplayer?.prices || null,
                                cardmarket_data: updatedCardData.cardmarket?.prices || null
                            }
                        }
                    });

                    result.successful_updates++;
                    result.pricing_summary.total_market_value += newMarketPrice;

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

            // Small delay between batches
            if (i + batchSize < cardsToUpdate.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Send notifications for significant price changes
        if (cardsWithSignificantChanges.length > 0) {
            console.log(`Sending notifications for ${cardsWithSignificantChanges.length} cards with significant price changes`);

            const notificationResult = await createBulkPriceChangeNotifications(cardsWithSignificantChanges);
            result.notifications_sent = notificationResult.totalNotifications;

            console.log(`Sent ${result.notifications_sent} notifications to card owners`);
        }

        // Calculate summary statistics
        if (priceChanges.length > 0) {
            result.pricing_summary.avg_price_change = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
        }
        result.pricing_summary.highest_value_card = highestValueCard;

        console.log('Price sync completed:', result);

        return NextResponse.json({
            success: true,
            message: `Price sync completed: ${result.successful_updates} updated, ${result.failed_updates} failed, ${result.skipped_cards} skipped, ${result.notifications_sent} notifications sent`,
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
            // Get current stats including recent price changes from price_history
            const cardStatsResult = await prisma.$queryRaw<Array<{
                total_cards: bigint;
                cards_with_prices: bigint;
                never_updated: bigint;
                stale_prices: bigint;
                avg_market_price: number | null;
                max_price: number | null;
                min_price: number | null;
            }>>`
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
            `;

            const recentChangesResult = await prisma.$queryRaw<Array<{
                cards_updated_24h: bigint;
                avg_change_24h: number | null;
            }>>`
                SELECT 
                  COUNT(DISTINCT card_id) as cards_updated_24h,
                  AVG(CAST(JSON_EXTRACT(metadata, '$.price_change_percent') AS DECIMAL(10,2))) as avg_change_24h
                FROM price_history
                WHERE recorded_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
                  AND source = 'pokemon_tcg_api'
            `;

            const stats = cardStatsResult[0] || {
                total_cards: 0n,
                cards_with_prices: 0n,
                never_updated: 0n,
                stale_prices: 0n,
                avg_market_price: null,
                max_price: null,
                min_price: null
            };

            const changes = recentChangesResult[0] || {
                cards_updated_24h: 0n,
                avg_change_24h: null
            };

            return NextResponse.json({
                success: true,
                stats: {
                    total_cards: Number(stats.total_cards),
                    cards_with_prices: Number(stats.cards_with_prices),
                    never_updated: Number(stats.never_updated),
                    stale_prices: Number(stats.stale_prices),
                    cards_updated_24h: Number(changes.cards_updated_24h),
                    avg_price_change_24h: changes.avg_change_24h ? Number(changes.avg_change_24h) : 0,
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