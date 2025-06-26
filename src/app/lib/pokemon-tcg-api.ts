

// Complete Pokemon TCG API interfaces
interface PokemonTCGCard {
    id: string;
    name: string;
    supertype: string; // "Pokémon", "Trainer", "Energy"
    subtypes?: string[];
    level?: string;
    hp?: string;
    types?: string[];
    evolvesFrom?: string;
    evolvesTo?: string[];
    rules?: string[];
    ancientTrait?: {
        name: string;
        text: string;
    };
    abilities?: Array<{
        name: string;
        text: string;
        type: string;
    }>;
    attacks?: Array<{
        name: string;
        cost: string[];
        convertedEnergyCost: number;
        damage: string;
        text: string;
    }>;
    weaknesses?: Array<{
        type: string;
        value: string;
    }>;
    resistances?: Array<{
        type: string;
        value: string;
    }>;
    retreatCost?: string[];
    convertedRetreatCost?: number;
    number: string;
    artist?: string;
    rarity: string;
    flavorText?: string;
    nationalPokedexNumbers?: number[];
    legalities?: {
        unlimited?: string;
        standard?: string;
        expanded?: string;
    };
    regulationMark?: string;
    images: {
        small: string;
        large: string;
    };
    tcgplayer?: {
        url: string;
        updatedAt: string;
        prices?: {
            holofoil?: {
                low: number;
                mid: number;
                high: number;
                market: number;
                directLow?: number;
            };
            reverseHolofoil?: {
                low: number;
                mid: number;
                high: number;
                market: number;
                directLow?: number;
            };
            normal?: {
                low: number;
                mid: number;
                high: number;
                market: number;
                directLow?: number;
            };
            '1stEditionHolofoil'?: {
                low: number;
                mid: number;
                high: number;
                market: number;
                directLow?: number;
            };
            '1stEditionNormal'?: {
                low: number;
                mid: number;
                high: number;
                market: number;
                directLow?: number;
            };
        };
    };
    cardmarket?: {
        url: string;
        updatedAt: string;
        prices?: {
            averageSellPrice?: number;
            lowPrice?: number;
            trendPrice?: number;
            germanProLow?: number;
            suggestedPrice?: number;
            reverseHoloSell?: number;
            reverseHoloLow?: number;
            reverseHoloTrend?: number;
            lowPriceExPlus?: number;
            avg1?: number;
            avg7?: number;
            avg30?: number;
            reverseHoloAvg1?: number;
            reverseHoloAvg7?: number;
            reverseHoloAvg30?: number;
        };
    };
    set: {
        id: string;
        name: string;
        series: string;
        printedTotal?: number;
        total?: number;
        legalities?: {
            unlimited?: string;
            standard?: string;
            expanded?: string;
        };
        ptcgoCode?: string;
        releaseDate: string;
        updatedAt: string;
        images?: {
            symbol: string;
            logo: string;
        };
    };
}

interface PokemonTCGSet {
    id: string;
    name: string;
    series: string;
    printedTotal?: number;
    total?: number;
    legalities?: {
        unlimited?: string;
        standard?: string;
        expanded?: string;
    };
    ptcgoCode?: string;
    releaseDate: string;
    updatedAt: string;
    images?: {
        symbol: string;
        logo: string;
    };
}

interface SearchResponse<T> {
    data: T[];
    page: number;
    pageSize: number;
    count: number;
    totalCount: number;
}

interface APIError {
    error: string;
    message?: string;
}

