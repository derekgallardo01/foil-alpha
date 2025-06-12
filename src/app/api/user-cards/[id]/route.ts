// // src/app/api/user-cards/[id]/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { getServerSession } from 'next-auth';
// import { prisma } from '../../../lib/prisma';

// // GET /api/user-cards/[id] - Get specific user card details
// export async function GET(
//     request: NextRequest,
//     { params }: { params: { id: string } }
// ) {
//     try {
//         const userCardId = parseInt(params.id);

//         const userCard = await prisma.userCard.findUnique({
//             where: { id: userCardId },
//             include: {
//                 card: true,
//                 owner: {
//                     select: { id: true, name: true, email: true }
//                 },
//                 bids: {
//                     where: { is_active: true },
//                     orderBy: { amount: 'desc' },
//                     include: {
//                         bidder: {
//                             select: { id: true, name: true }
//                         }
//                     }
//                 },
//                 cardHistory: {
//                     orderBy: { created_at: 'desc' },
//                     include: {
//                         fromUser: {
//                             select: { id: true, name: true }
//                         },
//                         toUser: {
//                             select: { id: true, name: true }
//                         }
//                     }
//                 }
//             }
//         });

//         if (!userCard) {
//             return NextResponse.json(
//                 { error: 'Card not found' },
//                 { status: 404 }
//             );
//         }

//         return NextResponse.json(userCard);

//     } catch (error) {
//         console.error('Error fetching user card:', error);
//         return NextResponse.json(
//             { error: 'Failed to fetch card details' },
//             { status: 500 }
//         );
//     }
// }

// // PUT /api/user-cards/[id] - Update user card (set for sale, pricing, etc.)
// export async function PUT(
//     request: NextRequest,
//     { params }: { params: { id: string } }
// ) {
//     try {
//         const session = await getServerSession();

//         if (!session?.user?.email) {
//             return NextResponse.json(
//                 { error: 'Authentication required' },
//                 { status: 401 }
//             );
//         }

//         const user = await prisma.user.findUnique({
//             where: { email: session.user.email }
//         });

//         if (!user) {
//             return NextResponse.json(
//                 { error: 'User not found' },
//                 { status: 404 }
//             );
//         }

//         const userCardId = parseInt(params.id);
//         const body = await request.json();

//         // Verify user owns this card
//         const userCard = await prisma.userCard.findUnique({
//             where: { id: userCardId }
//         });

//         if (!userCard) {
//             return NextResponse.json(
//                 { error: 'Card not found' },
//                 { status: 404 }
//             );
//         }

//         if (userCard.owner_id !== user.id) {
//             return NextResponse.json(
//                 { error: 'Not authorized to modify this card' },
//                 { status: 403 }
//             );
//         }

//         const {
//             is_for_sale,
//             sale_type,
//             fixed_price,
//             reserve_price,
//             auction_duration_hours,
//             notes
//         } = body;

//         // Prepare update data
//         const updateData: any = {};

//         if (typeof is_for_sale === 'boolean') {
//             updateData.is_for_sale = is_for_sale;

//             if (!is_for_sale) {
//                 // If removing from sale, clear sale-related fields
//                 updateData.sale_type = null;
//                 updateData.fixed_price = null;
//                 updateData.reserve_price = null;
//                 updateData.auction_end = null;
//             }
//         }

//         if (sale_type) {
//             updateData.sale_type = sale_type;

//             if (sale_type === 'FIXED' && fixed_price) {
//                 updateData.fixed_price = parseFloat(fixed_price);
//                 updateData.reserve_price = null;
//                 updateData.auction_end = null;
//             } else if (sale_type === 'AUCTION') {
//                 updateData.fixed_price = null;
//                 if (reserve_price) {
//                     updateData.reserve_price = parseFloat(reserve_price);
//                 }
//                 if (auction_duration_hours) {
//                     const auctionEnd = new Date();
//                     auctionEnd.setHours(auctionEnd.getHours() + parseInt(auction_duration_hours));
//                     updateData.auction_end = auctionEnd;
//                 }
//             }
//         }

//         if (notes !== undefined) {
//             updateData.notes = notes;
//         }

//         // Update the card
//         const updatedCard = await prisma.userCard.update({
//             where: { id: userCardId },
//             data: updateData,
//             include: {
//                 card: true,
//                 bids: {
//                     where: { is_active: true },
//                     orderBy: { amount: 'desc' }
//                 }
//             }
//         });

//         return NextResponse.json(updatedCard);

//     } catch (error) {
//         console.error('Error updating user card:', error);
//         return NextResponse.json(
//             { error: 'Failed to update card' },
//             { status: 500 }
//         );
//     }
// }

// // DELETE /api/user-cards/[id] - Remove card from collection (admin only)
// export async function DELETE(
//     request: NextRequest,
//     { params }: { params: { id: string } }
// ) {
//     try {
//         const session = await getServerSession();

//         if (!session?.user?.email) {
//             return NextResponse.json(
//                 { error: 'Authentication required' },
//                 { status: 401 }
//             );
//         }

//         const user = await prisma.user.findUnique({
//             where: { email: session.user.email }
//         });

