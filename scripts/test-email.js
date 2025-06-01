const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Load credentials from file
const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const { client_id, client_secret } = credentials.web;
const redirect_uris = credentials.web.redirect_uris;

// Create OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[1]
);

// Set the refresh token from environment
oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

async function sendTestEmail() {
  try {
    // Get access token
    const accessToken = await oAuth2Client.getAccessToken();
    
    // Create Gmail API client
    const gmail = google.gmail({
      version: 'v1',
      auth: oAuth2Client
    });

    // Create email message
    const message = {
      to: 'derekgallardo01@gmail.com',
      subject: 'Test Email from TCG Market',
      text: 'This is a test email sent from the TCG Market application using Gmail API.',
      html: '<h1>Test Email</h1><p>This is a test email sent from the TCG Market application using Gmail API.</p>'
    };

    // Convert message to raw format
    const rawMessage = createRawMessage(message);

    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage
      }
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', response.data.id);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

function createRawMessage(message) {
  const str = [
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    'MIME-Version: 1.0',
    'Content-type: multipart/alternative; boundary=boundary',
    '',
    '--boundary',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    message.text,
    '',
    '--boundary',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    message.html,
    '',
    '--boundary--',
    ''
  ].join('\n');

  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

sendTestEmail();
