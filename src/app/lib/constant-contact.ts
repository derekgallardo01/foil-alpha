import axios from 'axios';
import qs from 'qs';

const CLIENT_ID = process.env.CONSTANT_CONTACT_CLIENT_ID;
const CLIENT_SECRET = process.env.CONSTANT_CONTACT_CLIENT_SECRET;
const API_URL = 'https://api.constantcontact.com/v3';
const TOKEN_URL = 'https://authz.constantcontact.com/oauth2/default/v1/token';
const REDIRECT_URI = 'http://localhost:3000/auth/constantcontact/callback';

interface ContactData {
  email_address: string;
  first_name: string;
  last_name: string;
  create_source: string;
  permission_to_send: string;
  status: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

let cachedToken: TokenResponse | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_in * 1000) {
    return cachedToken.access_token;
  }

  try {
    // Get authorization URL
    const authUrl = `https://authz.constantcontact.com/oauth2/default/v1/authorize?${qs.stringify({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: 'http://localhost:3000/auth/constantcontact/callback',
      scope: 'contact_data offline_access',
      state: 'test_state'
    })}`;

    console.log('Please visit this URL to authorize:');
    console.log(authUrl);

    // Wait for user input
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\nAfter authorizing, you will be redirected to localhost:3000');
    console.log('Please copy the entire URL from your browser and paste it here:');

    const authorizationCode = await new Promise<string>((resolve) => {
      readline.question('Enter the full redirect URL: ', (url: string) => {
        readline.close();
        resolve(url);
      });
    });

    // Extract authorization code from URL
    const parsedUrl = new URL(authorizationCode as string);
    const code = parsedUrl.searchParams.get('code');
    if (!code) {
      throw new Error('No authorization code found in URL');
    }

    // Exchange code for tokens
    const response = await axios.post(
      TOKEN_URL,
      qs.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'http://localhost:3000/auth/constantcontact/callback',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    cachedToken = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: Math.floor(Date.now() / 1000) + response.data.expires_in - 300 // Subtract 5 minutes for safety
    };

    return cachedToken.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

export const addContactToWaitlist = async (email: string, name: string) => {
  try {
    const accessToken = await getAccessToken();
    
    const [firstName, lastName] = name.split(' ');
    const contactData: ContactData = {
      email_address: email,
      first_name: firstName,
      last_name: lastName || '',
      create_source: 'Website Waitlist',
      permission_to_send: 'implicit',
      status: 'ACTIVE'
    };

    const response = await axios.post(
      `${API_URL}/contacts`,
      contactData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': CLIENT_ID
        },
        params: {
          'api-key': CLIENT_ID
        }
      }
    );

    console.log('Successfully added contact to Constant Contact:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding contact to Constant Contact:', error);
    throw error;
  }
};
