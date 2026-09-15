/**
 * Cache Layer Type Definitions
 * Supports versioned envelopes, fresh/stale SWR windows, and distributed lock metrics.
 */

export interface CacheEnvelope<T> {
  schemaVersion: number;
  value: T;
  generatedAt: string;
  freshUntil: number; // Epoch ms
  staleUntil: number; // Epoch ms
  source: string;     // e.g. 'coinstats' | 'rpc' | 'lifi' | 'db' | 'fallback_stale'
  version: number;
}

export interface CacheTtlConfig {
  freshSeconds: number;
  staleSeconds?: number;
}

export interface CacheFetchOptions {
  forceRefresh?: boolean;
  source?: string;
  timeoutMs?: number;
  maxWaitMs?: number;
}

export interface CacheMetrics {
  hitsFresh: number;
  hitsStale: number;
  misses: number;
  hitRatioPercent: number;
  singleFlightJoins: number;
  locksAcquired: number;
  lockWaiters: number;
  lockTimeouts: number;
  backgroundRefreshes: number;
  fallbackServes: number;
  activeInFlight: number;
  inMemoryEntries: number;
  redisConnected: boolean;
}
