// src/app/api/pokemon-tcg/import/route.ts - Updated with Pokemon Price Tracker API
import { NextRequest, NextResponse } from 'next/server';
import { pokemonTCGAPI, PokemonTCGAPI } from '../../../lib/pokemon-tcg-api';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';
import { prisma } from '../../../lib/prisma';
import { CardSource } from '@prisma/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cardIds, setId, pricingStrategy = 'REAL_API' } = body;

        if (!cardIds && !setId) {
            return NextResponse.json(
                { success: false, error: 'Either cardIds or setId must be provided' },
                { status: 400 }
            );
        }

        const results = {
            imported: [] as any[],
            updated: [] as any[],
            errors: [] as any[],
            sets_created: [] as any[],
            rarities_created: [] as any[],
            subtypes_created: [] as any[],
            supertypes_created: [] as any[],
            pricing_summary: {
                total_cards_priced: 0,
                api_pricing_success: 0,
                fallback_pricing_used: 0,
                avg_market_price: 0,
                price_range: { min: 0, max: 0 },
                pricing_strategy_used: pricingStrategy,
                rate_limit_encountered: false,
            }
        };

        let cardsToImport: any[] = [];

        // Get cards from Pokemon TCG API
        if (setId) {
            console.log(`Importing entire set: ${setId}`);
            const setInfo = await pokemonTCGAPI.getSet(setId);
            await ensureSetExists(setInfo, results);
            const setCards = await pokemonTCGAPI.getAllCardsFromSet(setId);
            cardsToImport = setCards;
            console.log(`Found ${cardsToImport.length} cards in set ${setId}`);
        } else {
            for (const cardId of cardIds) {
                try {
                    const card = await pokemonTCGAPI.getCard(cardId);
                    cardsToImport.push(card);
                } catch (error) {
                    results.errors.push({
                        cardId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }

        const marketPrices: number[] = [];

        // Group cards for batch pricing lookup
        const priceTrackerIds = cardsToImport
            .map(card => ({
                apiCard: card,
                priceTrackerId: card.set?.id && card.number ?
                    PokemonPriceTrackerAPI.convertTCGCardIdToPriceTrackerId(card.set.id, card.number) : null
            }))
            .filter(item => item.priceTrackerId !== null);

        console.log(`Fetching pricing for ${priceTrackerIds.length} cards...`);

        // Fetch pricing data in batches
        let pricingDataMap = new Map<string, any>();

        if (pricingStrategy === 'REAL_API' && priceTrackerIds.length > 0) {
            try {
                const ids = priceTrackerIds.map(item => item.priceTrackerId!);
                const pricingResponse = await pokemonPriceTrackerAPI.getBatchPricing(ids, false);

                if (pricingResponse.success && pricingResponse.data) {
                    pricingResponse.data.forEach(priceData => {
                        pricingDataMap.set(priceData.id, priceData);
                    });
                    console.log(`Successfully fetched pricing for ${pricingDataMap.size} cards`);
                } else {
                    console.warn('Pricing API failed, falling back to calculated pricing:', pricingResponse.error);
                    results.pricing_summary.rate_limit_encountered = pricingResponse.error?.includes('Rate limited') || false;
                }
            } catch (error) {
                console.error('Error fetching batch pricing:', error);
            }
        }

        // Process each card
        for (const apiCard of cardsToImport) {
            try {
                // Ensure all related data exists first
                await ensureSetExists(apiCard.set, results);
                const rarityId = await ensureRarityExists(apiCard.rarity, results);
                const supertypeId = await ensureSupertypeExists(apiCard.supertype, results);
                const subtypeId = apiCard.subtypes?.[0] ? await ensureSubtypeExists(apiCard.subtypes[0], apiCard.supertype, results) : null;

                // Get real market price
                let marketPrice: number | null = null;
                let pricingSource = 'calculated';

                const priceTrackerId = apiCard.set?.id && apiCard.number ?
                    PokemonPriceTrackerAPI.convertTCGCardIdToPriceTrackerId(apiCard.set.id, apiCard.number) : null;

                if (priceTrackerId && pricingDataMap.has(priceTrackerId)) {
                    const pricingData = pricingDataMap.get(priceTrackerId);
                    marketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(pricingData);

                    if (marketPrice && marketPrice > 0) {
                        pricingSource = 'pokemon_price_tracker';
                        results.pricing_summary.api_pricing_success++;
                    }
                }

                // Fallback to Pokemon TCG API pricing
                if (!marketPrice || marketPrice <= 0) {
                    marketPrice = PokemonTCGAPI.getMarketPrice(apiCard);
                    if (marketPrice && marketPrice > 0) {
                        pricingSource = 'pokemon_tcg_api';
                    }
                }

                // Final fallback to calculated pricing
                if (!marketPrice || marketPrice <= 0) {
                    marketPrice = calculateFallbackPrice(apiCard);
                    pricingSource = 'calculated';
                    results.pricing_summary.fallback_pricing_used++;
                }

                if (marketPrice && marketPrice > 0) {
                    marketPrices.push(marketPrice);
                }

                // Convert API card to our database format
                const dbCardData = convertApiCardToDbCardEnhanced(apiCard, {
                    setId: apiCard.set.id,
                    rarityId,
                    supertypeId,
                    subtypeId,
                    marketPrice,
                    pricingSource,
                });

                // Check if card already exists by API ID
                const existingCard = await prisma.card.findFirst({
                    where: { api_id: apiCard.id }
                });

                if (existingCard) {
                    // Update existing card
                    const updateData: any = {
                        name: dbCardData.name,
                        set_name: dbCardData.set_name,
                        set_number: dbCardData.set_number,
                        rarity: dbCardData.rarity,
                        card_type: dbCardData.card_type,
                        subtype: dbCardData.subtype,
                        hp: dbCardData.hp,
                        image_url: dbCardData.image_url,
                        small_image_url: dbCardData.small_image_url,
                        supertype: dbCardData.supertype,
                        subtypes: dbCardData.subtypes,
                        types: dbCardData.types,
                        evolves_from: dbCardData.evolves_from,
                        artist: dbCardData.artist,
                        flavor_text: dbCardData.flavor_text,
                        national_pokedex_numbers: dbCardData.national_pokedex_numbers,
                        set_id: dbCardData.set_id,
                        rarity_id: dbCardData.rarity_id,
                        subtype_id: dbCardData.subtype_id,
                        supertype_id: dbCardData.supertype_id,
                        weakness_type: dbCardData.weakness_type,
                        weakness_value: dbCardData.weakness_value,
                        resistance_type: dbCardData.resistance_type,
                        resistance_value: dbCardData.resistance_value,
                        retreat_cost: dbCardData.retreat_cost,
                        retreat_cost_count: dbCardData.retreat_cost_count,
                        evolution_stage: dbCardData.evolution_stage,
                        abilities: dbCardData.abilities,
                        attacks: dbCardData.attacks,
                        tcgplayer_prices: dbCardData.tcgplayer_prices,
                        cardmarket_prices: dbCardData.cardmarket_prices,
                        legalities: dbCardData.legalities,
                        holographic: dbCardData.holographic,
                        reverse_holo: dbCardData.reverse_holo,
                        secret_rare: dbCardData.secret_rare,
                        source: existingCard.source === CardSource.MANUAL ? CardSource.MIXED : CardSource.API,
                        api_updated_at: new Date(),
                        last_sync: new Date(),
                        // Update market price and pricing metadata
                        market_price: marketPrice,
                        price_trend: pricingSource === 'pokemon_price_tracker' ?
                            PokemonPriceTrackerAPI.getPriceTrend(pricingDataMap.get(priceTrackerId!)) : 'stable',
                        last_price_update: new Date(),
                    };

                    const updatedCard = await prisma.card.update({
                        where: { id: existingCard.id },
                        data: updateData
                    });

                    // Get related data separately to maintain the same response structure
                    const pokemonSet = await prisma.pokemonSet.findUnique({
                        where: { id: dbCardData.set_id }
                    });

                    const rarity_ref = dbCardData.rarity_id ? await prisma.rarity.findUnique({
                        where: { id: dbCardData.rarity_id }
                    }) : null;

                    const subtype_ref = dbCardData.subtype_id ? await prisma.subtype.findUnique({
                        where: { id: dbCardData.subtype_id }
                    }) : null;

                    const supertype_ref = dbCardData.supertype_id ? await prisma.supertype.findUnique({
                        where: { id: dbCardData.supertype_id }
                    }) : null;

                    // Create price history entry
                    if (marketPrice && pricingSource !== 'calculated') {
                        await prisma.$executeRaw`
                            INSERT INTO price_history (card_id, price, source, recorded_at, metadata) 
                            VALUES (${existingCard.id}, ${marketPrice}, ${pricingSource}, NOW(), ${JSON.stringify({
                            pricing_source: pricingSource,
                            api_update: true,
                            price_tracker_id: priceTrackerId
                        })})
                        `;
                    }

                    results.updated.push({
                        ...updatedCard,
                        pokemonSet,
                        rarity_ref,
                        subtype_ref,
                        supertype_ref
                    });
                } else {
                    // Create new card
                    const createData: any = {
                        ...dbCardData,
                        source: CardSource.API,
                    };

                    const newCard = await prisma.card.create({
                        data: createData
                    });

                    // Get related data separately to maintain the same response structure
                    const pokemonSet = await prisma.pokemonSet.findUnique({
                        where: { id: dbCardData.set_id }
                    });

                    const rarity_ref = dbCardData.rarity_id ? await prisma.rarity.findUnique({
                        where: { id: dbCardData.rarity_id }
                    }) : null;

                    const subtype_ref = dbCardData.subtype_id ? await prisma.subtype.findUnique({
                        where: { id: dbCardData.subtype_id }
                    }) : null;

                    const supertype_ref = dbCardData.supertype_id ? await prisma.supertype.findUnique({
                        where: { id: dbCardData.supertype_id }
                    }) : null;

                    // Create initial price history entry
                    if (marketPrice && pricingSource !== 'calculated') {
                        await prisma.$executeRaw`
                            INSERT INTO price_history (card_id, price, source, recorded_at, metadata) 
                            VALUES (${newCard.id}, ${marketPrice}, ${pricingSource}, NOW(), ${JSON.stringify({
                            pricing_source: pricingSource,
                            initial_import: true,
                            price_tracker_id: priceTrackerId
                        })})
                        `;
                    }

                    results.imported.push({
                        ...newCard,
                        pokemonSet,
                        rarity_ref,
                        subtype_ref,
                        supertype_ref
                    });
                }

            } catch (error) {
                console.error(`Error processing card ${apiCard.id}:`, error);
                results.errors.push({
                    cardId: apiCard.id,
                    cardName: apiCard.name,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        // Calculate pricing summary
        if (marketPrices.length > 0) {
            results.pricing_summary = {
                ...results.pricing_summary,
                total_cards_priced: marketPrices.length,
                avg_market_price: marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length,
                price_range: {
                    min: Math.min(...marketPrices),
                    max: Math.max(...marketPrices)
                },
            };
        }

        return NextResponse.json({
            success: true,
            message: `Import completed: ${results.imported.length} imported, ${results.updated.length} updated, ${results.errors.length} errors`,
            details: {
                cards: {
                    imported: results.imported.length,
                    updated: results.updated.length,
                    errors: results.errors.length
                },
                sets_created: results.sets_created.length,
                rarities_created: results.rarities_created.length,
                subtypes_created: results.subtypes_created.length,
                supertypes_created: results.supertypes_created.length,
            },
            pricing_summary: results.pricing_summary,
            results,
        });

    } catch (error) {
        console.error('Error importing from Pokemon TCG API:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to import from Pokemon TCG API',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// Fallback pricing calculation (simplified version of original)
function calculateFallbackPrice(apiCard: any): number {
    const RARITY_BASE_PRICES: { [key: string]: number } = {
        'Common': 0.25,
        'Uncommon': 0.75,
        'Rare': 3.00,
        'Holo Rare': 8.00,
        'Ultra Rare': 25.00,
        'Secret Rare': 45.00,
        'Rainbow Rare': 75.00,
    };

    const basePrice = RARITY_BASE_PRICES[apiCard.rarity] || 1.00;
    const setYear = apiCard.set.releaseDate ? apiCard.set.releaseDate.substring(0, 4) : '2024';
    const yearMultiplier = setYear < '2020' ? 1.5 : 1.0;

    return Math.max(0.25, basePrice * yearMultiplier);
}

// Helper functions (keeping existing ones)
async function ensureSetExists(setData: any, results: any) {
    try {
        const existingSet = await prisma.pokemonSet.findUnique({
            where: { id: setData.id }
        });

        if (!existingSet) {
            const newSet = await prisma.pokemonSet.create({
                data: {
                    id: setData.id,
                    name: setData.name,
                    series: setData.series,
                    printed_total: setData.printedTotal || null,
                    total: setData.total || null,
                    legalities: setData.legalities || null,
                    ptcgo_code: setData.ptcgoCode || null,
                    release_date: setData.releaseDate,
                    images: setData.images || null,
                    api_updated_at: new Date(),
                }
            });
            results.sets_created.push(newSet);
            console.log(`Created new set: ${newSet.name}`);
        }
    } catch (error) {
        console.error(`Error ensuring set exists: ${setData.id}`, error);
    }
}

async function ensureRarityExists(rarityName: string, results: any): Promise<number | null> {
    if (!rarityName) return null;

    try {
        let rarity = await prisma.rarity.findUnique({
            where: { name: rarityName }
        });

        if (!rarity) {
            const rarityOrder: { [key: string]: number } = {
                'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Holo Rare': 4, 'Ultra Rare': 5,
                'Secret Rare': 6, 'Rainbow Rare': 7, 'Gold Rare': 8,
            };

            rarity = await prisma.rarity.create({
                data: {
                    name: rarityName,
                    order_index: rarityOrder[rarityName] || 999,
                }
            });
            results.rarities_created.push(rarity);
        }

        return rarity.id;
    } catch (error) {
        console.error(`Error ensuring rarity exists: ${rarityName}`, error);
        return null;
    }
}

async function ensureSupertypeExists(supertypeName: string, results: any): Promise<number | null> {
    if (!supertypeName) return null;

    try {
        let supertype = await prisma.supertype.findUnique({
            where: { name: supertypeName }
        });

        if (!supertype) {
            const supertypeOrder: { [key: string]: number } = {
                'Pokémon': 1, 'Trainer': 2, 'Energy': 3,
            };

            supertype = await prisma.supertype.create({
                data: {
                    name: supertypeName,
                    order_index: supertypeOrder[supertypeName] || 999,
                }
            });
            results.supertypes_created.push(supertype);
        }

        return supertype.id;
    } catch (error) {
        console.error(`Error ensuring supertype exists: ${supertypeName}`, error);
        return null;
    }
}

async function ensureSubtypeExists(subtypeName: string, supertypeName: string, results: any): Promise<number | null> {
    if (!subtypeName) return null;

    try {
        let subtype = await prisma.subtype.findUnique({
            where: { name: subtypeName }
        });

        if (!subtype) {
            let category = 'Unknown';
            if (supertypeName === 'Pokémon') category = 'Pokemon';
            else if (supertypeName === 'Trainer') category = 'Trainer';
            else if (supertypeName === 'Energy') category = 'Energy';

            subtype = await prisma.subtype.create({
                data: {
                    name: subtypeName,
                    category: category,
                }
            });
            results.subtypes_created.push(subtype);
        }

        return subtype.id;
    } catch (error) {
        console.error(`Error ensuring subtype exists: ${subtypeName}`, error);
        return null;
    }
}

function convertApiCardToDbCardEnhanced(apiCard: any, foreignKeys: {
    setId: string;
    rarityId: number | null;
    supertypeId: number | null;
    subtypeId: number | null;
    marketPrice: number | null;
    pricingSource: string;
}) {
    const parseHP = (hp?: string): number | null => {
        if (!hp) return null;
        const numericHP = parseInt(hp.replace(/\D/g, ''));
        return isNaN(numericHP) ? null : numericHP;
    };

    const getFirstSubtype = (subtypes?: string[]): string | null => {
        return subtypes && subtypes.length > 0 ? subtypes[0] : null;
    };

    const getCardType = (supertype: string, subtypes?: string[]): string => {
        if (supertype === 'Pokémon') return 'Pokemon';
        if (supertype === 'Trainer') return 'Trainer';
        if (supertype === 'Energy') return 'Energy';
        return supertype || 'Unknown';
    };

    const safeJsonField = (value: any) => {
        if (value === null || value === undefined) {
            return undefined;
        }
        return value;
    };

    return {
        // Basic card info
        name: apiCard.name,
        set_name: apiCard.set.name,
        set_number: apiCard.number || null,
        rarity: apiCard.rarity,
        card_type: getCardType(apiCard.supertype, apiCard.subtypes),
        subtype: getFirstSubtype(apiCard.subtypes),
        hp: parseHP(apiCard.hp),
        image_url: apiCard.images.large,
        small_image_url: apiCard.images.small,

        // API-specific fields
        api_id: apiCard.id,
        supertype: apiCard.supertype,
        subtypes: safeJsonField(apiCard.subtypes),
        types: safeJsonField(apiCard.types),
        evolves_from: apiCard.evolvesFrom || null,
        artist: apiCard.artist || null,
        flavor_text: apiCard.flavorText || null,
        national_pokedex_numbers: safeJsonField(apiCard.nationalPokedexNumbers),

        // Foreign key relationships
        set_id: foreignKeys.setId,
        rarity_id: foreignKeys.rarityId,
        subtype_id: foreignKeys.subtypeId,
        supertype_id: foreignKeys.supertypeId,

        // Type properties
        weakness_type: apiCard.weaknesses?.[0]?.type || null,
        weakness_value: apiCard.weaknesses?.[0]?.value || null,
        resistance_type: apiCard.resistances?.[0]?.type || null,
        resistance_value: apiCard.resistances?.[0]?.value || null,
        retreat_cost: safeJsonField(apiCard.retreatCost),
        retreat_cost_count: apiCard.convertedRetreatCost || null,

        // Pokemon-specific properties
        evolution_stage: apiCard.subtypes?.includes('Basic') ? 'Basic' :
            apiCard.subtypes?.includes('Stage 1') ? 'Stage 1' :
                apiCard.subtypes?.includes('Stage 2') ? 'Stage 2' : null,

        // Abilities and attacks
        abilities: safeJsonField(apiCard.abilities),
        attacks: safeJsonField(apiCard.attacks),

        // Market data - REAL PRICING FROM API
        tcgplayer_prices: safeJsonField(apiCard.tcgplayer),
        cardmarket_prices: safeJsonField(apiCard.cardmarket),
        market_price: foreignKeys.marketPrice,
        last_price_update: new Date(),
        legalities: safeJsonField(apiCard.legalities),

        // Rarity flags
        holographic: apiCard.rarity?.toLowerCase().includes('holo') || false,
        reverse_holo: apiCard.rarity?.toLowerCase().includes('reverse') || false,
        secret_rare: apiCard.rarity?.toLowerCase().includes('secret') || false,

        // Source and sync info
        api_updated_at: new Date(),
        last_sync: new Date(),
    };
}