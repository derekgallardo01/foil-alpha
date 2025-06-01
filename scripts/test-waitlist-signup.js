const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Create logs directory if it doesn't exist
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'waitlist-signup.log');

async function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    await fs.appendFile(LOG_FILE, logEntry);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

async function testWaitlistSignup() {
  try {
    // Create logs directory if it doesn't exist
    await fs.mkdir(LOG_DIR, { recursive: true });
    
    // Test data
    const testEmail = `test+${Date.now()}@example.com`;
    const testName = 'Test User';
    const testSource = 'TEST_SCRIPT';

    console.log('Starting waitlist signup test...');
    await logToFile('Starting waitlist signup test...');

    // Test API endpoint
    console.log('Testing API endpoint...');
    await logToFile('Testing API endpoint...');

    try {
      const response = await axios.post('http://localhost:3000/api/subscribe', {
        name: testName,
        email: testEmail
      });

      console.log('API Response:', response.data);
      await logToFile(`API Response: ${JSON.stringify(response.data)}`);

      // Verify database entry
      const verifyResponse = await axios.get(`http://localhost:3000/api/waitlist?email=${encodeURIComponent(testEmail)}`);
      console.log('Database Verification:', verifyResponse.data);
      await logToFile(`Database Verification: ${JSON.stringify(verifyResponse.data)}`);

      console.log('Test completed successfully!');
      await logToFile('Test completed successfully!');

    } catch (error) {
      console.error('API Error:', error.response?.data || error.message);
      await logToFile(`API Error: ${error.response?.data || error.message}`);
    }

  } catch (error) {
    console.error('Error testing waitlist signup:', error);
    await logToFile(`Error testing waitlist signup: ${error.message}`);
  }
}

// Run the test
testWaitlistSignup();
