import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

export const config = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  },
  youtube: {
    channelId: process.env.YOUTUBE_CHANNEL_ID || '',
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
    dbPath: process.env.CACHE_DB_PATH || join(PROJECT_ROOT, 'data', 'cache.db'),
  },
  calendar: {
    dbPath: process.env.CALENDAR_DB_PATH || join(PROJECT_ROOT, 'data', 'calendar.db'),
  },
  rateLimit: {
    dailyQuota: parseInt(process.env.YOUTUBE_DAILY_QUOTA || '10000', 10),
  },
  sse: {
    host: process.env.SSE_HOST || '0.0.0.0',
    port: parseInt(process.env.SSE_PORT || '3000', 10),
  },
  projectRoot: PROJECT_ROOT,
};

export function validateConfig(): void {
  if (!config.google.clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is required');
  }
  if (!config.google.clientSecret) {
    throw new Error('GOOGLE_CLIENT_SECRET environment variable is required');
  }
  if (!config.google.refreshToken) {
    throw new Error('GOOGLE_REFRESH_TOKEN environment variable is required. Run: npm run setup-oauth');
  }
}
