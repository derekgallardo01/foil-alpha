// src/app/api/pokemon-tcg/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pokemonTCGAPI } from '../../../lib/pokemon-tcg-api';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const searchOptions = {
            name: searchParams.get('name') || undefined,
            set: searchParams.get('set') || undefined,
            types: searchParams.get('types') || undefined,
            rarity: searchParams.get('rarity') || undefined,
            page: parseInt(searchParams.get('page') || '1'),
            pageSize: parseInt(searchParams.get('pageSize') || '20'),
        };

        console.log('Searching Pokemon TCG API with options:', searchOptions);

        const results = await pokemonTCGAPI.searchCards(searchOptions);

        return NextResponse.json({
            success: true,
            data: results.data,
            pagination: {
                page: results.page,
                pageSize: results.pageSize,
                count: results.count,
                totalCount: results.totalCount,
                totalPages: Math.ceil(results.totalCount / results.pageSize),
            },
        });
    } catch (error) {
        console.error('Error searching Pokemon TCG API:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to search Pokemon TCG API',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}