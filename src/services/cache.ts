import Database from 'better-sqlite3';
import { config } from '../config.js';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { log } from '../utils/logger.js';

let db: Database.Database | null = null;

export function initCache(): void {
  const dataDir = dirname(config.cache.dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  db = new Database(config.cache.dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
  `);
  db.prepare('DELETE FROM cache WHERE expires_at < ?').run(Date.now());
  log('info', `Cache initialized at ${config.cache.dbPath}`);
}

export function getCache<T>(key: string): T | null {
  if (!db) return null;
  const row = db.prepare('SELECT value FROM cache WHERE key = ? AND expires_at > ?').get(key, Date.now()) as { value: string } | undefined;
  return row ? JSON.parse(row.value) as T : null;
}

export function setCache(key: string, value: unknown, ttlSeconds?: number): void {
  if (!db) return;
  const ttl = ttlSeconds ?? config.cache.ttlSeconds;
  const expiresAt = Date.now() + ttl * 1000;
  db.prepare('INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), expiresAt);
}

export function invalidateCache(pattern: string): void {
  if (!db) return;
  db.prepare('DELETE FROM cache WHERE key LIKE ?').run(pattern);
}

export function closeCache(): void {
  if (db) {
    db.close();
    db = null;
  }
}
