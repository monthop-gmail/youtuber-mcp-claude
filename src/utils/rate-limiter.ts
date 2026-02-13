import { config } from '../config.js';
import { log } from './logger.js';

let quotaUsedToday = 0;
let resetDate = new Date().toISOString().split('T')[0];

function checkReset(): void {
  const today = new Date().toISOString().split('T')[0];
  if (today !== resetDate) {
    quotaUsedToday = 0;
    resetDate = today;
    log('info', 'Daily API quota reset');
  }
}

export function checkQuota(units: number): boolean {
  checkReset();
  return (quotaUsedToday + units) <= config.rateLimit.dailyQuota;
}

export function consumeQuota(units: number, operation: string): void {
  checkReset();
  if (!checkQuota(units)) {
    throw new Error(
      `YouTube API quota exceeded. Used: ${quotaUsedToday}/${config.rateLimit.dailyQuota}. ` +
      `Operation "${operation}" requires ${units} units.`
    );
  }
  quotaUsedToday += units;
  log('info', `Quota consumed: ${operation}`, {
    units,
    used: quotaUsedToday,
    remaining: config.rateLimit.dailyQuota - quotaUsedToday,
  });
}

export function getQuotaStatus(): { used: number; remaining: number; limit: number } {
  checkReset();
  return {
    used: quotaUsedToday,
    remaining: config.rateLimit.dailyQuota - quotaUsedToday,
    limit: config.rateLimit.dailyQuota,
  };
}
