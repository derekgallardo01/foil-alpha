
import { cronScheduler } from './cron-scheduler';

export async function initializeApplication() {
    console.log('🚀 Initializing Pokemon Marketplace...');

    // Start all cron jobs
    if (process.env.NODE_ENV === 'production') {
        cronScheduler.startAllJobs();
        console.log('✅ Cron jobs started in production mode');
    } else {
        console.log('⏭️  Skipping cron jobs in development mode');
    }

    console.log('🎉 Application initialized successfully');
}
