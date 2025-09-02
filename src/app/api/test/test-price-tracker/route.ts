// src/app/api/test-price-tracker/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PokemonPriceTrackerAPI, pokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Testing Pokemon Price Tracker API key...');

        // Test 1: Health check
        console.log('Step 1: Health check...');
        const isHealthy = await pokemonPriceTrackerAPI.healthCheck();

        if (!isHealthy) {
            return NextResponse.json({
                success: false,
                error: 'API health check failed - check your API key',
                tests: {
                    health_check: false
                }
            }, { status: 401 });
        }

        // Test 2: Get sets
        console.log('Step 2: Fetching sets...');
        const setsResponse = await pokemonPriceTrackerAPI.getSets();

        if (!setsResponse.success) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch sets',
                details: setsResponse.error,
                tests: {
                    health_check: true,
                    sets_fetch: false
                }
            }, { status: 500 });
        }

        // Test 3: Search for a popular card
        console.log('Step 3: Searching for sample card...');
        const searchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
            name: 'Charizard',
            limit: 5
        });

        const testResults = {
            health_check: true,
            sets_fetch: true,
            sets_count: setsResponse.data?.length || 0,
            card_search: searchResponse.success,
            sample_cards: searchResponse.success ? searchResponse.data?.length || 0 : 0,
            rate_limit_remaining: searchResponse.rate_limit?.remaining || 'Unknown'
        };

        // Test 4: Get specific card pricing if search worked
        let samplePricing = null;
        if (searchResponse.success && searchResponse.data && searchResponse.data.length > 0) {
            console.log('Step 4: Getting sample card pricing...');
            const firstCard = searchResponse.data[0];
            const pricingResponse = await pokemonPriceTrackerAPI.getCardPricing(firstCard.id);

            if (pricingResponse.success) {
                samplePricing = {
                    card_name: pricingResponse.data?.name,
                    card_id: pricingResponse.data?.id,
                    market_price: PokemonPriceTrackerAPI.getBestMarketPrice(pricingResponse.data!) || 'No price available',
                    pricing_sources: PokemonPriceTrackerAPI.getPricingSummary(pricingResponse.data!).sources
                };
            }
        }

        console.log('✅ Pokemon Price Tracker API test completed successfully!');

        return NextResponse.json({
            success: true,
            message: 'Pokemon Price Tracker API is working correctly!',
            api_key_status: 'Valid',
            tests: testResults,
            sample_pricing: samplePricing,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error testing Pokemon Price Tracker API:', error);

        return NextResponse.json({
            success: false,
            error: 'API test failed',
            details: error instanceof Error ? error.message : 'Unknown error',
            possible_causes: [
                'Invalid API key',
                'Network connectivity issue',
                'API endpoint changed',
                'Rate limit exceeded'
            ]
        }, { status: 500 });
    }
}