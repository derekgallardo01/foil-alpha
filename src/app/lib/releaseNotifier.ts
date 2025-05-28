import { schedule } from 'node-cron';
import { executeQuery } from './db';
import { sendEmail } from './email';
import { RowDataPacket } from 'mysql2/promise';

interface ReleaseReminder extends RowDataPacket {
  product_id: string;
  title: string;
  release_date: string;
  days_until_release: number;
}

function encodeSubject(subject: string): string {
  const encoded = Buffer.from(subject, 'utf8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

async function checkReleaseDates(isTest: boolean = false) {
  try {
    const daysToCheck = isTest ? [61] : [1, 3, 7, 14];
    const productIds = [1, 12, 13, 14]; // Configurable
    const query = `
      SELECT 
        product_id,
        title,
        release_date,
        DATEDIFF(release_date, CURDATE()) AS days_until_release
      FROM visitorDB.products
      WHERE 
        release_date IS NOT NULL
        AND DATEDIFF(release_date, CURDATE()) IN (${daysToCheck.join(',')})
        AND product_id IN (${productIds.join(',')});
    `;

    console.log(`[${new Date().toLocaleString()}] Executing query: ${query}`);
    const rows: ReleaseReminder[] = await executeQuery<ReleaseReminder[]>(query);

    if (rows.length === 0) {
      console.log(`[${new Date().toLocaleString()}] No release date notifications triggered ${isTest ? 'for test' : 'today'}.`);
      if (isTest) {
        // Send a test email even if no rows are found
        const testSubject = encodeSubject("Test Email: Release Notifier Startup");
        const testHtmlContent = `
          <h2>Test Email</h2>
          <p>This is a test email to confirm the Release Notifier email system is working.</p>
          <p>Sent on startup: ${new Date().toLocaleString()}</p>
        `;
        console.log(`[${new Date().toLocaleString()}] Sending test email to verify email functionality...`);
        await sendEmail('derekgallardo01@gmail.com', testSubject, testHtmlContent);
        console.log(`[${new Date().toLocaleString()}] Test email sent successfully.`);
      }
      return;
    }

    for (const row of rows) {
      const days = row.days_until_release;
      const releaseDate = new Date(row.release_date).toLocaleDateString();
      const subject = encodeSubject(`Release Reminder: ${row.title}`);
      const htmlContent = `
        <h2>Release Date Reminder</h2>
        <p>The product "<strong>${row.title}</strong>" (Product ID: ${row.product_id}) is releasing in <strong>${days} day${days > 1 ? 's' : ''}</strong>!</p>
        <p><strong>Release Date:</strong> ${releaseDate}</p>
        <img src="https://target.scene7.com/is/image/Target/GUEST_e9b070dc-a9b9-4cf1-a8f0-0b01963959da?wid=1200&hei=1200&qlt=80&fmt=webp" alt="${row.title}" style="max-width: 30%; height: auto;" />
        <p>Stay tuned for availability updates!</p>
      `;

      try {
        console.log(`[${new Date().toLocaleString()}] Attempting to send email for Product ID ${row.product_id} to derekgallardo01@gmail.com with subject: ${subject}`);
        await sendEmail('derekgallardo01@gmail.com', subject, htmlContent);
        console.log(`[${new Date().toLocaleString()}] Email successfully sent for Product ID ${row.product_id}: ${days} days until release on ${releaseDate}`);
      } catch (emailError) {
        console.error(`[${new Date().toLocaleString()}] Failed to send email for Product ID ${row.product_id}:`, emailError);
      }
    }
  } catch (error) {
    console.error(`[${new Date().toLocaleString()}] Error in checkReleaseDates:`, error);
    if (isTest) {
      // Attempt a test email even if the query fails, to isolate email functionality
      console.log(`[${new Date().toLocaleString()}] Query failed, but attempting test email to verify email system...`);
      const testSubject = encodeSubject("Test Email: Release Notifier Error Fallback");
      const testHtmlContent = `
        <h2>Test Email (Error Fallback)</h2>
        <p>Query failed, but this email confirms the email system is operational.</p>
        <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
      `;
      try {
        await sendEmail('derekgallardo01@gmail.com', testSubject, testHtmlContent);
        console.log(`[${new Date().toLocaleString()}] Test email sent despite query error.`);
      } catch (emailError) {
        console.error(`[${new Date().toLocaleString()}] Test email failed:`, emailError);
      }
    }
  }
}

async function startReleaseNotifier() {
  console.log(`[${new Date().toLocaleString()}] Starting Release Notifier Service...`);

  console.log(`[${new Date().toLocaleString()}] Running immediate test email...`);
  await checkReleaseDates(true);

  schedule('0 0 * * *', () => {
    console.log(`[${new Date().toLocaleString()}] Scheduled check at 12:00 AM EST...`);
    checkReleaseDates(false);
  }, { timezone: 'America/New_York' });

  schedule('0 5 * * *', () => {
    console.log(`[${new Date().toLocaleString()}] Scheduled check at 5:00 AM EST...`);
    checkReleaseDates(false);
  }, { timezone: 'America/New_York' });

  process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toLocaleString()}] Uncaught Exception:`, err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toLocaleString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
  });

  console.log(`[${new Date().toLocaleString()}] Release Notifier Service is running. Press Ctrl+C to stop.`);
}

if (require.main === module) {
  (async () => {
    await startReleaseNotifier();
  })();
}

export { startReleaseNotifier };