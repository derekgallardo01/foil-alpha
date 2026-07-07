// src/app/lib/notification.ts - Enhanced with email notifications
import { prisma } from './prisma';
import { sendEmail } from './email';
import { emitAppEvent } from './events';

export interface CreateNotificationData {
    user_id: number;
    type: string;
    title: string;
    message: string;
    data?: any;
}

// Admin email for notifications
const ADMIN_EMAIL = 'derekgallardo01@gmail.com';

// Get user email for notifications
async function getUserEmail(userId: number): Promise<string | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
        });
        return user?.email || null;
    } catch (error) {
        console.error('Error fetching user email:', error);
        return null;
    }
}

// Create email template for notifications
function createEmailTemplate(notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
}): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
            .notification-type { background: #f8f9fa; padding: 10px; border-left: 4px solid #007bff; margin: 10px 0; border-radius: 4px; }
            .card-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .price-change { font-weight: bold; color: #28a745; }
            .price-decrease { color: #dc3545; }
            .action-required { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
            .card-image { max-width: 100px; height: auto; border-radius: 8px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${notification.title}</h1>
            </div>
            
            <div class="notification-type">
                <strong>Type:</strong> ${notification.type.replace('_', ' ').toUpperCase()}
            </div>
            
            <div class="message">
                <p>${notification.message}</p>
            </div>
            
            ${notification.data ? generateDataSection(notification.data, notification.type) : ''}
            
            <div class="footer">
                <p>This is an automated notification from Foil Alpha. Please do not reply to this email.</p>
                <p>Visit your <a href="#">dashboard</a> to manage your notifications.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateDataSection(data: any, type: string): string {
    let section = '';

    if (data.card_name) {
        section += `<div class="card-info">`;
        section += `<h3>📱 ${data.card_name}</h3>`;
        if (data.card_image) {
            section += `<img src="${data.card_image}" alt="${data.card_name}" class="card-image">`;
        }
        section += `</div>`;
    }

    if (type === 'PRICE_CHANGE' || type === 'BULK_PRICE_CHANGE') {
        if (data.old_price && data.new_price) {
            const isIncrease = data.new_price > data.old_price;
            section += `<div class="card-info">`;
            section += `<p><strong>Price Change:</strong></p>`;
            section += `<p>From: $${data.old_price}</p>`;
            section += `<p>To: <span class="${isIncrease ? 'price-change' : 'price-decrease'}">$${data.new_price}</span></p>`;
            if (data.change_percent) {
                section += `<p>Change: ${data.change_percent > 0 ? '+' : ''}${data.change_percent.toFixed(1)}%</p>`;
            }
            section += `</div>`;
        }
    }

    if (data.amount) {
        section += `<div class="card-info"><p><strong>Amount:</strong> $${data.amount}</p></div>`;
    }

    if (data.action_required) {
        section += `<div class="action-required">`;
        section += `<p><strong>⚠️ Action Required</strong></p>`;
        if (data.expires_at) {
            section += `<p>Expires: ${new Date(data.expires_at).toLocaleString()}</p>`;
        }
        section += `</div>`;
    }

    if (data.seller_name || data.buyer_name || data.bidder_name) {
        section += `<div class="card-info">`;
        if (data.seller_name) section += `<p><strong>Seller:</strong> ${data.seller_name}</p>`;
        if (data.buyer_name) section += `<p><strong>Buyer:</strong> ${data.buyer_name}</p>`;
        if (data.bidder_name) section += `<p><strong>Bidder:</strong> ${data.bidder_name}</p>`;
        section += `</div>`;
    }

    return section;
}

// Send email notification
async function sendNotificationEmail(userId: number, notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
}) {
    try {
        const userEmail = await getUserEmail(userId);
        if (!userEmail) {
            console.log(`No email found for user ${userId}`);
            return false;
        }

        const htmlContent = createEmailTemplate(notification);
        const subject = `Foil Alpha - ${notification.title}`;

        const result = await sendEmail(userEmail, subject, htmlContent);
        console.log(`Email sent successfully to ${userEmail}:`, result.id);
        return true;
    } catch (error) {
        console.error('Error sending notification email:', error);
        return false;
    }
}

// Send admin notification email
async function sendAdminNotificationEmail(notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
}, userId?: number) {
    try {
        const userData = userId ? await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true }
        }) : null;

        const adminNotification = {
            type: notification.type,
            title: `[ADMIN] ${notification.title}`,
            message: `Admin Alert: ${notification.message}${userData ? ` (User: ${userData.name} - ${userData.email})` : ''}`,
            data: {
                ...notification.data,
                admin_notification: true,
                user_info: userData
            }
        };

        const htmlContent = createEmailTemplate(adminNotification);
        const subject = `TCG Admin Alert - ${notification.title}`;

        const result = await sendEmail(ADMIN_EMAIL, subject, htmlContent);
        console.log(`Admin email sent successfully:`, result.id);
        return true;
    } catch (error) {
        console.error('Error sending admin email:', error);
        return false;
    }
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

        // Push to the recipient's live stream (bell badge) — best-effort.
        emitAppEvent({ type: 'notification', userId: notificationData.user_id });

        // Send email notification
        await sendNotificationEmail(notificationData.user_id, {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data
        });

        // Send admin notification for important events
        const adminNotificationTypes = ['BID_ACCEPTED', 'PURCHASE_CONFIRMED', 'SALE_COMPLETED', 'AUCTION_WON'];
        if (adminNotificationTypes.includes(notificationData.type)) {
            await sendAdminNotificationEmail({
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message,
                data: notificationData.data
            }, notificationData.user_id);
        }

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
                select: { image_url: true } // Fixed: removed small_image_url
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
                card_image: userCard?.image_url, // Fixed: using only image_url
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
                select: { image_url: true } // Fixed: removed small_image_url
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
                card_image: userCard?.image_url, // Fixed: using only image_url
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

export async function createPriceChangeNotification(
    userId: number,
    cardId: number,
    cardName: string,
    oldPrice: number,
    newPrice: number,
    changePercent: number,
    imageUrl?: string | null
) {
    const isIncrease = newPrice > oldPrice;
    const emoji = isIncrease ? '📈' : '📉';
    const changeText = isIncrease ? 'increased' : 'decreased';

    return createNotification({
        user_id: userId,
        type: 'PRICE_CHANGE',
        title: `${emoji} Price ${changeText.charAt(0).toUpperCase() + changeText.slice(1)} for ${cardName}`,
        message: `The price of ${cardName} has ${changeText} from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`,
        data: {
            card_id: cardId,
            card_name: cardName,
            card_image: imageUrl,
            old_price: oldPrice,
            new_price: newPrice,
            change_percent: changePercent,
            change_type: isIncrease ? 'increase' : 'decrease',
            timestamp: new Date().toISOString()
        }
    });
}

export async function createBulkPriceChangeNotifications(
    priceChanges: Array<{
        cardId: number;
        cardName: string;
        oldPrice: number;
        newPrice: number;
        changePercent: number;
        imageUrl: string | null;
    }>
) {
    const notifications = [];
    let totalNotifications = 0;

    // Get all owners for the changed cards
    const cardIds = priceChanges.map(pc => pc.cardId);

    const userCards = await prisma.userCard.findMany({
        where: {
            card_id: { in: cardIds },
            is_sold: false // Only notify current owners
        },
        select: {
            owner_id: true,
            card_id: true
        }
    });

    // Group by owner to send consolidated notifications
    const ownerCardMap = new Map<number, typeof priceChanges>();

    userCards.forEach(uc => {
        const priceChange = priceChanges.find(pc => pc.cardId === uc.card_id);
        if (priceChange) {
            if (!ownerCardMap.has(uc.owner_id)) {
                ownerCardMap.set(uc.owner_id, []);
            }
            ownerCardMap.get(uc.owner_id)!.push(priceChange);
        }
    });

    // Create notifications for each owner
    for (const [ownerId, ownerPriceChanges] of ownerCardMap) {
        if (ownerPriceChanges.length === 1) {
            // Single card price change
            const change = ownerPriceChanges[0];
            notifications.push(
                createPriceChangeNotification(
                    ownerId,
                    change.cardId,
                    change.cardName,
                    change.oldPrice,
                    change.newPrice,
                    change.changePercent,
                    change.imageUrl
                )
            );
            totalNotifications++;
        } else {
            // Multiple cards price change - create summary notification
            const totalOldValue = ownerPriceChanges.reduce((sum, c) => sum + c.oldPrice, 0);
            const totalNewValue = ownerPriceChanges.reduce((sum, c) => sum + c.newPrice, 0);
            const totalChange = totalNewValue - totalOldValue;
            const totalChangePercent = (totalChange / totalOldValue) * 100;

            notifications.push(
                createNotification({
                    user_id: ownerId,
                    type: 'BULK_PRICE_CHANGE',
                    title: `📊 Price Updates for ${ownerPriceChanges.length} Cards`,
                    message: `${ownerPriceChanges.length} of your cards have price changes. Total portfolio value changed from $${totalOldValue.toFixed(2)} to $${totalNewValue.toFixed(2)} (${totalChangePercent > 0 ? '+' : ''}${totalChangePercent.toFixed(1)}%)`,
                    data: {
                        cards: ownerPriceChanges.map(c => ({
                            card_id: c.cardId,
                            card_name: c.cardName,
                            card_image: c.imageUrl,
                            old_price: c.oldPrice,
                            new_price: c.newPrice,
                            change_percent: c.changePercent
                        })),
                        total_old_value: totalOldValue,
                        total_new_value: totalNewValue,
                        total_change: totalChange,
                        total_change_percent: totalChangePercent,
                        timestamp: new Date().toISOString()
                    }
                })
            );
            totalNotifications++;
        }
    }

    await Promise.all(notifications);

    return {
        success: true,
        totalNotifications,
        uniqueOwners: ownerCardMap.size,
        totalCards: priceChanges.length
    };
}