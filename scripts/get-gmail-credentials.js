const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const url = require('url');

const credentialsPath = path.join(process.cwd(), "credentials.json");
const tokenPath = path.join(process.cwd(), "token.json");

console.log("Credentials path:", credentialsPath);
console.log("Token path:", tokenPath);

// Load credentials
fs.readFile(credentialsPath, 'utf8', (err, data) => {
  if (err) {
    console.error("Error loading credentials:", err);
    return;
  }

  const credentials = JSON.parse(data);
  console.log("Credentials loaded successfully:", {
    client_id: credentials.web.client_id,
    redirect_uris: credentials.web.redirect_uris,
    project_id: credentials.web.project_id,
  });

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Parse URL query parameters
  const urlParams = new URLSearchParams('state=state-parameter&code=4/0AUJR-x40o7qxZ-o_tN2LlICfOqWmuzF5hZCbECaeW8XXCVjOtUFvmpVKLBnCrQzyqvlkJQ&scope=https://www.googleapis.com/auth/gmail.send%20https://www.googleapis.com/auth/gmail.modify');
  const code = urlParams.get('code');

  if (!code) {
    console.error("No authorization code found in URL parameters");
    return;
  }

  console.log("Using authorization code:", code);

  // Exchange authorization code for tokens
  oAuth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error("Error getting tokens:", err);
      return;
    }

    console.log("Successfully obtained tokens:");
    console.log("  Access token:", tokens.access_token);
    console.log("  Refresh token:", tokens.refresh_token);
    console.log("  Expiry date:", tokens.expiry_date);

    // Save tokens
    fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2), (err) => {
      if (err) {
        console.error("Error saving tokens:", err);
        return;
      }
      console.log("Tokens saved to", tokenPath);

      // Test sending email
      oAuth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
      
      const message = {
        to: "derekgallardo01@gmail.com",
        subject: "Gmail API Test - New Credentials",
        html: "<h1>Gmail API Test</h1><p>This is a test email using new credentials.</p>",
      };

      const rawMessage = Buffer.from(
        `To: ${message.to}\r\n` +
        `Subject: ${message.subject}\r\n` +
        `Content-Type: text/html; charset=utf-8\r\n\r\n` +
        message.html
      ).toString("base64");

      gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: rawMessage,
        },
      }, (err, response) => {
        if (err) {
          console.error("Error sending test email:", err);
          return;
        }
        console.log("Test email sent successfully!");
        console.log("Response:", response.data);
      });
    });
  });
});
