// src/app/lib/notification.ts - Enhanced with seller name and card image data
import { prisma } from './prisma';

export interface CreateNotificationData {
    user_id: number;
    type: string;
    title: string;
    message: string;
    data?: any;
}

export async function createNotification(notificationData: CreateNotificationData) {
    try {
        const notification = await prisma.notification.create({
            data: {
                user_id: notificationData.user_id,
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message,
                data: notificationData.data,
                read: false
            }
        });
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

export async function createBidNotifications(
    sellerId: number,
    bidderId: number,
    cardName: string,
    bidAmount: number,
    bidId: number
) {
    const notifications = [];

    // Get bidder info for seller notification
    const bidder = await prisma.user.findUnique({
        where: { id: bidderId },
        select: { name: true }
    });

    // Notify seller of new bid
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'BID_RECEIVED',
            title: 'New Bid Received',
            message: `${bidder?.name || 'Someone'} placed a bid of $${bidAmount.toFixed(2)} on your ${cardName}`,
            data: {
                card_name: cardName,
                bid_amount: bidAmount,
                bidder_id: bidderId,
                bidder_name: bidder?.name,
                reference_id: bidId,
                reference_type: 'BID'
            }
        })
    );

    return Promise.all(notifications);
}

export async function createBidAcceptedNotifications(
    buyerId: number,
    sellerId: number,
    cardName: string,
    amount: number,
    transactionId: number
) {
    const notifications = [];

    // Get seller and card info for enhanced notification data
    const [seller, userCard] = await Promise.all([
        prisma.user.findUnique({
            where: { id: sellerId },
            select: { name: true }
        }),
        prisma.transaction.findUnique({
            where: { id: transactionId },
            select: { user_card_id: true }
        }).then(async (transaction) => {
            if (!transaction) return null;
            const userCard = await prisma.userCard.findUnique({
                where: { id: transaction.user_card_id }
            });
            if (!userCard) return null;
            return prisma.card.findUnique({
                where: { id: userCard.card_id },
                select: { image_url: true, small_image_url: true }
            });
        })
    ]);

    // Notify buyer that their bid was accepted - they need to confirm purchase
    notifications.push(
        createNotification({
            user_id: buyerId,
            type: 'BID_ACCEPTED',
            title: 'Bid Accepted - Confirm Purchase',
            message: `Your bid of $${amount.toFixed(2)} for ${cardName} was accepted! You have 24 hours to confirm your purchase.`,
            data: {
                card_name: cardName,
                card_image: userCard?.small_image_url || userCard?.image_url,
                amount,
                seller_name: seller?.name,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                action_required: true,
                reference_id: transactionId,
                reference_type: 'PENDING_PURCHASE'
            }
        })
    );

    return Promise.all(notifications);
}

export async function createAuctionWonNotifications(
    winnerId: number,
    sellerId: number,
    cardName: string,
    winningAmount: number,
    auctionId: number
) {
    const notifications = [];

    // Get seller and card info
    const [seller, userCard] = await Promise.all([
        prisma.user.findUnique({
            where: { id: sellerId },
            select: { name: true }
        }),
        prisma.userCard.findUnique({
            where: { id: auctionId }
        }).then(async (userCard) => {
            if (!userCard) return null;
            return prisma.card.findUnique({
                where: { id: userCard.card_id },
                select: { image_url: true, small_image_url: true }
            });
        })
    ]);

    // Notify winner - they need to confirm purchase within 24 hours
    notifications.push(
        createNotification({
            user_id: winnerId,
            type: 'AUCTION_WON',
            title: 'Auction Won - Confirm Purchase',
            message: `Congratulations! You won the auction for ${cardName} with a bid of $${winningAmount.toFixed(2)}. You have 24 hours to confirm your purchase.`,
            data: {
                card_name: cardName,
                card_image: userCard?.small_image_url || userCard?.image_url,
                winning_amount: winningAmount,
                seller_name: seller?.name,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                action_required: true,
                reference_id: auctionId,
                reference_type: 'AUCTION_WIN_PENDING'
            }
        })
    );

    // Notify seller of auction completion
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'AUCTION_ENDED',
            title: 'Auction Ended',
            message: `Your auction for ${cardName} ended. Winner has 24 hours to confirm purchase of $${winningAmount.toFixed(2)}.`,
            data: {
                card_name: cardName,
                winning_amount: winningAmount,
                reference_id: auctionId,
                reference_type: 'AUCTION_ENDED'
            }
        })
    );

    return Promise.all(notifications);
}

