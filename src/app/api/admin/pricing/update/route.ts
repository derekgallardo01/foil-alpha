// src/app/api/admin/pricing/update/route.ts - COMPLETELY FIXED FOR TYPE ISSUES
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI, type PokemonPriceTrackerCardV2 } from '../../../../lib/pokemon-price-tracker-api';

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

        // Get all cards eligible for price updates - FIXED: Use correct schema fields
        const cards = await prisma.card.findMany({
            where: {
                sync_enabled: true,
                price_tracker_id: { not: "" }, // FIXED: Use price_tracker_id instead of api_id
                set_id: { not: "" }, // FIXED: Use set_id string field
                card_number: { not: "" }, // FIXED: Use card_number instead of set_number
            },
            select: {
                id: true,
                price_tracker_id: true, // FIXED: Use price_tracker_id instead of api_id
                name: true,
                set_id: true,
                card_number: true, // FIXED: Use card_number instead of set_number
                market_price: true,
                last_updated: true, // FIXED: Use last_updated instead of last_price_update
            },
            orderBy: [
                { last_updated: 'asc' }, // FIXED: Use last_updated instead of last_price_update
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

        // Process cards in smaller batches to respect API limits
        for (let i = 0; i < Math.min(cards.length, 50); i++) { // Limit to 50 cards per run
            const card = cards[i];

            console.log(`🔄 Processing card ${i + 1}/${Math.min(cards.length, 50)}: ${card.name}`);

            try {
                results.api_calls_made++;

                // FIXED: Use existing API method instead of non-existent ones
                const pricingResponse = await pokemonPriceTrackerAPI.getCardPricing(card.price_tracker_id);

                if (!pricingResponse.success || !pricingResponse.data) {
                    console.error(`❌ API error for card ${card.id}:`, pricingResponse.error);
                    results.failed++;
                    results.errors.push({
                        card_id: card.id,
                        card_name: card.name,
                        error: pricingResponse.error || 'Failed to fetch pricing'
                    });
                    continue;
                }

                // COMPLETELY FIXED: Handle the API response type properly
                let actualCardData: PokemonPriceTrackerCardV2;

                const responseData = pricingResponse.data;
                if (Array.isArray(responseData)) {
                    actualCardData = responseData[0];
                } else if (responseData && typeof responseData === 'object' && 'data' in responseData) {
                    // If it's a V2APIResponse wrapper, extract the data array
                    const wrappedData = responseData as { data: PokemonPriceTrackerCardV2[] };
                    actualCardData = wrappedData.data[0];
                } else {
                    // Direct card object
                    actualCardData = responseData as PokemonPriceTrackerCardV2;
                }

                if (!actualCardData) {
                    console.error(`❌ No card data found for card ${card.id}`);
                    results.failed++;
                    continue;
                }

                // Extract pricing information - FIXED: Now using properly typed card data
                const newMarketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(actualCardData);

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

                // Update database - FIXED: All property access now uses properly typed data
                await prisma.$transaction(async (tx) => {
                    // Update card's current price
                    await tx.card.update({
                        where: { id: card.id },
                        data: {
                            market_price: newMarketPrice,
                            last_updated: new Date(), // FIXED: Use last_updated instead of last_price_update
                            updated_at: new Date(),
                            // Store V2 API data - FIXED: Simplified approach without Prisma types
                            prices_data: actualCardData.prices ? JSON.parse(JSON.stringify(actualCardData.prices)) : null,
                            ebay_data: actualCardData.ebay ? JSON.parse(JSON.stringify(actualCardData.ebay)) : null,
                            price_history_data: actualCardData.priceHistory ? JSON.parse(JSON.stringify(actualCardData.priceHistory)) : null,
                        }
                    });

                    // Create price history entry - FIXED: Use correct table name and fields
                    await tx.price_history.create({
                        data: {
                            card_id: card.id, // FIXED: Use card_id (correct field name)
                            price: newMarketPrice,
                            source: 'pokemon_price_tracker_v2',
                            recorded_at: new Date(),
                            price_type: 'market',
                            condition: 'Near Mint',
                            metadata: {
                                daily_sync: true,
                                old_price: oldPrice,
                                api_source: 'pokemon_price_tracker_v2'
                            }
                        }
                    });

                    // Store additional price points if available - FIXED: Use properly typed data
                    if (actualCardData.prices?.market && actualCardData.prices.listings) {
                        // Create additional history entry for listings count
                        await tx.price_history.create({
                            data: {
                                card_id: card.id,
                                price: actualCardData.prices.market,
                                source: 'pokemon_price_tracker_v2',
                                recorded_at: new Date(),
                                price_type: 'listings',
                                listing_count: actualCardData.prices.listings,
                                metadata: {
                                    daily_sync: true,
                                    pricing_data: actualCardData.prices
                                }
                            }
                        });
                    }
                });

                results.updated++;
                console.log(`✅ Updated ${card.name}: $${oldPrice || 'N/A'} -> $${newMarketPrice}`);

                // Rate limiting: wait 1 second between requests
                await new Promise(resolve => setTimeout(resolve, 1000));

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

    // Get status information
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const cardsNeedingUpdate = await prisma.card.count({
            where: {
                sync_enabled: true,
                price_tracker_id: { not: "" },
                OR: [
                    { last_updated: null },
                    { last_updated: { lt: oneDayAgo } }
                ]
            }
        });

        const totalTrackableCards = await prisma.card.count({
            where: {
                sync_enabled: true,
                price_tracker_id: { not: "" }
            }
        });

        return NextResponse.json({
            message: 'Use POST method to trigger daily price update',
            endpoint: '/api/admin/pricing/update',
            status: {
                cards_needing_update: cardsNeedingUpdate,
                total_trackable_cards: totalTrackableCards,
                daily_limit: 50,
                last_check: new Date().toISOString(),
            }
        });

    } catch (error) {
        return NextResponse.json({
            message: 'Use POST method to trigger daily price update',
            endpoint: '/api/admin/pricing/update',
            error: 'Could not fetch status',
            last_check: new Date().toISOString(),
        });
    }
}