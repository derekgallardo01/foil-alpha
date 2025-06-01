import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

// Hardcode GMAIL_REFRESH_TOKEN temporarily to match test-gmail.js
const GMAIL_REFRESH_TOKEN = "1//05uIp2_UZFzvkCgYIARAAGAUSNgF-L9IrSnbrN5VSqA8vZZOgmLLhFsRqvtDgcYI1nQWJJNoEdUHSV1qQQlbcDziPurGyUsTHag";

const credentialsPath = path.join(process.cwd(), "credentials.json");
console.log("Credentials path:", credentialsPath);

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  console.log("Credentials loaded successfully");
} catch (error) {
  console.error("Error loading credentials:", {
    message: error.message,
    stack: error.stack,
  });
  throw new Error("Failed to load Gmail credentials");
}

const { client_id, client_secret, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[1]);

oAuth2Client.setCredentials({
  refresh_token: GMAIL_REFRESH_TOKEN,
});

oAuth2Client.on("tokens", (tokens) => {
  if (tokens.refresh_token) {
    console.log("New refresh token received:", tokens.refresh_token);
  }
  console.log("Access token refreshed:", tokens.access_token);
});

const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

export async function sendEmail(to: string, subject: string, htmlContent: string) {
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  try {
    console.log(`[${timestamp}] Starting sendEmail function for ${to}`);
    console.log(`[${timestamp}] GMAIL_REFRESH_TOKEN: ${GMAIL_REFRESH_TOKEN ? "SET" : "NOT SET"}`);

    console.log(`[${timestamp}] Attempting to obtain access token`);
    const { token } = await oAuth2Client.getAccessToken();
    if (!token) {
      throw new Error("Failed to obtain access token");
    }
    console.log(`[${timestamp}] Access token obtained successfully`);

    const textContent = htmlContent.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
    const emailContent = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: multipart/alternative; boundary=boundary",
      "",
      "--boundary",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      textContent,
      "",
      "--boundary",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      htmlContent,
      "",
      "--boundary--",
      "",
    ].join("\n");

    console.log(`[${timestamp}] Encoding message`);
    const encodedMessage = Buffer.from(emailContent)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    console.log(`[${timestamp}] Sending email to ${to} with subject: ${subject}`);
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });
    console.log(`[${timestamp}] Email sent successfully to ${to}`, response.data);
    return response.data;
  } catch (error) {
    console.error(`[${timestamp}] Error sending email to ${to}:`, {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      code: error.code,
    });
    throw error;
  }
}