
import cron from 'node-cron';

export class CronScheduler {
    private jobs: Map<string, cron.ScheduledTask> = new Map();

    // Schedule daily price sync at 2 AM UTC
    scheduleDailyPriceSync() {
        const jobName = 'daily-price-sync';

        // Remove existing job if it exists
        if (this.jobs.has(jobName)) {
            this.jobs.get(jobName)?.stop();
            this.jobs.delete(jobName);
        }

        // Schedule new job: Every day at 2:00 AM UTC
        const task = cron.schedule('0 2 * * *', async () => {
            console.log('🕐 Starting daily price sync cron job...');

            try {
                // Call your daily price sync API endpoint
                const response = await fetch(`${process.env.NEXTAUTH_URL}/api/cron/daily-price-sync`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Daily price sync completed:', result.summary);

                    // Send notifications for price changes if any
                    await this.sendPriceUpdateNotifications();
                } else {
                    console.error('❌ Daily price sync failed:', await response.text());
                }
            } catch (error) {
                console.error('💥 Error in daily price sync cron:', error);
            }
        }, {
            scheduled: true,
            timezone: 'UTC'
        });

        this.jobs.set(jobName, task);
        console.log('📅 Daily price sync scheduled for 2:00 AM UTC');
    }

    // Send notifications for significant price changes
    private async sendPriceUpdateNotifications() {
        try {
            console.log('📧 Checking for price change notifications...');

            // Get price changes from last 24 hours
            const recentPriceChanges = await prisma.$queryRaw`
                SELECT 
                    c.id as card_id,
                    c.name as card_name,
                    c.market_price as current_price,
                    ph.price as previous_price,
                    ((c.market_price - ph.price) / ph.price * 100) as price_change_percent,
                    uc.owner_id
                FROM cards c
                JOIN price_history ph ON c.id = ph.card_id
                JOIN user_cards uc ON c.id = uc.card_id
                WHERE ph.recorded_at >= DATE_SUB(NOW(), INTERVAL 2 DAY)
                AND ph.recorded_at <= DATE_SUB(NOW(), INTERVAL 1 DAY)
                AND ABS((c.market_price - ph.price) / ph.price * 100) >= 10
                AND uc.is_sold = false
                GROUP BY c.id, uc.owner_id
                ORDER BY ABS((c.market_price - ph.price) / ph.price * 100) DESC
            ` as any[];

            console.log(`💹 Found ${recentPriceChanges.length} significant price changes (≥10%)`);

            // Group by user to batch notifications
            const userNotifications = new Map<number, any[]>();

            for (const change of recentPriceChanges) {
                const userId = change.owner_id;
                if (!userNotifications.has(userId)) {
                    userNotifications.set(userId, []);
                }
                userNotifications.get(userId)!.push(change);
            }

            // Send notifications to users
            for (const [userId, changes] of userNotifications.entries()) {
                try {
                    await prisma.notification.create({
                        data: {
                            user_id: userId,
                            type: 'PRICE_UPDATE',
                            title: `💰 Price Updates for ${changes.length} of Your Cards`,
                            message: `Significant price changes detected for cards in your collection. Biggest change: ${changes[0].card_name} (${changes[0].price_change_percent > 0 ? '+' : ''}${changes[0].price_change_percent.toFixed(1)}%)`,
                            data: {
                                changes: changes.map(c => ({
                                    card_name: c.card_name,
                                    current_price: c.current_price,
                                    previous_price: c.previous_price,
                                    change_percent: c.price_change_percent.toFixed(1)
                                })),
                                notification_type: 'daily_price_sync'
                            }
                        }
                    });
                } catch (notifError) {
                    console.error(`Failed to create notification for user ${userId}:`, notifError);
                }
            }

            console.log(`📬 Sent price update notifications to ${userNotifications.size} users`);

        } catch (error) {
            console.error('💥 Error sending price update notifications:', error);
        }
    }

    // Stop all cron jobs
    stopAllJobs() {
        for (const [name, task] of this.jobs.entries()) {
            task.stop();
            console.log(`🛑 Stopped cron job: ${name}`);
        }
        this.jobs.clear();
    }

    // Start all scheduled jobs
    startAllJobs() {
        this.scheduleDailyPriceSync();
        console.log('✅ All cron jobs started');
    }
}

// Export singleton
export const cronScheduler = new CronScheduler();