// // src/app/api/bids/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { getServerSession } from 'next-auth';
// import { prisma } from '../../lib/prisma';

// // GET /api/bids - Get user's bids or bids on user's cards
// export async function GET(request: NextRequest) {
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

//         const { searchParams } = new URL(request.url);
//         const type = searchParams.get('type') || 'my_bids'; // 'my_bids' or 'on_my_cards'
//         const page = parseInt(searchParams.get('page') || '1');
//         const limit = parseInt(searchParams.get('limit') || '20');

//         const skip = (page - 1) * limit;

//         let bids;
//         let totalCount;

//         if (type === 'my_bids') {
//             // Get bids placed by this user
//             [bids, totalCount] = await Promise.all([
//                 prisma.bid.findMany({
//                     where: {
//                         bidder_id: user.id,
//                         is_active: true
//                     },
//                     skip,
//                     take: limit,
//                     orderBy: { created_at: 'desc' },
//                     include: {
//                         userCard: {
//                             include: {
//                                 card: true,
//                                 owner: {
//                                     select: { id: true, name: true }
//                                 }
//                             }
//                         }
//                     }
//                 }),
//                 prisma.bid.count({
//                     where: {
//                         bidder_id: user.id,
//                         is_active: true
//                     }
//                 })
//             ]);
//         } else {
//             // Get bids on this user's cards
//             [bids, totalCount] = await Promise.all([
//                 prisma.bid.findMany({
//                     where: {
//                         userCard: {
//                             owner_id: user.id
//                         },
//                         is_active: true
//                     },
//                     skip,
//                     take: limit,
//                     orderBy: { created_at: 'desc' },
//                     include: {
//                         bidder: {
//                             select: { id: true, name: true }
//                         },
//                         userCard: {
//                             include: {
//                                 card: true
//                             }
//                         }
//                     }
//                 }),
//                 prisma.bid.count({
//                     where: {
//                         userCard: {
//                             owner_id: user.id
//                         },
//                         is_active: true
//                     }
//                 })
//             ]);
//         }

//         return NextResponse.json({
//             bids,
//             pagination: {
//                 page,
//                 limit,
//                 total: totalCount,
//                 totalPages: Math.ceil(totalCount / limit)
//             }
//         });

//     } catch (error) {
//         console.error('Error fetching bids:', error);
//         return NextResponse.json(
//             { error: 'Failed to fetch bids' },
//             { status: 500 }
//         );
//     }
// }

// // POST /api/bids - Place a new bid
// export async function POST(request: NextRequest) {
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

//         const body = await request.json();
//         const { user_card_id, amount } = body;

//         if (!user_card_id || !amount) {
//             return NextResponse.json(
//                 { error: 'user_card_id and amount are required' },
//                 { status: 400 }
//             );
//         }

//         const bidAmount = parseFloat(amount);
//         if (bidAmount <= 0) {
//             return NextResponse.json(
//                 { error: 'Bid amount must be greater than 0' },
//                 { status: 400 }
//             );
//         }

//         // Get the card being bid on
//         const userCard = await prisma.userCard.findUnique({
//             where: { id: user_card_id },
//             include: {
//                 owner: true,
//                 bids: {
//                     where: { is_active: true },
//                     orderBy: { amount: 'desc' },
//                     take: 1
//                 }
//             }
//         });

//         if (!userCard) {
//             return NextResponse.json(
//                 { error: 'Card not found' },
//                 { status: 404 }
//             );
//         }

//         // Validation checks
//         if (userCard.owner_id === user.id) {
//             return NextResponse.json(
//                 { error: 'Cannot bid on your own card' },
//                 { status: 400 }
//             );
//         }

//         if (!userCard.is_for_sale || userCard.sale_type !== 'AUCTION') {
//             return NextResponse.json(
//                 { error: 'Card is not available for auction' },
//                 { status: 400 }
//             );
//         }

//         if (userCard.is_sold) {
//             return NextResponse.json(
//                 { error: 'Card has already been sold' },
//                 { status: 400 }
//             );
//         }

