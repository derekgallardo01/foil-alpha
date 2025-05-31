// src/app/lib/email.ts
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// Use absolute path to credentials.json in project root
const credentialsPath = path.join(process.cwd(), "credentials.json");
console.log('Loading credentials from:', credentialsPath); // Debug log
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

const { client_id, client_secret, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

oAuth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

export async function sendEmail(to: string, subject: string, htmlContent: string) {
  try {
    const emailContent = `From: "TCG Market" <derekgallardo01@gmail.com>
To: ${to}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

${htmlContent}`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    console.log(`Sending email to ${to} with subject: ${subject}`);
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error;
  }
}