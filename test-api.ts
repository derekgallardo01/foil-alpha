// test-api-response.ts - Create this file in your project root
import {pokemonPriceTrackerAPI} from './src/app/lib/pokemon-price-tracker-api';

async function testAPIResponses() {
    console.log('🔍 Testing Pokemon Price Tracker API responses...\n');

    try {
        // Test 1: Get available sets
        console.log('=== TESTING SETS API ===');
        const setsResponse = await pokemonPriceTrackerAPI.getSets();
        console.log('Sets Response Success:', setsResponse.success);
        if (setsResponse.success && setsResponse.data) {
            console.log('Sets Data Type:', typeof setsResponse.data);
            console.log('Sets Array Length:', Array.isArray(setsResponse.data) ? setsResponse.data.length : 'Not an array');
            if (Array.isArray(setsResponse.data) && setsResponse.data.length > 0) {
                console.log('First Set Structure:');
                console.log(JSON.stringify(setsResponse.data[0], null, 2));
                console.log('\nAll Set Keys:', Object.keys(setsResponse.data[0]));
            }
        } else {
            console.log('Sets Error:', setsResponse.error);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Test 2: Search for specific cards
        console.log('=== TESTING CARD SEARCH API ===');
        const searchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
            name: 'Charizard',
            limit: 3
        });
        console.log('Search Response Success:', searchResponse.success);
        if (searchResponse.success && searchResponse.data) {
            console.log('Search Data Type:', typeof searchResponse.data);
            console.log('Search Array Length:', Array.isArray(searchResponse.data) ? searchResponse.data.length : 'Not an array');
            if (Array.isArray(searchResponse.data) && searchResponse.data.length > 0) {
                console.log('First Card Structure:');
                console.log(JSON.stringify(searchResponse.data[0], null, 2));
                console.log('\nAll Card Keys:', Object.keys(searchResponse.data[0]));

                // Check nested objects
                const firstCard = searchResponse.data[0];
                if (firstCard.prices) {
                    console.log('\nPrices Structure:');
                    console.log(JSON.stringify(firstCard.prices, null, 2));
                }
            }
        } else {
            console.log('Search Error:', searchResponse.error);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Test 3: Get specific card pricing
        console.log('=== TESTING SPECIFIC CARD PRICING ===');
        // Try a common card ID format - you might need to adjust this
        const cardPricingResponse = await pokemonPriceTrackerAPI.getCardPricing('base1-4'); // Charizard from Base Set
        console.log('Card Pricing Response Success:', cardPricingResponse.success);
        if (cardPricingResponse.success && cardPricingResponse.data) {
            console.log('Card Pricing Data Structure:');
            console.log(JSON.stringify(cardPricingResponse.data, null, 2));
            console.log('\nCard Pricing Keys:', Object.keys(cardPricingResponse.data));
        } else {
            console.log('Card Pricing Error:', cardPricingResponse.error);
            // Try alternative formats
            console.log('\nTrying alternative card ID formats...');
            const altFormats = ['sv1-1', 'swsh1-1', 'xy1-1'];
            for (const cardId of altFormats) {
                const altResponse = await pokemonPriceTrackerAPI.getCardPricing(cardId);
                if (altResponse.success) {
                    console.log(`✅ Card ID format "${cardId}" works!`);
                    console.log('Data:', JSON.stringify(altResponse.data, null, 2));
                    break;
                } else {
                    console.log(`❌ Card ID format "${cardId}" failed:`, altResponse.error);
                }
            }
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // Test 4: Test API health and rate limits
        console.log('=== TESTING API HEALTH ===');
        const healthCheck = await pokemonPriceTrackerAPI.healthCheck();
        console.log('API Health Check:', healthCheck);

    } catch (error) {
        console.error('❌ Test script error:', error);
    }
}

// Run the test
testAPIResponses();