//         if (userCard.auction_end && new Date() > userCard.auction_end) {
//             return NextResponse.json(
//                 { error: 'Auction has ended' },
//                 { status: 400 }
//             );
//         }

//         // Check minimum bid requirements
//         const currentHighestBid = userCard.bids[0];
//         const minimumBid = currentHighestBid
//             ? parseFloat(currentHighestBid.amount.toString()) + 0.50 // Minimum increment of $0.50
//             : (userCard.reserve_price ? parseFloat(userCard.reserve_price.toString()) : 0.01);

//         if (bidAmount < minimumBid) {
//             return NextResponse.json(
//                 {
//                     error: `Bid must be at least $${minimumBid.toFixed(2)}`,
//                     minimum_bid: minimumBid
//                 },
//                 { status: 400 }
//             );
//         }

//         // Check if user already has an active bid on this card
//         const existingBid = await prisma.bid.findFirst({
//             where: {
//                 user_card_id,
//                 bidder_id: user.id,
//                 is_active: true
//             }
//         });

//         // Create the transaction
//         const result = await prisma.$transaction(async (tx) => {
//             // Deactivate user's previous bid on this card if exists
//             if (existingBid) {
//                 await tx.bid.update({
//                     where: { id: existingBid.id },
//                     data: { is_active: false }
//                 });
//             }

//             // Create new bid
//             const newBid = await tx.bid.create({
//                 data: {
//                     user_card_id,
//                     bidder_id: user.id,
//                     amount: bidAmount
//                 },
//                 include: {
//                     bidder: {
//                         select: { id: true, name: true }
//                     },
//                     userCard: {
//                         include: {
//                             card: true,
//                             owner: {
//                                 select: { id: true, name: true }
//                             }
//                         }
//                     }
//                 }
//             });

//             return newBid;
//         });

//         return NextResponse.json(result, { status: 201 });

//     } catch (error) {
//         console.error('Error placing bid:', error);
//         return NextResponse.json(
//             { error: 'Failed to place bid' },
//             { status: 500 }
//         );
//     }
// }

// src/app/api/bids/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../lib/prisma';

