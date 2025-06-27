// src/app/api/pokemon-tcg/import/route.ts - Fixed TypeScript version
import { NextRequest, NextResponse } from 'next/server';
import { pokemonTCGAPI, PokemonTCGAPI } from '../../../lib/pokemon-tcg-api';
import { prisma } from '../../../lib/prisma';
import { CardSource } from '@prisma/client';

// Pricing configuration
const PRICING_CONFIG = {
    RARITY_BASE_PRICES: {
        'Common': 0.25,
        'Uncommon': 0.75,
        'Rare': 3.00,
        'Holo Rare': 8.00,
        'Ultra Rare': 25.00,
        'Secret Rare': 45.00,
        'Rainbow Rare': 75.00,
        'Gold Rare': 60.00,
        'Radiant Rare': 15.00,
        'Amazing Rare': 20.00,
        'Shining Rare': 30.00,
        'Prime': 40.00,
        'Legend': 50.00,
        'BREAK': 12.00,
        'GX': 18.00,
        'EX': 15.00,
        'V': 12.00,
        'VMAX': 25.00,
        'VSTAR': 22.00,
        'TAG TEAM': 35.00,
    },
    SET_AGE_MULTIPLIERS: {
        '2024': 1.5, '2023': 1.3, '2022': 1.1, '2021': 1.0, '2020': 0.9,
        '2019': 0.8, '2018': 0.7, '2017': 0.6, '2016': 0.7, '2015': 0.8,
        '2014': 0.9, '2013': 1.0, '2012': 1.1, '2011': 1.2, '2010': 1.3,
        '2009': 1.4, '2008': 1.5, '2007': 1.6, '2006': 1.7, '2005': 1.8,
        '2004': 1.9, '2003': 2.0, '2002': 2.1, '2001': 2.2, '2000': 2.3,
        '1999': 2.5, '1998': 2.7,
    },
    POPULAR_POKEMON_MULTIPLIERS: {
        'Charizard': 3.0, 'Pikachu': 2.0, 'Mewtwo': 1.8, 'Mew': 1.7,
        'Lugia': 1.6, 'Ho-Oh': 1.5, 'Rayquaza': 1.5, 'Arceus': 1.4,
    },
    MARKETPLACE_MARKUP: 1.15,
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cardIds, setId, pricingStrategy = 'AUTO' } = body;

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
                avg_calculated_price: 0,
                price_range: { min: 0, max: 0 },
                pricing_strategy_used: pricingStrategy,
            }
        };

        let cardsToImport: any[] = [];

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

        const calculatedPrices: number[] = [];

        // Process each card with enhanced pricing
        for (const apiCard of cardsToImport) {
            try {
                // Ensure all related data exists first
                await ensureSetExists(apiCard.set, results);
                const rarityId = await ensureRarityExists(apiCard.rarity, results);
                const supertypeId = await ensureSupertypeExists(apiCard.supertype, results);
                const subtypeId = apiCard.subtypes?.[0] ? await ensureSubtypeExists(apiCard.subtypes[0], apiCard.supertype, results) : null;

                // Calculate intelligent price for the card
                const calculatedPrice = calculateIntelligentPrice(apiCard, pricingStrategy);
                calculatedPrices.push(calculatedPrice);

                // Convert API card to our database format with pricing
                const dbCardData = convertApiCardToDbCardEnhanced(apiCard, {
                    setId: apiCard.set.id,
                    rarityId,
                    supertypeId,
                    subtypeId,
                    calculatedPrice,
                });

                // Check if card already exists by API ID
                const existingCard = await prisma.card.findFirst({
                    where: { api_id: apiCard.id }
                });

                if (existingCard) {
                    // Prepare update data with proper types
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
                        // Only update price if it's not manually set
                        market_price: existingCard.source === CardSource.MANUAL ? existingCard.market_price : calculatedPrice,
                        last_price_update: new Date(),
                    };

                    const updatedCard = await prisma.card.update({
                        where: { id: existingCard.id },
                        data: updateData,
                        include: {
                            pokemonSet: true,
                            rarity_ref: true,
                            subtype_ref: true,
                            supertype_ref: true,
                        }
                    });
                    results.updated.push(updatedCard);
                } else {
                    // Create new card with proper types
                    const createData: any = {
                        ...dbCardData,
                        source: CardSource.API, // Use proper enum value
                    };

                    const newCard = await prisma.card.create({
                        data: createData,
                        include: {
                            pokemonSet: true,
                            rarity_ref: true,
                            subtype_ref: true,
                            supertype_ref: true,
                        }
                    });
                    results.imported.push(newCard);
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
        if (calculatedPrices.length > 0) {
            results.pricing_summary = {
                total_cards_priced: calculatedPrices.length,
                avg_calculated_price: calculatedPrices.reduce((a, b) => a + b, 0) / calculatedPrices.length,
                price_range: {
                    min: Math.min(...calculatedPrices),
                    max: Math.max(...calculatedPrices)
                },
                pricing_strategy_used: pricingStrategy,
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

// Helper functions remain the same...
function calculateIntelligentPrice(apiCard: any, strategy: string = 'AUTO'): number {
    let basePrice = 1.00;

    try {
        if (strategy === 'API_PRIORITY' || strategy === 'AUTO') {
            const apiPrice = PokemonTCGAPI.getMarketPrice(apiCard);
            if (apiPrice && apiPrice > 0) {
                return Math.round((apiPrice * PRICING_CONFIG.MARKETPLACE_MARKUP) * 100) / 100;
            }
        }

        const rarity = apiCard.rarity || 'Common';
        basePrice = PRICING_CONFIG.RARITY_BASE_PRICES[rarity as keyof typeof PRICING_CONFIG.RARITY_BASE_PRICES] || 1.00;

        const setYear = apiCard.set.releaseDate ? apiCard.set.releaseDate.substring(0, 4) : '2024';
        const ageMultiplier = PRICING_CONFIG.SET_AGE_MULTIPLIERS[setYear as keyof typeof PRICING_CONFIG.SET_AGE_MULTIPLIERS] || 1.0;
        basePrice *= ageMultiplier;

        const pokemonName = apiCard.name.split(' ')[0];
        const popularityMultiplier = PRICING_CONFIG.POPULAR_POKEMON_MULTIPLIERS[pokemonName as keyof typeof PRICING_CONFIG.POPULAR_POKEMON_MULTIPLIERS] || 1.0;
        basePrice *= popularityMultiplier;

        if (apiCard.rarity?.toLowerCase().includes('holo')) {
            basePrice *= 1.8;
        }

        if (apiCard.rarity?.toLowerCase().includes('secret')) {
            basePrice *= 2.0;
        }

        if (apiCard.rarity?.toLowerCase().includes('rainbow')) {
            basePrice *= 1.5;
        }

        basePrice *= PRICING_CONFIG.MARKETPLACE_MARKUP;
        return Math.max(0.25, Math.round(basePrice * 100) / 100);

    } catch (error) {
        console.error('Error calculating price for card:', apiCard.name, error);
        return 1.00;
    }
}

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
            console.log(`Created new rarity: ${rarity.name}`);
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
            console.log(`Created new supertype: ${supertype.name}`);
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
            console.log(`Created new subtype: ${subtype.name} (${category})`);
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
    calculatedPrice: number;
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

        // Market data - ENHANCED WITH CALCULATED PRICE
        tcgplayer_prices: safeJsonField(apiCard.tcgplayer),
        cardmarket_prices: safeJsonField(apiCard.cardmarket),
        market_price: foreignKeys.calculatedPrice,
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