const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const credentialsPath = path.join(__dirname, '..', 'credentials.json');
console.log('Credentials path:', credentialsPath);

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  console.log('Credentials loaded successfully:', {
    client_id: credentials.web.client_id,
    project_id: credentials.web.project_id,
    redirect_uris: credentials.web.redirect_uris
  });
} catch (error) {
  console.error('Error loading credentials:', {
    message: error.message,
    stack: error.stack,
  });
  throw new Error('Failed to load Gmail credentials');
}

const { client_id, client_secret, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
if (!refreshToken) {
  console.error('GMAIL_REFRESH_TOKEN is not set in environment variables');
  throw new Error('GMAIL_REFRESH_TOKEN is not set');
}

console.log('Setting credentials with refresh token:', {
  client_id,
  has_refresh_token: !!refreshToken
});

oAuth2Client.setCredentials({
  refresh_token: refreshToken,
});

async function testAuth() {
  try {
    console.log('Attempting to get access token...');
    const { token } = await oAuth2Client.getAccessToken();
    console.log('Access token obtained:', token);

    console.log('Testing Gmail API...');
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('Gmail profile:', profile.data);
  } catch (error) {
    console.error('Error testing Gmail auth:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
  }
}

testAuth();
