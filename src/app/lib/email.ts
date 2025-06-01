import { google } from "googleapis";
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient } from "@prisma/client";
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

type Credentials = {
    web: {
        client_id: string;
        client_secret: string;
        redirect_uris: string[];
    }
};

type Token = {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
};

dotenv.config({ path: path.join(process.cwd(), ".env") });

const prisma = new PrismaClient();

// Load credentials and token
const credentialsPath = path.join(process.cwd(), "credentials.json");
const tokenPath = path.join(process.cwd(), "token.json");

let credentials: Credentials;
try {
    credentials = JSON.parse(await fs.readFile(credentialsPath, "utf8")) as Credentials;
} catch (error) {
    console.error("Error loading credentials:", error);
    throw error;
}

let tokens: Token;
try {
    tokens = JSON.parse(await fs.readFile(tokenPath, "utf8")) as Token;
} catch (error) {
    console.error("Error loading tokens:", error);
    throw error;
}

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly'
];

// Initialize OAuth2 client with credentials and scopes
const oAuth2Client = new google.auth.OAuth2({
    clientId: credentials.web.client_id,
    clientSecret: credentials.web.client_secret,
    redirectUri: credentials.web.redirect_uris[0]
});

// Set credentials
oAuth2Client.setCredentials(tokens);

// Set credentials
oAuth2Client.setCredentials(tokens);

// Initialize Gmail API
const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

async function ensureValidToken() {
    try {
        if (!oAuth2Client.credentials?.access_token) {
            console.log("Refreshing access token...");
            await oAuth2Client.refreshAccessToken();
        }
    } catch (error) {
        console.error("Error refreshing token:", error);
        throw error;
    }
}

export async function testGmailApi() {
    console.log("\nTesting Gmail API connection...");
    try {
        console.log("Attempting to get Gmail profile...");
        console.log("API client configuration:", {
            auth: !!oAuth2Client,
            scopes: SCOPES,
            credentials: oAuth2Client.credentials
        });
        
        // Log OAuth2 client configuration
        console.log("\nOAuth2 client configuration:", {
            clientId: credentials.web.client_id,
            hasCredentials: !!oAuth2Client.credentials,
            hasAccessToken: !!oAuth2Client.credentials?.access_token,
            hasRefreshToken: !!oAuth2Client.credentials?.refresh_token
        });
        
        // Force token refresh before making API call
        console.log("\nForcing token refresh before API call...");
        const refreshResult = await oAuth2Client.refreshAccessToken();
        console.log("Token refresh result:", {
            access_token: refreshResult.credentials.access_token,
            token_type: refreshResult.credentials.token_type
        });
        
        // Log OAuth2 client state
        console.log("\nOAuth2 client state:", {
            hasCredentials: !!oAuth2Client.credentials,
            hasAccessToken: !!oAuth2Client.credentials?.access_token,
            hasRefreshToken: !!oAuth2Client.credentials?.refresh_token,
            scopes: oAuth2Client.scopes
        });
        
        // Get Gmail profile
        console.log("\nGetting Gmail profile...");
        const profileResponse = await gmail.users.getProfile({ userId: 'me' });
        console.log("Profile info:", {
            email: profileResponse.data.emailAddress,
            messagesTotal: profileResponse.data.messagesTotal,
            threadsTotal: profileResponse.data.threadsTotal
        });
        
        // List labels to verify permissions
        console.log("\nListing Gmail labels...");
        const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
        console.log("Found", labelsResponse.data.labels?.length || 0, "labels");
        
        console.log("\nGmail API test successful!");
    } catch (error) {
        console.error("Test failed:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            response: error instanceof Error ? (error as Error & { response?: { data: any } }).response?.data : undefined,
            code: error instanceof Error ? (error as Error & { code?: any }).code : undefined,
            status: error instanceof Error ? (error as Error & { response?: { status: any } }).response?.status : undefined,
            errorObject: error
        });
        throw error;
    }
}

export async function sendEmail(to: string, subject: string, htmlContent: string) {
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    try {
        console.log(`[${timestamp}] Attempting to send email:`, {
            to,
            subject,
            contentLength: htmlContent.length,
        });

        await ensureValidToken();

        const message = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "MIME-Version: 1.0",
            'Content-Type: text/html; charset="UTF-8"',
            "Content-Transfer-Encoding: base64",
            "",
            Buffer.from(htmlContent).toString("base64"),
        ].join("\n");

        const rawMessage = Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        console.log(`[${timestamp}] Raw message created (first 100 chars):`, rawMessage.substring(0, 100));

        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: rawMessage,
            },
        });

        console.log(`[${timestamp}] Email sent successfully:`, {
            id: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds,
        });
        return response.data;
    } catch (error) {
        console.error(`[${timestamp}] Email sending failed:`, {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
            code: error.code,
            status: error.response?.status,
        });
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

// Test function - only runs if this file is executed directly
if (import.meta.url === new URL(import.meta.url).pathname) {
    const testEmail = async () => {
        try {
            await testGmailApi();
            console.log("\nSending test email...");
            await sendEmail(
                process.env.TEST_EMAIL || "test@example.com",
                "Test Email from TCG Market",
                "<h1>Test Email</h1><p>This is a test email sent from the TCG Market email system.</p>"
            );
            console.log("\nTest email sent successfully!");
        } catch (error) {
            console.error("Test failed:", error);
        }
    };

    testEmail();
}
