const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const credentialsPath = path.join(__dirname, '..', 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

const { client_id, client_secret, redirect_uris } = credentials.web;
console.log('Using credentials:');
console.log('Client ID:', client_id.slice(0, 10) + '...');
console.log('Client Secret:', client_secret.slice(0, 10) + '...');
console.log('Redirect URI:', redirect_uris[0]);

// Use the first redirect URI from credentials
const redirectUri = redirect_uris[1]; // Use the second redirect URI

async function exchangeToken(code) {
  console.log('Exchanging authorization code:', code.slice(0, 10) + '...');

  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code: code,
        client_id: client_id,
        client_secret: client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('\nToken response received!');
    console.log('Token Response:', JSON.stringify(data, null, 2));
    
    if (data.refresh_token) {
      console.log('Refresh Token:', data.refresh_token);
      console.log('Access Token:', data.access_token?.slice(0, 10) + '...');
      console.log('\nAdd this to your .env file:');
      console.log('GMAIL_REFRESH_TOKEN=', data.refresh_token);
    } else {
      console.error('No refresh token received in response');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error retrieving access token:', {
      message: err.message,
      code: err.code,
      response: err.response?.data
    });
    process.exit(1);
  }
}

async function main() {
  try {
    // Extract the authorization code from the URL
    const url = process.argv[2];
    if (!url) {
      console.error('Please provide the full URL from the browser as the first argument');
      process.exit(1);
    }

    const searchParams = new URL(url).searchParams;
    const code = searchParams.get('code');
    
    if (!code) {
      console.error('No authorization code found in URL');
      process.exit(1);
    }

    console.log('Extracted authorization code:', code.slice(0, 10) + '...');
    await exchangeToken(code);
  } catch (err) {
    console.error('Error processing URL:', err.message);
    process.exit(1);
  }
}

main();
