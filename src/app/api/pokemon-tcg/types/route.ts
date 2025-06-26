// src/app/api/pokemon-tcg/types/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pokemonTCGAPI } from '../../../lib/pokemon-tcg-api';

export async function GET(request: NextRequest) {
    try {
        const [types, rarities] = await Promise.all([
            pokemonTCGAPI.getTypes(),
            pokemonTCGAPI.getRarities(),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                types,
                rarities,
            },
        });
    } catch (error) {
        console.error('Error fetching Pokemon TCG types/rarities:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch Pokemon TCG types and rarities',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// Also support POST for compatibility
export async function POST(request: NextRequest) {
    return GET(request);
}