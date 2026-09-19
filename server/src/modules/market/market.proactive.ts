import { marketService } from './market.service';
import { getRedisClient, isRedisConnected } from '../../config/redis';
import { realtimePubSub } from '../realtime/realtimePubSub';
import { coinMarketCapProvider } from '../../providers/CoinMarketCapProvider';
import { marketDemandTracker } from './marketDemand';
import { config } from '../../config/env';

const REDIS_INTERVAL_KEY = 'market:refresh_interval_seconds';
let currentIntervalSeconds = Math.max(5, Math.min(60, config.marketRefreshInterval || 5));
let refreshIntervalTimer: NodeJS.Timeout | null = null;
let isRunning: boolean = false;
let lastIdleLogTimestamp = 0;
let hadPreviousDemand = false;

async function runProactiveCycle(): Promise<void> {
  if (isRunning) return;
  if (!isRedisConnected()) {
    console.log('[MarketProactive] Redis not connected yet, skipping cycle');
    return;
  }

  // Demand-driven gate: Only call external APIs when users are actively showing/viewing market data
  const hasDemand = await marketDemandTracker.hasActiveDemand();
  if (!hasDemand) {
    if (hadPreviousDemand || Date.now() - lastIdleLogTimestamp > 30000) {
      lastIdleLogTimestamp = Date.now();
      hadPreviousDemand = false;
      console.log('[MarketProactive] Idle: 0 active market viewers. Skipping upstream API calls to conserve limits.');
    }
    return;
  }
  hadPreviousDemand = true;

  // If upstream CMC circuit is OPEN, pause proactive calls to allow cooldown
  if (coinMarketCapProvider.getCircuitState() === 'OPEN') {
    return;
  }

  // Yield to interactive user requests if outbound rate limit capacity is constrained
  if (!coinMarketCapProvider.hasOutboundCapacity(3)) {
    console.log('[MarketProactive] Outbound capacity near limit; yielding cycle to user traffic.');
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    // Refresh market overview, then tokens with 150ms stagger to prevent burst collisions
    const overview = await marketService.getOverview(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const masterTokens = await marketService.getMasterTokenList(true);

    const duration = Date.now() - start;
    const tokenCount = masterTokens?.length || 0;

    console.log(
      `[MarketProactive] Cache warmed successfully in ${duration}ms (Overview + ${tokenCount} master tokens)`
    );

    // Section 38: Broadcast lightweight snapshot update signals to all gateways
    await Promise.allSettled([
      realtimePubSub.publish('market:tokens', 'snapshot_updated', {
        tokenCount,
        durationMs: duration,
      }),
      realtimePubSub.publish('market:overview', 'snapshot_updated', {
        durationMs: duration,
      }),
    ]);
  } catch (err: any) {
    console.warn(`[MarketProactive] Cycle completed with fallback or notice:`, err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Gets currently active proactive refresh interval in seconds
 */
export function getProactiveRefreshInterval(): number {
  return currentIntervalSeconds;
}

/**
 * Dynamically updates proactive refresh interval in seconds (5s to 60s)
 * Automatically reschedules background timer and syncs across cluster via Redis
 */
export async function setProactiveRefreshInterval(seconds: number): Promise<number> {
  const bounded = Math.max(5, Math.min(60, Math.floor(seconds)));
  if (bounded === currentIntervalSeconds && refreshIntervalTimer) {
    return currentIntervalSeconds;
  }

  const oldSeconds = currentIntervalSeconds;
  currentIntervalSeconds = bounded;

  // Persist in Redis so all instances and restarts remember it
  const client = getRedisClient();
  if (client && isRedisConnected()) {
    client.set(REDIS_INTERVAL_KEY, String(bounded)).catch(() => {});
  }

  // Reschedule timer immediately with the new interval
  if (refreshIntervalTimer) {
    clearInterval(refreshIntervalTimer);
    refreshIntervalTimer = setInterval(() => {
      runProactiveCycle().catch((err) => {
        console.error('[MarketProactive] Recurring warming cycle error:', err.message);
      });
    }, currentIntervalSeconds * 1000);
  }

  console.log(`[MarketProactive] Cache warmer interval updated: ${oldSeconds}s -> ${bounded}s`);
  return currentIntervalSeconds;
}

/**
 * Start proactive cache warming worker
 */
export async function startMarketProactiveRefresher(): Promise<void> {
  if (refreshIntervalTimer) {
    console.log('[MarketProactive] Warmer already running');
    return;
  }

  // Load saved interval from Redis if available
  const client = getRedisClient();
  if (client && isRedisConnected()) {
    try {
      const saved = await client.get(REDIS_INTERVAL_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 5 && parsed <= 60) {
          currentIntervalSeconds = parsed;
        }
      }
    } catch {}
  }

  console.log(`[MarketProactive] Starting proactive cache warmer (interval: ${currentIntervalSeconds}s)`);

  // Run initial cycle after 3s delay to allow full startup
  setTimeout(() => {
    runProactiveCycle().catch((err) => {
      console.error('[MarketProactive] Initial warming cycle error:', err.message);
    });
  }, 3000);

  // Set recurring interval
  refreshIntervalTimer = setInterval(() => {
    runProactiveCycle().catch((err) => {
      console.error('[MarketProactive] Recurring warming cycle error:', err.message);
    });
  }, currentIntervalSeconds * 1000);
}

/**
 * Stop proactive cache warming worker gracefully
 */
export function stopMarketProactiveRefresher(): void {
  if (refreshIntervalTimer) {
    clearInterval(refreshIntervalTimer);
    refreshIntervalTimer = null;
    console.log('[MarketProactive] Proactive cache warmer stopped');
  }
}
