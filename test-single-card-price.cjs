// test-single-card-price.js - Test individual card price lookup
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testSingleCardPrice() {
    console.log('🔍 Testing single card price lookup...\n');

    try {
        // Get a sample card
        const sampleCard = await prisma.card.findFirst({
            where: {
                api_id: { not: null },
                set_id: { not: null },
                set_number: { not: null }
            },
            select: {
                id: true,
                name: true,
                api_id: true,
                set_id: true,
                set_number: true,
                market_price: true
            }
        });

        if (!sampleCard) {
            console.log('❌ No suitable sample card found');
            return;
        }

        console.log(`Testing card: ${sampleCard.name}`);
        console.log(`API ID: ${sampleCard.api_id}`);
        console.log(`Set ID: ${sampleCard.set_id}`);
        console.log(`Set Number: ${sampleCard.set_number}`);
        console.log(`Current Price: $${sampleCard.market_price || 'Not set'}`);

        // Convert to price tracker format (same as your import logic)
        const priceTrackerId = `${sampleCard.set_id}-${sampleCard.set_number}`;
        console.log(`Price Tracker ID: ${priceTrackerId}`);

        // Test the exact API call your code would make
        console.log('\n🔍 Testing Pokemon Price Tracker API call...');

        const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
        console.log(`API Key: ${apiKey ? apiKey.substring(0, 15) + '...' : 'Missing'}`);

        if (!apiKey) {
            console.log('❌ Missing POKEMON_PRICE_TRACKER_API_KEY in .env');
            return;
        }

        // Try the exact same API call as your pokemon-price-tracker-api.ts
        const response = await fetch(`https://api.pokemonpricetracker.com/v1/prices?id=${priceTrackerId}`, {
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
                'User-Agent': 'TCG-Market-App/1.0'
            }
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ API Error Response:', errorText);

            if (response.status === 401) {
                console.log('🔑 API Key might be invalid or expired');
            } else if (response.status === 404) {
                console.log('📭 Card not found in price tracker');
            } else if (response.status === 429) {
                console.log('⏰ Rate limited');
            }
            return;
        }

        const data = await response.json();
        console.log('\n✅ API Response received');
        console.log('Response structure:', JSON.stringify(data, null, 2));

        // Check if we got price data
        if (data.data && data.data.length > 0) {
            const cardData = data.data[0];
            console.log('\n💰 Price Information:');

            if (cardData.prices) {
                if (cardData.prices.tcgplayer) {
                    console.log(`TCGPlayer Market: $${cardData.prices.tcgplayer.market || 'N/A'}`);
                    console.log(`TCGPlayer Low: $${cardData.prices.tcgplayer.low || 'N/A'}`);
                    console.log(`TCGPlayer High: $${cardData.prices.tcgplayer.high || 'N/A'}`);
                }

                if (cardData.prices.ebay) {
                    console.log(`eBay Average: $${cardData.prices.ebay.average || 'N/A'}`);
                }

                if (cardData.prices.cardmarket) {
                    console.log(`CardMarket Average: $${cardData.prices.cardmarket.average || 'N/A'}`);
                }
            }

            // Test your getBestMarketPrice logic
            const bestPrice = cardData.prices?.tcgplayer?.market ||
                cardData.prices?.tcgplayer?.mid ||
                cardData.prices?.ebay?.average ||
                cardData.prices?.cardmarket?.average;

            console.log(`\n🎯 Best Market Price: $${bestPrice || 'No price found'}`);

            if (bestPrice && bestPrice > 0) {
                console.log('\n✅ SUCCESS: Price lookup would work for sync!');

                // Test updating this card
                console.log('\n🔄 Testing database update...');
                await prisma.card.update({
                    where: { id: sampleCard.id },
                    data: {
                        market_price: bestPrice,
                        last_price_update: new Date(),
                        price_trend: 'stable'
                    }
                });
                console.log('✅ Database update successful');

                // Test creating price history
                await prisma.price_history.create({
                    data: {
                        card_id: sampleCard.id,
                        price: bestPrice,
                        source: 'pokemon_price_tracker',
                        recorded_at: new Date(),
                        metadata: {
                            test_run: true,
                            api_response: true
                        }
                    }
                });
                console.log('✅ Price history entry created');

            } else {
                console.log('❌ No valid price found - this is why sync fails');
            }

        } else {
            console.log('❌ No price data in API response');
            console.log('This explains why your sync is failing - the API returns no data for your cards');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);

        if (error.message.includes('fetch failed')) {
            console.log('\n🌐 Network connectivity issue detected');
            console.log('This is the same error your sync is experiencing');
        }
    } finally {
        await prisma.$disconnect();
    }
}

// For Node.js environments without built-in fetch
if (typeof fetch === 'undefined') {
    global.fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
}

testSingleCardPrice().catch(console.error);