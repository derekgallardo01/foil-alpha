// cron-runner.js
require('dotenv').config();
const cron = require('node-cron');

async function runDailyPriceSync() {
    console.log(`[${new Date().toISOString()}] Starting daily price sync...`);

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/daily-price-sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log(`[${new Date().toISOString()}] Daily sync completed:`, result.message);

        // Log statistics
        if (result.result) {
            console.log(`
                ✅ Updated: ${result.result.successful_updates}
                ❌ Failed: ${result.result.failed_updates}
                ⏭️ Skipped: ${result.result.skipped_cards}
                📬 Notifications: ${result.result.notifications_sent}
            `);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Daily sync failed:`, error);
    }
}

// Schedule for 2 AM every day
cron.schedule('0 2 * * *', runDailyPriceSync);

// Also run every 6 hours for more frequent updates (optional)
// cron.schedule('0 */6 * * *', runDailyPriceSync);

// Run immediately on startup (optional - good for testing)
if (process.env.RUN_ON_STARTUP === 'true') {
    runDailyPriceSync();
}

console.log('🕐 Cron jobs scheduled:');
console.log('  - Daily price sync at 2:00 AM');
console.log('  - Server time:', new Date().toString());