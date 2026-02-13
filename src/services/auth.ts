import { google } from 'googleapis';
import { config } from '../config.js';
import { log } from '../utils/logger.js';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

let oauth2Client: OAuth2Client | null = null;

export function getAuthClient(): OAuth2Client {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    oauth2Client.setCredentials({
      refresh_token: config.google.refreshToken,
    });
    oauth2Client.on('tokens', (tokens) => {
      log('info', 'OAuth token refreshed', { expiry: tokens.expiry_date });
    });
  }
  return oauth2Client;
}

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
];

export function getAuthUrl(): string {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: OAUTH_SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
  const { tokens } = await client.getToken(code);
  return {
    accessToken: tokens.access_token || '',
    refreshToken: tokens.refresh_token || '',
  };
}
