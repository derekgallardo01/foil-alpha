// src/app/lib/google-chat.ts - Admin-Only Google Chat Integration
import dotenv from 'dotenv';
dotenv.config();

// Google Chat Webhook Configuration - ADMIN ONLY
const GOOGLE_CHAT_ADMIN_WEBHOOK_URL = process.env.GOOGLE_CHAT_ADMIN_WEBHOOK_URL || 'https://chat.googleapis.com/v1/spaces/AAQAk2F5Yl8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=3GTcb3zSPczIroMRHvZmw6l-ND_3xXwpfB1d1Q7TXXU';

export interface GoogleChatMessage {
    text?: string;
    cards?: GoogleChatCard[];
}

export interface GoogleChatCard {
    header?: {
        title: string;
        subtitle?: string;
        imageUrl?: string;
    };
    sections: GoogleChatSection[];
}

export interface GoogleChatSection {
    widgets: GoogleChatWidget[];
}

export interface GoogleChatWidget {
    textParagraph?: {
        text: string;
    };
    keyValue?: {
        topLabel?: string;
        content: string;
        contentMultiline?: boolean;
        icon?: string;
    };
    buttons?: Array<{
        textButton: {
            text: string;
            onClick: {
                openLink: {
                    url: string;
                };
            };
        };
    }>;
}

export interface NotificationData {
    type: string;
    title: string;
    message: string;
    data?: any;
    user_id?: number;
    user_name?: string;
    user_email?: string;
}

// Send a simple text message to Google Chat (admin only)
export async function sendGoogleChatMessage(message: string): Promise<boolean> {
    try {
        if (!GOOGLE_CHAT_ADMIN_WEBHOOK_URL) {
            console.log('Google Chat admin webhook URL not configured');
            return false;
        }

        const response = await fetch(GOOGLE_CHAT_ADMIN_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: message }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Chat API error:', response.status, errorText);
            return false;
        }

        console.log('Google Chat message sent successfully to admin');
        return true;
    } catch (error) {
        console.error('Error sending Google Chat message:', error);
        return false;
    }
}

// Send a formatted card message to Google Chat (admin only)
export async function sendGoogleChatCard(card: GoogleChatCard): Promise<boolean> {
    try {
        if (!GOOGLE_CHAT_ADMIN_WEBHOOK_URL) {
            console.log('Google Chat admin webhook URL not configured');
            return false;
        }

        const message: GoogleChatMessage = {
            cards: [card],
        };

        const response = await fetch(GOOGLE_CHAT_ADMIN_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Chat API error:', response.status, errorText);
            return false;
        }

        console.log('Google Chat card sent successfully to admin');
        return true;
    } catch (error) {
        console.error('Error sending Google Chat card:', error);
        return false;
    }
}