// POST /api/bids - Place a bid on an auction
export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const { user_card_id, amount } = body;

        if (!user_card_id || !amount) {
            return NextResponse.json(
                { error: 'user_card_id and amount are required' },
                { status: 400 }
            );
        }

        const bidAmount = parseFloat(amount);
        if (bidAmount <= 0) {
            return NextResponse.json(
                { error: 'Bid amount must be positive' },
                { status: 400 }
            );
        }

        // Get the card being bid on
        const userCard = await prisma.userCard.findUnique({
            where: { id: user_card_id },
            include: {
                card: true,
                owner: { select: { id: true, name: true } },
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' },
                    take: 1
                }
            }
        });

        if (!userCard) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        // Validation checks
        if (userCard.owner_id === user.id) {
            return NextResponse.json(
                { error: 'Cannot bid on your own card' },
                { status: 400 }
            );
        }

        if (!userCard.is_for_sale || userCard.sale_type !== 'AUCTION') {
            return NextResponse.json(
                { error: 'Card is not available for auction' },
                { status: 400 }
            );
        }

        if (userCard.is_sold) {
            return NextResponse.json(
                { error: 'Card has already been sold' },
                { status: 400 }
            );
        }

        // Check if auction is still active
        const currentTime = new Date();
        if (!userCard.auction_end || userCard.auction_end <= currentTime) {
            return NextResponse.json(
                { error: 'Auction has ended' },
                { status: 400 }
            );
        }

        // Check bid amount constraints
        const reservePrice = Number(userCard.reserve_price) || 0;
        const currentHighestBid = userCard.bids.length > 0 ? Number(userCard.bids[0].amount) : 0;
        const minimumBid = Math.max(reservePrice, currentHighestBid + 0.01); // At least $0.01 higher

        if (bidAmount < minimumBid) {
            return NextResponse.json(
                {
                    error: `Bid must be at least $${minimumBid.toFixed(2)}`,
                    minimum_bid: minimumBid
                },
                { status: 400 }
            );
        }

        // Check if user already has an active bid (update or create new)
        const existingBid = await prisma.bid.findFirst({
            where: {
                user_card_id,
                bidder_id: user.id,
                is_active: true
            }
        });

        let bid;
        if (existingBid) {
            // Update existing bid
            bid = await prisma.bid.update({
                where: { id: existingBid.id },
                data: {
                    amount: bidAmount,
                    created_at: new Date() // Update timestamp
                },
                include: {
                    bidder: { select: { id: true, name: true } },
                    userCard: {
                        include: {
                            card: true,
                            owner: { select: { id: true, name: true } }
                        }
                    }
                }
            });
        } else {
            // Create new bid
            bid = await prisma.bid.create({
                data: {
                    user_card_id,
                    bidder_id: user.id,
                    amount: bidAmount
                },
                include: {
                    bidder: { select: { id: true, name: true } },
                    userCard: {
                        include: {
                            card: true,
                            owner: { select: { id: true, name: true } }
                        }
                    }
                }
            });
        }

        // Auto-extend auction if bid placed in last 5 minutes
        const timeUntilEnd = userCard.auction_end.getTime() - currentTime.getTime();
        const fiveMinutesMs = 5 * 60 * 1000;

        if (timeUntilEnd <= fiveMinutesMs) {
            const newEndTime = new Date(currentTime.getTime() + fiveMinutesMs);
            await prisma.userCard.update({
                where: { id: user_card_id },
                data: { auction_end: newEndTime }
            });
        }

        // Create history entry
        await prisma.cardHistory.create({
            data: {
                user_card_id,
                from_user_id: user.id,
                to_user_id: userCard.owner_id,
                transaction_type: 'BID',
                price: bidAmount,
                notes: `Bid placed: $${bidAmount.toFixed(2)}`
            }
        });

        return NextResponse.json({
            bid,
            message: 'Bid placed successfully',
            auction_extended: timeUntilEnd <= fiveMinutesMs
        }, { status: 201 });

    } catch (error) {
        console.error('Error placing bid:', error);
        return NextResponse.json(
            {
                error: 'Failed to place bid',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// GET /api/bids - Get user's bidding history
export async function GET(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const active = searchParams.get('active') === 'true';

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {
            bidder_id: user.id
        };

        if (active) {
            where.is_active = true;
            where.userCard = {
                auction_end: { gt: new Date() },
                is_sold: false
            };
        }

        // Get user's bids
        const [bids, totalCount] = await Promise.all([
            prisma.bid.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    userCard: {
                        include: {
                            card: true,
                            owner: { select: { id: true, name: true } },
                            bids: {
                                where: { is_active: true },
                                orderBy: { amount: 'desc' },
                                take: 1
                            }
                        }
                    }
                }
            }),
            prisma.bid.count({ where })
        ]);

        // Add status information to each bid
        const bidsWithStatus = bids.map(bid => {
            const userCard = bid.userCard;
            const isAuctionActive = userCard.auction_end && userCard.auction_end > new Date();
            const isHighestBid = userCard.bids.length > 0 && userCard.bids[0].amount === bid.amount;
            const auctionEnded = userCard.auction_end && userCard.auction_end <= new Date();

            let status = 'ACTIVE';
            if (!bid.is_active) status = 'CANCELLED';
            else if (auctionEnded && isHighestBid) status = 'WON';
            else if (auctionEnded && !isHighestBid) status = 'LOST';
            else if (!isHighestBid) status = 'OUTBID';

            return {
                ...bid,
                status,
                is_highest_bid: isHighestBid,
                is_auction_active: isAuctionActive,
                time_left_ms: isAuctionActive ? userCard.auction_end!.getTime() - new Date().getTime() : 0
            };
        });

        return NextResponse.json({
            bids: bidsWithStatus,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching bids:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch bids',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}