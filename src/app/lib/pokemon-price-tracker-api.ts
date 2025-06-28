// src/app/lib/pokemon-price-tracker-api.ts
interface PriceData {
    tcgplayer?: {
        market?: number;
        low?: number;
        mid?: number;
        high?: number;
        updated_at?: string;
    };
    ebay?: {
        average?: number;
        recent?: number;
        updated_at?: string;
    };
    cardmarket?: {
        average?: number;
        trend?: number;
        updated_at?: string;
    };
}

interface GradedPriceData {
    psa_7?: number;
    psa_8?: number;
    psa_9?: number;
    psa_10?: number;
    population?: {
        psa_7?: number;
        psa_8?: number;
        psa_9?: number;
        psa_10?: number;
    };
}

interface PokemonPriceTrackerCard {
    id: string; // "setId-cardNumber" format
    name: string;
    set_name: string;
    set_id: string;
    card_number: string;
    rarity?: string;
    prices: PriceData;
    graded_prices?: GradedPriceData;
    last_updated: string;
    market_cap?: number;
    volume_24h?: number;
    price_change_24h?: number;
    price_change_7d?: number;
}

interface PokemonPriceTrackerSet {
    id: string;
    name: string;
    release_date: string;
    card_count: number;
    avg_price: number;
    total_market_cap: number;
}

interface PriceHistoryEntry {
    date: string;
    price: number;
    source: 'tcgplayer' | 'ebay' | 'cardmarket';
}

