// src/app/lib/pokemon-price-tracker-api.ts - CORRECTED IMPLEMENTATION
interface PokemonPriceTrackerCard {
    id: string; // Format: "setId-cardNumber" 
    name: string;
    setName: string;
    setId: string;
    number: string;
    rarity?: string;
    imageUrl?: string;
    prices?: {
        tcgplayer?: {
            market?: number;
            low?: number;
            high?: number;
            lastUpdated?: string;
        };
        ebay?: {
            average?: number;
            prices?: {
                PSA10?: number;
                PSA9?: number;
                PSA8?: number;
                PSA7?: number;
            };
            lastUpdated?: string;
        };
        cardmarket?: {
            average?: number;
            trend?: number;
            lastUpdated?: string;
        };
    };
    lastUpdated?: string;
}

interface PokemonPriceTrackerSet {
    id: string;
    name: string;
    releaseDate?: string;
    cardCount?: number;
    avgPrice?: number;
    totalMarketCap?: number;
}

interface APIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    rate_limit?: {
        remaining: number;
        reset_at: string;
    };
}

class PokemonPriceTrackerAPI {
    private baseUrl = 'https://www.pokemonpricetracker.com/api'; // CORRECTED BASE URL
    private apiKey: string;
    private defaultHeaders: Record<string, string>;
    private rateLimitCache = new Map<string, number>();

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.defaultHeaders = {
            'Authorization': `Bearer ${this.apiKey}`, // CORRECTED: Use Bearer token
            'Content-Type': 'application/json',
            'User-Agent': 'TCG-Market-App/1.0'
        };
    }

    private async makeRequest<T>(
        endpoint: string,
        params?: Record<string, any>,
        useCache = true
    ): Promise<APIResponse<T>> {
        const url = new URL(`${this.baseUrl}${endpoint}`);

        // Add query parameters
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        const cacheKey = url.toString();

        // Check rate limiting cache
        if (useCache && this.rateLimitCache.has(cacheKey)) {
            const cacheTime = this.rateLimitCache.get(cacheKey)!;
            const timeDiff = Date.now() - cacheTime;
            if (timeDiff < 60000) { // 1 minute cache
                console.log('Rate limit cache hit, skipping request:', endpoint);
                return { success: false, error: 'Rate limited - using cache' };
            }
        }

        console.log('Making Pokemon Price Tracker API request:', url.toString());

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.defaultHeaders,
            });

            // Handle rate limiting (429)
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
                console.warn(`Pokemon Price Tracker API rate limited. Waiting ${waitTime}ms...`);

                this.rateLimitCache.set(cacheKey, Date.now());

                return {
                    success: false,
                    error: `Rate limited. Retry after ${Math.ceil(waitTime / 1000)} seconds.`
                };
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Pokemon Price Tracker API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                    url: url.toString()
                });

                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorJson.error || errorMessage;
                } catch (e) {
                    // Ignore JSON parse errors
                }

                return { success: false, error: errorMessage };
            }

            const data = await response.json();

            // Update rate limit cache
            this.rateLimitCache.set(cacheKey, Date.now());

            console.log('Pokemon Price Tracker API Response:', {
                endpoint,
                dataType: Array.isArray(data) ? 'array' : typeof data,
                count: Array.isArray(data) ? data.length : 'N/A'
            });

            return {
                success: true,
                data: data,
                rate_limit: {
                    remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
                    reset_at: response.headers.get('X-RateLimit-Reset') || new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Network error calling Pokemon Price Tracker API:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // Get pricing for specific card by ID
    async getCardPricing(cardId: string): Promise<APIResponse<PokemonPriceTrackerCard>> {
        return this.makeRequest<PokemonPriceTrackerCard>(`/prices`, { id: cardId });
    }

    // Search for cards by name
    async searchCardPricing(options: {
        name?: string;
        setId?: string;
        limit?: number;
        page?: number;
        includeHistory?: boolean;
    } = {}): Promise<APIResponse<PokemonPriceTrackerCard[]>> {
        const params: Record<string, any> = {
            limit: Math.min(options.limit || 50, 100), // API limit
            page: options.page || 1,
        };

        if (options.name) params.name = options.name;
        if (options.setId) params.setId = options.setId;
        if (options.includeHistory) params.includeHistory = 'true';

        return this.makeRequest<PokemonPriceTrackerCard[]>('/prices', params);
    }

    // Get all cards from a specific set
    async getSetPricing(setId: string): Promise<APIResponse<PokemonPriceTrackerCard[]>> {
        const allCards: PokemonPriceTrackerCard[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) { // Safety limit
            const response = await this.searchCardPricing({
                setId,
                page,
                limit: 100
            });

            if (!response.success || !response.data) {
                return { success: false, error: response.error || 'Failed to fetch set pricing' };
            }

            allCards.push(...response.data);
            hasMore = response.data.length === 100; // If we got a full page, there might be more
            page++;

            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return { success: true, data: allCards };
    }

    // Get available sets
    async getSets(): Promise<APIResponse<PokemonPriceTrackerSet[]>> {
        return this.makeRequest<PokemonPriceTrackerSet[]>('/sets');
    }

    // Get price history for a card
    async getCardPriceHistory(cardId: string, days = 30): Promise<APIResponse<any[]>> {
        return this.makeRequest<any[]>(`/cards/${cardId}/history`, {
            days: Math.min(days, 365) // API limit
        });
    }

    // Batch pricing lookup
    async getBatchPricing(cardIds: string[]): Promise<APIResponse<PokemonPriceTrackerCard[]>> {
        // Process in chunks of 50 (API limit)
        const chunkSize = 50;
        const chunks = [];

        for (let i = 0; i < cardIds.length; i += chunkSize) {
            chunks.push(cardIds.slice(i, i + chunkSize));
        }

        const allResults: PokemonPriceTrackerCard[] = [];
        const errors: string[] = [];

        for (const chunk of chunks) {
            try {
                // Note: Check if API supports bulk requests, otherwise do individual requests
                for (const cardId of chunk) {
                    const response = await this.getCardPricing(cardId);
                    if (response.success && response.data) {
                        allResults.push(response.data);
                    } else {
                        errors.push(response.error || 'Unknown error');
                    }

                    // Rate limiting delay
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                errors.push(error instanceof Error ? error.message : 'Unknown error');
            }
        }

        if (allResults.length === 0 && errors.length > 0) {
            return { success: false, error: errors.join(', ') };
        }

        return { success: true, data: allResults };
    }

    // Extract best market price from pricing data
    static getBestMarketPrice(card: PokemonPriceTrackerCard): number | null {
        if (!card.prices) return null;

        // Priority: TCGPlayer market > TCGPlayer low > eBay average
        if (card.prices.tcgplayer?.market && card.prices.tcgplayer.market > 0) {
            return card.prices.tcgplayer.market;
        }

        if (card.prices.tcgplayer?.low && card.prices.tcgplayer.low > 0) {
            return card.prices.tcgplayer.low;
        }

        if (card.prices.ebay?.average && card.prices.ebay.average > 0) {
            return card.prices.ebay.average;
        }

        if (card.prices.cardmarket?.average && card.prices.cardmarket.average > 0) {
            return card.prices.cardmarket.average;
        }

        return null;
    }

    // Calculate price trend
    static getPriceTrend(card: PokemonPriceTrackerCard): 'up' | 'down' | 'stable' {
        // Note: Price Tracker API doesn't provide trend data directly
        // You might need to implement this by comparing with historical data
        return 'stable';
    }

    // Get comprehensive pricing summary
    static getPricingSummary(card: PokemonPriceTrackerCard) {
        const marketPrice = this.getBestMarketPrice(card);
        const trend = this.getPriceTrend(card);

        return {
            market_price: marketPrice,
            price_range: {
                low: card.prices?.tcgplayer?.low || null,
                high: card.prices?.tcgplayer?.high || null,
            },
            trend,
            change_24h: null, // Not available in API
            change_7d: null,  // Not available in API
            volume_24h: null, // Not available in API
            last_updated: card.lastUpdated,
            sources: {
                tcgplayer: !!card.prices?.tcgplayer,
                ebay: !!card.prices?.ebay,
                cardmarket: !!card.prices?.cardmarket,
            }
        };
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.makeRequest('/sets', { limit: 1 });
            return response.success;
        } catch (error) {
            console.error('Pokemon Price Tracker API health check failed:', error);
            return false;
        }
    }
}

// Export singleton instance
const pokemonPriceTrackerAPI = new PokemonPriceTrackerAPI(
    process.env.POKEMON_PRICE_TRACKER_API_KEY || 'pokeprice_pro_a08dea5947407f6c0d1bcd52fd88a6cbcdeaa9aa6b75e979'
);

export { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI };
export type {
    PokemonPriceTrackerCard,
    PokemonPriceTrackerSet,
    APIResponse
};