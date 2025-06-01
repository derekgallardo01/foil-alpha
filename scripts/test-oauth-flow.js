const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const credentialsPath = path.join(__dirname, '..', 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

const { client_id, client_secret } = credentials.web;
const redirect_uris = credentials.web.redirect_uris;
console.log('Available redirect URIs:', redirect_uris);
// Use the first redirect URI from credentials
const redirectUri = redirect_uris[1]; // Use the second redirect URI
console.log('Using redirect URI:', redirectUri);
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

// Generate the authorization URL
const scopes = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
];

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  new URLSearchParams({
    client_id: client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: 'offline'
  }).toString();

console.log('\nOAuth2 Configuration:');
console.log('Client ID:', client_id.slice(0, 10) + '...');
console.log('Client Secret:', client_secret.slice(0, 10) + '...');
console.log('Redirect URI:', redirectUri);
console.log('Scopes:', scopes.join(', '));
console.log('\nGenerated authorization URL:', authUrl);

// Open the URL in the default browser
require('child_process').exec(`start ${authUrl}`);

console.log('\nPlease visit this URL in your browser to authorize the application:');
console.log(authUrl);

console.log('\nAfter authorization, you will be redirected to your browser.');
console.log('The authorization code will be captured automatically.');
