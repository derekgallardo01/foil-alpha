import { sendEmail } from './email';

async function testEmail() {
  try {
    // Log start of test
    console.log('Starting test-email.ts');
    console.log('Environment variables:', {
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ? 'SET' : 'NOT SET'
    });

    const to = 'derekgallardo01@gmail.com';
    const subject = 'Test Email from TCG Market (email.ts)';
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
  } catch (error) {
    console.error('Error sending test email:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    throw error;
  }
}

export default testEmail;