class PokemonTCGAPI {
    private baseUrl = 'https://api.pokemontcg.io/v2';
    private apiKey: string;
    private defaultHeaders: Record<string, string>;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.defaultHeaders = {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'TCG-Market-App/1.0'
        };
    }

    private async makeRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
        const url = new URL(`${this.baseUrl}${endpoint}`);

        // Add query parameters
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        console.log('Making Pokemon TCG API request:', url.toString());

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.defaultHeaders,
            });

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
                console.warn(`Rate limited. Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.makeRequest<T>(endpoint, params); // Retry
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Pokemon TCG API Error:', {
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

                throw new Error(errorMessage);
            }

            const data = await response.json();

            console.log('Pokemon TCG API Response:', {
                endpoint,
                count: data.data?.length || 0,
                totalCount: data.totalCount || 'N/A',
                page: data.page || 'N/A'
            });

            return data;
        } catch (error) {
            console.error('Network error calling Pokemon TCG API:', error);
            throw error;
        }
    }

    // Search cards with various filters
    async searchCards(options: {
        name?: string;
        set?: string;
        setId?: string;
        types?: string;
        supertype?: string;
        subtypes?: string;
        rarity?: string;
        hp?: string;
        artist?: string;
        page?: number;
        pageSize?: number;
        orderBy?: string;
    } = {}): Promise<SearchResponse<PokemonTCGCard>> {
        const params: Record<string, any> = {
            page: options.page || 1,
            pageSize: Math.min(options.pageSize || 20, 250), // API max is 250
        };

        // Build query string for advanced search using Pokemon TCG API query syntax
        const queryParts: string[] = [];

        if (options.name) {
            // Use wildcard search for partial name matching
            queryParts.push(`name:"${options.name}*"`);
        }

        if (options.set) {
            queryParts.push(`set.name:"${options.set}"`);
        }

        if (options.setId) {
            queryParts.push(`set.id:"${options.setId}"`);
        }

        if (options.types) {
            queryParts.push(`types:"${options.types}"`);
        }

        if (options.supertype) {
            queryParts.push(`supertype:"${options.supertype}"`);
        }

        if (options.subtypes) {
            queryParts.push(`subtypes:"${options.subtypes}"`);
        }

        if (options.rarity) {
            queryParts.push(`rarity:"${options.rarity}"`);
        }

        if (options.hp) {
            queryParts.push(`hp:"${options.hp}"`);
        }

        if (options.artist) {
            queryParts.push(`artist:"${options.artist}"`);
        }

        if (queryParts.length > 0) {
            params.q = queryParts.join(' AND ');
        }

        // Add ordering
        if (options.orderBy) {
            params.orderBy = options.orderBy;
        }

        return this.makeRequest<SearchResponse<PokemonTCGCard>>('/cards', params);
    }

    // Get a specific card by ID
    async getCard(cardId: string): Promise<PokemonTCGCard> {
        const response = await this.makeRequest<{ data: PokemonTCGCard }>(`/cards/${cardId}`);
        return response.data;
    }

    // Get all cards from a specific set with pagination support
    async getCardsFromSet(setId: string, page = 1, pageSize = 250): Promise<SearchResponse<PokemonTCGCard>> {
        return this.makeRequest<SearchResponse<PokemonTCGCard>>('/cards', {
            q: `set.id:"${setId}"`,
            page,
            pageSize,
            orderBy: 'number'
        });
    }

    // Get all cards from a set (handles pagination automatically)
    async getAllCardsFromSet(setId: string): Promise<PokemonTCGCard[]> {
        const allCards: PokemonTCGCard[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await this.getCardsFromSet(setId, page, 250);
            allCards.push(...response.data);

            hasMore = response.data.length === 250; // If we got a full page, there might be more
            page++;

            // Safety limit to prevent infinite loops
            if (page > 50) {
                console.warn(`Reached maximum page limit (50) for set ${setId}`);
                break;
            }
        }

        return allCards;
    }

    // Get all sets with pagination
    async getSets(page = 1, pageSize = 250): Promise<SearchResponse<PokemonTCGSet>> {
        return this.makeRequest<SearchResponse<PokemonTCGSet>>('/sets', {
            page,
            pageSize,
            orderBy: 'releaseDate'
        });
    }

    // Get all sets (handles pagination automatically)
    async getAllSets(): Promise<PokemonTCGSet[]> {
        const allSets: PokemonTCGSet[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await this.getSets(page, 250);
            allSets.push(...response.data);

            hasMore = response.data.length === 250;
            page++;

            if (page > 10) break; // Safety limit
        }

        return allSets;
    }

    // Get a specific set
    async getSet(setId: string): Promise<PokemonTCGSet> {
        const response = await this.makeRequest<{ data: PokemonTCGSet }>(`/sets/${setId}`);
        return response.data;
    }

    // Get available types (for filters)
    async getTypes(): Promise<string[]> {
        const response = await this.makeRequest<{ data: string[] }>('/types');
        return response.data;
    }

    // Get available subtypes (for filters)
    async getSubtypes(): Promise<string[]> {
        const response = await this.makeRequest<{ data: string[] }>('/subtypes');
        return response.data;
    }

    // Get available supertypes (for filters)
    async getSupertypes(): Promise<string[]> {
        const response = await this.makeRequest<{ data: string[] }>('/supertypes');
        return response.data;
    }

    // Get available rarities (for filters)
    async getRarities(): Promise<string[]> {
        const response = await this.makeRequest<{ data: string[] }>('/rarities');
        return response.data;
    }

    // Utility method to check API health
    async healthCheck(): Promise<boolean> {
        try {
            await this.makeRequest('/cards', { pageSize: 1 });
            return true;
        } catch (error) {
            console.error('Pokemon TCG API health check failed:', error);
            return false;
        }
    }

    // Convert API card to our database format (full schema with new fields) - Fixed JSON handling
    static convertApiCardToDbCard(apiCard: PokemonTCGCard) {
        // Helper function to safely convert HP to number
        const parseHP = (hp?: string): number | null => {
            if (!hp) return null;
            const numericHP = parseInt(hp.replace(/\D/g, ''));
            return isNaN(numericHP) ? null : numericHP;
        };

        // Helper function to get the first subtype
        const getFirstSubtype = (subtypes?: string[]): string | null => {
            return subtypes && subtypes.length > 0 ? subtypes[0] : null;
        };

        // Helper function to determine card type from supertype and subtypes
        const getCardType = (supertype: string, subtypes?: string[]): string => {
            if (supertype === 'Pokémon') return 'Pokemon';
            if (supertype === 'Trainer') return 'Trainer';
            if (supertype === 'Energy') return 'Energy';
            return supertype || 'Unknown';
        };

        // Helper function to safely handle JSON fields (fixes Prisma JSON type issues)
        const safeJsonField = (value: any) => {
            if (value === null || value === undefined) {
                return undefined; // Use undefined instead of null for optional JSON fields
            }
            return value;
        };

        return {
            name: apiCard.name,
            set_name: apiCard.set.name,
            set_number: apiCard.number || null,
            rarity: apiCard.rarity,
            card_type: getCardType(apiCard.supertype, apiCard.subtypes),
            subtype: getFirstSubtype(apiCard.subtypes),
            hp: parseHP(apiCard.hp),
            image_url: apiCard.images.large,
            small_image_url: apiCard.images.small,

            // New API-specific fields with safe JSON handling
            api_id: apiCard.id,
            supertype: apiCard.supertype,
            subtypes: safeJsonField(apiCard.subtypes),                    // Fixed JSON handling
            types: safeJsonField(apiCard.types),                          // Fixed JSON handling
            evolves_from: apiCard.evolvesFrom || null,
            artist: apiCard.artist || null,
            flavor_text: apiCard.flavorText || null,
            national_pokedex_numbers: safeJsonField(apiCard.nationalPokedexNumbers), // Fixed JSON handling
            tcgplayer_prices: safeJsonField(apiCard.tcgplayer),           // Fixed JSON handling
            cardmarket_prices: safeJsonField(apiCard.cardmarket),         // Fixed JSON handling
            legalities: safeJsonField(apiCard.legalities),               // Fixed JSON handling

            source: 'API' as const,
            api_updated_at: new Date(),
        };
    }

    // Convert API set to our database format
    static convertApiSetToDbSet(apiSet: PokemonTCGSet) {
        return {
            id: apiSet.id,
            name: apiSet.name,
            series: apiSet.series,
            printed_total: apiSet.printedTotal || null,
            total: apiSet.total || null,
            legalities: apiSet.legalities || null,
            ptcgo_code: apiSet.ptcgoCode || null,
            release_date: apiSet.releaseDate,
            images: apiSet.images || null,
            api_updated_at: new Date(),
        };
    }

    // Get market price from card data
    static getMarketPrice(card: PokemonTCGCard): number | null {
        // Try TCGPlayer first
        if (card.tcgplayer?.prices) {
            const prices = card.tcgplayer.prices;

            // Priority order: holofoil, normal, reverseHolofoil
            if (prices.holofoil?.market) return prices.holofoil.market;
            if (prices.normal?.market) return prices.normal.market;
            if (prices.reverseHolofoil?.market) return prices.reverseHolofoil.market;

            // Fallback to mid prices
            if (prices.holofoil?.mid) return prices.holofoil.mid;
            if (prices.normal?.mid) return prices.normal.mid;
            if (prices.reverseHolofoil?.mid) return prices.reverseHolofoil.mid;
        }

        // Try Cardmarket as fallback
        if (card.cardmarket?.prices?.trendPrice) {
            return card.cardmarket.prices.trendPrice;
        }

        return null;
    }

    // Get card condition variants with pricing
    static getCardVariants(card: PokemonTCGCard) {
        const variants = [];

        if (card.tcgplayer?.prices) {
            const prices = card.tcgplayer.prices;

            if (prices.normal) {
                variants.push({
                    condition: 'Normal',
                    price: prices.normal.market || prices.normal.mid,
                    low: prices.normal.low,
                    high: prices.normal.high
                });
            }

            if (prices.holofoil) {
                variants.push({
                    condition: 'Holofoil',
                    price: prices.holofoil.market || prices.holofoil.mid,
                    low: prices.holofoil.low,
                    high: prices.holofoil.high
                });
            }

            if (prices.reverseHolofoil) {
                variants.push({
                    condition: 'Reverse Holofoil',
                    price: prices.reverseHolofoil.market || prices.reverseHolofoil.mid,
                    low: prices.reverseHolofoil.low,
                    high: prices.reverseHolofoil.high
                });
            }
        }

        return variants;
    }
}

// Export singleton instance with your API key
const pokemonTCGAPI = new PokemonTCGAPI(
    process.env.POKEMON_TCG_API_KEY || '1360395b-8230-432d-ba11-d84985bc2023'
);

export { pokemonTCGAPI, PokemonTCGAPI };
export type { PokemonTCGCard, PokemonTCGSet, SearchResponse, APIError };