export async function createAuctionLostNotifications(
    loserIds: number[],
    cardName: string,
    winningAmount: number,
    auctionId: number
) {
    const notifications = [];

    for (const loserId of loserIds) {
        notifications.push(
            createNotification({
                user_id: loserId,
                type: 'AUCTION_LOST',
                title: 'Auction Lost',
                message: `The auction for ${cardName} ended. Winning bid was $${winningAmount.toFixed(2)}.`,
                data: {
                    card_name: cardName,
                    winning_amount: winningAmount,
                    reference_id: auctionId,
                    reference_type: 'AUCTION_ENDED'
                }
            })
        );
    }

    return Promise.all(notifications);
}

export async function createBidOutbidNotification(
    previousBidderId: number,
    cardName: string,
    previousBidAmount: number,
    newBidAmount: number,
    bidId: number
) {
    return createNotification({
        user_id: previousBidderId,
        type: 'BID_OUTBID',
        title: 'You\'ve Been Outbid',
        message: `Your bid of $${previousBidAmount.toFixed(2)} on ${cardName} has been outbid. Current highest bid: $${newBidAmount.toFixed(2)}`,
        data: {
            card_name: cardName,
            previous_bid: previousBidAmount,
            new_bid: newBidAmount,
            reference_id: bidId,
            reference_type: 'BID'
        }
    });
}

export async function createPurchaseConfirmedNotifications(
    buyerId: number,
    sellerId: number,
    cardName: string,
    amount: number,
    transactionId: number
) {
    const notifications = [];

    // Get names for notifications
    const [buyer, seller] = await Promise.all([
        prisma.user.findUnique({
            where: { id: buyerId },
            select: { name: true }
        }),
        prisma.user.findUnique({
            where: { id: sellerId },
            select: { name: true }
        })
    ]);

    // Notify buyer of successful purchase
    notifications.push(
        createNotification({
            user_id: buyerId,
            type: 'PURCHASE_CONFIRMED',
            title: 'Purchase Confirmed',
            message: `Purchase confirmed! You now own ${cardName}. $${amount.toFixed(2)} has been deducted from your wallet.`,
            data: {
                card_name: cardName,
                amount,
                seller_name: seller?.name,
                reference_id: transactionId,
                reference_type: 'TRANSACTION'
            }
        })
    );

    // Notify seller of sale completion
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'SALE_COMPLETED',
            title: 'Sale Completed',
            message: `Your ${cardName} was sold to ${buyer?.name} for $${amount.toFixed(2)}. Funds have been added to your wallet.`,
            data: {
                card_name: cardName,
                amount,
                buyer_name: buyer?.name,
                reference_id: transactionId,
                reference_type: 'TRANSACTION'
            }
        })
    );

    return Promise.all(notifications);
}

export async function createPurchaseDeclinedNotifications(
    buyerId: number,
    sellerId: number,
    cardName: string,
    amount: number,
    auctionId: number
) {
    const notifications = [];

    // Get buyer name for seller notification
    const buyer = await prisma.user.findUnique({
        where: { id: buyerId },
        select: { name: true }
    });

    // Notify seller that buyer declined
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'PURCHASE_DECLINED',
            title: 'Purchase Declined',
            message: `${buyer?.name || 'The winning bidder'} declined to purchase ${cardName}. Your auction will continue with other bidders.`,
            data: {
                card_name: cardName,
                declined_amount: amount,
                buyer_name: buyer?.name,
                reference_id: auctionId,
                reference_type: 'AUCTION'
            }
        })
    );

    return Promise.all(notifications);
}

export async function createPurchaseExpiredNotifications(
    buyerId: number,
    sellerId: number,
    cardName: string,
    amount: number,
    auctionId: number
) {
    const notifications = [];

    // Get buyer name for seller notification
    const buyer = await prisma.user.findUnique({
        where: { id: buyerId },
        select: { name: true }
    });

    // Notify buyer they missed the deadline
    notifications.push(
        createNotification({
            user_id: buyerId,
            type: 'PURCHASE_EXPIRED',
            title: 'Purchase Opportunity Expired',
            message: `Your 24-hour window to purchase ${cardName} for $${amount.toFixed(2)} has expired.`,
            data: {
                card_name: cardName,
                expired_amount: amount,
                reference_id: auctionId,
                reference_type: 'AUCTION'
            }
        })
    );

    // Notify seller of expiration
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'PURCHASE_EXPIRED',
            title: 'Purchase Window Expired',
            message: `${buyer?.name || 'The winning bidder'} did not confirm purchase of ${cardName} within 24 hours. Your auction will continue with other bidders.`,
            data: {
                card_name: cardName,
                expired_amount: amount,
                buyer_name: buyer?.name,
                reference_id: auctionId,
                reference_type: 'AUCTION'
            }
        })
    );

    return Promise.all(notifications);
}