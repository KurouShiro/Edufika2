const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");

const secretPath = process.env.GDRIVE_CLIENT_SECRET_JSON || "";
if (!secretPath) {
  console.error("Set GDRIVE_CLIENT_SECRET_JSON to your client_secret_*.json file path");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(secretPath, "utf8"));
const cfg = raw.installed || raw.web;

const clientId = cfg.client_id;
const clientSecret = cfg.client_secret;
const redirectUri = process.env.GDRIVE_REDIRECT_URI || (cfg.redirect_uris || [])[0];

if (!redirectUri) {
  console.error(
    "Missing redirect URI. Set GDRIVE_REDIRECT_URI and add it to your OAuth client in Google Cloud Console."
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Use minimal scope for uploads
const scopes = ["https://www.googleapis.com/auth/drive.file"];

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
});

console.log("\nOpen this URL in your browser:\n");
console.log(authUrl, "\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Paste the code here: ", async (code) => {
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    console.log("\nRefresh token:\n", tokens.refresh_token || "(none returned)");
    console.log("\nSave it as GDRIVE_REFRESH_TOKEN in your .env");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    rl.close();
  }
});
