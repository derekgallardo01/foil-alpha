const fs = require("fs").promises;
const path = require("path");
const { google } = require("googleapis");
const readline = require("readline");

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

async function authorize(credentials) {
  console.log("Credentials loaded successfully:", {
    client_id: credentials.web.client_id ? "set" : "unset",
    client_secret: credentials.web.client_secret ? "set" : "unset",
    redirect_uris: credentials.web.redirect_uris,
    project_id: credentials.web.project_id,
  });

  const { client_id, client_secret, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force refresh_token generation
  });
  console.log("Authorize this app by visiting this URL:", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question("Enter the code from that page here: ", (code) => {
      rl.close();
      resolve(code);
    });
  });

  const { tokens } = await oAuth2Client.getToken(code);
  console.log("Tokens received:", {
    access_token: tokens.access_token ? "set" : "unset",
    refresh_token: tokens.refresh_token ? "set" : "unset",
    scope: tokens.scope,
    expiry_date: tokens.expiry_date,
  });

  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("Token stored to:", TOKEN_PATH);
  return tokens;
}

async function testEmail(oAuth2Client) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  try {
    console.log(`[${timestamp}] Sending test email...`);
    const message = [
      `To: derekgallardo01@gmail.com`,
      `Subject: Test Email from Foil Alpha`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(
        `<h1>Test Email</h1><p>This is a test email sent from the Foil Alpha application using Gmail API.</p>`
      ).toString("base64"),
    ].join("\n");

    const rawMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
      },
    });

    console.log(`[${timestamp}] Test email sent successfully:`, {
      id: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds,
    });
  } catch (error) {
    console.error(`[${timestamp}] Error sending test email:`, {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    throw error;
  }
}

async function main() {
  try {
    // Load credentials first
    const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, "utf8"));
    console.log("Credentials loaded in main:", {
      client_id: credentials.web.client_id,
      client_secret: credentials.web.client_secret,
      redirect_uris: credentials.web.redirect_uris,
      project_id: credentials.web.project_id,
    });

    const tokens = await authorize(credentials);
    const oAuth2Client = new google.auth.OAuth2(
      credentials.web.client_id,
      credentials.web.client_secret,
      credentials.web.redirect_uris[0]
    );
    oAuth2Client.setCredentials(tokens);
    await testEmail(oAuth2Client);
    console.log("Token generation and test email completed successfully!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();