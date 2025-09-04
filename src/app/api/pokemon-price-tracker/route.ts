// src/app/api/pokemon-price-tracker/route.ts - V2 API VERSION
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

        // V2 BASE URL
        const baseUrl = 'https://www.pokemonpricetracker.com/api/v2';

        let endpoint = '';
        let queryParams = new URLSearchParams();
        let method = 'GET';
        let postBody: any = null;

        switch (action) {
            case 'searchCardPricing':
                endpoint = '/cards';
                if (params.name) queryParams.append('search', params.name); // Changed from 'name' to 'search'
                if (params.setId) queryParams.append('setId', params.setId);
                if (params.limit) queryParams.append('limit', params.limit.toString());
                if (params.offset) queryParams.append('offset', params.offset.toString());
                // Always include pricing data
                queryParams.append('includeBoth', 'true');
                break;

            case 'getCardPricing':
                endpoint = '/cards';
                if (params.tcgPlayerId) {
                    queryParams.append('tcgPlayerId', params.tcgPlayerId);
                } else if (params.id) {
                    // Try to extract tcgPlayerId from old format
                    queryParams.append('id', params.id);
                }
                queryParams.append('includeBoth', 'true');
                break;

            case 'getSetPricing':
                endpoint = '/cards';
                if (params.setId) queryParams.append('setId', params.setId);
                if (params.limit) queryParams.append('limit', params.limit.toString());
                if (params.offset) queryParams.append('offset', params.offset.toString());
                queryParams.append('includeBoth', 'true');
                break;

            case 'getSets':
                endpoint = '/sets';
                if (params.limit) queryParams.append('limit', params.limit.toString());
                if (params.name) queryParams.append('name', params.name);
                break;

            case 'getCardHistory':
                // For V2, history is included in the main card response
                endpoint = '/cards';
                if (params.cardId) queryParams.append('id', params.cardId);
                queryParams.append('includeHistory', 'true');
                break;

            case 'getBulkHistory':
                // V2 doesn't have bulk history, so we'll return error
                return NextResponse.json({
                    success: false,
                    error: 'Bulk history not supported in V2 API - use individual card requests'
                });

            case 'getBulkPricing':
                // Fetch multiple cards individually
                if (params.cardIds && Array.isArray(params.cardIds)) {
                    const results = [];
                    for (const cardId of params.cardIds) {
                        try {
                            const cardResponse = await fetch(`${baseUrl}/cards?id=${cardId}&includeBoth=true`, {
                                headers: {
                                    'Authorization': `Bearer ${apiKey}`,
                                    'Content-Type': 'application/json',
                                }
                            });

                            if (cardResponse.ok) {
                                const cardData = await cardResponse.json();
                                results.push(...(cardData.data || []));
                            }
                        } catch (error) {
                            console.error(`Failed to fetch pricing for card ${cardId}:`, error);
                        }
                    }

                    return NextResponse.json({
                        success: true,
                        data: results,
                        rate_limit: {
                            remaining: 0,
                            reset_at: new Date().toISOString()
                        }
                    });
                }
                break;

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
            },
            body: postBody ? JSON.stringify(postBody) : undefined,
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
        console.log('V2 API Response data keys:', Object.keys(data));
        console.log('V2 API Response sample:', JSON.stringify(data, null, 2).substring(0, 1000) + '...');

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

    if (test === 'v2-pricing') {
        try {
            const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
            const response = await fetch('https://www.pokemonpricetracker.com/api/v2/cards?search=pikachu&limit=1&includeBoth=true', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            return NextResponse.json({
                success: response.ok,
                status: response.status,
                data: data,
                hasPricing: data.data && data.data.length > 0 ? !!data.data[0].prices : false,
                hasEbayData: data.data && data.data.length > 0 ? !!data.data[0].ebay : false,
                hasPriceHistory: data.data && data.data.length > 0 ? !!data.data[0].priceHistory : false
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
        apiKeyConfigured: !!process.env.POKEMON_PRICE_TRACKER_API_KEY
    });
}