#!/usr/bin/env tsx
/**
 * OAuth 2.0 Setup Wizard for YouTuber MCP Server
 *
 * Usage: npm run setup-oauth
 *
 * Prerequisites:
 * 1. Create a project at https://console.cloud.google.com
 * 2. Enable YouTube Data API v3 and YouTube Analytics API
 * 3. Create OAuth 2.0 credentials (Desktop app or Web app)
 * 4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
 */

import { google } from 'googleapis';
import { createServer } from 'http';
import { URL } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

// Load env vars
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback';
const PORT = parseInt(new URL(REDIRECT_URI).port || '3000', 10);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file');
  console.error('');
  console.error('Steps:');
  console.error('1. Go to https://console.cloud.google.com');
  console.error('2. Create a new project or select existing');
  console.error('3. Enable YouTube Data API v3 and YouTube Analytics API');
  console.error('4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID');
  console.error('5. Copy Client ID and Client Secret to .env file');
  process.exit(1);
}

const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('');
console.log('=== YouTuber MCP OAuth Setup ===');
console.log('');
console.log('Open this URL in your browser to authorize:');
console.log('');
console.log(authUrl);
console.log('');
console.log(`Waiting for callback on port ${PORT}...`);

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);

  if (url.pathname === '/oauth/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
      console.error(`Authorization failed: ${error}`);
      httpServer.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>No authorization code received</h1>');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      const refreshToken = tokens.refresh_token;

      if (!refreshToken) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>No refresh token received</h1><p>Try revoking access at https://myaccount.google.com/permissions and retry.</p>');
        console.error('No refresh token received. Revoke access and retry.');
        httpServer.close();
        process.exit(1);
      }

      // Update .env file
      let envContent = '';
      if (existsSync(envPath)) {
        envContent = readFileSync(envPath, 'utf-8');
      }

      if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
      } else {
        envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}`;
      }

      writeFileSync(envPath, envContent.trim() + '\n');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>Authorization successful!</h1>
        <p>Refresh token has been saved to .env file.</p>
        <p>You can close this window and start the MCP server.</p>
      `);

      console.log('');
      console.log('Authorization successful!');
      console.log(`Refresh token saved to ${envPath}`);
      console.log('');
      console.log('You can now start the server with: npm start');

      setTimeout(() => {
        httpServer.close();
        process.exit(0);
      }, 1000);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Error exchanging code</h1><p>${err}</p>`);
      console.error('Error exchanging code:', err);
      httpServer.close();
      process.exit(1);
    }
  } else {
    res.writeHead(302, { Location: authUrl });
    res.end();
  }
});

httpServer.listen(PORT, () => {
  console.log(`OAuth callback server listening on port ${PORT}`);
});
