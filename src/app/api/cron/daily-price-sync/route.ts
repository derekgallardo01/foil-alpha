// src/app/api/cron/daily-price-sync/route.ts - FIXED FOR YOUR SCHEMA & API
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI, type PokemonPriceTrackerCardV2 } from '../../../lib/pokemon-price-tracker-api';
import { ingestCardPriceHistory } from '../../../lib/price-history-ingest';
import { Prisma } from '@prisma/client';

interface SyncStats {
    total_cards: number;
    cards_processed: number;
    cards_updated: number;
    cards_failed: number;
    cards_skipped: number;
    api_requests: number;
    api_errors: number;
    rate_limit_hits: number;
    start_time: Date;
    end_time?: Date;
    duration_seconds?: number;
    errors: Array<{
        card_id: number;
        card_name: string;
        error: string;
    }>;
}

export async function POST(request: NextRequest) {
    try {
        console.log('🚀 Starting daily price sync...');

        // Authorize either as the cron (shared secret) or a signed-in admin.
        // The admin UI "Test Cron" button calls this with its session cookie.
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
        if (!isCron) {
            const auth = await requireAdmin();
            if ("response" in auth) return auth.response;
        }

        const startTime = new Date();

        // Parse request body for options
        const body = await request.json().catch(() => ({}));
        const {
            maxCards = 50, // Respect your daily API limit
            hoursThreshold = 24,
            force = false
        } = body;

        console.log(`📊 Sync config: maxCards=${maxCards}, hoursThreshold=${hoursThreshold}, force=${force}`);

        // Get cards that need price updates
        const cutoffTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);

        const whereClause = {
            AND: [
                { price_tracker_id: { not: "" } }, // Not empty string
                { sync_enabled: true },
                ...(force ? [] : [{
                    OR: [
                        { last_updated: null },
                        { last_updated: { lt: cutoffTime } }
                    ]
                }])
            ]
        };

        // Get cards prioritizing:
        // 1. Never updated (last_updated is null)
        // 2. Oldest updates first
        // 3. Cards with sync errors (to retry)
        const cardsToUpdate = await prisma.card.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                price_tracker_id: true,
                market_price: true,
                last_updated: true,
                sync_errors: true,
                set_name: true,
                card_number: true
            },
            orderBy: [
                { last_updated: 'asc' }, // Never updated first, then oldest
                { sync_errors: 'desc' },  // Cards with errors get priority
                { id: 'asc' }
            ],
            take: maxCards // Respect API limit
        });

        console.log(`🔍 Found ${cardsToUpdate.length} cards to update`);

        if (cardsToUpdate.length === 0) {
            const logEntry = await prisma.priceSyncLog.create({
                data: {
                    sync_type: 'daily_automated',
                    cards_processed: 0,
                    cards_updated: 0,
                    cards_failed: 0,
                    cards_skipped: 0,
                    total_api_requests: 0,
                    api_errors: 0,
                    rate_limit_hits: 0,
                    start_time: startTime,
                    end_time: new Date(),
                    duration_seconds: 0,
                    triggered_by: 'cron',
                }
            });

            return NextResponse.json({
                success: true,
                message: 'No cards need updating',
                results: {
                    total: 0,
                    updated: 0,
                    failed: 0,
                    skipped: 0,
                    errors: []
                },
                sync_log_id: logEntry.id
            });
        }

        const stats: SyncStats = {
            total_cards: cardsToUpdate.length,
            cards_processed: 0,
            cards_updated: 0,
            cards_failed: 0,
            cards_skipped: 0,
            api_requests: 0,
            api_errors: 0,
            rate_limit_hits: 0,
            start_time: startTime,
            errors: []
        };

        // Process cards one by one to respect rate limits
        for (const card of cardsToUpdate) {
            try {
                if (!card.price_tracker_id) {
                    console.warn(`⚠️ Card ${card.name} has no price tracker ID`);
                    stats.cards_skipped++;
                    continue;
                }

                console.log(`🔄 Updating prices for: ${card.name} (${card.price_tracker_id})`);
                stats.api_requests++;

                // Fetch updated pricing from Pokemon Price Tracker API
                const pricingResponse = await pokemonPriceTrackerAPI.getCardPricing(card.price_tracker_id);

                if (!pricingResponse.success || !pricingResponse.data) {
                    console.error(`❌ Failed to fetch pricing for ${card.name}: ${pricingResponse.error}`);
                    stats.api_errors++;
                    stats.cards_failed++;
                    stats.errors.push({
                        card_id: card.id,
                        card_name: card.name,
                        error: pricingResponse.error || 'Failed to fetch pricing'
                    });

                    // Increment sync_errors for this card
                    await prisma.card.update({
                        where: { id: card.id },
                        data: {
                            sync_errors: { increment: 1 },
                            updated_at: new Date()
                        }
                    });
                    continue;
                }

                // FIXED: Extract the actual card data correctly
                const cardData = pricingResponse.data as PokemonPriceTrackerCardV2;
                const newMarketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(cardData);

                if (!newMarketPrice || newMarketPrice <= 0) {
                    console.warn(`⚠️ No valid price found for ${card.name}`);
                    stats.cards_skipped++;
                    continue;
                }

                const oldPrice = card.market_price ? Number(card.market_price) : null;
                const priceChange = oldPrice ? ((newMarketPrice - oldPrice) / oldPrice) * 100 : null;

                // FIXED: Update the card using correct schema fields
                await prisma.card.update({
                    where: { id: card.id },
                    data: {
                        market_price: newMarketPrice,
                        price_source: 'pokemon_price_tracker_v2', // Match your schema
                        last_updated: new Date(),
                        sync_errors: 0, // Reset error count on successful update
                        updated_at: new Date(),
                        // FIXED: Store V2 API data in the correct JSON fields from your schema
                        prices_data: (cardData.prices || Prisma.JsonNull) as Prisma.InputJsonValue,
                        ebay_data: (cardData.ebay || Prisma.JsonNull) as Prisma.InputJsonValue,
                        price_history_data: (cardData.priceHistory || Prisma.JsonNull) as Prisma.InputJsonValue,
                        attacks_data: (cardData.attacks || Prisma.JsonNull) as Prisma.InputJsonValue,
                        weakness_data: (cardData.weakness || Prisma.JsonNull) as Prisma.InputJsonValue,
                        resistance_data: (cardData.resistance || Prisma.JsonNull) as Prisma.InputJsonValue,
                        // Update other V2 fields that exist in your schema
                        data_completeness: cardData.dataCompleteness || null,
                        needs_detailed_scrape: cardData.needsDetailedScrape || false,
                        last_scraped_at: cardData.lastScrapedAt ? new Date(cardData.lastScrapedAt) : null,
                        // Update additional fields if they have data
                        tcg_player_url: cardData.tcgPlayerUrl || null,
                        artist: cardData.artist || null,
                        retreat_cost: cardData.retreatCost || null,
                    }
                });

                // Create price history entry
                await prisma.price_history.create({
                    data: {
                        card_id: card.id,
                        price: newMarketPrice,
                        source: 'pokemon_price_tracker_v2', // Match your schema default
                        price_type: 'market',
                        condition: cardData.prices?.primaryCondition || 'Near Mint',
                        // FIXED: Store additional data in metadata
                        metadata: {
                            daily_sync: true,
                            api_source: 'pokemon_price_tracker_v2',
                            old_price: oldPrice,
                            price_change_percent: priceChange,
                            pricing_data: cardData.prices || null,
                            listings_count: cardData.prices?.listings || null
                        } as Prisma.InputJsonValue
                    }
                });

                // Also persist the full V2 price *time series* (idempotent), so
                // the forecasting dataset deepens with every sync — not just the
                // single latest point written above.
                try {
                    await ingestCardPriceHistory(card.id, cardData.priceHistory as any);
                } catch (ingestErr) {
                    console.warn(`⚠️ History ingest failed for ${card.name}:`, ingestErr);
                }

                stats.cards_updated++;
                stats.cards_processed++;

                const changeText = priceChange ? ` (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}%)` : '';
                console.log(`✅ Updated ${card.name}: $${oldPrice || 'N/A'} -> $${newMarketPrice}${changeText}`);

                // Rate limiting: wait 1 second between requests (60/min limit)
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                stats.cards_failed++;
                stats.cards_processed++;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';

                console.error(`❌ Error updating ${card.name}:`, error);
                stats.errors.push({
                    card_id: card.id,
                    card_name: card.name,
                    error: errorMsg
                });

                // Update sync_errors count
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
        }

        // Finalize stats
        const endTime = new Date();
        stats.end_time = endTime;
        stats.duration_seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        // Create sync log entry
        const logEntry = await prisma.priceSyncLog.create({
            data: {
                sync_type: 'daily_automated',
                cards_processed: stats.cards_processed,
                cards_updated: stats.cards_updated,
                cards_failed: stats.cards_failed,
                cards_skipped: stats.cards_skipped,
                total_api_requests: stats.api_requests,
                api_errors: stats.api_errors,
                rate_limit_hits: stats.rate_limit_hits,
                start_time: startTime,
                end_time: endTime,
                duration_seconds: stats.duration_seconds,
                error_details: (stats.errors.length > 0 ? stats.errors : Prisma.JsonNull) as Prisma.InputJsonValue,
                triggered_by: 'cron',
            }
        });

        console.log('🎉 Daily price sync completed:', {
            updated: stats.cards_updated,
            failed: stats.cards_failed,
            skipped: stats.cards_skipped,
            duration: `${stats.duration_seconds}s`,
            log_id: logEntry.id
        });

        return NextResponse.json({
            success: true,
            message: `Daily price sync completed: ${stats.cards_updated}/${stats.total_cards} cards updated`,
            results: {
                total: stats.total_cards,
                updated: stats.cards_updated,
                failed: stats.cards_failed,
                skipped: stats.cards_skipped,
                errors: stats.errors,
                duration_seconds: stats.duration_seconds,
                api_requests_used: stats.api_requests
            },
            sync_log_id: logEntry.id
        });

    } catch (error) {
        console.error('❌ Daily price sync error:', error);

        // Log the error
        try {
            const errorLog = await prisma.priceSyncLog.create({
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

            console.log('📝 Error logged with ID:', errorLog.id);
        } catch (logError) {
            console.error('Failed to log sync error:', logError);
        }

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Daily price sync failed'
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'status') {
            // Get sync status information
            const latestSync = await prisma.priceSyncLog.findFirst({
                orderBy: { created_at: 'desc' },
                where: { sync_type: 'daily_automated' }
            });

            const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const cardsNeedingUpdate = await prisma.card.count({
                where: {
                    AND: [
                        { price_tracker_id: { not: "" } }, // Not empty string
                        { sync_enabled: true },
                        {
                            OR: [
                                { last_updated: null },
                                { last_updated: { lt: cutoffTime } }
                            ]
                        }
                    ]
                }
            });

            const totalCards = await prisma.card.count({
                where: {
                    AND: [
                        { price_tracker_id: { not: "" } }, // Not empty string
                        { sync_enabled: true }
                    ]
                }
            });

            const cardsWithPrices = await prisma.card.count({
                where: {
                    AND: [
                        { price_tracker_id: { not: "" } },
                        { market_price: { not: null } },
                        { market_price: { gt: 0 } }
                    ]
                }
            });

            return NextResponse.json({
                success: true,
                status: {
                    cards_needing_update: cardsNeedingUpdate,
                    total_trackable_cards: totalCards,
                    cards_with_prices: cardsWithPrices,
                    coverage_percentage: totalCards > 0 ? Math.round((cardsWithPrices / totalCards) * 100) : 0,
                    last_sync: latestSync,
                    daily_api_limit: 50,
                    recommended_sync_frequency: 'Every 24 hours',
                    next_sync_estimate: latestSync ?
                        new Date(latestSync.created_at.getTime() + 24 * 60 * 60 * 1000).toISOString() :
                        'Not scheduled'
                }
            });
        }

        if (action === 'logs') {
            // Get recent sync logs
            const limit = parseInt(searchParams.get('limit') || '10');
            const logs = await prisma.priceSyncLog.findMany({
                where: { sync_type: 'daily_automated' },
                orderBy: { created_at: 'desc' },
                take: limit
            });

            return NextResponse.json({
                success: true,
                logs
            });
        }

        // Default health check
        return NextResponse.json({
            success: true,
            message: 'Daily price sync API is ready',
            endpoints: {
                'POST /': 'Run sync manually',
                'GET ?action=status': 'Get sync status',
                'GET ?action=logs': 'Get sync logs'
            },
            api_info: {
                source: 'Pokemon Price Tracker V2 API',
                daily_limit: 50,
                rate_limit: '60 requests per minute',
                cost_per_card: '1 credit'
            }
        });

    } catch (error) {
        console.error('Error in daily sync GET:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}