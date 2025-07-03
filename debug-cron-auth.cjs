// debug-cron-auth-fixed.js - Fixed debug script with proper fetch
require('dotenv').config();

async function debugCronAuth() {
    console.log('🔍 Debugging Cron Authentication...\n');

    // Import node-fetch properly
    let fetch;
    try {
        fetch = (await import('node-fetch')).default;
    } catch (error) {
        console.error('❌ node-fetch not installed. Install with: npm install node-fetch --legacy-peer-deps');
        return;
    }

    // Check environment variables
    console.log('Environment Variables:');
    console.log(`CRON_SECRET: ${process.env.CRON_SECRET ? 'Set (' + process.env.CRON_SECRET.substring(0, 10) + '...)' : 'Missing'}`);
    console.log(`POKEMON_PRICE_TRACKER_API_KEY: ${process.env.POKEMON_PRICE_TRACKER_API_KEY ? 'Set (' + process.env.POKEMON_PRICE_TRACKER_API_KEY.substring(0, 15) + '...)' : 'Missing'}`);
    console.log(`NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'Not set'}`);

    // Check if Next.js server is running
    console.log('\n🔍 Checking if Next.js server is running...');
    try {
        const response = await fetch('http://localhost:3000/api/health', {
            timeout: 5000
        });
        console.log(`✅ Next.js server is running (${response.status})`);
    } catch (error) {
        console.error('❌ Next.js server is not running or not accessible');
        console.log('Please start your Next.js server with: npm run dev');
        return;
    }

    // Test cron endpoint without auth
    console.log('\n🔍 Testing cron endpoint (GET - no auth needed):');
    try {
        const response = await fetch('http://localhost:3000/api/cron/daily-price-sync');
        const result = await response.json();
        console.log('✅ GET endpoint response:', result);
    } catch (error) {
        console.error('❌ GET endpoint failed:', error.message);
    }

    // Test cron endpoint with auth
    console.log('\n🔍 Testing cron endpoint (POST - with auth):');
    try {
        const response = await fetch('http://localhost:3000/api/cron/daily-price-sync', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Response status: ${response.status} ${response.statusText}`);

        const result = await response.json();
        console.log('Response body:', JSON.stringify(result, null, 2));

        if (response.status === 401) {
            console.log('\n❌ UNAUTHORIZED - Check these:');
            console.log('1. CRON_SECRET in .env file');
            console.log('2. Authorization header format');
            console.log('3. Cron endpoint authentication logic');
        } else if (result.success) {
            console.log('✅ Cron endpoint working!');
        }
    } catch (error) {
        console.error('❌ POST endpoint failed:', error.message);
    }

    // Test Pokemon Price Tracker API
    console.log('\n🔍 Testing Pokemon Price Tracker API:');
    try {
        const response = await fetch('https://api.pokemonpricetracker.com/v1/sets?per_page=1', {
            headers: {
                'X-API-Key': process.env.POKEMON_PRICE_TRACKER_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log(`API Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Pokemon Price Tracker API is accessible');
            console.log('Sample response:', data.data ? `${data.data.length} sets found` : 'No data');
        } else {
            const errorText = await response.text();
            console.log('❌ API Error:', errorText);

            if (response.status === 401) {
                console.log('🔑 API Key might be invalid or expired');
            } else if (response.status === 429) {
                console.log('⏰ Rate limited - too many requests');
            }
        }
    } catch (error) {
        console.error('❌ API connection failed:', error.message);
    }

    // Test a specific card price lookup
    console.log('\n🔍 Testing specific card price lookup:');
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const sampleCard = await prisma.card.findFirst({
            where: {
                api_id: { not: null },
                set_id: { not: null },
                set_number: { not: null }
            },
            select: { id: true, name: true, api_id: true, set_id: true, set_number: true }
        });

        if (sampleCard) {
            console.log(`Sample card: ${sampleCard.name} (${sampleCard.api_id})`);

            // Convert to price tracker format
            const priceTrackerId = `${sampleCard.set_id}-${sampleCard.set_number}`;
            console.log(`Price tracker ID: ${priceTrackerId}`);

            const response = await fetch(`https://api.pokemonpricetracker.com/v1/prices?id=${priceTrackerId}`, {
                headers: {
                    'X-API-Key': process.env.POKEMON_PRICE_TRACKER_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Card lookup status: ${response.status} ${response.statusText}`);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Card price lookup successful');
                if (data.data && data.data.length > 0) {
                    const cardData = data.data[0];
                    console.log(`Price data found: $${cardData.prices?.tcgplayer?.market || 'No price'}`);
                } else {
                    console.log('⚠️ No price data returned for this card');
                }
            } else {
                const errorText = await response.text();
                console.log('❌ Card price lookup failed:', errorText);
            }
        } else {
            console.log('❌ No suitable sample card found');
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Card lookup test failed:', error.message);
    }

    console.log('\n📋 DIAGNOSIS COMPLETE');
    console.log('===================');
    console.log('If all tests pass, your price sync should work!');
    console.log('If tests fail, check the errors above for specific issues to fix.');
}

debugCronAuth().catch(console.error);