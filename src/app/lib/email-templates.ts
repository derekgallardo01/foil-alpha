// src/lib/email-templates.ts - Email templates and configuration
export const EMAIL_CONFIG = {
    ADMIN_EMAIL: 'whitedevil5633@gmail.com',
    FROM_NAME: 'Foil Alpha',
    REPLY_TO: 'noreply@foilalpha.com',
    BASE_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000'
};

// Email template types
export type NotificationType =
    | 'BID_RECEIVED'
    | 'BID_ACCEPTED'
    | 'BID_OUTBID'
    | 'AUCTION_WON'
    | 'AUCTION_LOST'
    | 'AUCTION_ENDED'
    | 'PURCHASE_CONFIRMED'
    | 'PURCHASE_DECLINED'
    | 'PURCHASE_EXPIRED'
    | 'SALE_COMPLETED'
    | 'PRICE_CHANGE'
    | 'BULK_PRICE_CHANGE'
    | 'WALLET_TRANSACTION'
    | 'SYSTEM_NOTIFICATION';

// Email subject templates
export const EMAIL_SUBJECTS: Record<NotificationType, string> = {
    BID_RECEIVED: '💰 New Bid Received on Your Card',
    BID_ACCEPTED: '✅ Your Bid Was Accepted!',
    BID_OUTBID: '⚡ You\'ve Been Outbid',
    AUCTION_WON: '🏆 Congratulations! You Won an Auction',
    AUCTION_LOST: '📉 Auction Ended',
    AUCTION_ENDED: '🔚 Your Auction Has Ended',
    PURCHASE_CONFIRMED: '✅ Purchase Confirmed',
    PURCHASE_DECLINED: '❌ Purchase Declined',
    PURCHASE_EXPIRED: '⏰ Purchase Window Expired',
    SALE_COMPLETED: '💸 Sale Completed Successfully',
    PRICE_CHANGE: '📊 Price Alert for Your Card',
    BULK_PRICE_CHANGE: '📈 Portfolio Price Updates',
    WALLET_TRANSACTION: '💳 Wallet Transaction',
    SYSTEM_NOTIFICATION: '🔔 System Notification'
};

// Generate notification-specific content
export function getNotificationContent(type: NotificationType, data: any): {
    emoji: string;
    color: string;
    actionText?: string;
    urgency: 'low' | 'medium' | 'high';
} {
    const contentMap = {
        BID_RECEIVED: { emoji: '💰', color: '#28a745', urgency: 'medium' as const },
        BID_ACCEPTED: { emoji: '✅', color: '#007bff', actionText: 'Confirm Purchase', urgency: 'high' as const },
        BID_OUTBID: { emoji: '⚡', color: '#ffc107', actionText: 'Place Higher Bid', urgency: 'medium' as const },
        AUCTION_WON: { emoji: '🏆', color: '#28a745', actionText: 'Confirm Purchase', urgency: 'high' as const },
        AUCTION_LOST: { emoji: '📉', color: '#6c757d', urgency: 'low' as const },
        AUCTION_ENDED: { emoji: '🔚', color: '#17a2b8', urgency: 'medium' as const },
        PURCHASE_CONFIRMED: { emoji: '✅', color: '#28a745', urgency: 'medium' as const },
        PURCHASE_DECLINED: { emoji: '❌', color: '#dc3545', urgency: 'medium' as const },
        PURCHASE_EXPIRED: { emoji: '⏰', color: '#fd7e14', urgency: 'low' as const },
        SALE_COMPLETED: { emoji: '💸', color: '#28a745', urgency: 'medium' as const },
        PRICE_CHANGE: { emoji: '📊', color: '#007bff', urgency: 'low' as const },
        BULK_PRICE_CHANGE: { emoji: '📈', color: '#6f42c1', urgency: 'low' as const },
        WALLET_TRANSACTION: { emoji: '💳', color: '#20c997', urgency: 'medium' as const },
        SYSTEM_NOTIFICATION: { emoji: '🔔', color: '#6c757d', urgency: 'low' as const }
    };

    return contentMap[type] || contentMap.SYSTEM_NOTIFICATION;
}

