import crypto from 'crypto';
import { getRedisClient, isRedisConnected } from '../config/redis';

// Atomic Lua script: only deletes lock if the value matches ownerToken
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

interface MemoryLock {
  ownerToken: string;
  expiresAt: number;
}

export class RedisLockManager {
  private memoryLocks: Map<string, MemoryLock> = new Map();

  /**
   * Generates a cryptographically random lock owner token
   */
  public generateOwnerToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Attempts to acquire a distributed lock
   */
  public async acquireLock(
    lockKey: string,
    ttlSeconds: number,
    ownerToken: string
  ): Promise<boolean> {
    const client = getRedisClient();

    if (client && isRedisConnected()) {
      try {
        const res = await client.set(lockKey, ownerToken, {
          NX: true,
          EX: ttlSeconds,
        });
        return res === 'OK';
      } catch (err: any) {
        console.warn(`[RedisLock] Redis lock acquire error for "${lockKey}":`, err.message);
      }
    }

    // In-memory fallback lock
    const now = Date.now();
    const existing = this.memoryLocks.get(lockKey);

    if (existing && existing.expiresAt > now) {
      return false; // Already locked
    }

    this.memoryLocks.set(lockKey, {
      ownerToken,
      expiresAt: now + ttlSeconds * 1000,
    });
    return true;
  }

  /**
   * Atomically releases a distributed lock only if the caller owns it
   */
  public async releaseLock(lockKey: string, ownerToken: string): Promise<boolean> {
    const client = getRedisClient();

    if (client && isRedisConnected()) {
      try {
        const res = await client.eval(RELEASE_LOCK_LUA, {
          keys: [lockKey],
          arguments: [ownerToken],
        });
        return res === 1;
      } catch (err: any) {
        console.warn(`[RedisLock] Redis lock release error for "${lockKey}":`, err.message);
      }
    }

    // In-memory fallback release
    const existing = this.memoryLocks.get(lockKey);
    if (existing && existing.ownerToken === ownerToken) {
      this.memoryLocks.delete(lockKey);
      return true;
    }
    return false;
  }
}

export const redisLock = new RedisLockManager();
