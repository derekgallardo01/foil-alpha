// src/lib/pokemon-price-tracker-api.ts - FIXED FOR V2 API
interface PokemonPriceTrackerCardV2 {
    id: string;
    tcgPlayerId?: string;
    setId: string;
    setName: string;
    name: string;
    cardNumber: string;
    rarity: string;
    cardType?: string;
    hp?: number;
    stage?: string;

    // V2 API Image field - this is what we're looking for!
    imageUrl?: string;

    // V2 Pricing data structure
    prices?: {
        market?: number;
        listings?: number;
        lastUpdated?: string;
        primaryCondition?: string;
    };

    // V2 Additional fields
    tcgPlayerUrl?: string;
    artist?: string;
    retreatCost?: number;
    dataCompleteness?: number;
    needsDetailedScrape?: boolean;
    lastScrapedAt?: string;

    // V2 Rich data
    attacks?: Array<{
        name: string;
        cost?: string[];
        damage?: string;
        text?: string;
    }>;
    weakness?: {
        type: string;
        value: string;
    };
    resistance?: {
        type: string;
        value: string;
    };

    // V2 eBay graded data
    ebay?: {
        salesByGrade?: {
            [grade: string]: {
                count: number;
                totalValue?: number;
                averagePrice: number;
                medianPrice?: number;
                minPrice?: number;
                maxPrice?: number;
            };
        };
        salesVelocity?: {
            dailyAverage: number;
            weeklyAverage: number;
            monthlyTotal: number;
        };
        lastScrapedDate?: string;
    };

    // V2 Price history
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

    lastUpdated?: string;
}

interface PokemonPriceTrackerSetV2 {
    id: string;
    tcgPlayerId?: string;
    name: string;
    series?: string;
    releaseDate?: string;
    cardCount?: number;
    priceGuideUrl?: string;
    hasPriceGuide?: boolean;
    imageUrl?: string;
}

interface V2APIResponse<T> {
    data: T[];
    metadata: {
        total: number;
        count: number;
        limit?: number;
        offset?: number;
        page?: number;
        hasMore?: boolean;
    };
}

// Raw response shape returned by the proxy: data may be a wrapped V2 payload,
// a single item, or a bare array. Used internally by makeProxyRequest.
interface RawAPIResponse<T> {
    success: boolean;
    data?: V2APIResponse<T> | T | T[];
    error?: string;
    message?: string;
    rate_limit?: {
        remaining: number;
        reset_at: string;
    };
}

