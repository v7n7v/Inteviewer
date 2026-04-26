/**
 * Distributed Rate Limiter — Upstash Redis
 *
 * Replaces the previous in-memory Map() which reset on cold starts
 * and didn't share state across serverless instances.
 *
 * Upstash Redis is persistent, shared, and edge-deployed.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── Upstash Redis client (lazy singleton) ──
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

// ── Pre-built rate limiters ──

/** Public free tool: 3 requests per 24 hours per IP */
export const freeToolLimiter = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  }),
  limiter: Ratelimit.fixedWindow(3, '24 h'),
  prefix: 'ratelimit:free-tool',
  analytics: true,
});

/** Authenticated API: 30 requests per 60 seconds per user */
export const authApiLimiter = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  }),
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  prefix: 'ratelimit:auth-api',
});

/**
 * Legacy-compatible checkRateLimit function.
 * Used by existing API routes — now backed by Upstash instead of in-memory Map.
 *
 * For new code, use freeToolLimiter or authApiLimiter directly.
 */
export async function checkRateLimit(
  key: string,
  limit: number = 30,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  try {
    const redis = getRedis();
    const windowKey = `rl:${key}`;
    const now = Date.now();

    // Atomic increment with TTL
    const count = await redis.incr(windowKey);

    if (count === 1) {
      // First request — set expiry
      await redis.pexpire(windowKey, windowMs);
    }

    const ttl = await redis.pttl(windowKey);

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.max(0, ttl),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      resetIn: Math.max(0, ttl),
    };
  } catch (error) {
    // If Redis is down, fail open (allow the request) to avoid blocking users
    console.error('[rate-limit] Upstash Redis error, failing open:', error);
    return { allowed: true, remaining: limit, resetIn: 0 };
  }
}