interface SearchResponse<T> {
    data: T[];
    total: number;
    page: number;
    per_page: number;
    last_page: number;
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
    private baseUrl = 'https://api.pokemonpricetracker.com/v1';
    private apiKey: string;
    private defaultHeaders: Record<string, string>;
    private rateLimitCache = new Map<string, number>();

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.defaultHeaders = {
            'X-API-Key': this.apiKey,
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

        // Check rate limiting cache (avoid hitting API too frequently)
        if (useCache && this.rateLimitCache.has(cacheKey)) {
            const cacheTime = this.rateLimitCache.get(cacheKey)!;
            const timeDiff = Date.now() - cacheTime;
            if (timeDiff < 60000) { // 1 minute cache for rate limiting
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

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
                console.warn(`Pokemon Price Tracker API rate limited. Waiting ${waitTime}ms...`);

                // Cache this endpoint to prevent immediate retry
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

            // Update rate limit cache with successful request
            this.rateLimitCache.set(cacheKey, Date.now());

            console.log('Pokemon Price Tracker API Response:', {
                endpoint,
                dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
                count: Array.isArray(data.data) ? data.data.length : 'N/A'
            });

            return {
                success: true,
                data: data.data || data,
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

    // Get pricing for a specific card by ID (setId-cardNumber format)
    async getCardPricing(cardId: string, includeGraded = false): Promise<APIResponse<PokemonPriceTrackerCard>> {
        const params: Record<string, any> = { id: cardId };
        if (includeGraded) {
            params.includeGraded = 'true';
        }

        return this.makeRequest<PokemonPriceTrackerCard>('/prices', params);
    }

    // Search for cards by name and set
    async searchCardPricing(options: {
        name?: string;
        setId?: string;
        page?: number;
        per_page?: number;
        includeGraded?: boolean;
    } = {}): Promise<APIResponse<SearchResponse<PokemonPriceTrackerCard>>> {
        const params: Record<string, any> = {
            page: options.page || 1,
            per_page: Math.min(options.per_page || 20, 100), // API limit
        };

        if (options.name) params.name = options.name;
        if (options.setId) params.setId = options.setId;
        if (options.includeGraded) params.includeGraded = 'true';

        return this.makeRequest<SearchResponse<PokemonPriceTrackerCard>>('/prices', params);
    }

    // Get all cards from a specific set with pricing
    async getSetPricing(setId: string, includeGraded = false): Promise<APIResponse<PokemonPriceTrackerCard[]>> {
        let allCards: PokemonPriceTrackerCard[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) { // Safety limit
            const response = await this.searchCardPricing({
                setId,
                page,
                per_page: 100,
                includeGraded
            });

            if (!response.success || !response.data) {
                return { success: false, error: response.error || 'Failed to fetch set pricing' };
            }

            allCards.push(...response.data.data);
            hasMore = page < response.data.last_page;
            page++;
        }

        return { success: true, data: allCards };
    }

    // Get available sets
    async getSets(): Promise<APIResponse<PokemonPriceTrackerSet[]>> {
        return this.makeRequest<PokemonPriceTrackerSet[]>('/sets');
    }

    // Get price history for a card
    async getCardPriceHistory(
        cardId: string,
        days = 30
    ): Promise<APIResponse<PriceHistoryEntry[]>> {
        return this.makeRequest<PriceHistoryEntry[]>(`/prices/${cardId}/history`, {
            days: Math.min(days, 365) // API limit
        });
    }

    // Batch pricing lookup for multiple cards
    async getBatchPricing(
        cardIds: string[],
        includeGraded = false
    ): Promise<APIResponse<PokemonPriceTrackerCard[]>> {
        // Split into chunks to respect API limits
        const chunkSize = 50; // Conservative chunk size
        const chunks = [];

        for (let i = 0; i < cardIds.length; i += chunkSize) {
            chunks.push(cardIds.slice(i, i + chunkSize));
        }

        const allResults: PokemonPriceTrackerCard[] = [];
        const errors: string[] = [];

        for (const chunk of chunks) {
            const params: Record<string, any> = {
                ids: chunk.join(','),
                per_page: chunkSize
            };

            if (includeGraded) params.includeGraded = 'true';

            const response = await this.makeRequest<SearchResponse<PokemonPriceTrackerCard>>('/prices', params);

            if (response.success && response.data) {
                allResults.push(...response.data.data);
            } else {
                errors.push(response.error || 'Unknown error');
            }

            // Add delay between requests to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (allResults.length === 0 && errors.length > 0) {
            return { success: false, error: errors.join(', ') };
        }

        return { success: true, data: allResults };
    }

    // Utility method to convert Pokemon TCG API card ID to Price Tracker format
    static convertTCGCardIdToPriceTrackerId(setId: string, cardNumber: string): string {
        // Clean and format the card number
        const cleanNumber = cardNumber.replace(/[^\d\/]/g, '');
        return `${setId}-${cleanNumber}`;
    }

    // Extract best market price from pricing data
    static getBestMarketPrice(card: PokemonPriceTrackerCard): number | null {
        const prices = card.prices;

        // Priority: TCGPlayer market > TCGPlayer mid > eBay average > CardMarket average
        if (prices.tcgplayer?.market && prices.tcgplayer.market > 0) {
            return prices.tcgplayer.market;
        }

        if (prices.tcgplayer?.mid && prices.tcgplayer.mid > 0) {
            return prices.tcgplayer.mid;
        }

        if (prices.ebay?.average && prices.ebay.average > 0) {
            return prices.ebay.average;
        }

        if (prices.cardmarket?.average && prices.cardmarket.average > 0) {
            return prices.cardmarket.average;
        }

        return null;
    }

    // Calculate price trend from change data
    static getPriceTrend(card: PokemonPriceTrackerCard): 'up' | 'down' | 'stable' {
        if (card.price_change_24h === undefined) return 'stable';

        if (card.price_change_24h > 2) return 'up';
        if (card.price_change_24h < -2) return 'down';
        return 'stable';
    }

    // Get comprehensive pricing summary
    static getPricingSummary(card: PokemonPriceTrackerCard) {
        const marketPrice = this.getBestMarketPrice(card);
        const trend = this.getPriceTrend(card);

        return {
            market_price: marketPrice,
            price_range: {
                low: card.prices.tcgplayer?.low || null,
                high: card.prices.tcgplayer?.high || null,
            },
            trend,
            change_24h: card.price_change_24h || null,
            change_7d: card.price_change_7d || null,
            volume_24h: card.volume_24h || null,
            last_updated: card.last_updated,
            sources: {
                tcgplayer: !!card.prices.tcgplayer,
                ebay: !!card.prices.ebay,
                cardmarket: !!card.prices.cardmarket,
            }
        };
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.makeRequest('/sets', { per_page: 1 });
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
    PriceData,
    GradedPriceData,
    PriceHistoryEntry,
    APIResponse
  };