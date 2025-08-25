
const cron = require('node-cron');
const fetch = require('node-fetch');

// Schedule daily price sync at 2 AM
cron.schedule('0 2 * * *', async () => {
    console.log('Running daily price sync...');

    try {
        const response = await fetch('http://localhost:3000/api/cron/daily-price-sync', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('Daily sync result:', result);
    } catch (error) {
        console.error('Daily sync failed:', error);
    }
});

console.log('Daily price sync cron job scheduled for 2 AM every day');