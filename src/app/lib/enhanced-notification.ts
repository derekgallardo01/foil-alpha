// src/lib/enhanced-notification.ts - New enhanced notification system
import { prisma } from './prisma';
import { sendEmail } from './email';
import {
    createEmailTemplate,
    createAdminEmailTemplate,
    EMAIL_CONFIG,
    EMAIL_SUBJECTS,
    NotificationType
} from './email-templates';

export interface CreateNotificationData {
    user_id: number;
    type: string;
    title: string;
    message: string;
    data?: any;
    send_email?: boolean; // Optional flag to control email sending
}

// Enhanced notification creation with email integration
export async function createNotificationWithEmail(notificationData: CreateNotificationData) {
    try {
        // Create database notification
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

        // Send email notification if not explicitly disabled
        if (notificationData.send_email !== false) {
            await sendNotificationEmail(notificationData);
        }

        // Send admin notification for important events
        const adminNotificationTypes = [
            'BID_ACCEPTED',
            'PURCHASE_CONFIRMED',
            'SALE_COMPLETED',
            'AUCTION_WON',
            'PURCHASE_EXPIRED',
            'PURCHASE_DECLINED'
        ];

        if (adminNotificationTypes.includes(notificationData.type)) {
            await sendAdminNotificationEmail(notificationData);
        }

        return notification;
    } catch (error) {
        console.error('Error creating notification with email:', error);
        throw error;
    }
}

// Send email notification to user
async function sendNotificationEmail(notificationData: CreateNotificationData) {
    try {
        // Get user email
        const user = await prisma.user.findUnique({
            where: { id: notificationData.user_id },
            select: { email: true, name: true }
        });

        if (!user?.email) {
            console.log(`No email found for user ${notificationData.user_id}`);
            return false;
        }

        // Get email subject
        const notificationType = notificationData.type as NotificationType;
        const subject = EMAIL_SUBJECTS[notificationType] || `TCG Marketplace - ${notificationData.title}`;

        // Create email content
        const htmlContent = createEmailTemplate({
            type: notificationType,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data
        });

        // Send email
        const result = await sendEmail(user.email, subject, htmlContent);
        console.log(`Email sent successfully to ${user.email}: ${result.id}`);

        return true;
    } catch (error) {
        console.error('Error sending notification email:', error);
        return false;
    }
}

// Send admin notification email
async function sendAdminNotificationEmail(notificationData: CreateNotificationData) {
    try {
        // Get user info for admin notification
        const user = await prisma.user.findUnique({
            where: { id: notificationData.user_id },
            select: { name: true, email: true }
        });

        const adminSubject = `[ADMIN] TCG Alert - ${notificationData.title}`;
        const adminHtml = createAdminEmailTemplate({
            type: notificationData.type as NotificationType,
            title: notificationData.title,
            message: notificationData.message,
            data: notificationData.data
        }, user || undefined);

        const result = await sendEmail(EMAIL_CONFIG.ADMIN_EMAIL, adminSubject, adminHtml);
        console.log(`Admin email sent successfully: ${result.id}`);

        return true;
    } catch (error) {
        console.error('Error sending admin email:', error);
        return false;
    }
}

// Bulk notification sender for system-wide notifications
export async function sendBulkNotifications(
    userIds: number[],
    notificationData: Omit<CreateNotificationData, 'user_id'>
) {
    const results = [];
    const batchSize = 10; // Process in batches to avoid overwhelming email service

    for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);

        const batchPromises = batch.map(userId =>
            createNotificationWithEmail({
                ...notificationData,
                user_id: userId
            }).catch(error => {
                console.error(`Failed to send notification to user ${userId}:`, error);
                return null;
            })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(Boolean));

        // Small delay between batches
        if (i + batchSize < userIds.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}

// Test email notification system
export async function testEmailNotification(userId: number) {
    return createNotificationWithEmail({
        user_id: userId,
        type: 'SYSTEM_NOTIFICATION',
        title: 'Email System Test',
        message: 'This is a test notification to verify that email notifications are working correctly.',
        data: {
            test: true,
            timestamp: new Date().toISOString()
        }
    });
}