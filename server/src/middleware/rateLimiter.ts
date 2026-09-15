import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisConnected } from '../config/redis';
import { config } from '../config/env';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  bucketName: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface RateLimitResult {
  allowed: boolean;
  total: number;
  remaining: number;
  resetTimeMs: number;
}

// Local in-memory sliding window store for fallback
class MemorySlidingWindow {
  private store: Map<string, number[]> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodically clean up stale buckets every 2 minutes
    this.cleanupInterval = setInterval(() => this.pruneStale(), 2 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  public checkAndIncrement(key: string, windowMs: number, maxRequests: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = this.store.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);

    const total = timestamps.length;
    if (total >= maxRequests) {
      const oldest = timestamps[0] || now;
      const resetTimeMs = oldest + windowMs;
      return {
        allowed: false,
        total,
        remaining: 0,
        resetTimeMs,
      };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    const oldest = timestamps[0];
    const resetTimeMs = oldest + windowMs;
    const remaining = Math.max(0, maxRequests - (total + 1));

    return {
      allowed: true,
      total: total + 1,
      remaining,
      resetTimeMs,
    };
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.store.entries()) {
      const valid = timestamps.filter((t) => now - t < 120000);
      if (valid.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, valid);
      }
    }
  }
}

const memoryStore = new MemorySlidingWindow();

/**
 * Extracts a client IP from request headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Evaluates rate limit against Redis or in-memory fallback
 */
async function evaluateRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<RateLimitResult> {
  const client = getRedisClient();

  if (client && isRedisConnected()) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      const redisKey = `ratelimit:${key}`;

      // Redis pipeline: prune old, add current, count window
      // Using multi
      const multi = client.multi();
      multi.zRemRangeByScore(redisKey, 0, windowStart);
      multi.zCard(redisKey);
      multi.zRange(redisKey, 0, 0, { REV: false }); // get oldest in window for reset time calculation

      const results = await multi.exec();
      const count = (results[1] as unknown as number) || 0;
      const oldestArr = (results[2] as unknown as string[]) || [];
      const oldestTimestamp = oldestArr.length > 0 ? parseInt(oldestArr[0], 10) : now;
      const resetTimeMs = oldestTimestamp + windowMs;

      if (count >= maxRequests) {
        return {
          allowed: false,
          total: count,
          remaining: 0,
          resetTimeMs,
        };
      }

      // Add current request and renew TTL
      const addMulti = client.multi();
      addMulti.zAdd(redisKey, { score: now, value: `${now}:${Math.random().toString(36).slice(2, 7)}` });
      addMulti.expire(redisKey, Math.ceil((windowMs * 2) / 1000));
      await addMulti.exec();

      return {
        allowed: true,
        total: count + 1,
        remaining: Math.max(0, maxRequests - (count + 1)),
        resetTimeMs,
      };
    } catch (err: any) {
      console.warn('[RateLimiter] Redis rate limiting failed, falling back to memory:', err.message);
    }
  }

  // Fallback to in-memory sliding window
  return memoryStore.checkAndIncrement(key, windowMs, maxRequests);
}

/**
 * Factory creating rate limiting middleware with custom window and quota
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    bucketName,
    keyGenerator = (req: Request) => getClientIp(req),
    skip = () => false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (skip(req)) {
      return next();
    }

    const clientId = keyGenerator(req);
    const key = `${bucketName}:${clientId}`;

    const result = await evaluateRateLimit(key, windowMs, maxRequests);

    // Set standard rate limit headers
    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', result.remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(result.resetTimeMs / 1000));

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((result.resetTimeMs - Date.now()) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests on ${bucketName}. Please retry after ${retryAfterSeconds} seconds.`,
          retryAfterSeconds,
          requestId: req.id,
        },
      });
      return;
    }

    next();
  };
}

// ─── PRE-CONFIGURED TIERED LIMITERS ──────────────────────────────────────────

/**
 * Tier 1: Global API Limiter
 * 120 requests per minute per IP
 */
export const globalRateLimiter = createRateLimiter({
  bucketName: 'global',
  windowMs: 60 * 1000,
  maxRequests: config.rateLimit.globalMax,
  skip: (req) => req.path === '/health' || req.path === '/readiness',
});

/**
 * Tier 2: Refresh Limiter (Guards against cache stampedes on force-refresh)
 * 15 requests per minute per IP/wallet
 */
export const refreshRateLimiter = createRateLimiter({
  bucketName: 'refresh',
  windowMs: 60 * 1000,
  maxRequests: config.rateLimit.refreshMax,
  skip: (req) => req.query.refresh !== 'true' && req.query.forceRefresh !== 'true',
});

/**
 * Tier 3: Mutation Limiter (Write endpoints: swaps, alerts, notifications)
 * 30 requests per minute per IP
 */
export const mutationRateLimiter = createRateLimiter({
  bucketName: 'mutation',
  windowMs: 60 * 1000,
  maxRequests: config.rateLimit.mutationMax,
});