//         if (!user || user.role !== 'admin') {
//             return NextResponse.json(
//                 { error: 'Admin access required' },
//                 { status: 403 }
//             );
//         }

//         const userCardId = parseInt(params.id);

//         await prisma.userCard.delete({
//             where: { id: userCardId }
//         });

//         return NextResponse.json({ message: 'Card removed successfully' });

//     } catch (error) {
//         console.error('Error deleting user card:', error);
//         return NextResponse.json(
//             { error: 'Failed to delete card' },
//             { status: 500 }
//         );
//     }
// }

// src/app/api/user-cards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../../lib/prisma';

// PUT /api/user-cards/[id] - Update user's card (listing, condition, notes)
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

        // Get user
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
        const existingUserCard = await prisma.userCard.findFirst({
            where: {
                id: userCardId,
                owner_id: user.id
            }
        });

        if (!existingUserCard) {
            return NextResponse.json(
                { error: 'Card not found or not owned by user' },
                { status: 404 }
            );
        }

        // Prepare update data
        const updateData: any = {
            notes: body.notes,
            is_for_sale: body.is_for_sale,
            updated_at: new Date()
        };

        // If listing for sale, handle sale type and pricing
        if (body.is_for_sale) {
            updateData.sale_type = body.sale_type;

            if (body.sale_type === 'FIXED') {
                // Fixed price listing
                updateData.fixed_price = parseFloat(body.fixed_price);
                updateData.reserve_price = null;
                updateData.auction_end = null;
            } else if (body.sale_type === 'AUCTION') {
                // Auction listing
                const auctionDurationHours = parseInt(body.auction_duration_hours || '168'); // Default 7 days
                const auctionEnd = new Date();
                auctionEnd.setHours(auctionEnd.getHours() + auctionDurationHours);

                updateData.reserve_price = parseFloat(body.reserve_price);
                updateData.fixed_price = null;
                updateData.auction_end = auctionEnd;

                // Cancel any existing bids if re-listing
                await prisma.bid.updateMany({
                    where: {
                        user_card_id: userCardId,
                        is_active: true
                    },
                    data: {
                        is_active: false
                    }
                });
            }
        } else {
            // Not for sale - clear sale data
            updateData.sale_type = null;
            updateData.fixed_price = null;
            updateData.reserve_price = null;
            updateData.auction_end = null;

            // Cancel any active bids
            await prisma.bid.updateMany({
                where: {
                    user_card_id: userCardId,
                    is_active: true
                },
                data: {
                    is_active: false
                }
            });
        }

        // Update the card
        const updatedUserCard = await prisma.userCard.update({
            where: { id: userCardId },
            data: updateData,
            include: {
                card: true,
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' },
                    include: {
                        bidder: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        // Create history entry for significant changes
        if (body.is_for_sale && !existingUserCard.is_for_sale) {
            await prisma.cardHistory.create({
                data: {
                    user_card_id: userCardId,
                    to_user_id: user.id,
                    transaction_type: 'LISTING',
                    price: body.sale_type === 'FIXED' ? parseFloat(body.fixed_price) : parseFloat(body.reserve_price),
                    notes: `Listed for ${body.sale_type === 'FIXED' ? 'fixed price sale' : 'auction'}`
                }
            });
        } else if (!body.is_for_sale && existingUserCard.is_for_sale) {
            await prisma.cardHistory.create({
                data: {
                    user_card_id: userCardId,
                    to_user_id: user.id,
                    transaction_type: 'DELISTING',
                    notes: 'Removed from sale'
                }
            });
        }

        return NextResponse.json(updatedUserCard);

    } catch (error) {
        console.error('Error updating user card:', error);
        return NextResponse.json(
            {
                error: 'Failed to update card',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// DELETE /api/user-cards/[id] - Remove card from collection (admin only or special cases)
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

        // Get user
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

        // Verify user owns this card
        const userCard = await prisma.userCard.findFirst({
            where: {
                id: userCardId,
                owner_id: user.id
            }
        });

        if (!userCard) {
            return NextResponse.json(
                { error: 'Card not found or not owned by user' },
                { status: 404 }
            );
        }

        // Check if card has active bids
        const activeBids = await prisma.bid.count({
            where: {
                user_card_id: userCardId,
                is_active: true
            }
        });

        if (activeBids > 0) {
            return NextResponse.json(
                { error: 'Cannot delete card with active bids' },
                { status: 400 }
            );
        }

        // Perform deletion in transaction
        await prisma.$transaction(async (tx) => {
            // Deactivate any bids
            await tx.bid.updateMany({
                where: { user_card_id: userCardId },
                data: { is_active: false }
            });

            // Create deletion history
            await tx.cardHistory.create({
                data: {
                    user_card_id: userCardId,
                    to_user_id: user.id,
                    transaction_type: 'DELETION',
                    notes: 'Card removed from collection'
                }
            });

            // Delete the user card
            await tx.userCard.delete({
                where: { id: userCardId }
            });
        });

        return NextResponse.json({ message: 'Card removed from collection' });

    } catch (error) {
        console.error('Error deleting user card:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete card',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}