// Main email template
export function createEmailTemplate(notification: {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
}): string {
    const content = getNotificationContent(notification.type, notification.data);
    const isUrgent = content.urgency === 'high';

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6; 
                color: #333; 
                background-color: #f8f9fa; 
                padding: 20px;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
            }
            .header { 
                background: linear-gradient(135deg, ${content.color} 0%, ${adjustColor(content.color, -20)} 100%);
                color: white; 
                padding: 30px 20px; 
                text-align: center;
            }
            .header h1 { 
                font-size: 24px; 
                font-weight: 600; 
                margin-bottom: 8px;
            }
            .notification-badge {
                display: inline-block;
                background: rgba(255,255,255,0.2);
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-top: 8px;
            }
            .content { padding: 30px 20px; }
            .message { 
                font-size: 16px; 
                color: #495057; 
                margin-bottom: 20px;
                line-height: 1.5;
            }
            .card-info { 
                background: #f8f9fa; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0;
                border-left: 4px solid ${content.color};
            }
            .card-header {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 15px;
            }
            .card-image { 
                width: 80px; 
                height: 80px; 
                object-fit: cover;
                border-radius: 8px; 
                border: 2px solid #dee2e6;
            }
            .card-details h3 {
                font-size: 18px;
                color: #212529;
                margin-bottom: 4px;
            }
            .price-change { 
                font-weight: 600; 
                color: #28a745; 
                font-size: 18px;
            }
            .price-decrease { color: #dc3545; }
            .price-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 10px 0;
            }
            .price-old {
                text-decoration: line-through;
                color: #6c757d;
                font-size: 14px;
            }
            .action-required { 
                background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                border: 1px solid #ffd333; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0;
                text-align: center;
            }
            .action-required h3 {
                color: #856404;
                margin-bottom: 10px;
                font-size: 18px;
            }
            .action-button {
                display: inline-block;
                background: ${content.color};
                color: white;
                padding: 12px 24px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                margin-top: 15px;
                transition: background-color 0.3s;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                margin: 15px 0;
            }
            .stat-item {
                background: white;
                padding: 15px;
                border-radius: 6px;
                border: 1px solid #dee2e6;
                text-align: center;
            }
            .stat-value {
                font-size: 20px;
                font-weight: 600;
                color: ${content.color};
                display: block;
            }
            .stat-label {
                font-size: 12px;
                color: #6c757d;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .footer { 
                background: #f8f9fa;
                padding: 25px 20px; 
                border-top: 1px solid #dee2e6; 
                text-align: center;
            }
            .footer p { 
                color: #6c757d; 
                font-size: 12px; 
                margin-bottom: 8px;
            }
            .footer a { 
                color: ${content.color}; 
                text-decoration: none; 
            }
            .urgent-banner {
                background: #dc3545;
                color: white;
                text-align: center;
                padding: 10px;
                font-weight: 600;
                font-size: 14px;
            }
            @media (max-width: 600px) {
                .container { margin: 10px; border-radius: 8px; }
                .content { padding: 20px 15px; }
                .stats-grid { grid-template-columns: 1fr; }
                .card-header { flex-direction: column; text-align: center; }
                .card-image { width: 60px; height: 60px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            ${isUrgent ? '<div class="urgent-banner">⚡ ACTION REQUIRED - Time Sensitive</div>' : ''}
            
            <div class="header">
                <h1>${content.emoji} ${notification.title}</h1>
                <div class="notification-badge">${notification.type.replace('_', ' ')}</div>
            </div>
            
            <div class="content">
                <div class="message">
                    ${notification.message}
                </div>
                
                ${generateNotificationContent(notification.type, notification.data)}
                
                ${content.actionText ? `
                <div class="action-required">
                    <h3>Action Required</h3>
                    <p>Please log in to your account to ${content.actionText.toLowerCase()}.</p>
                    <a href="${EMAIL_CONFIG.BASE_URL}/dashboard" class="action-button">
                        ${content.actionText}
                    </a>
                </div>
                ` : ''}
            </div>
            
            <div class="footer">
                <p>This is an automated notification from ${EMAIL_CONFIG.FROM_NAME}.</p>
                <p><a href="${EMAIL_CONFIG.BASE_URL}/dashboard">Visit Dashboard</a> | <a href="${EMAIL_CONFIG.BASE_URL}/settings">Notification Settings</a></p>
                <p>© 2024 Foil Alpha. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

function adjustColor(color: string, percent: number): string {
    // Simple color adjustment for gradients
    const colorMap: Record<string, string> = {
        '#28a745': '#1e7e34',
        '#007bff': '#0056b3',
        '#dc3545': '#a71d2a',
        '#ffc107': '#d39e00',
        '#17a2b8': '#117a8b',
        '#6f42c1': '#563d7c',
        '#20c997': '#1a9e7e',
        '#6c757d': '#545b62'
    };

    return colorMap[color] || color;
}

function generateNotificationContent(type: NotificationType, data: any): string {
    if (!data) return '';

    let content = '';

    // Card information section
    if (data.card_name) {
        content += `
        <div class="card-info">
            <div class="card-header">
                ${data.card_image ? `<img src="${data.card_image}" alt="${data.card_name}" class="card-image">` : ''}
                <div class="card-details">
                    <h3>${data.card_name}</h3>
                    ${data.set_name ? `<p style="color: #6c757d; font-size: 14px;">${data.set_name}</p>` : ''}
                </div>
            </div>
        `;

        // Price information
        if (type === 'PRICE_CHANGE' && data.old_price && data.new_price) {
            const isIncrease = data.new_price > data.old_price;
            content += `
            <div class="price-info">
                <div>
                    <span class="price-old">${data.old_price.toFixed(2)}</span>
                    <span class="${isIncrease ? 'price-change' : 'price-decrease'}">
                        ${data.new_price.toFixed(2)}
                    </span>
                </div>
                <div class="${isIncrease ? 'price-change' : 'price-decrease'}">
                    ${data.change_percent > 0 ? '+' : ''}${data.change_percent.toFixed(1)}%
                </div>
            </div>
            `;
        }

        // Transaction amount
        if (data.amount || data.bid_amount || data.winning_amount) {
            const amount = data.amount || data.bid_amount || data.winning_amount;
            content += `<p><strong>Amount:</strong> ${amount.toFixed(2)}</p>`;
        }

        content += '</div>';
    }

    // Bulk price changes
    if (type === 'BULK_PRICE_CHANGE' && data.cards) {
        content += `
        <div class="card-info">
            <h3>Portfolio Summary</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-value">${data.total_old_value.toFixed(2)}</span>
                    <span class="stat-label">Previous Value</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${data.total_new_value.toFixed(2)}</span>
                    <span class="stat-label">Current Value</span>
                </div>
            </div>
            <p><strong>Total Change:</strong> 
                <span class="${data.total_change > 0 ? 'price-change' : 'price-decrease'}">
                    ${data.total_change > 0 ? '+' : ''}${data.total_change_percent.toFixed(1)}%
                </span>
            </p>
        </div>
        `;
    }

    // People involved
    if (data.seller_name || data.buyer_name || data.bidder_name) {
        content += '<div class="card-info">';
        if (data.seller_name) content += `<p><strong>Seller:</strong> ${data.seller_name}</p>`;
        if (data.buyer_name) content += `<p><strong>Buyer:</strong> ${data.buyer_name}</p>`;
        if (data.bidder_name) content += `<p><strong>Bidder:</strong> ${data.bidder_name}</p>`;
        content += '</div>';
    }

    // Expiration info
    if (data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        content += `
        <div class="action-required">
            <p><strong>Expires:</strong> ${expiresAt.toLocaleString()}</p>
        </div>
        `;
    }

    return content;
}

// Admin email template
export function createAdminEmailTemplate(notification: {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
}, userInfo?: { name: string; email: string }): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Admin Alert - ${notification.title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .admin-header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .user-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .notification-data { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="admin-header">
                <h1>🚨 ADMIN ALERT</h1>
                <h2>${notification.title}</h2>
            </div>
            
            <div class="content">
                <p><strong>Message:</strong> ${notification.message}</p>
                
                ${userInfo ? `
                <div class="user-info">
                    <h3>User Information</h3>
                    <p><strong>Name:</strong> ${userInfo.name}</p>
                    <p><strong>Email:</strong> ${userInfo.email}</p>
                </div>
                ` : ''}
                
                ${notification.data ? `
                <div class="notification-data">
                    <h3>Additional Data</h3>
                    <pre>${JSON.stringify(notification.data, null, 2)}</pre>
                </div>
                ` : ''}
                
                <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>
    `;
}