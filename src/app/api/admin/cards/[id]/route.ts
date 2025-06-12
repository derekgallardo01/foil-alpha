// src/app/api/admin/cards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
// import { getCurrentUser } from '../../../../lib/dev-auth';

// GET /api/admin/cards/[id] - Get specific card with admin details
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const cardId = parseInt(params.id);

        const card = await prisma.card.findUnique({
            where: { id: cardId },
            include: {
                userCards: {
                    include: {
                        owner: {
                            select: { id: true, name: true, email: true }
                        },
                        bids: {
                            where: { is_active: true },
                            include: {
                                bidder: {
                                    select: { id: true, name: true }
                                }
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        userCards: true
                    }
                }
            }
        });

        if (!card) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        // Add computed fields
        const cardWithStats = {
            ...card,
            totalOwned: card._count.userCards,
            forSaleCount: card.userCards.filter(uc => uc.is_for_sale && !uc.is_sold).length,
            soldCount: card.userCards.filter(uc => uc.is_sold).length,
            uniqueOwners: new Set(card.userCards.map(uc => uc.owner_id)).size
        };

        return NextResponse.json(cardWithStats);

    } catch (error) {
        console.error('Error fetching card:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch card',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// PUT /api/admin/cards/[id] - Update card
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }


        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const cardId = parseInt(params.id);
        const body = await request.json();

        const {
            name,
            set_name,
            set_number,
            rarity,
            card_type,
            subtype,
            hp,
            image_url,
            small_image_url,
            tcg_id
        } = body;

        // Validate required fields
        if (!name || !set_name || !set_number || !rarity || !card_type) {
            return NextResponse.json(
                { error: 'Missing required fields: name, set_name, set_number, rarity, card_type' },
                { status: 400 }
            );
        }

        // Check if card exists
        const existingCard = await prisma.card.findUnique({
            where: { id: cardId }
        });

        if (!existingCard) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        // Update card
        const updatedCard = await prisma.card.update({
            where: { id: cardId },
            data: {
                name,
                set_name,
                set_number,
                rarity,
                card_type,
                subtype,
                hp: hp ? parseInt(hp) : null,
                image_url,
                small_image_url,
                tcg_id
            },
            include: {
                _count: {
                    select: {
                        userCards: true
                    }
                }
            }
        });

        // Add computed fields
        const cardWithStats = {
            ...updatedCard,
            totalOwned: updatedCard._count.userCards,
            forSaleCount: 0,
            soldCount: 0,
            uniqueOwners: 0
        };

        return NextResponse.json(cardWithStats);

    } catch (error) {
        console.error('Error updating card:', error);
        return NextResponse.json(
            {
                error: 'Failed to update card',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/cards/[id] - Delete card
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }


        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const cardId = parseInt(params.id);

        // Check if card exists
        const existingCard = await prisma.card.findUnique({
            where: { id: cardId },
            include: {
                userCards: true
            }
        });

        if (!existingCard) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        // Check if card has user cards (might want to prevent deletion)
        if (existingCard.userCards.length > 0) {
            return NextResponse.json(
                {
                    error: 'Cannot delete card that is owned by users',
                    details: `This card is owned by ${existingCard.userCards.length} user(s)`
                },
                { status: 400 }
            );
        }

        // Delete card
        await prisma.card.delete({
            where: { id: cardId }
        });

        return NextResponse.json({ message: 'Card deleted successfully' });

    } catch (error) {
        console.error('Error deleting card:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete card',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}