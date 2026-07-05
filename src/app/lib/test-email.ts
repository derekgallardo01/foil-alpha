import { sendEmail } from './email';

interface EmailError extends Error {
  response?: {
    data?: unknown;
  };
}

async function testEmail() {
  try {
    console.log('Starting test-email.ts');
    console.log('Environment variables:', {
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? 'SET' : 'NOT SET',
    });

    const to = 'derekgallardo01@gmail.com';
    const subject = 'Test Email from Foil Alpha (email.ts)';
    const content = `
      <h1>Test Email from email.ts Module</h1>
      <p>This is a test email sent using the email.ts module.</p>
      <p>Current time: ${new Date().toLocaleString()}</p>
      <p>Includes both HTML and plain text versions.</p>
    `;

    console.log('Attempting to send test email using email.ts...');
    console.log('Email details:', { to, subject });

    const result = await sendEmail(to, subject, content);
    console.log('Email sent successfully!');
    console.log('Email response:', result);
    return result;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Error sending test email:', {
      message: err.message,
      stack: err.stack,
      response: (err as EmailError).response?.data, // Use defined interface
    });
    throw err;
  }
}

export default testEmail;