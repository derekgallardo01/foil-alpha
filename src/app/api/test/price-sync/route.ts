import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        // Test with a small batch of cards
        const testCards = await prisma.card.findMany({
            where: {
                api_id: { not: null },
                sync_enabled: true
            },
            take: 5 // Just test with 5 cards
        });

        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cards/sync-prices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cardIds: testCards.map((c: { id: any; }) => c.id),
                force: true,
                priceChangeThreshold: 1 // Lower threshold for testing
            })
        });

        const result = await response.json();

        return NextResponse.json({
            success: true,
            message: 'Test sync completed',
            testedCards: testCards.length,
            result
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: 'Test sync failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}