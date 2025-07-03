// scripts/setup-cron.js - Fixed cron job system (no node-fetch dependency)
const cron = require('node-cron');
require('dotenv').config();

const CRON_SECRET = process.env.CRON_SECRET || 'default_secret';
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

console.log('🚀 Starting Pokemon TCG Card Price Tracking Cron Jobs...');
console.log(`📍 Target URL: ${NEXTAUTH_URL}`);
console.log(`🔑 Using CRON_SECRET: ${CRON_SECRET ? 'Set' : 'Missing'}`);

// Use Node.js built-in fetch (available in Node 18+)
// For older Node versions, we'll use a simple HTTP request

async function makeRequest(url, options = {}) {
    // Try to use fetch if available (Node 18+)
    if (typeof fetch !== 'undefined') {
        return fetch(url, options);
    }

    // Fallback for older Node versions
    const https = require('https');
    const http = require('http');
    const urlParsed = new URL(url);
    const client = urlParsed.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        const req = client.request({
            hostname: urlParsed.hostname,
            port: urlParsed.port,
            path: urlParsed.pathname + urlParsed.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    json: () => Promise.resolve(JSON.parse(data)),
                    text: () => Promise.resolve(data)
                });
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Daily Card Price Update Job - Runs at midnight every day
const dailyPriceUpdateJob = cron.schedule('0 0 * * *', async () => {
    console.log('🕛 [CRON] Running daily card price update at midnight UTC...');

    try {
        // Use the correct endpoint that exists
        const response = await makeRequest(`${NEXTAUTH_URL}/api/cron/daily-price-sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CRON_SECRET}`,
                'User-Agent': 'TCG-Marketplace-Cron/1.0'
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            console.log('✅ [CRON] Daily card price update completed:', {
                total_cards: result.results?.total_cards || 0,
                successful_updates: result.results?.successful_updates || 0,
                failed_updates: result.results?.failed_updates || 0,
                skipped_cards: result.results?.skipped_cards || 0,
                duration: result.summary?.duration || 'Unknown',
                success_rate: result.summary?.success_rate || '0%'
            });

            // Log any errors if they exist
            if (result.results?.errors?.length > 0) {
                console.warn(`⚠️ [CRON] ${result.results.errors.length} cards failed to update`);
            }
        } else {
            console.error('❌ [CRON] Daily card price update failed:', result.error);
        }
    } catch (error) {
        console.error('💥 [CRON] Error in daily card price update:', error.message);

        // Try to get more details about the error
        if (error.message.includes('ECONNREFUSED')) {
            console.error('🔌 [CRON] Connection refused - is the server running?');
        } else if (error.message.includes('401')) {
            console.error('🔑 [CRON] Unauthorized - check CRON_SECRET configuration');
        }
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Health check job - Runs every 6 hours
const healthCheckJob = cron.schedule('0 */6 * * *', async () => {
    console.log('🔍 [CRON] Running health check...');

    try {
        const response = await makeRequest(`${NEXTAUTH_URL}/api/health?detailed=true`);

        if (response.ok) {
            const health = await response.json();
            console.log('✅ [CRON] Health check passed:', {
                status: health.status,
                database: health.services?.database || 'unknown',
                price_api: health.services?.pokemon_price_tracker_api || 'unknown',
                pricing_sync: health.services?.pricing_sync || 'unknown',
                total_cards: health.stats?.cards?.total || 0,
                cards_with_prices: health.stats?.cards?.with_prices || 0,
                recent_updates: health.stats?.cards?.recently_updated || 0
            });

            // Alert if services are down
            if (health.status !== 'healthy') {
                console.warn('⚠️ [CRON] System health degraded:', health.status);
            }
        } else {
            console.warn('⚠️ [CRON] Health check failed:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('💥 [CRON] Health check error:', error.message);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Weekly cleanup job - Runs every Sunday at 2 AM UTC
const weeklyCleanupJob = cron.schedule('0 2 * * 0', async () => {
    console.log('🧹 [CRON] Running weekly cleanup...');

    try {
        const response = await makeRequest(`${NEXTAUTH_URL}/api/health`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TCG-Marketplace-Cron/1.0'
            },
            body: JSON.stringify({ action: 'cleanup_old_prices' })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ [CRON] Weekly cleanup completed:', result.results);
        } else {
            console.warn('⚠️ [CRON] Weekly cleanup failed:', response.status);
        }
    } catch (error) {
        console.error('💥 [CRON] Weekly cleanup error:', error.message);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});

// Manual trigger for testing (runs once on startup in test mode)
if (process.env.NODE_ENV === 'development' || process.argv.includes('--test')) {
    console.log('\n🧪 TEST MODE: Running immediate price sync test...');
    setTimeout(async () => {
        try {
            console.log('🔄 Testing manual price sync...');
            const response = await makeRequest(`${NEXTAUTH_URL}/api/cron/daily-price-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CRON_SECRET}`,
                    'User-Agent': 'TCG-Marketplace-Cron-Test/1.0'
                },
            });

            const result = await response.json();
            if (result.success) {
                console.log('✅ Test sync successful:', {
                    updated: result.results?.successful_updates || 0,
                    failed: result.results?.failed_updates || 0,
                    skipped: result.results?.skipped_cards || 0
                });
            } else {
                console.error('❌ Test sync failed:', result.error);
            }
        } catch (error) {
            console.error('💥 Test sync error:', error.message);
        }
    }, 5000); // Wait 5 seconds for server to be ready
}

console.log('\n⏰ Card price tracking cron jobs scheduled:');
console.log('  💰 Daily Price Update: Every day at 00:00 UTC');
console.log('  🧹 Weekly Cleanup: Every Sunday at 02:00 UTC');
console.log('  🔍 Health Check: Every 6 hours');
console.log('\n🚀 Cron system is now running...');
console.log('💡 Run with --test flag to trigger immediate test sync');

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

// Export jobs for external control
module.exports = {
    dailyPriceUpdateJob,
    healthCheckJob,
    weeklyCleanupJob
};