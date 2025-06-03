import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

interface Credentials {
  web: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface Token {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

interface ApiErrorResponse {
  data?: unknown;
  status?: number;
}

interface CustomError extends Error {
  response?: ApiErrorResponse;
  code?: string;
}

// Validate environment and credentials
const credentialsPath = path.join(process.cwd(), 'credentials.json');
const tokenPath = path.join(process.cwd(), 'token.json');

let credentials: Credentials;
let tokens: Token;

async function loadCredentials() {
  try {
    const data = await fs.readFile(credentialsPath, 'utf8');
    credentials = JSON.parse(data) as Credentials;
  } catch (error) {
    throw new Error(`Failed to load credentials: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function loadTokens() {
  try {
    const data = await fs.readFile(tokenPath, 'utf8');
    tokens = JSON.parse(data) as Token;
  } catch (error) {
    throw new Error(`Failed to load tokens: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Initialize OAuth2 client
async function initializeOAuth2Client() {
  await loadCredentials();
  await loadTokens();

  if (!credentials.web.client_id || !credentials.web.client_secret || !credentials.web.redirect_uris[0]) {
    throw new Error('Invalid credentials configuration');
  }

  const oAuth2Client = new google.auth.OAuth2({
    clientId: credentials.web.client_id,
    clientSecret: credentials.web.client_secret,
    redirectUri: credentials.web.redirect_uris[0],
  });

  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

// Initialize Gmail API
async function initializeGmail() {
  const oAuth2Client = await initializeOAuth2Client();
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

async function ensureValidToken(oAuth2Client: OAuth2Client) {
  try {
    if (!oAuth2Client.credentials.access_token) {
      await oAuth2Client.refreshAccessToken();
    }
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function testGmailApi() {
  try {
    const gmail = await initializeGmail();
    const profileResponse = await gmail.users.getProfile({ userId: 'me' });
    return {
      success: true,
      email: profileResponse.data.emailAddress,
      messagesTotal: profileResponse.data.messagesTotal,
      threadsTotal: profileResponse.data.threadsTotal,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const customErr = err as CustomError;
    throw new Error(`Gmail API test failed: ${err.message}`, {
      cause: {
        message: err.message,
        stack: err.stack,
        response: customErr.response?.data,
        code: customErr.code,
        status: customErr.response?.status,
      },
    });
  }
}

export async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    if (!to || !subject || !htmlContent) {
      throw new Error('Missing required email parameters');
    }

    const oAuth2Client = await initializeOAuth2Client();
    await ensureValidToken(oAuth2Client);
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlContent).toString('base64'),
    ].join('\n');

    const rawMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    return {
      success: true,
      id: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const customErr = err as CustomError;
    throw new Error(`Failed to send email: ${err.message}`, {
      cause: {
        message: err.message,
        stack: err.stack,
        response: customErr.response?.data,
        code: customErr.code,
        status: customErr.response?.status,
      },
    });
  }
}