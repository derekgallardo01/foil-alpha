// src/app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { pokemonPriceTrackerAPI } from '../../lib/pokemon-price-tracker-api';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const detailed = searchParams.get('detailed') === 'true';

        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                database: 'unknown',
                pokemon_price_tracker_api: 'unknown',
                pricing_sync: 'unknown'
            },
            stats: detailed ? {} : undefined
        };

        // Check database connection
        try {
            await prisma.$queryRaw`SELECT 1`;
            health.services.database = 'healthy';
        } catch (error) {
            health.services.database = 'unhealthy';
            health.status = 'degraded';
        }

        // Check Pokemon Price Tracker API
        try {
            const apiHealthy = await pokemonPriceTrackerAPI.healthCheck();
            health.services.pokemon_price_tracker_api = apiHealthy ? 'healthy' : 'unhealthy';
            if (!apiHealthy) health.status = 'degraded';
        } catch (error) {
            health.services.pokemon_price_tracker_api = 'unhealthy';
            health.status = 'degraded';
        }

        // Check pricing sync status
        try {
            const recentUpdates = await prisma.card.count({
                where: {
                    last_price_update: {
                        gte: new Date(Date.now() - 25 * 60 * 60 * 1000) // Last 25 hours
                    }
                }
            });

            const totalCards = await prisma.card.count({
                where: {
                    api_id: { not: null },
                    sync_enabled: true
                }
            });

            const syncHealth = totalCards > 0 ? (recentUpdates / totalCards) : 1;
            health.services.pricing_sync = syncHealth > 0.8 ? 'healthy' :
                syncHealth > 0.5 ? 'degraded' : 'unhealthy';

            if (syncHealth <= 0.5) health.status = 'degraded';

        } catch (error) {
            health.services.pricing_sync = 'unhealthy';
            health.status = 'degraded';
        }

        // Get detailed stats if requested
        if (detailed) {
            try {
                const stats = await Promise.all([
                    // Card statistics
                    prisma.card.count(),
                    prisma.card.count({ where: { api_id: { not: null } } }),
                    prisma.card.count({ where: { market_price: { not: null } } }),

                    // User statistics
                    prisma.user.count(),
                    prisma.userCard.count(),

                    // Price history statistics
                    prisma.price_history.count(),
                    prisma.price_history.count({
                        where: {
                            recorded_at: {
                                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                            }
                        }
                    }),

                    // Recent activity
                    prisma.card.count({
                        where: {
                            last_price_update: {
                                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                            }
                        }
                    })
                ]);

                health.stats = {
                    cards: {
                        total: stats[0],
                        with_api_id: stats[1],
                        with_prices: stats[2],
                        recently_updated: stats[7]
                    },
                    users: {
                        total: stats[3],
                        user_cards: stats[4]
                    },
                    price_history: {
                        total_entries: stats[5],
                        entries_24h: stats[6]
                    },
                    sync_rate: stats[1] > 0 ? ((stats[7] / stats[1]) * 100).toFixed(1) + '%' : '0%'
                };

            } catch (error) {
                console.error('Error getting detailed stats:', error);
                health.stats = { error: 'Failed to fetch detailed statistics' };
            }
        }

        // Determine HTTP status code
        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 200 : 503;

        return NextResponse.json(health, { status: statusCode });

    } catch (error) {
        console.error('Health check error:', error);
        return NextResponse.json(
            {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                services: {
                    database: 'unknown',
                    pokemon_price_tracker_api: 'unknown',
                    pricing_sync: 'unknown'
                }
            },
            { status: 503 }
        );
    }
}

// POST endpoint for manual health check with actions
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        const results = {
            action_performed: action,
            timestamp: new Date().toISOString(),
            results: {} as any
        };

        switch (action) {
            case 'test_database':
                try {
                    await prisma.$queryRaw`SELECT 1 + 1 as test`;
                    results.results.database = 'Connection successful';
                } catch (error) {
                    results.results.database = `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
                break;

            case 'test_price_api':
                try {
                    const apiTest = await pokemonPriceTrackerAPI.healthCheck();
                    results.results.price_api = apiTest ? 'API accessible' : 'API not responding';
                } catch (error) {
                    results.results.price_api = `API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
                break;

            case 'sync_sample':
                try {
                    // Test sync with a small sample of cards
                    const sampleCards = await prisma.card.findMany({
                        where: {
                            api_id: { not: null },
                            sync_enabled: true
                        },
                        take: 5,
                        select: { id: true }
                    });

                    if (sampleCards.length > 0) {
                        const syncResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cards/sync-prices`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                cardIds: sampleCards.map(c => c.id),
                                force: true,
                                batchSize: 5
                            })
                        });

                        const syncData = await syncResponse.json();
                        results.results.sync_sample = syncData.success ?
                            `Successfully synced ${syncData.result?.successful_updates || 0} cards` :
                            `Sync failed: ${syncData.error}`;
                    } else {
                        results.results.sync_sample = 'No cards available for testing';
                    }
                } catch (error) {
                    results.results.sync_sample = `Sync test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
                break;

            case 'cleanup_old_prices':
                try {
                    // Clean up price history older than 1 year
                    const oneYearAgo = new Date();
                    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                    const deleteResult = await prisma.price_history.deleteMany({
                        where: {
                            recorded_at: { lt: oneYearAgo }
                        }
                    });

                    results.results.cleanup = `Removed ${deleteResult.count} old price records`;
                } catch (error) {
                    results.results.cleanup = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
                }
                break;

            default:
                results.results.error = 'Unknown action. Available actions: test_database, test_price_api, sync_sample, cleanup_old_prices';
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error('Health check action error:', error);
        return NextResponse.json(
            {
                error: 'Health check action failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}