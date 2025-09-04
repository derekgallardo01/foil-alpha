// src/lib/pokemon-price-tracker-api.ts - V2 API VERSION
interface PokemonPriceTrackerCardV2 {
    id: string;
    tcgPlayerId: string;
    setId: string;
    setName: string;
    name: string;
    cardNumber: string;
    rarity: string;
    cardType: string;
    hp?: number;
    prices?: {
        market: number;
        listings: number;
        lastUpdated: string;
    };
    imageUrl?: string;
    priceHistory?: {
        conditions?: {
            [condition: string]: {
                dataPoints: number;
                latestPrice: number;
                latestDate: string;
                priceRange: { min: number; max: number };
                history: Array<{
                    date: string;
                    market: number;
                    volume: number;
                }>;
            };
        };
        totalDataPoints: number;
        earliestDate: string;
        latestDate: string;
        lastUpdated: string;
    };
    ebay?: {
        salesByGrade: {
            [grade: string]: {
                count: number;
                totalValue?: number;
                averagePrice: number;
                medianPrice?: number;
                minPrice?: number;
                maxPrice?: number;
                marketPrice7Day?: number;
                marketTrend?: string;
                smartMarketPrice?: {
                    price: number;
                    confidence: string;
                    method: string;
                    daysUsed: number;
                };
            };
        };
        salesVelocity?: {
            dailyAverage: number;
            weeklyAverage: number;
            monthlyTotal: number;
        };
        priceHistory?: {
            [grade: string]: {
                [date: string]: {
                    average: number;
                    count: number;
                    totalValue: number;
                };
            };
        };
        lastScrapedDate?: string;
    };
    lastUpdated?: string;
}

interface PokemonPriceTrackerSetV2 {
    id: string;
    tcgPlayerId: string;
    name: string;
    series?: string;
    releaseDate?: string;
    cardCount?: number;
    priceGuideUrl?: string;
    hasPriceGuide?: boolean;
    imageUrl?: string;
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

interface V2APIResponse<T> {
    data: T[];
    metadata: {
        total: number;
        count: number;
        limit: number;
        offset: number;
        hasMore: boolean;
        includes?: {
            priceHistory: boolean;
            ebayData: boolean;
        };
    };
}

class PokemonPriceTrackerAPI {
    private proxyUrl = '/api/pokemon-price-tracker';

    private async makeProxyRequest<T>(
        action: string,
        params: Record<string, any> = {}
    ): Promise<APIResponse<T>> {
        try {
            console.log(`Making V2 proxy request - Action: ${action}`, params);

            const response = await fetch(this.proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action,
                    params
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('V2 Proxy request failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });

                return {
                    success: false,
                    error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
                };
            }

            const result = await response.json();
            console.log(`V2 Proxy response for ${action}:`, result);

            // Handle V2 API response structure
            if (result.success && result.data) {
                // V2 API wraps data in { data: [...], metadata: {...} }
                if (result.data.data && Array.isArray(result.data.data)) {
                    return {
                        success: true,
                        data: result.data.data as T,
                        rate_limit: result.rate_limit
                    };
                }
                // For single responses or different structures
                return {
                    success: true,
                    data: result.data as T,
                    rate_limit: result.rate_limit
                };
            }

            return result;

        } catch (error) {
            console.error('Network error calling V2 proxy:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // Get pricing for specific card by tcgPlayerId or id
    async getCardPricing(cardIdentifier: string): Promise<APIResponse<PokemonPriceTrackerCardV2>> {
        // Try tcgPlayerId first, fallback to id
        const params = cardIdentifier.includes('-') ?
            { id: cardIdentifier } :
            { tcgPlayerId: cardIdentifier };

        const response = await this.makeProxyRequest<PokemonPriceTrackerCardV2[]>('getCardPricing', params);

        if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
            return {
                success: true,
                data: response.data[0],
                rate_limit: response.rate_limit
            };
        }

        return {
            success: false,
            error: 'Card not found or no data returned'
        };
    }

    // Search for cards by name with pricing
    async searchCardPricing(options: {
        name?: string;
        setId?: string;
        limit?: number;
        page?: number;
        includeHistory?: boolean;
    } = {}): Promise<APIResponse<PokemonPriceTrackerCardV2[]>> {
        const params: Record<string, any> = {
            limit: Math.min(options.limit || 50, 100),
            offset: ((options.page || 1) - 1) * (options.limit || 50),
        };

        if (options.name) params.name = options.name;
        if (options.setId) params.setId = options.setId;

        return this.makeProxyRequest<PokemonPriceTrackerCardV2[]>('searchCardPricing', params);
    }

    // Get all cards from a specific set
    async getSetPricing(setId: string): Promise<APIResponse<PokemonPriceTrackerCardV2[]>> {
        const allCards: PokemonPriceTrackerCardV2[] = [];
        let offset = 0;
        let hasMore = true;
        const limit = 100;

        while (hasMore && offset < 1000) { // Safety limit
            const response = await this.makeProxyRequest<PokemonPriceTrackerCardV2[]>('getSetPricing', {
                setId,
                limit,
                offset
            });

            if (!response.success || !response.data) {
                return { success: false, error: response.error || 'Failed to fetch set pricing' };
            }

            allCards.push(...response.data);
            hasMore = response.data.length === limit;
            offset += limit;

            // Rate limiting delay
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return { success: true, data: allCards };
    }

    // Get available sets
    async getSets(): Promise<APIResponse<PokemonPriceTrackerSetV2[]>> {
        return this.makeProxyRequest<PokemonPriceTrackerSetV2[]>('getSets');
    }

    // Extract best market price from V2 pricing data
    static getBestMarketPrice(card: PokemonPriceTrackerCardV2): number | null {
        // V2 API has simpler pricing structure
        if (card.prices?.market && card.prices.market > 0) {
            return card.prices.market;
        }

        // Fallback to eBay PSA 10 price if available
        if (card.ebay?.salesByGrade?.psa10?.averagePrice) {
            return card.ebay.salesByGrade.psa10.averagePrice;
        }

        // Fallback to any available eBay grade
        const ebayGrades = Object.values(card.ebay?.salesByGrade || {});
        if (ebayGrades.length > 0) {
            return ebayGrades[0].averagePrice || null;
        }

        return null;
    }

    // Get PSA 10 price specifically
    static getPSA10Price(card: PokemonPriceTrackerCardV2): number | null {
        return card.ebay?.salesByGrade?.psa10?.averagePrice || null;
    }

    // Get latest price from price history
    static getLatestHistoryPrice(card: PokemonPriceTrackerCardV2, condition = 'Near Mint'): number | null {
        const conditionData = card.priceHistory?.conditions?.[condition];
        return conditionData?.latestPrice || null;
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.proxyUrl}`, {
                method: 'GET'
            });
            return response.ok;
        } catch (error) {
            console.error('Pokemon Price Tracker V2 API health check failed:', error);
            return false;
        }
    }
}

// Export singleton instance
const pokemonPriceTrackerAPI = new PokemonPriceTrackerAPI();

export { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI };
export type {
    PokemonPriceTrackerCardV2,
    PokemonPriceTrackerSetV2,
    APIResponse
};

// For backwards compatibility, also export with old names
export type PokemonPriceTrackerCard = PokemonPriceTrackerCardV2;
export type PokemonPriceTrackerSet = PokemonPriceTrackerSetV2;