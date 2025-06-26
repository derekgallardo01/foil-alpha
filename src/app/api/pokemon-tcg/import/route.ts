// src/app/api/pokemon-tcg/import/route.ts - Enhanced version
import { NextRequest, NextResponse } from 'next/server';
import { pokemonTCGAPI, PokemonTCGAPI } from '../../../lib/pokemon-tcg-api';
import { prisma } from '../../../lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cardIds, setId } = body;

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
        };

        let cardsToImport: any[] = [];

        if (setId) {
            // Import entire set
            console.log(`Importing entire set: ${setId}`);

            // First, ensure the set exists in our database
            const setInfo = await pokemonTCGAPI.getSet(setId);
            await ensureSetExists(setInfo, results);

            // Get all cards from the set (handles pagination automatically)
            const setCards = await pokemonTCGAPI.getAllCardsFromSet(setId);
            cardsToImport = setCards;

            console.log(`Found ${cardsToImport.length} cards in set ${setId}`);
        } else {
            // Import specific cards
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

        // Process each card
        for (const apiCard of cardsToImport) {
            try {
                // Ensure all related data exists first
                await ensureSetExists(apiCard.set, results);
                const rarityId = await ensureRarityExists(apiCard.rarity, results);
                const supertypeId = await ensureSupertypeExists(apiCard.supertype, results);
                const subtypeId = apiCard.subtypes?.[0] ? await ensureSubtypeExists(apiCard.subtypes[0], apiCard.supertype, results) : null;

                // Convert API card to our database format with foreign keys
                const dbCardData = convertApiCardToDbCardEnhanced(apiCard, {
                    setId: apiCard.set.id,
                    rarityId,
                    supertypeId,
                    subtypeId,
                });

                // Check if card already exists by API ID
                const existingCard = await prisma.card.findFirst({
                    where: { api_id: apiCard.id }
                });

                if (existingCard) {
                    // Update existing card
                    const updatedCard = await prisma.card.update({
                        where: { id: existingCard.id },
                        data: {
                            ...dbCardData,
                            source: existingCard.source === 'MANUAL' ? 'MIXED' : 'API',
                        },
                        include: {
                            pokemonSet: true,
                            rarity_ref: true,
                            subtype_ref: true,
                            supertype_ref: true,
                        }
                    });
                    results.updated.push(updatedCard);
                } else {
                    // Create new card
                    const newCard = await prisma.card.create({
                        data: dbCardData,
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

// Helper function to ensure set exists in database
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

// Helper function to ensure rarity exists in database
async function ensureRarityExists(rarityName: string, results: any): Promise<number | null> {
    if (!rarityName) return null;

    try {
        let rarity = await prisma.rarity.findUnique({
            where: { name: rarityName }
        });

        if (!rarity) {
            // Auto-assign order based on common rarity hierarchy
            const rarityOrder: { [key: string]: number } = {
                'Common': 1,
                'Uncommon': 2,
                'Rare': 3,
                'Holo Rare': 4,
                'Ultra Rare': 5,
                'Secret Rare': 6,
                'Rainbow Rare': 7,
                'Gold Rare': 8,
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

// Helper function to ensure supertype exists in database
async function ensureSupertypeExists(supertypeName: string, results: any): Promise<number | null> {
    if (!supertypeName) return null;

    try {
        let supertype = await prisma.supertype.findUnique({
            where: { name: supertypeName }
        });

        if (!supertype) {
            const supertypeOrder: { [key: string]: number } = {
                'Pokémon': 1,
                'Trainer': 2,
                'Energy': 3,
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

// Helper function to ensure subtype exists in database
async function ensureSubtypeExists(subtypeName: string, supertypeName: string, results: any): Promise<number | null> {
    if (!subtypeName) return null;

    try {
        let subtype = await prisma.subtype.findUnique({
            where: { name: subtypeName }
        });

        if (!subtype) {
            // Determine category based on supertype
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

// Enhanced conversion function with foreign key support
function convertApiCardToDbCardEnhanced(apiCard: any, foreignKeys: {
    setId: string;
    rarityId: number | null;
    supertypeId: number | null;
    subtypeId: number | null;
}) {
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

    // Helper function to safely handle JSON fields
    const safeJsonField = (value: any) => {
        if (value === null || value === undefined) {
            return undefined;
        }
        return value;
    };

    // Get market price
    const getMarketPrice = (): number | null => {
        if (apiCard.tcgplayer?.prices) {
            const prices = apiCard.tcgplayer.prices;
            if (prices.holofoil?.market) return prices.holofoil.market;
            if (prices.normal?.market) return prices.normal.market;
            if (prices.reverseHolofoil?.market) return prices.reverseHolofoil.market;
        }
        return null;
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

        // Market data
        tcgplayer_prices: safeJsonField(apiCard.tcgplayer),
        cardmarket_prices: safeJsonField(apiCard.cardmarket),
        market_price: getMarketPrice(),
        legalities: safeJsonField(apiCard.legalities),

        // Rarity flags
        holographic: apiCard.rarity?.toLowerCase().includes('holo') || false,
        reverse_holo: apiCard.rarity?.toLowerCase().includes('reverse') || false,
        secret_rare: apiCard.rarity?.toLowerCase().includes('secret') || false,

        // Source and sync info
        source: 'API' as const,
        api_updated_at: new Date(),
        last_sync: new Date(),
    };
}