// Clean public response: the API methods always unwrap to a plain T
// (either a single item or an array), so consumers never see the union.
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
    private proxyUrl = '/api/pokemon-price-tracker';

    private async makeProxyRequest<T>(
        action: string,
        params: Record<string, any> = {}
    ): Promise<RawAPIResponse<T>> {
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
            console.log(`V2 Proxy response for ${action}:`, {
                success: result.success,
                hasData: !!result.data,
                dataStructure: result.data ? Object.keys(result.data) : [],
                rateLimit: result.rate_limit
            });

            return result;

        } catch (error) {
            console.error('Network error calling V2 proxy:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            };
        }
    }

    // Search for cards by name with V2 API
    // Update the searchCardPricing method in pokemon-price-tracker-api.ts
    async searchCardPricing(options: {
        name?: string;
        setId?: string;
        setName?: string;  // Add this to fix the TypeScript error
        rarity?: string;
        cardType?: string;
        artist?: string;
        minPrice?: number;
        maxPrice?: number;
        limit?: number;
        page?: number;
    } = {}): Promise<APIResponse<PokemonPriceTrackerCardV2[]>> {
        const params: Record<string, any> = {
            limit: Math.min(options.limit || 1, 5),
        };

        if (options.name) params.name = options.name;
        if (options.setId) params.setId = options.setId;
        if (options.setName) params.setName = options.setName; // Add this line
        if (options.rarity) params.rarity = options.rarity;
        if (options.cardType) params.cardType = options.cardType;
        if (options.artist) params.artist = options.artist;
        if (options.minPrice) params.minPrice = options.minPrice;
        if (options.maxPrice) params.maxPrice = options.maxPrice;
        if (options.page) params.page = options.page;

        const response = await this.makeProxyRequest<PokemonPriceTrackerCardV2>('searchCardPricing', params);

        if (response.success && response.data) {
            if (Array.isArray(response.data)) {
                return {
                    success: true,
                    data: response.data,
                    rate_limit: response.rate_limit
                };
            } else {
                const v2Data = response.data as V2APIResponse<PokemonPriceTrackerCardV2>;
                return {
                    success: true,
                    data: v2Data.data || [],
                    rate_limit: response.rate_limit
                };
            }
        }

        return {
            success: false,
            error: response.error || 'Search failed',
            data: []
        };
    }

    async getCardPricing(cardIdentifier: string): Promise<APIResponse<PokemonPriceTrackerCardV2>> {
        const params = { id: cardIdentifier };

        const response = await this.makeProxyRequest<PokemonPriceTrackerCardV2>('getCardPricing', params);

        if (response.success && response.data) {
            // Handle both possible response types
            if (Array.isArray(response.data)) {
                // Direct array response
                if (response.data.length > 0) {
                    return {
                        success: true,
                        data: response.data[0],
                        rate_limit: response.rate_limit
                    };
                }
            } else {
                // V2 API wrapped response
                const v2Data = response.data as V2APIResponse<PokemonPriceTrackerCardV2>;
                if (v2Data.data && Array.isArray(v2Data.data) && v2Data.data.length > 0) {
                    return {
                        success: true,
                        data: v2Data.data[0],
                        rate_limit: response.rate_limit
                    };
                }
            }
        }

        return {
            success: false,
            error: 'Card not found or no data returned'
        };
    }

    async getSetPricing(setId: string): Promise<APIResponse<PokemonPriceTrackerCardV2[]>> {
        const allCards: PokemonPriceTrackerCardV2[] = [];
        let page = 1;
        let hasMore = true;
        const limit = 50;

        while (hasMore && page <= 10) { // Safety limit of 10 pages (500 cards max)
            const response = await this.makeProxyRequest<PokemonPriceTrackerCardV2>('getSetPricing', {
                setId,
                page,
                limit
            });

            if (!response.success || !response.data) {
                if (page === 1) {
                    // If first page fails, return error
                    return { success: false, error: response.error || 'Failed to fetch set pricing' };
                } else {
                    // If later pages fail, just stop and return what we have
                    break;
                }
            }

            const cards = Array.isArray(response.data) ? response.data : [];
            allCards.push(...cards);

            // If we got less than the limit, we've reached the end
            hasMore = cards.length === limit;
            page++;

            // Rate limiting delay
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return { success: true, data: allCards };
    }
    async getSets(options: { name?: string } = {}): Promise<APIResponse<PokemonPriceTrackerSetV2[]>> {
        const params: Record<string, any> = {};
        if (options.name) params.name = options.name;

        const response = await this.makeProxyRequest<PokemonPriceTrackerSetV2>('getSets', params);

        if (response.success && response.data) {
            // Handle both possible response types
            if (Array.isArray(response.data)) {
                // Direct array response
                return {
                    success: true,
                    data: response.data,
                    rate_limit: response.rate_limit
                };
            } else {
                // V2 API wrapped response
                const v2Data = response.data as V2APIResponse<PokemonPriceTrackerSetV2>;
                return {
                    success: true,
                    data: v2Data.data || [],
                    rate_limit: response.rate_limit
                };
            }
        }

        return {
            success: false,
            error: response.error || 'Failed to fetch sets',
            data: []
        };
    }

    // Extract best market price from V2 pricing data
    static getBestMarketPrice(card: PokemonPriceTrackerCardV2): number | null {
        // V2 API has simpler pricing structure
        if (card.prices?.market && card.prices.market > 0) {
            return card.prices.market;
        }

        // Fallback to eBay PSA 10 price if available
        if (card.ebay?.salesByGrade?.PSA10?.averagePrice) {
            return card.ebay.salesByGrade.PSA10.averagePrice;
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
        return card.ebay?.salesByGrade?.PSA10?.averagePrice || null;
    }

    // Summarize the pricing sources available for a card (market + graded eBay)
    static getPricingSummary(card: PokemonPriceTrackerCardV2): {
        sources: Record<string, number | null>;
    } {
        return {
            sources: {
                market: card.prices?.market ?? null,
                psa10: card.ebay?.salesByGrade?.PSA10?.averagePrice ?? null,
            },
        };
    }

    // Get card image URL from V2 API
    static getImageUrl(card: PokemonPriceTrackerCardV2): string | null {
        return card.imageUrl || null;
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

    // Debug method to test V2 API response structure
    async debugV2Structure(): Promise<any> {
        try {
            const response = await fetch(`${this.proxyUrl}?test=v2-structure`);
            return await response.json();
        } catch (error) {
            console.error('V2 debug request failed:', error);
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    // Test the exact example from docs
    async testSetExample(): Promise<any> {
        try {
            const response = await fetch(`${this.proxyUrl}?test=v2-set-example`);
            return await response.json();
        } catch (error) {
            console.error('V2 set example test failed:', error);
            return { error: error instanceof Error ? error.message : 'Unknown error' };
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

// For backwards compatibility
export type PokemonPriceTrackerCard = PokemonPriceTrackerCardV2;
export type PokemonPriceTrackerSet = PokemonPriceTrackerSetV2;