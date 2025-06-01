require('dotenv').config();
const axios = require('axios');
const qs = require('qs');

const API_URL = 'https://api.constantcontact.com/v3';
const CLIENT_ID = '38a70497-ed35-4c33-a30f-def162e5adb4';
const CLIENT_SECRET = process.env.CONSTANT_CONTACT_CLIENT_SECRET; // Ensure set in .env
const REDIRECT_URI = 'http://localhost:3000/auth/constantcontact/callback';
const STATE = '123456'; // Constant for state validation

// Validate environment variables
if (!CLIENT_SECRET) {
  throw new Error('CONSTANT_CONTACT_CLIENT_SECRET is not set in .env file');
}

async function getAuthorizationUrl() {
  const params = {
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'contact_data offline_access account_read campaign_data', // Added campaign_data
    state: STATE,
  };

  const authUrl = `https://authz.constantcontact.com/oauth2/default/v1/authorize?${qs.stringify(params)}`;
  console.log('Please visit this URL to authorize the application:');
  console.log(authUrl);

  console.log('\nAfter authorizing, you will be redirected to localhost:3000');
  console.log('Please copy the entire URL from your browser and paste it here:');

  return new Promise((resolve, reject) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('Enter the full redirect URL: ', (url) => {
      readline.close();
      try {
        const parsedUrl = new URL(url);
        const code = parsedUrl.searchParams.get('code');
        const returnedState = parsedUrl.searchParams.get('state');
        if (!code) {
          reject(new Error('No authorization code found in URL'));
        }
        if (returnedState !== STATE) {
          reject(new Error('State mismatch! Possible CSRF attack.'));
        }
        resolve(code);
      } catch (error) {
        reject(new Error(`Invalid URL: ${error.message}`));
      }
    });
  });
}

async function exchangeCodeForToken(authorizationCode) {
  try {
    const response = await axios.post(
      'https://authz.constantcontact.com/oauth2/default/v1/token',
      qs.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    console.log('Successfully obtained tokens');
    console.log('Response data:', response.data);
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    console.error('Full error:', error.response?.data);
    throw error;
  }
}

async function refreshAccessToken(refreshToken) {
  try {
    const response = await axios.post(
      'https://authz.constantcontact.com/oauth2/default/v1/token',
      qs.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    console.log('Successfully refreshed access token');
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    throw error;
  }
}

async function testConstantContact() {
  try {
    // Get authorization code
    const authorizationCode = await getAuthorizationUrl();

    // Exchange code for access and refresh tokens
    let tokens = await exchangeCodeForToken(authorizationCode);
    let accessToken = tokens.access_token;
    let refreshToken = tokens.refresh_token;

    // Test a minimal read-only endpoint
    try {
      console.log('Fetching account summary...');
      const accountSummary = await axios.get(`${API_URL}/account/summary`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      });
      console.log('Account summary:', accountSummary.data);
    } catch (summaryError) {
      console.error('Failed to fetch account summary:', summaryError.response?.data || summaryError.message);
    }

    // Try to fetch available contact lists
    let listId = null;
    try {
      console.log('Fetching available contact lists...');
      const listsResponse = await axios.get(`${API_URL}/contact_lists`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      const lists = listsResponse.data.lists;
      console.log('Available lists:', lists);

      if (!lists || lists.length === 0) {
        console.warn('No contact lists found. Creating contact without list membership.');
      } else {
        listId = lists[0].list_id;
        console.log('Using list ID:', listId);
      }
    } catch (listError) {
      console.error('Failed to fetch contact lists:', listError.response?.data || listError.message);
      console.warn('Proceeding to create contact without list membership.');
    }

    // Test API with access token
    const contactData = {
      email_address: `test-${Date.now()}@example.com`, // Unique email to avoid duplicates
      first_name: 'Test',
      last_name: 'User',
      create_source: 'Account',
      permission_to_send: 'implicit',
    };

    // Add list membership only if listId exists
    if (listId) {
      contactData.list_memberships = [listId];
    }

    try {
      const addContact = await axios.post(`${API_URL}/contacts`, contactData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      console.log('Successfully added contact to Constant Contact');
      console.log('Response:', addContact.data);
    } catch (contactError) {
      console.error('Failed to create contact:', contactError.response?.data || contactError.message);
      // Try refreshing token and retrying contact creation
      console.log('Attempting to refresh token and retry...');
      try {
        tokens = await refreshAccessToken(refreshToken);
        accessToken = tokens.access_token;
        refreshToken = tokens.refresh_token;

        const retryAddContact = await axios.post(`${API_URL}/contacts`, contactData, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 10000,
        });

        console.log('Successfully added contact after token refresh');
        console.log('Response:', retryAddContact.data);
      } catch (retryError) {
        console.error('Retry failed:', retryError.response?.data || retryError.message);
      }
    }

  } catch (error) {
    console.error('Error testing Constant Contact:', error.response?.data || error.message);
    console.error('Full error details:', error.response?.data);
  }
}

testConstantContact();