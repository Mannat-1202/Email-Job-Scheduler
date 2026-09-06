import { config } from '../config/env';
import { db } from '../db/client';
import { redisConnection } from '../queues/emailQueue';

export function getHourWindowKey(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}`;
}

export function getNextWindowDelayMs(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  const diff = nextHour.getTime() - now.getTime();
  // Small random jitter between 500ms and 2500ms to avoid thundering herd
  const jitter = Math.floor(Math.random() * 2000) + 500;
  return Math.max(1000, diff + jitter);
}

export async function getSenderHourlyLimit(senderId: string): Promise<number> {
  try {
    const latestCampaign = await db.campaign.findFirst({
      where: { senderId },
      orderBy: { createdAt: 'desc' },
      select: { hourlyLimit: true },
    });
    if (latestCampaign && latestCampaign.hourlyLimit > 0) {
      return latestCampaign.hourlyLimit;
    }
  } catch {
    // If DB check fails, use env default
  }
  return config.MAX_EMAILS_PER_HOUR_PER_SENDER;
}

export async function tryConsume(senderId: string, customLimit?: number): Promise<boolean> {
  const windowKey = getHourWindowKey(new Date());
  const key = `rl:${senderId}:${windowKey}`;

  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.expire(key, 3600);
  }

  const limit = customLimit ?? (await getSenderHourlyLimit(senderId));
  if (count > limit) {
    await redisConnection.decr(key);
    return false;
  }

  return true;
}

export const rateLimiter = {
  tryConsume,
  getNextWindowDelayMs,
  getHourWindowKey,
  getSenderHourlyLimit,
};
