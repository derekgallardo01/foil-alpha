// src/app/lib/releaseNotifier.ts
import cron from 'node-cron';
import { executeQuery } from './db';
import { sendEmail } from './email';
import { RowDataPacket } from 'mysql2/promise';

// Interface for query result
interface ReleaseReminder extends RowDataPacket {
  product_id: string;
  title: string;
  release_date: string;
  days_until_release: number;
}

// Function to check release dates and send notifications
async function checkReleaseDates() {
  try {
    const query = `
      SELECT 
        product_id,
        title,
        release_date,
        DATEDIFF(release_date, CURDATE()) AS days_until_release
      FROM visitorDB.products
      WHERE 
        release_date IS NOT NULL
        AND DATEDIFF(release_date, CURDATE()) IN (1, 3, 7, 14)
        AND product_id = 1;
    `;

    const rows: ReleaseReminder[] = await executeQuery<ReleaseReminder[]>(query); // Explicitly typed

    for (const row of rows) { // row is now a single ReleaseReminder
      const days = row.days_until_release;
      const releaseDate = new Date(row.release_date).toLocaleDateString();
      const subject = `Release Reminder: ${row.title}`;
      const htmlContent = `
        <h2>Release Date Reminder</h2>
        <p>The product "<strong>${row.title}</strong>" (Product ID: ${row.product_id}) is releasing in <strong>${days} day${days > 1 ? 's' : ''}</strong>!</p>
        <p><strong>Release Date:</strong> ${releaseDate}</p>
        <p>Stay tuned for availability updates!</p>
      `;

      await sendEmail(
        'derekgallardo01@gmail.com',
        subject,
        htmlContent
      );
      console.log(`Notification sent for Product ID ${row.product_id}: ${days} days until release on ${releaseDate}`);
    }

    if (rows.length === 0) {
      console.log('No release date notifications triggered today.');
    }
  } catch (error) {
    console.error('Error checking release dates or sending email:', error);
  }
}

// Main function to start the service
function startReleaseNotifier() {
  console.log('Starting Release Notifier Service...');

  cron.schedule('0 9 * * *', () => {
    console.log('Checking release dates for notifications...', new Date().toLocaleString());
    checkReleaseDates();
  }, {
    timezone: 'America/New_York', // Adjust to your timezone
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  console.log('Release Notifier Service is running. Press Ctrl+C to stop.');
}

if (require.main === module) {
  startReleaseNotifier();
}

export { startReleaseNotifier };