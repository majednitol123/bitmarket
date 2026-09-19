import { getRedisClient, isRedisConnected } from '../config/redis';
import { redisLock } from './redisLock';
import { cacheKeys } from './cacheKeys';
import {
  CacheEnvelope,
  CacheTtlConfig,
  CacheFetchOptions,
  CacheMetrics,
} from './cache.types';

export class CacheService {
  private memoryCache: Map<string, CacheEnvelope<any>> = new Map();
  private evergreenFallbackCache: Map<string, CacheEnvelope<any>> = new Map();
  private inFlightPromises: Map<string, Promise<any>> = new Map();
  private maxMemoryEntries: number = 1000;

  private metrics: CacheMetrics = {
    hitsFresh: 0,
    hitsStale: 0,
    misses: 0,
    hitRatioPercent: 0,
    singleFlightJoins: 0,
    locksAcquired: 0,
    lockWaiters: 0,
    lockTimeouts: 0,
    backgroundRefreshes: 0,
    fallbackServes: 0,
    activeInFlight: 0,
    inMemoryEntries: 0,
    redisConnected: false,
  };

  /**
   * Retrieves an envelope from Redis or in-memory fallback
   */
  public async readEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const client = getRedisClient();

    if (client && isRedisConnected()) {
      try {
        const raw = await client.get(key);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheEnvelope<T>;
          if (parsed && typeof parsed.freshUntil === 'number') {
            // Update local memory copy and evergreen fallback
            this.setToMemory(key, parsed);
            this.evergreenFallbackCache.set(key, parsed);
            return parsed;
          }
        }
      } catch (err: any) {
        console.warn(`[CacheService] Redis read error for "${key}":`, err.message);
      }
    }

    // Memory cache lookup
    const memEntry = this.memoryCache.get(key);
    if (!memEntry) return null;

    return memEntry as CacheEnvelope<T>;
  }

  /**
   * Writes a versioned envelope to Redis and memory
   */
  public async writeEnvelope<T>(
    key: string,
    data: T,
    ttlConfig: CacheTtlConfig,
    source: string = 'upstream'
  ): Promise<CacheEnvelope<T>> {
    const now = Date.now();
    const freshSeconds = ttlConfig.freshSeconds;
    const staleSeconds = ttlConfig.staleSeconds ?? Math.max(freshSeconds * 30, 3600);

    const freshUntil = now + freshSeconds * 1000;
    const staleUntil = now + (freshSeconds + staleSeconds) * 1000;
    const existing = this.memoryCache.get(key);

    const envelope: CacheEnvelope<T> = {
      schemaVersion: 1,
      value: data,
      generatedAt: new Date(now).toISOString(),
      freshUntil,
      staleUntil,
      source,
      version: (existing?.version || 0) + 1,
    };

    // Update memory & evergreen fallback
    this.setToMemory(key, envelope);
    this.evergreenFallbackCache.set(key, envelope);

    // Update Redis with hard expiration (fresh + stale window + 60s safety margin)
    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        const hardTtlSeconds = freshSeconds + staleSeconds + 60;
        await client.set(key, JSON.stringify(envelope), {
          EX: hardTtlSeconds,
        });
      } catch (err: any) {
        console.warn(`[CacheService] Redis write error for "${key}":`, err.message);
      }
    }

    return envelope;
  }

  /**
   * Main caching entry point:
   * 1. Returns fresh data immediately (< 2ms).
   * 2. Returns stale data immediately (SWR) while kicking off background refresh.
   * 3. On miss / hard expiry: Single-Flight coalescing + Distributed Locking.
   * 4. On provider failure: Gracefully falls back to stale envelope if available.
   */
  public async getOrFetch<T>(
    key: string,
    ttl: number | CacheTtlConfig,
    fetcher: () => Promise<T>,
    options: CacheFetchOptions = {}
  ): Promise<T> {
    const ttlConfig: CacheTtlConfig =
      typeof ttl === 'number'
        ? { freshSeconds: ttl, staleSeconds: Math.max(ttl * 30, 3600) }
        : { freshSeconds: ttl.freshSeconds, staleSeconds: ttl.staleSeconds ?? Math.max(ttl.freshSeconds * 30, 3600) };

    const now = Date.now();

    // 1. Check existing envelope (unless explicit forceRefresh)
    if (!options.forceRefresh) {
      const envelope = await this.readEnvelope<T>(key);
      if (envelope) {
        // Fresh hit
        if (now < envelope.freshUntil) {
          this.metrics.hitsFresh++;
          return envelope.value;
        }

        // Stale hit within acceptable window: Return stale immediately and revalidate in background (SWR)
        if (now < envelope.staleUntil) {
          this.metrics.hitsStale++;
          this.triggerBackgroundRevalidation(key, ttlConfig, fetcher, options);
          return envelope.value;
        }
      }
    }

    // 2. Cache Miss or Hard Expired or forceRefresh: Single-Flight promise coalescing
    this.metrics.misses++;

    if (this.inFlightPromises.has(key)) {
      this.metrics.singleFlightJoins++;
      return (await this.inFlightPromises.get(key)) as T;
    }

    const fetchPromise = this.executeFetchWithLock(key, ttlConfig, fetcher, options);
    this.inFlightPromises.set(key, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlightPromises.delete(key);
    }
  }

  /**
   * Coordinates provider fetching using distributed Redis locking
   */
  private async executeFetchWithLock<T>(
    key: string,
    ttlConfig: CacheTtlConfig,
    fetcher: () => Promise<T>,
    options: CacheFetchOptions
  ): Promise<T> {
    const lockKey = cacheKeys.lockKey(key);
    const ownerToken = redisLock.generateOwnerToken();
    const lockTtlSeconds = 12;

    const acquired = await redisLock.acquireLock(lockKey, lockTtlSeconds, ownerToken);

    if (acquired) {
      this.metrics.locksAcquired++;
      try {
        const freshData = await fetcher();
        await this.writeEnvelope(key, freshData, ttlConfig, options.source || 'upstream');
        return freshData;
      } catch (err: any) {
        // Provider failed: Check if a stale or evergreen envelope exists in cache to serve as fallback
        const staleEnvelope = (await this.readEnvelope<T>(key)) || (this.evergreenFallbackCache.get(key) as CacheEnvelope<T> | undefined);
        if (staleEnvelope && staleEnvelope.value !== null && staleEnvelope.value !== undefined) {
          this.metrics.fallbackServes++;
          console.warn(
            `[CacheService] Provider failed for "${key}". Serving stale fallback data: ${err.message}`
          );
          return staleEnvelope.value;
        }
        throw err;
      } finally {
        await redisLock.releaseLock(lockKey, ownerToken);
      }
    }

    // Lock was not acquired: Another server/request is currently fetching
    this.metrics.lockWaiters++;
    const maxWaitMs = options.maxWaitMs || 2500;
    const pollIntervals = [50, 100, 150, 200, 250, 300, 400];
    let elapsed = 0;
    let pollIdx = 0;

    while (elapsed < maxWaitMs) {
      const waitTime = pollIntervals[Math.min(pollIdx++, pollIntervals.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      elapsed += waitTime;

      const updated = await this.readEnvelope<T>(key);
      if (updated && Date.now() < updated.staleUntil) {
        // Waiter received refreshed result — never called provider
        return updated.value;
      }
    }

    // Waiter timed out waiting for lock holder
    this.metrics.lockTimeouts++;
    console.warn(`[CacheService] Waiter timed out after ${elapsed}ms for lock "${lockKey}".`);

    // Check if stale data is available
    const staleFallback = await this.readEnvelope<T>(key);
    if (staleFallback && staleFallback.value !== null && staleFallback.value !== undefined) {
      this.metrics.fallbackServes++;
      return staleFallback.value;
    }

    // Last resort fallback: Attempt direct fetch
    const lastResortData = await fetcher();
    await this.writeEnvelope(key, lastResortData, ttlConfig, options.source || 'upstream_fallback');
    return lastResortData;
  }

  /**
   * Background SWR revalidation
   */
  private triggerBackgroundRevalidation<T>(
    key: string,
    ttlConfig: CacheTtlConfig,
    fetcher: () => Promise<T>,
    options: CacheFetchOptions
  ): void {
    if (this.inFlightPromises.has(key)) {
      return; // Already revalidating
    }

    this.metrics.backgroundRefreshes++;

    const bgPromise = this.executeFetchWithLock(key, ttlConfig, fetcher, options).catch((err) => {
      console.warn(`[CacheService] Background revalidation failed for "${key}":`, err.message);
    });

    this.inFlightPromises.set(key, bgPromise);
    bgPromise.finally(() => {
      this.inFlightPromises.delete(key);
    });
  }

  /**
   * Direct cache write (envelope-wrapped)
   */
  public async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    await this.writeEnvelope(key, data, { freshSeconds: ttlSeconds });
  }

  /**
   * Direct cache read (returns raw value)
   */
  public async get<T>(key: string): Promise<T | null> {
    const envelope = await this.readEnvelope<T>(key);
    return envelope ? envelope.value : null;
  }

  /**
   * Delete a single key
   */
  public async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    this.evergreenFallbackCache.delete(key);
    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        await client.del(key);
      } catch (err: any) {
        console.warn(`[CacheService] Redis delete error for "${key}":`, err.message);
      }
    }
  }

  /**
   * Non-blocking pattern invalidation using Redis SCAN (never uses blocking KEYS *)
   */
  public async invalidatePattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    // 1. Purge from memory cache and evergreen fallback
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of Array.from(this.memoryCache.keys())) {
      if (regexPattern.test(k)) {
        this.memoryCache.delete(k);
        deletedCount++;
      }
    }
    for (const k of Array.from(this.evergreenFallbackCache.keys())) {
      if (regexPattern.test(k)) {
        this.evergreenFallbackCache.delete(k);
      }
    }

    // 2. Purge from Redis via non-blocking SCAN
    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        const matchingKeys: string[] = [];
        for await (const entry of (client as any).scanIterator({ MATCH: pattern, COUNT: 100 })) {
          if (Array.isArray(entry)) {
            matchingKeys.push(...entry);
          } else if (typeof entry === 'string') {
            matchingKeys.push(entry);
          }
        }

        if (matchingKeys.length > 0) {
          // Delete in batches of 100
          for (let i = 0; i < matchingKeys.length; i += 100) {
            const chunk = matchingKeys.slice(i, i + 100);
            await Promise.all(chunk.map((k) => client.del(k)));
          }
          deletedCount += matchingKeys.length;
        }
      } catch (err: any) {
        console.warn(`[CacheService] Redis pattern invalidation error for "${pattern}":`, err.message);
      }
    }

    return deletedCount;
  }

  /**
   * In-memory cache helper with bounded size
   */
  private setToMemory<T>(key: string, envelope: CacheEnvelope<T>): void {
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, envelope);
  }

  /**
   * Observability metrics snapshot
   */
  public getMetrics(): CacheMetrics {
    const totalHits = this.metrics.hitsFresh + this.metrics.hitsStale;
    const totalRequests = totalHits + this.metrics.misses;
    const hitRatioPercent =
      totalRequests > 0 ? Math.round((totalHits / totalRequests) * 10000) / 100 : 0;

    return {
      ...this.metrics,
      hitRatioPercent,
      activeInFlight: this.inFlightPromises.size,
      inMemoryEntries: this.memoryCache.size,
      redisConnected: isRedisConnected(),
    };
  }
}

export const cacheService = new CacheService();