// Create a formatted notification card based on notification type
export function createNotificationCard(notification: NotificationData): GoogleChatCard {
    const { type, title, message, data, user_name, user_email } = notification;

    // Determine icon based on notification type
    const getTypeIcon = (type: string): string => {
        const icons: Record<string, string> = {
            BID_RECEIVED: '💰',
            BID_ACCEPTED: '✅',
            BID_OUTBID: '⚠️',
            AUCTION_WON: '🏆',
            AUCTION_LOST: '😞',
            AUCTION_ENDED: '🔔',
            PURCHASE_CONFIRMED: '✅',
            PURCHASE_DECLINED: '❌',
            PURCHASE_EXPIRED: '⏰',
            SALE_COMPLETED: '💵',
            PRICE_CHANGE: data?.change_type === 'increase' ? '📈' : '📉',
            BULK_PRICE_CHANGE: '📊',
            SYSTEM_NOTIFICATION: '🔔',
        };
        return icons[type] || '📬';
    };

    const icon = getTypeIcon(type);
    const subtitle = type.replace(/_/g, ' ').toLowerCase();

    const card: GoogleChatCard = {
        header: {
            title: `${icon} ${title}`,
            subtitle: subtitle,
        },
        sections: [],
    };

    // Main message section
    const messageSection: GoogleChatSection = {
        widgets: [
            {
                textParagraph: {
                    text: `<b>${message}</b>`,
                },
            },
        ],
    };

    // Add user info if available
    if (user_name || user_email) {
        messageSection.widgets.push({
            keyValue: {
                topLabel: 'User',
                content: user_name || user_email || 'Unknown',
                icon: 'PERSON',
            },
        });
    }

    card.sections.push(messageSection);

    // Add data-specific sections
    if (data) {
        const dataSection: GoogleChatSection = { widgets: [] };

        // Card information
        if (data.card_name) {
            dataSection.widgets.push({
                keyValue: {
                    topLabel: 'Card',
                    content: data.card_name,
                    icon: 'BOOKMARK',
                },
            });
        }

        // Price information
        if (data.amount) {
            dataSection.widgets.push({
                keyValue: {
                    topLabel: 'Amount',
                    content: `$${parseFloat(data.amount).toFixed(2)}`,
                    icon: 'DOLLAR',
                },
            });
        }

        if (data.bid_amount) {
            dataSection.widgets.push({
                keyValue: {
                    topLabel: 'Bid Amount',
                    content: `$${parseFloat(data.bid_amount).toFixed(2)}`,
                    icon: 'DOLLAR',
                },
            });
        }

        // Price change information
        if (data.old_price && data.new_price) {
            const changePercent = data.change_percent ||
                (((data.new_price - data.old_price) / data.old_price) * 100);
            dataSection.widgets.push({
                keyValue: {
                    topLabel: 'Price Change',
                    content: `$${data.old_price.toFixed(2)} → $${data.new_price.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`,
                    contentMultiline: true,
                },
            });
        }

        // Involved parties
        if (data.seller_name) {
            dataSection.widgets.push({
                keyValue: {
                    topLabel: 'Seller',
                    content: data.seller_name,
                    icon: 'PERSON',
                },
            });
        }

        if (data.buyer_name) {
            dataSection.widgets.push({
                keyValue: {
                    topLabel: 'Buyer',
                    content: data.buyer_name,
                    icon: 'PERSON',
                },
            });
        }

        if (data.bidder_name) {
            dataSection.widgets.push({
                keyValue: {
                    topLabel: 'Bidder',
                    content: data.bidder_name,
                    icon: 'PERSON',
                },
            });
        }

        // Action required
        if (data.action_required && data.expires_at) {
            const expiresAt = new Date(data.expires_at);
            dataSection.widgets.push({
                keyValue: {
                    topLabel: '⚠️ Action Required',
                    content: `Expires: ${expiresAt.toLocaleString()}`,
                    contentMultiline: true,
                },
            });
        }

        if (dataSection.widgets.length > 0) {
            card.sections.push(dataSection);
        }

        // Add action buttons for important notifications
        if (data.reference_id && (type === 'BID_ACCEPTED' || type === 'AUCTION_WON')) {
            const buttonSection: GoogleChatSection = {
                widgets: [
                    {
                        buttons: [
                            {
                                textButton: {
                                    text: 'View in Dashboard',
                                    onClick: {
                                        openLink: {
                                            url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard`,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            };
            card.sections.push(buttonSection);
        }
    }

    // Add timestamp
    const timestampSection: GoogleChatSection = {
        widgets: [
            {
                keyValue: {
                    content: new Date().toLocaleString(),
                    icon: 'CLOCK',
                },
            },
        ],
    };
    card.sections.push(timestampSection);

    return card;
}

// Send notification to Google Chat (admin only - automatically formats based on type)
export async function sendNotificationToGoogleChat(
    notification: NotificationData,
    isAdminNotification: boolean = true // Always true, keeping param for compatibility
): Promise<boolean> {
    try {
        // Create formatted card
        const card = createNotificationCard(notification);

        // Send to admin Google Chat
        return await sendGoogleChatCard(card);
    } catch (error) {
        console.error('Error sending notification to Google Chat:', error);
        return false;
    }
}

// Test Google Chat connection (admin only)
export async function testGoogleChat(): Promise<{ success: boolean; message: string }> {
    try {
        const testMessage = `🔔 Test notification from TCG Marketplace\nTimestamp: ${new Date().toLocaleString()}`;

        if (!GOOGLE_CHAT_ADMIN_WEBHOOK_URL) {
            return {
                success: false,
                message: 'Admin webhook not configured in environment variables',
            };
        }

        const adminSuccess = await sendGoogleChatMessage(testMessage);

        return {
            success: adminSuccess,
            message: `Admin webhook: ${adminSuccess ? '✅' : '❌'}`,
        };
    } catch (error) {
        return {
            success: false,
            message: `Test failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}