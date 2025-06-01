const { sendEmail } = require('./../src/app/lib/email');

async function testGmail() {
  try {
    const to = 'derekgallardo01@gmail.com';
    const subject = 'Test Email from TCG Market';
    const content = `
      <h1>Test Email</h1>
      <p>This is a test email sent directly using the Gmail API.</p>
      <p>Current time: ${new Date().toLocaleString()}</p>
      <p>Includes both HTML and plain text versions.</p>
    `;

    console.log('Attempting to send test email...');
    await sendEmail(to, subject, content);
    console.log('Email sent successfully!');
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

testGmail();
