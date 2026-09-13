import { getRedisClient, isRedisConnected } from '../config/redis';

interface MemoryCacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private memoryCache: Map<string, MemoryCacheEntry<any>> = new Map();
  private maxMemoryEntries = 500;

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setToMemory<T>(key: string, data: T, ttlSeconds: number): void {
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      // Remove oldest entry
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        const cached = await client.get(key);
        if (cached) {
          return JSON.parse(cached) as T;
        }
      } catch (err: any) {
        console.warn(`[CacheService] Redis get error for key "${key}":`, err.message);
      }
    }

    return this.getFromMemory<T>(key);
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    // Always update memory cache as fallback
    this.setToMemory(key, data, ttlSeconds);

    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        await client.set(key, JSON.stringify(data), {
          EX: ttlSeconds,
        });
      } catch (err: any) {
        console.warn(`[CacheService] Redis set error for key "${key}":`, err.message);
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        await client.del(key);
      } catch (err: any) {
        console.warn(`[CacheService] Redis del error for key "${key}":`, err.message);
      }
    }
  }

  /**
   * High-performance getOrFetch with Stampede Protection and graceful fallbacks.
   */
  async getOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    // 1. Check cache first
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const client = getRedisClient();
    const lockKey = `${key}:lock`;

    // If Redis is connected, try to acquire distributed lock for stampede protection
    if (client && isRedisConnected()) {
      let acquiredLock = false;
      try {
        const lockRes = await client.set(lockKey, '1', {
          NX: true,
          EX: 10, // 10s max lock duration
        });
        acquiredLock = lockRes === 'OK';
      } catch (err: any) {
        acquiredLock = false;
      }

      if (!acquiredLock) {
        // Another process is fetching; wait up to 4 iterations (600ms)
        for (let i = 0; i < 4; i++) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const retryCached = await this.get<T>(key);
          if (retryCached !== null && retryCached !== undefined) {
            return retryCached;
          }
        }
      }

      try {
        const freshData = await fetcher();
        await this.set(key, freshData, ttlSeconds);
        return freshData;
      } finally {
        if (acquiredLock) {
          try {
            await client.del(lockKey);
          } catch {}
        }
      }
    }

    // Fallback: If Redis is unavailable, use in-memory cache directly
    const freshData = await fetcher();
    this.setToMemory(key, freshData, ttlSeconds);
    return freshData;
  }
}

export const cacheService = new CacheService();
