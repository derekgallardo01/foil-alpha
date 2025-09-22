// src/app/api/pokemon-price-tracker/route.ts - FIXED FOR V2 API
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        console.log('Pokemon Price Tracker V2 proxy route called');

        const body = await request.json();
        console.log('Request body:', JSON.stringify(body, null, 2));

        const { action, params } = body;

        if (!action) {
            return NextResponse.json({
                success: false,
                error: 'Action parameter is required'
            }, { status: 400 });
        }

        const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
        console.log('API Key present:', !!apiKey);

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                error: 'Pokemon Price Tracker API key not configured'
            }, { status: 500 });
        }

        // V2 API BASE URL
        const baseUrl = 'https://www.pokemonpricetracker.com/api/v2';

        let endpoint = '';
        let queryParams = new URLSearchParams();
        let method = 'GET';

        switch (action) {
            case 'searchCardPricing':
                endpoint = '/cards';

                // FIXED: Ensure at least one filter parameter is provided
                let hasFilter = false;

                if (params.name) {
                    queryParams.append('search', params.name);
                    hasFilter = true;
                }
                if (params.setId) {
                    queryParams.append('set', params.setId);
                    hasFilter = true;
                }
                if (params.rarity) {
                    queryParams.append('rarity', params.rarity);
                    hasFilter = true;
                }
                if (params.cardType) {
                    queryParams.append('cardType', params.cardType);
                    hasFilter = true;
                }
                if (params.artist) {
                    queryParams.append('artist', params.artist);
                    hasFilter = true;
                }
                if (params.minPrice) {
                    queryParams.append('minPrice', params.minPrice.toString());
                    hasFilter = true;
                }
                if (params.maxPrice) {
                    queryParams.append('maxPrice', params.maxPrice.toString());
                    hasFilter = true;
                }

                // FIXED: If no filters provided, add a default search to prevent 400 error
                if (!hasFilter) {
                    console.log('No filters provided, adding default search for popular cards');
                    queryParams.append('search', 'Pikachu'); // Default to popular cards
                    hasFilter = true;
                }

                // Limit cards to avoid expensive calls
                const limit = Math.min(params.limit || 50, 100);
                queryParams.append('limit', limit.toString());

                if (params.page) {
                    queryParams.append('page', params.page.toString());
                } else if (params.offset) {
                    const page = Math.floor(params.offset / limit) + 1;
                    queryParams.append('page', page.toString());
                }
                break;

            case 'getCardPricing':
                endpoint = '/cards';
                if (params.id) {
                    queryParams.append('tcgPlayerId', params.id);
                } else if (params.tcgPlayerId) {
                    queryParams.append('tcgPlayerId', params.tcgPlayerId);
                } else {
                    return NextResponse.json({
                        success: false,
                        error: 'Either id or tcgPlayerId is required for getCardPricing'
                    }, { status: 400 });
                }
                break;

            case 'getSetPricing':
                endpoint = '/cards';
                if (!params.setId) {
                    return NextResponse.json({
                        success: false,
                        error: 'setId is required for getSetPricing'
                    }, { status: 400 });
                }

                queryParams.append('set', params.setId);
                queryParams.append('limit', '50'); // Smaller batches
                queryParams.append('page', params.page?.toString() || '1');
                break;

            case 'getSets':
                endpoint = '/sets';
                // Sets endpoint doesn't require filters
                if (params.name) queryParams.append('name', params.name);
                break;

            case 'getBulkPricing':
                // For bulk requests, make multiple individual calls
                if (!params.cardIds || !Array.isArray(params.cardIds)) {
                    return NextResponse.json({
                        success: false,
                        error: 'cardIds array is required for getBulkPricing'
                    }, { status: 400 });
                }

                if (params.cardIds.length > 20) {
                    return NextResponse.json({
                        success: false,
                        error: 'Maximum 20 cards can be requested at once to avoid rate limits'
                    }, { status: 400 });
                }

                // Make individual requests for each card
                const bulkResults = [];
                for (const cardId of params.cardIds) {
                    try {
                        const cardResponse = await fetch(`${baseUrl}/cards?tcgPlayerId=${cardId}`, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json',
                            }
                        });

                        if (cardResponse.ok) {
                            const cardData = await cardResponse.json();
                            if (cardData.data && Array.isArray(cardData.data)) {
                                bulkResults.push(...cardData.data);
                            }
                        }

                        // Small delay to avoid rate limits
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        console.error(`Failed to fetch card ${cardId}:`, error);
                    }
                }

                return NextResponse.json({
                    success: true,
                    data: {
                        data: bulkResults,
                        metadata: {
                            total: bulkResults.length,
                            count: bulkResults.length
                        }
                    },
                    rate_limit: {
                        remaining: 0,
                        reset_at: new Date().toISOString()
                    }
                });

            default:
                return NextResponse.json({
                    success: false,
                    error: 'Invalid action specified'
                }, { status: 400 });
        }

        const fullUrl = `${baseUrl}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        console.log('Making Pokemon Price Tracker V2 API request to:', fullUrl);

        const response = await fetch(fullUrl, {
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            }
        });

        console.log('API Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Pokemon Price Tracker V2 API Error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
                url: fullUrl
            });

            return NextResponse.json({
                success: false,
                error: `API Error ${response.status}: ${response.statusText}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        console.log('V2 API Response structure:', {
            hasData: !!data.data,
            dataLength: Array.isArray(data.data) ? data.data.length : 'not array',
            hasMetadata: !!data.metadata,
            topLevelKeys: Object.keys(data)
        });

        // Log sample card for debugging images
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const sampleCard = data.data[0];
            console.log('Sample V2 card structure:', {
                id: sampleCard.id,
                name: sampleCard.name,
                hasImageUrl: 'imageUrl' in sampleCard,
                hasImages: 'images' in sampleCard,
                imageUrl: sampleCard.imageUrl,
                images: sampleCard.images,
                allImageFields: Object.keys(sampleCard).filter(key =>
                    key.toLowerCase().includes('image')
                ),
                topKeys: Object.keys(sampleCard).slice(0, 15)
            });
        }

        return NextResponse.json({
            success: true,
            data: data,
            rate_limit: {
                remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
                reset_at: response.headers.get('X-RateLimit-Reset') || new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Pokemon Price Tracker V2 API proxy error:', error);

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test');

    if (test === 'v2-structure') {
        try {
            const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;

            // Test with a single card to see V2 structure
            const response = await fetch('https://www.pokemonpricetracker.com/api/v2/cards?search=pikachu&limit=1', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                }
            });

            const rawData = await response.json();

            return NextResponse.json({
                success: response.ok,
                status: response.status,
                hasData: !!rawData.data,
                dataLength: Array.isArray(rawData.data) ? rawData.data.length : 0,
                sampleCard: rawData.data?.[0] || null,
                fullStructure: rawData,
                rateLimit: {
                    remaining: response.headers.get('X-RateLimit-Remaining'),
                    reset: response.headers.get('X-RateLimit-Reset')
                }
            });

        } catch (error) {
            return NextResponse.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    if (test === 'v2-set-example') {
        try {
            const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;

            // Test the exact example from docs
            const response = await fetch('https://www.pokemonpricetracker.com/api/v2/cards?set=celebrations&fetchAllInSet=true', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            const data = await response.json();

            return NextResponse.json({
                success: response.ok,
                status: response.status,
                cardCount: data.data?.length || 0,
                hasImages: data.data?.[0] ? ('imageUrl' in data.data[0] || 'images' in data.data[0]) : false,
                sampleCard: data.data?.[0] || null,
                cost: `${data.data?.length || 0} credits`,
                rateLimit: {
                    remaining: response.headers.get('X-RateLimit-Remaining'),
                    reset: response.headers.get('X-RateLimit-Reset')
                }
            });

        } catch (error) {
            return NextResponse.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    if (test === 'debug-charizard') {
        try {
            const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;

            // Test the exact search that's failing
            const response = await fetch('https://www.pokemonpricetracker.com/api/v2/cards?search=charizard&limit=3', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                }
            });

            const rawData = await response.json();

            return NextResponse.json({
                success: response.ok,
                status: response.status,
                fullResponse: rawData,
                firstCard: rawData.data?.[0] || null,
                firstCardKeys: rawData.data?.[0] ? Object.keys(rawData.data[0]) : [],
                hasPrices: rawData.data?.[0]?.prices || null,
                hasImageUrl: rawData.data?.[0]?.imageUrl || null,
                hasSetName: rawData.data?.[0]?.setName || null
            });

        } catch (error) {
            return NextResponse.json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Default health check
    console.log('Pokemon Price Tracker V2 proxy health check called');
    return NextResponse.json({
        message: 'Pokemon Price Tracker V2 API proxy is running',
        timestamp: new Date().toISOString(),
        apiKeyConfigured: !!process.env.POKEMON_PRICE_TRACKER_API_KEY,
        correctBaseUrl: 'https://www.pokemonpricetracker.com/api/v2',
        testEndpoints: [
            '/api/pokemon-price-tracker?test=v2-structure',
            '/api/pokemon-price-tracker?test=v2-set-example'
        ]
    });
}