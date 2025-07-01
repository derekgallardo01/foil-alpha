// src/app/api/cron/daily-price-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';

// Cron job for daily price updates
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Starting daily price sync job...');

        const results = {
            total_cards: 0,
            successful_updates: 0,
            failed_updates: 0,
            skipped_cards: 0,
            errors: [] as any[],
            start_time: new Date(),
            end_time: null as Date | null,
            duration_ms: 0,
        };

        // Get all cards that need price updates (all cards with api_id)
        const cardsToUpdate = await prisma.card.findMany({
            where: {
                api_id: { not: null },
                sync_enabled: true, // Only sync enabled cards
            },
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

        results.total_cards = cardsToUpdate.length;
        console.log(`Found ${results.total_cards} cards to update`);

        if (results.total_cards === 0) {
            return NextResponse.json({
                success: true,
                message: 'No cards need price updates',
                results
            });
        }

        // Process cards in batches to respect API limits
        const batchSize = 50;
        const delay = 2000; // 2 seconds between batches

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
                results.skipped_cards += batch.length;
                continue;
            }

            try {
                // Fetch pricing data for batch
                const pricingResponse = await pokemonPriceTrackerAPI.getBatchPricing(priceTrackerIds, false);

                if (!pricingResponse.success || !pricingResponse.data) {
                    console.error('Failed to fetch pricing data:', pricingResponse.error);
                    results.failed_updates += batch.length;
                    results.errors.push({
                        batch_index: Math.floor(i / batchSize) + 1,
                        error: pricingResponse.error || 'Failed to fetch pricing'
                    });
                    continue;
                }

                // Process each card in the batch
                for (const card of batch) {
                    try {
                        const priceTrackerId = card.set_id && card.set_number ?
                            PokemonPriceTrackerAPI.convertTCGCardIdToPriceTrackerId(card.set_id, card.set_number) : null;

                        if (!priceTrackerId) {
                            results.skipped_cards++;
                            continue;
                        }

                        // Find pricing data for this card
                        const pricingData = pricingResponse.data.find(p => p.id === priceTrackerId);

                        if (!pricingData) {
                            results.skipped_cards++;
                            continue;
                        }

                        // Extract pricing information
                        const marketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(pricingData);
                        const priceSummary = PokemonPriceTrackerAPI.getPricingSummary(pricingData);

                        if (!marketPrice || marketPrice <= 0) {
                            results.skipped_cards++;
                            continue;
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

                        // Create price history entry using the correct table
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
                                    cron_job: true,
                                    sync_timestamp: new Date().toISOString()
                                }
                            }
                        });

                        results.successful_updates++;

                    } catch (error) {
                        console.error(`Error updating card ${card.id}:`, error);
                        results.errors.push({
                            card_id: card.id,
                            card_name: card.name,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                        results.failed_updates++;
                    }
                }

            } catch (batchError) {
                console.error(`Error processing batch:`, batchError);
                results.failed_updates += batch.length;
                results.errors.push({
                    batch_index: Math.floor(i / batchSize) + 1,
                    error: batchError instanceof Error ? batchError.message : 'Batch processing failed'
                });
            }

            // Delay between batches to respect rate limits
            if (i + batchSize < cardsToUpdate.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        results.end_time = new Date();
        results.duration_ms = results.end_time.getTime() - results.start_time.getTime();

        console.log('Daily price sync completed:', results);

        // Send summary to admin (optional - you can implement email notifications)
        if (results.errors.length > 10) {
            console.warn(`High error rate in price sync: ${results.errors.length} errors`);
        }

        return NextResponse.json({
            success: true,
            message: `Daily price sync completed: ${results.successful_updates} updated, ${results.failed_updates} failed, ${results.skipped_cards} skipped`,
            results,
            summary: {
                success_rate: results.total_cards > 0 ?
                    (results.successful_updates / results.total_cards * 100).toFixed(2) + '%' : '0%',
                duration: `${Math.round(results.duration_ms / 1000)}s`,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error in daily price sync cron job:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Daily price sync failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

// GET endpoint for cron job status/health check
export async function GET() {
    try {
        // Get recent price sync statistics
        const recentUpdates = await prisma.card.findMany({
            where: {
                last_price_update: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
            },
            select: {
                id: true,
                last_price_update: true,
            }
        });

        const totalCards = await prisma.card.count({
            where: { api_id: { not: null } }
        });

        const staleCards = await prisma.card.count({
            where: {
                api_id: { not: null },
                OR: [
                    { last_price_update: null },
                    {
                        last_price_update: {
                            lt: new Date(Date.now() - 25 * 60 * 60 * 1000) // More than 25 hours ago
                        }
                    }
                ]
            }
        });

        return NextResponse.json({
            success: true,
            status: {
                total_cards_with_api: totalCards,
                recent_updates_24h: recentUpdates.length,
                stale_cards: staleCards,
                last_sync_status: staleCards === 0 ? 'healthy' : 'needs_sync',
                next_sync_time: 'Daily at midnight UTC',
                current_time: new Date().toISOString()
            }
        });

    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to get cron status',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}