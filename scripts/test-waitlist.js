require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const qs = require('qs');

const prisma = new PrismaClient();
const LOG_FILE = path.join(__dirname, '..', 'logs', 'waitlist-test.log');

async function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;

  try {
    await fs.promises.appendFile(LOG_FILE, logEntry);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

async function getAuthorizationCode() {
  const API_URL = 'https://api.constantcontact.com/v3';
  const CLIENT_ID = '38a70497-ed35-4c33-a30f-def162e5adb4';
  const REDIRECT_URI = 'http://localhost:3000/auth/constantcontact/callback';
  const STATE = '123456';

  const params = {
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: 'contact_data offline_access account_read campaign_data',
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

async function testWaitlist() {
  try {
    // Test data
    const timestamp = Date.now();
    const testEmail = `test+${timestamp}@example.com`;
    const testName = 'Test User';
    const testSource = 'TEST_SCRIPT';

    console.log('Starting waitlist test...');
    await logToFile('Starting waitlist test...');

    // 1. Check if email exists
    console.log('Checking if email exists...');
    await logToFile(`Checking if email exists: ${testEmail}`);

    const existing = await prisma.waitlist.findUnique({ where: { email: testEmail } });
    if (existing) {
      console.log('Email already exists in waitlist');
      await logToFile(`Email already exists: ${testEmail}`);
      return;
    }

    // 2. Add to waitlist
    console.log('Adding to waitlist...');
    await logToFile(`Adding to waitlist: ${testEmail}`);

    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email: testEmail,
        name: testName,
        status: 'PENDING',
        source: testSource,
        metadata: {
          source: testSource,
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log('Successfully added to waitlist:', waitlistEntry);
    await logToFile(`Successfully added to waitlist: ${JSON.stringify(waitlistEntry)}`);

    // 3. Verify database entry
    console.log('Verifying database entry...');
    await logToFile('Verifying database entry...');

    const verified = await prisma.waitlist.findUnique({ where: { email: testEmail } });
    if (!verified) {
      console.error('Failed to verify waitlist entry');
      await logToFile('Failed to verify waitlist entry');
      return;
    }

    // 4. Test API endpoint
    console.log('Testing API endpoint...');
    await logToFile('Testing API endpoint...');

    try {
      const response = await axios.post('http://localhost:3000/api/subscribe', {
        name: testName,
        email: testEmail,
      });

      console.log('API Response:', response.data);
      await logToFile(`API Response: ${JSON.stringify(response.data)}`);
    } catch (error) {
      console.error('API Error:', error.response?.data || error.message);
      await logToFile(`API Error: ${error.response?.data || error.message}`);
    }

    // 5. Test Constant Contact integration
    console.log('Testing Constant Contact integration...');
    await logToFile('Testing Constant Contact integration...');

    try {
      const API_URL = 'https://api.constantcontact.com/v3';
      const CLIENT_ID = '38a70497-ed35-4c33-a30f-def162e5adb4';
      const CLIENT_SECRET = process.env.CONSTANT_CONTACT_CLIENT_SECRET;
      const REDIRECT_URI = 'http://localhost:3000/auth/constantcontact/callback';

      if (!CLIENT_SECRET) {
        throw new Error('CONSTANT_CONTACT_CLIENT_SECRET is not set in .env file');
      }

      // Get authorization code
      const authorizationCode = await getAuthorizationCode();

      // Exchange code for tokens
      console.log('Attempting to exchange authorization code:', authorizationCode);
      const tokenResponse = await axios.post(
        'https://authz.constantcontact.com/oauth2/default/v1/token',
        qs.stringify({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      const accessToken = tokenResponse.data.access_token;
      const refreshToken = tokenResponse.data.refresh_token;
      console.log('Successfully got access token and refresh token');
      await logToFile('Successfully got access token and refresh token');

      // Test read-only endpoint
      try {
        console.log('Fetching account summary...');
        await logToFile('Fetching account summary...');
        const accountSummary = await axios.get(`${API_URL}/account/summary`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 10000,
        });
        console.log('Account summary:', accountSummary.data);
        await logToFile(`Account summary: ${JSON.stringify(accountSummary.data)}`);
      } catch (summaryError) {
        console.error('Failed to fetch account summary:', summaryError.response?.data || summaryError.message);
        await logToFile(`Failed to fetch account summary: ${summaryError.response?.data || summaryError.message}`);
      }

      // Try to fetch contact lists
      let listId = null;
      try {
        console.log('Fetching contact lists...');
        await logToFile('Fetching contact lists...');
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
        await logToFile(`Available lists: ${JSON.stringify(lists)}`);

        if (lists && lists.length > 0) {
          listId = lists[0].list_id;
          console.log('Using list ID:', listId);
          await logToFile(`Using list ID: ${listId}`);
        } else {
          console.warn('No contact lists found. Creating contact without list membership.');
          await logToFile('No contact lists found. Creating contact without list membership.');
        }
      } catch (listError) {
        console.error('Failed to fetch contact lists:', listError.response?.data || listError.message);
        await logToFile(`Failed to fetch contact lists: ${listError.response?.data || listError.message}`);
        console.warn('Proceeding to create contact without list membership.');
        await logToFile('Proceeding to create contact without list membership.');
      }

      // Create contact
      const contactData = {
        email_address: testEmail,
        first_name: testName.split(' ')[0],
        last_name: testName.split(' ')[1] || '',
        create_source: 'Account',
        permission_to_send: 'implicit',
      };

      if (listId) {
        contactData.list_memberships = [listId];
      }

      try {
        const contactResponse = await axios.post(`${API_URL}/contacts`, contactData, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          timeout: 10000,
        });

        console.log('Successfully created contact in Constant Contact:', contactResponse.data);
        await logToFile(`Successfully created contact in Constant Contact: ${JSON.stringify(contactResponse.data)}`);
      } catch (contactError) {
        console.error('Error creating contact:', contactError.response?.data || contactError.message);
        await logToFile(`Error creating contact: ${contactError.response?.data || contactError.message}`);

        // Try refreshing token and retrying
        console.log('Attempting to refresh token and retry...');
        await logToFile('Attempting to refresh token and retry...');

        try {
          const refreshResponse = await axios.post(
            'https://authz.constantcontact.com/oauth2/default/v1/token',
            qs.stringify({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              timeout: 10000,
            }
          );

          const newAccessToken = refreshResponse.data.access_token;
          console.log('Successfully refreshed access token');
          await logToFile('Successfully refreshed access token');

          // Retry contact creation with new token
          const retryContactResponse = await axios.post(`${API_URL}/contacts`, contactData, {
            headers: {
              'Authorization': `Bearer ${newAccessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 10000,
          });

          console.log('Successfully created contact after token refresh:', retryContactResponse.data);
          await logToFile(`Successfully created contact after token refresh: ${JSON.stringify(retryContactResponse.data)}`);
        } catch (refreshError) {
          console.error('Refresh and retry failed:', refreshError.response?.data || refreshError.message);
          await logToFile(`Refresh and retry failed: ${refreshError.response?.data || refreshError.message}`);
        }
      }

    } catch (error) {
      console.error('Constant Contact Error:', error.response?.data || error.message);
      await logToFile(`Constant Contact Error: ${error.response?.data || error.message}`);
    }

    console.log('Test completed successfully!');
    await logToFile('Test completed successfully!');

  } catch (error) {
    console.error('Error testing waitlist:', error);
    await logToFile(`Error testing waitlist: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Create logs directory if it doesn't exist
fs.mkdir(path.join(__dirname, '..', 'logs'), { recursive: true }, (err) => {
  if (err) console.error('Error creating logs directory:', err);
});

// Run the test
testWaitlist();