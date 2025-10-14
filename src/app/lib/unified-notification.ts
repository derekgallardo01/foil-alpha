// src/app/lib/unified-notification.ts
// Unified notification system - Google Chat ONLY for admin notifications
import { prisma } from './prisma';
import { sendEmail } from './email';
import { sendNotificationToGoogleChat, NotificationData } from './google-chat';
import {
    createEmailTemplate,
    createAdminEmailTemplate,
    EMAIL_CONFIG,
    EMAIL_SUBJECTS,
    NotificationType
} from './email-templates';

export interface CreateNotificationOptions {
    user_id: number;
    type: string;
    title: string;
    message: string;
    data?: any;
    send_email?: boolean;
    send_admin_google_chat?: boolean; // Only admin gets Google Chat
    is_admin_notification?: boolean;
}

// Admin notification types that should go to Google Chat
const ADMIN_NOTIFICATION_TYPES = [
    'BID_ACCEPTED',
    'PURCHASE_CONFIRMED',
    'SALE_COMPLETED',
    'AUCTION_WON',
    'PURCHASE_EXPIRED',
    'PURCHASE_DECLINED',
    'BID_RECEIVED', // Include all bid activity for admin
    'AUCTION_ENDED',
];

/**
 * Create a notification and send it through all configured channels
 * Google Chat is ONLY sent to admin, never to users
 */
export async function createUnifiedNotification(options: CreateNotificationOptions) {
    const {
        user_id,
        type,
        title,
        message,
        data,
        send_email = true,
        send_admin_google_chat = true,
        is_admin_notification = ADMIN_NOTIFICATION_TYPES.includes(type),
    } = options;

    const results = {
        database: false,
        email: false,
        adminEmail: false,
        adminGoogleChat: false,
    };

    try {
        // 1. Create database notification
        const notification = await prisma.notification.create({
            data: {
                user_id,
                type,
                title,
                message,
                data,
                read: false,
            },
        });
        results.database = true;
        console.log(`✅ Database notification created: ${notification.id}`);

        // Get user info for notifications
        const user = await prisma.user.findUnique({
            where: { id: user_id },
            select: { email: true, name: true },
        });

        // 2. Send email notification to user
        if (send_email && user?.email) {
            try {
                const notificationType = type as NotificationType;
                const subject = EMAIL_SUBJECTS[notificationType] || `TCG Marketplace - ${title}`;
                const htmlContent = createEmailTemplate({
                    type: notificationType,
                    title,
                    message,
                    data,
                });

                const emailResult = await sendEmail(user.email, subject, htmlContent);
                results.email = true;
                console.log(`✅ Email sent to ${user.email}: ${emailResult.id}`);
            } catch (error) {
                console.error('❌ Error sending user email:', error);
            }
        }

        // 3. Send admin notifications (email + Google Chat)
        if (is_admin_notification) {
            // Admin email
            try {
                const adminSubject = `[ADMIN] TCG Alert - ${title}`;
                const adminHtml = createAdminEmailTemplate(
                    {
                        type: type as NotificationType,
                        title,
                        message,
                        data,
                    },
                    user || undefined
                );

                const adminEmailResult = await sendEmail(
                    EMAIL_CONFIG.ADMIN_EMAIL,
                    adminSubject,
                    adminHtml
                );
                results.adminEmail = true;
                console.log(`✅ Admin email sent: ${adminEmailResult.id}`);
            } catch (error) {
                console.error('❌ Error sending admin email:', error);
            }

            // Admin Google Chat (ONLY admins get Google Chat notifications)
            if (send_admin_google_chat) {
                try {
                    const adminChatNotification: NotificationData = {
                        type,
                        title: `[ADMIN ALERT] ${title}`,
                        message,
                        data: {
                            ...data,
                            admin_notification: true,
                            user_info: user,
                        },
                        user_id,
                        user_name: user?.name || undefined,
                        user_email: user?.email || undefined,
                    };

                    // Always send to admin space (isAdminNotification = true)
                    const adminChatResult = await sendNotificationToGoogleChat(
                        adminChatNotification,
                        true // Always true = admin space
                    );
                    results.adminGoogleChat = adminChatResult;
                    console.log(`${adminChatResult ? '✅' : '⚠️'} Google Chat notification sent to admin space`);
                } catch (error) {
                    console.error('❌ Error sending admin Google Chat notification:', error);
                }
            }
        }

        return {
            success: true,
            notification,
            results,
        };
    } catch (error) {
        console.error('❌ Error in unified notification system:', error);
        throw error;
    }
}

/**
 * Send bulk notifications to multiple users
 */
export async function sendBulkUnifiedNotifications(
    userIds: number[],
    notificationData: Omit<CreateNotificationOptions, 'user_id'>
) {
    const results = [];
    const batchSize = 10;

    for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);

        const batchPromises = batch.map((userId) =>
            createUnifiedNotification({
                ...notificationData,
                user_id: userId,
            }).catch((error) => {
                console.error(`Failed to send notification to user ${userId}:`, error);
                return null;
            })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(Boolean));

        // Small delay between batches
        if (i + batchSize < userIds.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    return results;
}

/**
 * Test the unified notification system
 */
export async function testUnifiedNotification(userId: number) {
    console.log('🧪 Testing unified notification system (Admin-only Google Chat)...');

    return createUnifiedNotification({
        user_id: userId,
        type: 'PURCHASE_CONFIRMED', // This triggers admin notification
        title: 'Test Admin Notification',
        message: 'This is a test notification. Admin should receive this in Google Chat. User gets email only.',
        data: {
            test: true,
            timestamp: new Date().toISOString(),
            channels: {
                user: ['database', 'email'],
                admin: ['email', 'google_chat']
            },
            card_name: 'Test Card',
            amount: 99.99,
        },
        send_email: true,
        send_admin_google_chat: true,
    });
}