// src/app/api/pokemon-tcg/sets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pokemonTCGAPI } from '../../../lib/pokemon-tcg-api';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '20');

        console.log('Fetching Pokemon TCG sets:', { page, pageSize });

        const results = await pokemonTCGAPI.getSets(page, pageSize);

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
        console.error('Error fetching Pokemon TCG sets:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch Pokemon TCG sets',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}