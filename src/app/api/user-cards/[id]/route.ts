// src/app/api/user-cards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../../lib/prisma';

// GET /api/user-cards/[id] - Get specific user card details
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const userCardId = parseInt(params.id);

        const userCard = await prisma.userCard.findUnique({
            where: { id: userCardId },
            include: {
                card: true,
                owner: {
                    select: { id: true, name: true, email: true }
                },
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' },
                    include: {
                        bidder: {
                            select: { id: true, name: true }
                        }
                    }
                },
                cardHistory: {
                    orderBy: { created_at: 'desc' },
                    include: {
                        fromUser: {
                            select: { id: true, name: true }
                        },
                        toUser: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        if (!userCard) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(userCard);

    } catch (error) {
        console.error('Error fetching user card:', error);
        return NextResponse.json(
            { error: 'Failed to fetch card details' },
            { status: 500 }
        );
    }
}

// PUT /api/user-cards/[id] - Update user card (set for sale, pricing, etc.)
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const userCardId = parseInt(params.id);
        const body = await request.json();

        // Verify user owns this card
        const userCard = await prisma.userCard.findUnique({
            where: { id: userCardId }
        });

        if (!userCard) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        if (userCard.owner_id !== user.id) {
            return NextResponse.json(
                { error: 'Not authorized to modify this card' },
                { status: 403 }
            );
        }

        const {
            is_for_sale,
            sale_type,
            fixed_price,
            reserve_price,
            auction_duration_hours,
            notes
        } = body;

        // Prepare update data
        const updateData: any = {};

        if (typeof is_for_sale === 'boolean') {
            updateData.is_for_sale = is_for_sale;

            if (!is_for_sale) {
                // If removing from sale, clear sale-related fields
                updateData.sale_type = null;
                updateData.fixed_price = null;
                updateData.reserve_price = null;
                updateData.auction_end = null;
            }
        }

        if (sale_type) {
            updateData.sale_type = sale_type;

            if (sale_type === 'FIXED' && fixed_price) {
                updateData.fixed_price = parseFloat(fixed_price);
                updateData.reserve_price = null;
                updateData.auction_end = null;
            } else if (sale_type === 'AUCTION') {
                updateData.fixed_price = null;
                if (reserve_price) {
                    updateData.reserve_price = parseFloat(reserve_price);
                }
                if (auction_duration_hours) {
                    const auctionEnd = new Date();
                    auctionEnd.setHours(auctionEnd.getHours() + parseInt(auction_duration_hours));
                    updateData.auction_end = auctionEnd;
                }
            }
        }

        if (notes !== undefined) {
            updateData.notes = notes;
        }

        // Update the card
        const updatedCard = await prisma.userCard.update({
            where: { id: userCardId },
            data: updateData,
            include: {
                card: true,
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' }
                }
            }
        });

        return NextResponse.json(updatedCard);

    } catch (error) {
        console.error('Error updating user card:', error);
        return NextResponse.json(
            { error: 'Failed to update card' },
            { status: 500 }
        );
    }
}

// DELETE /api/user-cards/[id] - Remove card from collection (admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const userCardId = parseInt(params.id);

        await prisma.userCard.delete({
            where: { id: userCardId }
        });

        return NextResponse.json({ message: 'Card removed successfully' });

    } catch (error) {
        console.error('Error deleting user card:', error);
        return NextResponse.json(
            { error: 'Failed to delete card' },
            { status: 500 }
        );
    }
}