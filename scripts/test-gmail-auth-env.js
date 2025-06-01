const { google } = require('googleapis');
const path = require('path');
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = require(path.join(__dirname, 'load-env'));

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
  console.error('Missing required environment variables');
  console.error('GOOGLE_CLIENT_ID:', !!GOOGLE_CLIENT_ID);
  console.error('GOOGLE_CLIENT_SECRET:', !!GOOGLE_CLIENT_SECRET);
  console.error('GMAIL_REFRESH_TOKEN:', !!GMAIL_REFRESH_TOKEN);
  process.exit(1);
}

console.log('Environment variables loaded:', {
  clientId: GOOGLE_CLIENT_ID.slice(0, 10) + '...',
  projectId: process.env.GOOGLE_PROJECT_ID,
  redirectUri: 'http://localhost:3000'
});

const oAuth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'http://localhost:3000'
);

oAuth2Client.setCredentials({
  refresh_token: GMAIL_REFRESH_TOKEN,
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
