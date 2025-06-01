const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { createInterface } = require('readline');

// Initialize OAuth2 client at module level
let oAuth2Client;

async function generateRefreshToken() {
    const credentialsPath = path.join(process.cwd(), "credentials.json");
    const tokenPath = path.join(process.cwd(), "token.json");

    console.log("Credentials path:", credentialsPath);
    console.log("Token path:", tokenPath);

    let credentials;
    try {
        credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
        console.log("Credentials loaded successfully:", {
            client_id: credentials.web.client_id,
            redirect_uris: credentials.web.redirect_uris,
            project_id: credentials.web.project_id,
        });
    } catch (error) {
        console.error("Error loading credentials:", {
            message: error.message,
            stack: error.stack,
        });
        throw new Error("Failed to load Gmail credentials");
    }

    let tokens;
    try {
        tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        console.log("Tokens loaded successfully:", {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ? "SET" : "NOT SET",
            scope: tokens.scope,
        });
    } catch (error) {
        console.error("Error loading tokens:", {
            message: error.message,
            stack: error.stack,
        });
        throw new Error("Failed to load Gmail tokens");
    }

    const SCOPES = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly'
    ];

    const { client_id, client_secret, redirect_uris } = credentials.web;
    oAuth2Client = new google.auth.OAuth2({
        clientId: client_id,
        clientSecret: client_secret,
        redirectUri: redirect_uris[0]
    });

    // Set scopes explicitly
    oAuth2Client.scopes = SCOPES.join(' ');

    // Get authorization URL
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });

    console.log('Please visit this URL to authorize the application:', authUrl);

    // Wait for user to authorize and paste the code
    const code = await new Promise((resolve) => {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('Enter the authorization code: ', (code) => {
            rl.close();
            resolve(code);
        });
    });

    // Exchange authorization code for tokens
    const authResult = await oAuth2Client.getToken(code);

    // Set credentials with new tokens
    oAuth2Client.setCredentials(authResult.tokens);

    // Save tokens to token.json
    fs.writeFileSync(tokenPath, JSON.stringify(authResult.tokens, null, 2));
    console.log('Tokens saved to', tokenPath);
}

async function testConnection() {
    try {
        console.log('\nTesting Gmail API connection...');
        
        // Log OAuth2 client state
        console.log('OAuth2 Client State:', {
            hasCredentials: !!oAuth2Client.credentials,
            hasAccessToken: !!oAuth2Client.credentials?.access_token,
            hasRefreshToken: !!oAuth2Client.credentials?.refresh_token,
            scopes: oAuth2Client.scopes
        });

        const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
        
        // Get Gmail profile
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.log('Profile:', profile.data);
        
        // List labels
        const labels = await gmail.users.labels.list({ userId: 'me' });
        console.log(`Found ${labels.data.labels.length} labels`);
        
        console.log('\nGmail API test successful!');
    } catch (error) {
        console.error('\nTest failed:', error);
        throw error;
    }
}

async function main() {
    try {
        await generateRefreshToken();
        if (process.argv[2] === 'test') {
            await testConnection();
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main();