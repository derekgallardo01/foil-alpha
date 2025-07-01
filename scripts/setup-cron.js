// scripts/start-cron.js
// Main cron job system for daily price updates

const cron = require('node-cron');
require('dotenv').config();

const CRON_SECRET = process.env.CRON_SECRET || 'default_secret';
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log('🚀 Starting Pokemon TCG Card Price Tracking Cron Jobs...');
console.log(`📍 Target URL: ${NEXTAUTH_URL}`);

// Daily Card Price Update Job - Runs at midnight every day
const dailyPriceUpdateJob = cron.schedule('0 0 * * *', async () => {
    console.log('🕛 [CRON] Running daily card price update at midnight UTC...');

    try {
        const fetch = require('node-fetch');

        const response = await fetch(`${NEXTAUTH_URL}/api/admin/pricing/daily-update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CRON_SECRET}`,
                'User-Agent': 'TCG-Marketplace-Cron/1.0'
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            console.log('✅ [CRON] Daily card price update completed:', {
                updated: result.results?.updated || 0,
                failed: result.results?.failed || 0,
                new_prices: result.results?.price_changes?.new_prices || 0,
                processing_time: `${(result.results?.processing_time / 60000 || 0).toFixed(2)}min`,
            });
        } else {
            console.error('❌ [CRON] Daily card price update failed:', result.error);
        }
    } catch (error) {
        console.error('💥 [CRON] Error in daily card price update:', error.message);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Health check job - Runs every 6 hours
const healthCheckJob = cron.schedule('0 */6 * * *', async () => {
    console.log('🔍 [CRON] Running health check...');

    try {
        const fetch = require('node-fetch');

        const response = await fetch(`${NEXTAUTH_URL}/api/health`, {
            method: 'GET',
            headers: {
                'User-Agent': 'TCG-Marketplace-Cron/1.0'
            },
        });

        if (response.ok) {
            const health = await response.json();
            console.log('✅ [CRON] Health check passed:', {
                status: health.status,
                tracked_cards: health.stats?.tracked_cards || 0,
                recent_updates: health.stats?.recent_updates || 0,
            });
        } else {
            console.warn('⚠️ [CRON] Health check failed:', response.status);
        }
    } catch (error) {
        console.error('💥 [CRON] Health check error:', error.message);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

console.log('⏰ Card price tracking cron jobs scheduled:');
console.log('  💰 Daily Price Update: Every day at 00:00 UTC');
console.log('  🧹 Weekly Cleanup: Every Sunday at 02:00 UTC');
console.log('  🔍 Health Check: Every 6 hours');
console.log('\n🚀 Cron system is now running...');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down cron jobs...');
    dailyPriceUpdateJob.stop();
    weeklyCleanupJob.stop();
    healthCheckJob.stop();
    console.log('✅ All cron jobs stopped');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down cron jobs...');
    dailyPriceUpdateJob.stop();
    weeklyCleanupJob.stop();
    healthCheckJob.stop();
    console.log('✅ All cron jobs stopped');
    process.exit(0);
});

