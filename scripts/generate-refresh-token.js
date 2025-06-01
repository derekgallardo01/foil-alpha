const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");

const credentialsPath = path.join(process.cwd(), 'credentials.json');

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  console.log('Credentials loaded successfully:', {
    client_id: credentials.web.client_id,
    redirect_uris: credentials.web.redirect_uris,
    project_id: credentials.web.project_id
  });
} catch (error) {
  console.error('Error loading credentials:', {
    message: error.message,
    stack: error.stack,
  });
  throw new Error('Failed to load Gmail credentials');
}

const { client_id, client_secret, redirect_uris } = credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

// Start a local server to capture the OAuth2 redirect
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.pathname === "/oauth2callback") {
    const code = parsedUrl.query.code;
    if (code) {
      console.log("\nAuthorization code received:");
      console.log("Code:", code);
      console.log("\nPlease copy this code and press Enter to continue...");
      
      // Wait for user to copy the code
      const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.on("close", () => {
        // Exchange code for tokens
        oAuth2Client.getToken(code, (err, token) => {
          if (err) {
            console.error("Error retrieving access token:", err);
            process.exit(1);
          }
          console.log("\nRefresh Token:", token.refresh_token);
          console.log("Add this to your .env file: GMAIL_REFRESH_TOKEN=" + token.refresh_token);
          process.exit(0);
        });
      });
      
      rl.question("", () => {
        rl.close();
      });
      
      // Send a simple response to the browser
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Authorization code received. Check your terminal for the code.");
    } else {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("No authorization code found in the request.");
      server.close();
    }
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    server.close();
  }
});

// Use port 3001 to avoid conflict with Next.js
const port = 3001;

server.listen(port, () => {
  console.log(`Local server running on http://localhost:${port}`);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("Authorize this app by visiting this URL:", authUrl);
  const { exec } = require("child_process");
  exec(`start "" "${authUrl}"`, (err) => {
    if (err) console.error("Error opening browser:", err);
  });
});