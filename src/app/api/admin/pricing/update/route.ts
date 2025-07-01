// src/app/api/admin/pricing/daily-update/route.ts
// Daily price update API that runs via cron job at midnight

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../../lib/pokemon-price-tracker-api';

const BATCH_SIZE = 50; // Respect 60 per minute API limit
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export async function POST(request: NextRequest) {
    try {
        console.log('🚀 Starting daily card price update...');
        const startTime = Date.now();

        // Authentication check
        const authHeader = request.headers.get('authorization');
        if (authHeader && !authHeader.includes(process.env.CRON_SECRET || 'default_secret')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all cards eligible for price updates
        const cards = await prisma.card.findMany({
            where: {
                sync_enabled: true,
                api_id: { not: null },
                set_id: { not: null },
                set_number: { not: null },
            },
            select: {
                id: true,
                api_id: true,
                name: true,
                set_id: true,
                set_number: true,
                market_price: true,
                last_price_update: true,
            },
            orderBy: [
                { last_price_update: { sort: 'asc', nulls: 'first' } },
                { id: 'asc' }
            ],
        });

        console.log(`📊 Found ${cards.length} cards eligible for price updates`);

        const results = {
            total_cards: cards.length,
            updated: 0,
            failed: 0,
            skipped: 0,
            errors: [] as Array<{ card_id: number; card_name: string; error: string }>,
            price_changes: { increased: 0, decreased: 0, unchanged: 0, new_prices: 0 },
            processing_time: 0,
            api_calls_made: 0,
            rate_limit_hits: 0,
        };

        // Process cards in batches
        for (let i = 0; i < cards.length; i += BATCH_SIZE) {
            const batch = cards.slice(i, i + BATCH_SIZE);
            const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(cards.length / BATCH_SIZE);

            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} cards)`);

            // Convert to price tracker IDs
            const priceTrackerRequests = batch.map(card => ({
                card,
                priceTrackerId: PokemonPriceTrackerAPI.convertTCGCardIdToPriceTrackerId(card.set_id!, card.set_number!)
            }));

            // Fetch pricing data with retry logic
            let pricingData = null;
            let retryCount = 0;

            while (retryCount < MAX_RETRIES && !pricingData) {
                try {
                    results.api_calls_made++;

                    const pricingResponse = await pokemonPriceTrackerAPI.getBatchPricing(
                        priceTrackerRequests.map(item => item.priceTrackerId),
                        false
                    );

                    if (pricingResponse.success && pricingResponse.data) {
                        pricingData = pricingResponse.data;
                        console.log(`✅ Fetched pricing for ${pricingData.length} cards in batch ${batchNumber}`);
                        break;
                    } else if (pricingResponse.error?.includes('Rate limited')) {
                        results.rate_limit_hits++;
                        const waitTime = RETRY_DELAY * (retryCount + 1);
                        console.log(`⏳ Rate limited, waiting ${waitTime}ms...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        retryCount++;
                    } else {
                        console.error(`❌ API error for batch ${batchNumber}:`, pricingResponse.error);
                        break;
                    }
                } catch (error) {
                    console.error(`💥 Network error on batch ${batchNumber}:`, error);
                    retryCount++;
                    if (retryCount < MAX_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
                    }
                }
            }

            if (!pricingData) {
                results.failed += batch.length;
                continue;
            }

            // Create pricing map
            const pricingMap = new Map(pricingData.map((item: any) => [item.id, item]));

            // Process each card
            for (const { card, priceTrackerId } of priceTrackerRequests) {
                try {
                    const cardPricing = pricingMap.get(priceTrackerId);

                    if (!cardPricing) {
                        results.skipped++;
                        continue;
                    }

                    // Extract pricing information
                    const newMarketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(cardPricing);
                    const priceTrend = PokemonPriceTrackerAPI.getPriceTrend(cardPricing);

                    if (!newMarketPrice || newMarketPrice <= 0) {
                        results.skipped++;
                        continue;
                    }

                    // Calculate price change
                    const oldPrice = card.market_price ? parseFloat(card.market_price.toString()) : null;
                    let changeType = 'new_prices';

                    if (oldPrice !== null) {
                        const priceChange = newMarketPrice - oldPrice;
                        if (Math.abs(priceChange) > 0.01) {
                            changeType = priceChange > 0 ? 'increased' : 'decreased';
                        } else {
                            changeType = 'unchanged';
                        }
                    }

                    results.price_changes[changeType as keyof typeof results.price_changes]++;

                    // Update database
                    await prisma.$transaction(async (tx) => {
                        // Update card's current price
                        await tx.card.update({
                            where: { id: card.id },
                            data: {
                                market_price: newMarketPrice,
                                price_trend: priceTrend,
                                last_price_update: new Date(),
                                updated_at: new Date(),
                            }
                        });

                        // Create price history entry
                        await tx.priceHistory.create({
                            data: {
                                card_id: card.id,
                                price: newMarketPrice,
                                recorded_at: new Date(),
                                source: 'pokemon_price_tracker',
                                price_type: 'market',
                                condition: 'NM',
                                retailer: 'pokemon_price_tracker',
                                stock_status: 'available',
                                raw_data: cardPricing,
                            }
                        });

                        // Store additional price points if available
                        const prices = cardPricing.prices;
                        if (prices?.tcgplayer) {
                            if (prices.tcgplayer.low && prices.tcgplayer.low !== newMarketPrice) {
                                await tx.priceHistory.create({
                                    data: {
                                        card_id: card.id,
                                        price: prices.tcgplayer.low,
                                        recorded_at: new Date(),
                                        source: 'pokemon_price_tracker',
                                        price_type: 'low',
                                        condition: 'NM',
                                        retailer: 'tcgplayer',
                                        stock_status: 'available',
                                    }
                                });
                            }

                            if (prices.tcgplayer.high && prices.tcgplayer.high !== newMarketPrice) {
                                await tx.priceHistory.create({
                                    data: {
                                        card_id: card.id,
                                        price: prices.tcgplayer.high,
                                        recorded_at: new Date(),
                                        source: 'pokemon_price_tracker',
                                        price_type: 'high',
                                        condition: 'NM',
                                        retailer: 'tcgplayer',
                                        stock_status: 'available',
                                    }
                                });
                            }
                        }
                    });

                    results.updated++;

                } catch (error) {
                    console.error(`❌ Error updating card ${card.id}:`, error);
                    results.failed++;
                    results.errors.push({
                        card_id: card.id,
                        card_name: card.name,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            // Rate limiting between batches
            if (i + BATCH_SIZE < cards.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        results.processing_time = Date.now() - startTime;

        console.log('🎉 Daily price update completed:', {
            ...results,
            processing_time_minutes: (results.processing_time / 60000).toFixed(2),
            success_rate: `${((results.updated / results.total_cards) * 100).toFixed(1)}%`,
        });

        // Log completion
        await prisma.activityLog.create({
            data: {
                userId: 1, // System user
                action: `Daily price update: ${results.updated}/${results.total_cards} cards updated`,
                timestamp: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: `Daily price update completed: ${results.updated} updated, ${results.failed} failed, ${results.skipped} skipped`,
            results,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('💥 Critical error in daily price update:', error);

        try {
            await prisma.activityLog.create({
                data: {
                    userId: 1,
                    action: `Daily price update FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    timestamp: new Date()
                }
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        return NextResponse.json({
            success: false,
            error: 'Daily price update failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}

// Manual trigger endpoint for testing
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes(process.env.CRON_SECRET || 'default_secret')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
        message: 'Use POST method to trigger daily price update',
        endpoint: '/api/admin/pricing/daily-update',
        last_run: new Date().toISOString(),
    });
}