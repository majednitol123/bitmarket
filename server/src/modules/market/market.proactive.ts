import { marketService } from './market.service';
import { isRedisConnected } from '../../config/redis';
import { realtimePubSub } from '../realtime/realtimePubSub';

/**
 * Market Proactive Cache Warmer
 * Periodically refreshes shared market overview and top 250 master tokens
 * to guarantee instantaneous (<2ms) response times for mobile users.
 * Adheres to Section 10 and 53 of plan.md.
 */

let refreshIntervalTimer: NodeJS.Timeout | null = null;
let isRunning: boolean = false;

const REFRESH_INTERVAL_MS = 60 * 1000; // Every 60 seconds

async function runProactiveCycle(): Promise<void> {
  if (isRunning) return;
  if (!isRedisConnected()) {
    console.log('[MarketProactive] Redis not connected yet, skipping cycle');
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    // Refresh market overview and master tokens in parallel
    const [overview, masterTokens] = await Promise.allSettled([
      marketService.getOverview(false),
      marketService.getMasterTokenList(false),
    ]);

    const overviewSuccess = overview.status === 'fulfilled';
    const tokensSuccess = masterTokens.status === 'fulfilled';
    const duration = Date.now() - start;

    if (overviewSuccess && tokensSuccess) {
      const tokenCount = (masterTokens as PromiseFulfilledResult<any>).value?.length || 0;
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
    } else {
      console.warn(
        `[MarketProactive] Partial warming completed in ${duration}ms (Overview: ${overview.status}, Tokens: ${masterTokens.status})`
      );
    }
  } catch (err: any) {
    console.error(`[MarketProactive] Error warming market cache:`, err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Start proactive cache warming worker
 */
export function startMarketProactiveRefresher(): void {
  if (refreshIntervalTimer) {
    console.log('[MarketProactive] Warmer already running');
    return;
  }

  console.log(`[MarketProactive] Starting proactive cache warmer (interval: ${REFRESH_INTERVAL_MS / 1000}s)`);

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
  }, REFRESH_INTERVAL_MS);
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
