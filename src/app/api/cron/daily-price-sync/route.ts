// src/app/api/cron/daily-price-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';

// Cron job for daily price updates

export async function POST(request: NextRequest) {
    try {
        // Verify cron secret for security
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // For development, allow without secret
        if (process.env.NODE_ENV === 'production' && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🚀 Starting daily price sync cron job...');

        // Call the main sync endpoint
        const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cards/sync-prices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                force: false,
                batchSize: 50,
                maxAgeHours: 24,
                priceChangeThreshold: 5 // 5% threshold for notifications
            })
        });

        const syncResult = await syncResponse.json();

        // Log results for monitoring
        console.log('✅ Daily price sync completed:', syncResult);

        // Optional: Send admin notification about sync results
        if (syncResult.result?.errors?.length > 10) {
            // You can implement admin notification here
            console.warn(`⚠️ High error rate in daily sync: ${syncResult.result.errors.length} errors`);
        }

        return NextResponse.json({
            success: true,
            message: 'Daily price sync completed',
            timestamp: new Date().toISOString(),
            ...syncResult
        });

    } catch (error) {
        console.error('❌ Error in daily price sync cron job:', error);
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