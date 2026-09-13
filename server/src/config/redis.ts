import { createClient, RedisClientType } from 'redis';
import { config } from './env';

let redisClient: RedisClientType | null = null;
let isRedisReady = false;

export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

export function isRedisConnected(): boolean {
  return isRedisReady;
}

export async function initRedis(): Promise<RedisClientType | null> {
  try {
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 1) {
            console.log('[Redis] Offline. Operating in high-performance memory cache mode.');
            return false;
          }
          return 200;
        },
      },
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connecting...');
    });

    redisClient.on('ready', () => {
      isRedisReady = true;
      console.log('[Redis] Connected and ready');
    });

    redisClient.on('error', (err) => {
      console.warn('[Redis] Connection error (caching will fallback if unavailable):', err.message);
      isRedisReady = false;
    });

    redisClient.on('end', () => {
      isRedisReady = false;
      console.log('[Redis] Connection closed');
    });

    await redisClient.connect();
    return redisClient;
  } catch (err: any) {
    console.warn('[Redis] Failed to connect on startup:', err.message);
    isRedisReady = false;
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient && isRedisReady) {
    try {
      await redisClient.quit();
      console.log('[Redis] Gracefully disconnected');
    } catch (err: any) {
      console.error('[Redis] Error disconnecting:', err.message);
    }
  }
}
