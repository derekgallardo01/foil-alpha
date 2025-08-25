// src/app/api/pokemon-tcg/import/route.ts - FIXED VERSION

import { NextRequest, NextResponse } from 'next/server';
import { pokemonTCGAPI, PokemonTCGAPI } from '../../../lib/pokemon-tcg-api';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';
import { prisma } from '../../../lib/prisma';
import { CardSource } from '@prisma/client';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { cardIds, setId, fullImport = false } = body;

        if (!cardIds && !setId && !fullImport) {
            return NextResponse.json(
                { success: false, error: 'Either cardIds, setId, or fullImport must be provided' },
                { status: 400 }
            );
        }

        const results = {
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: [] as any[],
            sets_processed: 0,
            total_api_cards: 0,
        };

        let cardsToProcess: any[] = [];

        if (fullImport) {
            // Import ALL Pokemon cards (handles pagination automatically)
            console.log('🚀 Starting FULL import of all Pokemon cards...');
            cardsToProcess = await getAllPokemonCards();
        } else if (setId) {
            console.log(`📦 Importing set: ${setId}`);
            const setCards = await pokemonTCGAPI.getAllCardsFromSet(setId);
            cardsToProcess = setCards;
        } else if (cardIds) {
            console.log(`🎴 Importing specific cards: ${cardIds.length}`);
            for (const cardId of cardIds) {
                try {
                    const card = await pokemonTCGAPI.getCard(cardId);
                    cardsToProcess.push(card);
                } catch (error) {
                    results.errors.push({
                        cardId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }

        results.total_api_cards = cardsToProcess.length;
        console.log(`📊 Total cards to process: ${results.total_api_cards}`);

        // Get all existing cards to check for duplicates efficiently
        const existingCards = await prisma.card.findMany({
            where: { api_id: { not: null } },
            select: { api_id: true, id: true, last_price_update: true }
        });

        const existingApiIds = new Set(existingCards.map(card => card.api_id));
        console.log(`📋 Found ${existingApiIds.size} existing cards in database`);

        // Process cards in batches to avoid memory issues
        const batchSize = 100;
        let processedCount = 0;

        async function ensureSetExists(setData: any) {
            const existingSet = await prisma.pokemonSet.findUnique({
                where: { id: setData.id }
            });

            if (!existingSet) {
                await prisma.pokemonSet.create({
                    data: {
                        id: setData.id,
                        name: setData.name,
                        series: setData.series,
                        printed_total: setData.printedTotal || null,
                        total: setData.total || null,
                        ptcgo_code: setData.ptcgoCode || null,
                        release_date: setData.releaseDate,
                        images: setData.images || null,
                        api_updated_at: new Date(),
                    }
                });
            }
        }

        async function ensureRarityExists(rarityName: string): Promise<number | null> {
            if (!rarityName) return null;

            let rarity = await prisma.rarity.findUnique({
                where: { name: rarityName }
            });

            if (!rarity) {
                rarity = await prisma.rarity.create({
                    data: {
                        name: rarityName,
                        order_index: getRarityOrder(rarityName),
                    }
                });
            }

            return rarity.id;
        }

        async function ensureSupertypeExists(supertypeName: string): Promise<number | null> {
            if (!supertypeName) return null;

            let supertype = await prisma.supertype.findUnique({
                where: { name: supertypeName }
            });

            if (!supertype) {
                supertype = await prisma.supertype.create({
                    data: {
                        name: supertypeName,
                        order_index: getSupertypeOrder(supertypeName),
                    }
                });
            }

            return supertype.id;
        }

        async function ensureSubtypeExists(subtypeName: string, supertypeName: string): Promise<number | null> {
            if (!subtypeName) return null;

            let subtype = await prisma.subtype.findUnique({
                where: { name: subtypeName }
            });

            if (!subtype) {
                subtype = await prisma.subtype.create({
                    data: {
                        name: subtypeName,
                        category: mapSupertypeToCategory(supertypeName),
                    }
                });
            }

            return subtype.id;
        }

        function convertApiCardToDbCardEnhanced(apiCard: any, foreignKeys: any) {
            const parseHP = (hp?: string): number | null => {
                if (!hp) return null;
                const numericHP = parseInt(hp.replace(/\D/g, ''));
                return isNaN(numericHP) ? null : numericHP;
            };

            return {
                name: apiCard.name,
                set_name: apiCard.set.name,
                set_number: apiCard.number || null,
                rarity: apiCard.rarity,
                card_type: apiCard.supertype || 'Unknown',
                subtype: apiCard.subtypes?.[0] || null,
                hp: parseHP(apiCard.hp),
                image_url: apiCard.images.large,
                small_image_url: apiCard.images.small,
                api_id: apiCard.id,
                supertype: apiCard.supertype,
                subtypes: apiCard.subtypes || null,
                types: apiCard.types || null,
                evolves_from: apiCard.evolvesFrom || null,
                artist: apiCard.artist || null,
                flavor_text: apiCard.flavorText || null,
                national_pokedex_numbers: apiCard.nationalPokedexNumbers || null,
                set_id: foreignKeys.setId,
                rarity_id: foreignKeys.rarityId,
                subtype_id: foreignKeys.subtypeId,
                supertype_id: foreignKeys.supertypeId,
                market_price: foreignKeys.marketPrice,
                last_price_update: new Date(),
                tcgplayer_prices: apiCard.tcgplayer || null,
                cardmarket_prices: apiCard.cardmarket || null,
                legalities: apiCard.legalities || null,
                api_updated_at: new Date(),
                last_sync: new Date(),
            };
        }

        function calculateFallbackPrice(apiCard: any): number {
            const rarityPrices: { [key: string]: number } = {
                'Common': 0.25,
                'Uncommon': 0.75,
                'Rare': 3.00,
                'Holo Rare': 8.00,
                'Ultra Rare': 25.00,
                'Secret Rare': 45.00,
            };

            return rarityPrices[apiCard.rarity] || 1.00;
        }

        function getRarityOrder(rarity: string): number {
            const rarityOrder: { [key: string]: number } = {
                'Common': 1,
                'Uncommon': 2,
                'Rare': 3,
                'Holo Rare': 4,
                'Ultra Rare': 5,
                'Secret Rare': 6,
                'Rainbow Rare': 7,
            };
            return rarityOrder[rarity] || 999;
        }

        function getSupertypeOrder(supertype: string): number {
            const supertypeOrder: { [key: string]: number } = {
                'Pokémon': 1,
                'Trainer': 2,
                'Energy': 3,
            };
            return supertypeOrder[supertype] || 999;
        }

        function mapSupertypeToCategory(supertype: string): string {
            const categoryMap: { [key: string]: string } = {
                'Pokémon': 'Pokemon',
                'Trainer': 'Trainer',
                'Energy': 'Energy',
            };
            return categoryMap[supertype] || 'Unknown';
        }

        for (let i = 0; i < cardsToProcess.length; i += batchSize) {
            const batch = cardsToProcess.slice(i, i + batchSize);
            console.log(`⚡ Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardsToProcess.length / batchSize)}`);

            for (const apiCard of batch) {
                try {
                    // Check if card already exists - FIXED DUPLICATE CHECK
                    if (existingApiIds.has(apiCard.id)) {
                        console.log(`⏭️  Skipping existing card: ${apiCard.name} (${apiCard.id})`);
                        results.skipped++;
                        continue;
                    }

                    // Ensure all related data exists
                    await ensureSetExists(apiCard.set);
                    const rarityId = await ensureRarityExists(apiCard.rarity);
                    const supertypeId = await ensureSupertypeExists(apiCard.supertype);
                    const subtypeId = apiCard.subtypes?.[0] ? await ensureSubtypeExists(apiCard.subtypes[0], apiCard.supertype) : null;

                    // Get market price
                    let marketPrice = PokemonTCGAPI.getMarketPrice(apiCard);
                    if (!marketPrice || marketPrice <= 0) {
                        marketPrice = calculateFallbackPrice(apiCard);
                    }

                    // Convert and create new card - NO DUPLICATES
                    const dbCardData = convertApiCardToDbCardEnhanced(apiCard, {
                        setId: apiCard.set.id,
                        rarityId,
                        supertypeId,
                        subtypeId,
                        marketPrice,
                        pricingSource: 'api'
                    });

                    await prisma.card.create({
                        data: {
                            ...dbCardData,
                            source: CardSource.API,
                        }
                    });

                    // Add to existing set to prevent future duplicates
                    existingApiIds.add(apiCard.id);
                    results.imported++;

                    console.log(`✅ Imported: ${apiCard.name} ($${marketPrice?.toFixed(2)})`);

                } catch (error) {
                    console.error(`❌ Error processing card ${apiCard.id}:`, error);
                    results.errors.push({
                        cardId: apiCard.id,
                        cardName: apiCard.name,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }

                processedCount++;
                if (processedCount % 50 === 0) {
                    console.log(`📈 Progress: ${processedCount}/${results.total_api_cards} (${((processedCount / results.total_api_cards) * 100).toFixed(1)}%)`);
                }
            }

            // Small delay between batches to avoid overwhelming the database
            if (i + batchSize < cardsToProcess.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log('🎉 Import completed!', results);

        return NextResponse.json({
            success: true,
            message: `Import completed: ${results.imported} new cards imported, ${results.skipped} duplicates skipped, ${results.errors.length} errors`,
            results
        });

    } catch (error) {
        console.error('💥 Error in card import:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to import cards',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// Helper function to get ALL Pokemon cards with proper pagination
async function getAllPokemonCards(): Promise<any[]> {
    const allCards: any[] = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 250; // Max allowed by API

    console.log('🔄 Fetching all Pokemon cards from API...');

    while (hasMore) {
        try {
            const response = await pokemonTCGAPI.searchCards({
                page,
                pageSize,
                orderBy: 'set.releaseDate,number'
            });

            allCards.push(...response.data);
            console.log(`📄 Page ${page}: ${response.data.length} cards (Total so far: ${allCards.length})`);

            // Check if we have more pages
            hasMore = response.data.length === pageSize && allCards.length < response.totalCount;
            page++;

            // Safety limit to prevent infinite loops
            if (page > 500) {
                console.warn('⚠️  Reached maximum page limit (500), stopping import');
                break;
            }

            // Rate limiting: wait between pages
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }

        } catch (error) {
            console.error(`❌ Error fetching page ${page}:`, error);

            // If it's a rate limit error, wait longer and retry
            if (error instanceof Error && error.message.includes('429')) {
                console.log('⏳ Rate limited, waiting 10 seconds...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue; // Retry same page
            }

            // For other errors, stop the import
            console.error('🛑 Stopping import due to error');
            break;
        }
    }

    console.log(`✅ Fetched ${allCards.length} total cards from Pokemon TCG API`);
    return allCards;
}