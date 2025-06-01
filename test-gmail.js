const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const GMAIL_REFRESH_TOKEN = "1//05uIp2_UZFzvkCgYIARAAGAUSNgF-L9IrSnbrN5VSqA8vZZOgmLLhFsRqvtDgcYI1nQWJJNoEdUHSV1qQQlbcDziPurGyUsTHag";
// Load environment variables
require('dotenv').config();

// Load credentials from file
console.log('Loading credentials...');
const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
const { client_id, client_secret } = credentials.web;
const redirect_uris = credentials.web.redirect_uris;

// Create OAuth2 client
console.log('Creating OAuth2 client...');
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[1]
);

// Set the refresh token from environment
console.log('Setting credentials with refresh token...');
oAuth2Client.setCredentials({
  refresh_token: GMAIL_REFRESH_TOKEN
});

async function testEmail() {
  try {
    console.log('Starting testEmail function');
    console.log('Environment variables:', {
      GMAIL_REFRESH_TOKEN: GMAIL_REFRESH_TOKEN ? 'SET' : 'NOT SET'
    });

    // Create Gmail API client
    console.log('Creating Gmail API client...');
    const gmail = google.gmail({
      version: 'v1',
      auth: oAuth2Client
    });

    // Create email message
    const message = {
      to: 'derekgallardo01@gmail.com',
      subject: 'Direct Test Email',
      text: 'This is a direct test email sent using the Gmail API.',
      html: '<h1>Direct Test Email</h1><p>This is a direct test email sent using the Gmail API.</p>'
    };

    console.log('Creating raw message...');
    // Convert message to raw format
    const rawMessage = [
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary=boundary',
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

    console.log('Encoding message...');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log('Attempting to send email...');
    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });

    console.log('Email sent successfully!');
    console.log('Message ID:', response.data.id);
  } catch (error) {
    console.error('Error in testEmail:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      code: error.code
    });
    throw error;
  }
}

// Run the test
console.log('Starting test...');
testEmail();
