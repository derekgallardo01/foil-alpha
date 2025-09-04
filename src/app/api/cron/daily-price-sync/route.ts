// src/app/api/cron/daily-price-sync/route.ts - TYPESCRIPT ERROR FREE VERSION
import { NextRequest, NextResponse } from 'next/server';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';
import { prisma } from '../../../lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
    try {
        console.log('Starting daily price sync...');

        // Optional: Verify this is a legitimate cron request
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({
                success: false,
                error: 'Unauthorized'
            }, { status: 401 });
        }

        // Get all cards that need price updates (older than 24 hours or never updated)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const cardsToUpdate = await prisma.card.findMany({
            where: {
                AND: [
                    { price_tracker_id: { not: null } },
                    { sync_enabled: true },
                    {
                        OR: [
                            { last_updated: null },
                            { last_updated: { lt: oneDayAgo } }
                        ]
                    }
                ]
            },
            select: {
                id: true,
                name: true,
                price_tracker_id: true,
                last_updated: true
            },
            take: 1000
        });

        console.log(`Found ${cardsToUpdate.length} cards to update`);

        if (cardsToUpdate.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No cards need updating',
                results: {
                    total: 0,
                    updated: 0,
                    failed: 0,
                    errors: []
                }
            });
        }

        const results = {
            total: cardsToUpdate.length,
            updated: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Process cards in batches
        const batchSize = 50;
        const delayBetweenBatches = 60000;

        for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
            const batch = cardsToUpdate.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsToUpdate.length / batchSize)}`);

            for (const card of batch) {
                try {
                    if (!card.price_tracker_id) {
                        results.failed++;
                        results.errors.push(`Card ${card.name} has no price tracker ID`);
                        continue;
                    }

                    console.log(`Updating prices for: ${card.name} (${card.price_tracker_id})`);

                    const pricingResponse = await pokemonPriceTrackerAPI.getCardPricing(card.price_tracker_id);

                    if (!pricingResponse.success || !pricingResponse.data) {
                        results.failed++;
                        results.errors.push(`Failed to fetch pricing for ${card.name}: ${pricingResponse.error}`);
                        continue;
                    }

                    const cardData = pricingResponse.data;
                    const marketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(cardData);

                    // Update the card in database - using proper Prisma types
                    await prisma.card.update({
                        where: { id: card.id },
                        data: {
                            market_price: marketPrice,
                            price_source: 'pokemon_price_tracker',
                            last_updated: new Date(),
                            sync_errors: 0,
                            updated_at: new Date(),
                            tcgplayer_data: (cardData.prices?.tcgplayer || Prisma.JsonNull) as Prisma.InputJsonValue,
                            cardmarket_data: (cardData.prices?.cardmarket || Prisma.JsonNull) as Prisma.InputJsonValue,
                            ebay_data: (cardData.prices?.ebay || Prisma.JsonNull) as Prisma.InputJsonValue,
                        }
                    });

                    // Create price history entry
                    if (marketPrice) {
                        await prisma.price_history.create({
                            data: {
                                card_id: card.id,
                                price: marketPrice,
                                source: 'pokemon_price_tracker',
                                price_type: 'market',
                                metadata: {
                                    daily_sync: true,
                                    api_source: 'pokemon_price_tracker',
                                    pricing_sources: cardData.prices || {}
                                } as Prisma.InputJsonValue
                            }
                        });
                    }

                    results.updated++;
                    console.log(`Updated ${card.name}: $${marketPrice}`);

                } catch (error) {
                    results.failed++;
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    results.errors.push(`Error updating ${card.name}: ${errorMsg}`);
                    console.error(`Error updating ${card.name}:`, error);

                    try {
                        await prisma.card.update({
                            where: { id: card.id },
                            data: {
                                sync_errors: { increment: 1 },
                                updated_at: new Date()
                            }
                        });
                    } catch (dbError) {
                        console.error(`Failed to update sync error count for ${card.name}:`, dbError);
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (i + batchSize < cardsToUpdate.length) {
                console.log(`Waiting ${delayBetweenBatches / 1000} seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        // Create a sync log entry - using proper Prisma types
        await prisma.priceSyncLog.create({
            data: {
                sync_type: 'daily_automated',
                cards_processed: results.total,
                cards_updated: results.updated,
                cards_failed: results.failed,
                cards_skipped: 0,
                total_api_requests: results.total,
                api_errors: results.failed,
                rate_limit_hits: 0,
                start_time: new Date(Date.now() - (results.total * 1000)),
                end_time: new Date(),
                duration_seconds: Math.floor(results.total * 1000 / 1000),
                error_details: (results.errors.length > 0 ? results.errors : Prisma.JsonNull) as Prisma.InputJsonValue,
                triggered_by: 'cron',
            }
        });

        console.log('Daily price sync completed:', results);

        return NextResponse.json({
            success: true,
            message: `Daily price sync completed: ${results.updated}/${results.total} cards updated`,
            results
        });

    } catch (error) {
        console.error('Daily price sync error:', error);

        try {
            await prisma.priceSyncLog.create({
                data: {
                    sync_type: 'daily_automated',
                    cards_processed: 0,
                    cards_updated: 0,
                    cards_failed: 0,
                    cards_skipped: 0,
                    total_api_requests: 0,
                    api_errors: 1,
                    rate_limit_hits: 0,
                    start_time: new Date(),
                    end_time: new Date(),
                    duration_seconds: 0,
                    error_details: ([error instanceof Error ? error.message : 'Unknown error']) as Prisma.InputJsonValue,
                    triggered_by: 'cron',
                }
            });
        } catch (logError) {
            console.error('Failed to log sync error:', logError);
        }

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const latestSync = await prisma.priceSyncLog.findFirst({
            orderBy: { created_at: 'desc' },
            where: { sync_type: 'daily_automated' }
        });

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const cardsNeedingUpdate = await prisma.card.count({
            where: {
                AND: [
                    { price_tracker_id: { not: null } },
                    { sync_enabled: true },
                    {
                        OR: [
                            { last_updated: null },
                            { last_updated: { lt: oneDayAgo } }
                        ]
                    }
                ]
            }
        });

        return NextResponse.json({
            cardsNeedingUpdate,
            lastSync: latestSync,
            nextScheduledSync: 'Configure with cron job or Vercel Cron'
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}