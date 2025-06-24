// src/lib/notification.ts - Updated with new bidding flow notifications
import { prisma } from './prisma';

export interface CreateNotificationData {
    user_id: number;
    type: string;
    title: string;
    message: string;
    reference_id?: number;
    reference_type?: string;
    metadata?: any;
}

export async function createNotification(data: CreateNotificationData) {
    try {
        const notification = await prisma.notification.create({
            data: {
                user_id: data.user_id,
                type: data.type,
                title: data.title,
                message: data.message,
                reference_id: data.reference_id,
                reference_type: data.reference_type,
                metadata: data.metadata,
                is_read: false
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

    // Notify seller of new bid
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'BID_RECEIVED',
            title: 'New Bid Received',
            message: `Someone placed a bid of $${bidAmount.toFixed(2)} on your ${cardName}`,
            reference_id: bidId,
            reference_type: 'BID',
            metadata: { card_name: cardName, bid_amount: bidAmount, bidder_id: bidderId }
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

    // Notify buyer that their bid was accepted - they need to confirm purchase
    notifications.push(
        createNotification({
            user_id: buyerId,
            type: 'BID_ACCEPTED',
            title: 'Bid Accepted - Confirm Purchase',
            message: `Your bid of $${amount.toFixed(2)} for ${cardName} was accepted! You have 24 hours to confirm your purchase.`,
            reference_id: transactionId,
            reference_type: 'PENDING_PURCHASE',
            metadata: {
                card_name: cardName,
                amount,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                action_required: true
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

    // Notify winner - they need to confirm purchase within 24 hours
    notifications.push(
        createNotification({
            user_id: winnerId,
            type: 'AUCTION_WON',
            title: 'Auction Won - Confirm Purchase',
            message: `Congratulations! You won the auction for ${cardName} with a bid of $${winningAmount.toFixed(2)}. You have 24 hours to confirm your purchase.`,
            reference_id: auctionId,
            reference_type: 'AUCTION_WIN_PENDING',
            metadata: {
                card_name: cardName,
                winning_amount: winningAmount,
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                action_required: true
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
            reference_id: auctionId,
            reference_type: 'AUCTION_ENDED',
            metadata: { card_name: cardName, winning_amount: winningAmount }
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
                reference_id: auctionId,
                reference_type: 'AUCTION_ENDED',
                metadata: { card_name: cardName, winning_amount: winningAmount }
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
        reference_id: bidId,
        reference_type: 'BID',
        metadata: {
            card_name: cardName,
            previous_bid: previousBidAmount,
            new_bid: newBidAmount
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

    // Notify buyer of successful purchase
    notifications.push(
        createNotification({
            user_id: buyerId,
            type: 'PURCHASE_CONFIRMED',
            title: 'Purchase Confirmed',
            message: `Purchase confirmed! You now own ${cardName}. $${amount.toFixed(2)} has been deducted from your wallet.`,
            reference_id: transactionId,
            reference_type: 'TRANSACTION',
            metadata: { card_name: cardName, amount }
        })
    );

    // Notify seller of sale completion
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'SALE_COMPLETED',
            title: 'Sale Completed',
            message: `Your ${cardName} was sold for $${amount.toFixed(2)}. Funds have been added to your wallet.`,
            reference_id: transactionId,
            reference_type: 'TRANSACTION',
            metadata: { card_name: cardName, amount }
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

    // Notify seller that buyer declined
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'PURCHASE_DECLINED',
            title: 'Purchase Declined',
            message: `The winning bidder declined to purchase ${cardName}. Your auction will be relisted.`,
            reference_id: auctionId,
            reference_type: 'AUCTION',
            metadata: { card_name: cardName, declined_amount: amount }
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

    // Notify buyer they missed the deadline
    notifications.push(
        createNotification({
            user_id: buyerId,
            type: 'PURCHASE_EXPIRED',
            title: 'Purchase Opportunity Expired',
            message: `Your 24-hour window to purchase ${cardName} for $${amount.toFixed(2)} has expired.`,
            reference_id: auctionId,
            reference_type: 'AUCTION',
            metadata: { card_name: cardName, expired_amount: amount }
        })
    );

    // Notify seller of expiration
    notifications.push(
        createNotification({
            user_id: sellerId,
            type: 'PURCHASE_EXPIRED',
            title: 'Purchase Window Expired',
            message: `The winning bidder did not confirm purchase of ${cardName} within 24 hours. Your auction will be relisted.`,
            reference_id: auctionId,
            reference_type: 'AUCTION',
            metadata: { card_name: cardName, expired_amount: amount }
        })
    );

    return Promise.all(notifications);
}