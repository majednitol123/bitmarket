import { alertService } from './alert.service';
import { cacheService } from '../../cache/cacheService';
import { cacheKeys } from '../../cache/cacheKeys';
import { redisLock } from '../../cache/redisLock';
import { MarketToken } from '../market/market.types';
import { realtimePubSub } from '../realtime/realtimePubSub';
import { metricsService } from '../system/metrics.service';

export class PriceAlertWorker {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private isProcessing: boolean = false;

  constructor(intervalMs: number = 15000) {
    this.intervalMs = intervalMs;
  }

  /**
   * Starts the background evaluation loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[PriceAlertWorker] Started enterprise alert evaluator loop (interval: ${this.intervalMs}ms)`);

    // Run first evaluation after 3 seconds
    this.timer = setTimeout(() => this.tick(), 3000);
  }

  /**
   * Stops the background evaluation loop cleanly
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[PriceAlertWorker] Worker stopped');
  }

  /**
   * Main evaluation cycle protected by Redis distributed lock
   */
  private async tick(): Promise<void> {
    if (!this.isRunning) return;

    if (!this.isProcessing) {
      this.isProcessing = true;
      try {
        await this.evaluateAlerts();
      } catch (err: any) {
        console.error('[PriceAlertWorker] Error in evaluation cycle:', err.message);
      } finally {
        this.isProcessing = false;
      }
    }

    if (this.isRunning) {
      this.timer = setTimeout(() => this.tick(), this.intervalMs);
    }
  }

  /**
   * Evaluates all eligible alerts against the shared Redis market snapshot.
   * Section 7, 24, 37 Guarantee:
   * - Zero provider requests per user or per alert.
   * - Consumes the shared Redis market snapshot (`cacheKeys.marketMasterTokens()`).
   * - Rejects stale snapshot (>120s old) to protect against false triggers during provider outages.
   * - True crossing & atomic row-locked evaluation with hysteresis and automatic re-arm.
   */
  public async evaluateAlerts(): Promise<void> {
    const lockKey = 'locks:price_alert_worker';
    const ownerToken = redisLock.generateOwnerToken();
    const acquired = await redisLock.acquireLock(lockKey, 12, ownerToken);

    if (!acquired) {
      // Lock held by another instance
      return;
    }

    try {
      // 1. Read shared market master snapshot envelope from Redis
      const envelope = await cacheService.readEnvelope<MarketToken[]>(cacheKeys.marketMasterTokens());
      if (!envelope || !envelope.value || envelope.value.length === 0) {
        console.warn('[PriceAlertWorker] No market master snapshot found in cache; skipping evaluation cycle');
        return;
      }

      const snapshotTimestamp = new Date(envelope.generatedAt).getTime();
      const snapshotAgeMs = Date.now() - snapshotTimestamp;

      // Section 24: Protect against stale data (>120s old)
      if (snapshotAgeMs > 120000) {
        console.warn(
          `[PriceAlertWorker] Market snapshot is stale (${Math.round(snapshotAgeMs / 1000)}s old > 120s limit); skipping evaluation`
        );
        return;
      }

      const tokens = envelope.value;

      // 2. Build fast in-memory lookup map by tokenId, tokenSymbol, and tokenAddress
      const priceMap = new Map<string, number>();
      for (const token of tokens) {
        if (token.id && typeof token.priceUsd === 'number') {
          priceMap.set(`id:${token.id.toLowerCase().trim()}`, token.priceUsd);
        }
        if (token.symbol && typeof token.priceUsd === 'number') {
          priceMap.set(`sym:${token.symbol.toLowerCase().trim()}`, token.priceUsd);
        }
        if (token.contractAddress && typeof token.priceUsd === 'number') {
          priceMap.set(`addr:${token.contractAddress.toLowerCase().trim()}`, token.priceUsd);
        }
        if (token.contractAddresses && Array.isArray(token.contractAddresses)) {
          for (const ca of token.contractAddresses) {
            if (ca.contractAddress && typeof token.priceUsd === 'number') {
              priceMap.set(`addr:${ca.contractAddress.toLowerCase().trim()}`, token.priceUsd);
            }
          }
        }
      }

      // 3. Batch retrieve eligible active/triggered alerts using token identifiers
      const tokenIdentifiers = tokens.map((t) => ({ id: t.id, symbol: t.symbol }));
      let offset = 0;
      const pageSize = 500;
      let evaluatedCount = 0;
      let triggeredCount = 0;
      let rearmedCount = 0;

      while (true) {
        const batch = await alertService.getActiveAlertsForTokens(tokenIdentifiers, pageSize, offset);
        if (!batch || batch.length === 0) break;

        for (const alert of batch) {
          // Resolve current price: prefer tokenAddress -> tokenId -> tokenSymbol
          let currentPrice: number | undefined;
          if (alert.tokenAddress) {
            currentPrice = priceMap.get(`addr:${alert.tokenAddress.toLowerCase().trim()}`);
          }
          if (currentPrice === undefined && alert.tokenId) {
            currentPrice = priceMap.get(`id:${alert.tokenId.toLowerCase().trim()}`);
          }
          if (currentPrice === undefined && alert.tokenSymbol) {
            currentPrice = priceMap.get(`sym:${alert.tokenSymbol.toLowerCase().trim()}`);
          }

          if (currentPrice === undefined || isNaN(currentPrice) || currentPrice <= 0) {
            continue;
          }

          evaluatedCount++;
          try {
            const evalResult = await alertService.evaluateAndTriggerAtomic(
              alert.id,
              currentPrice,
              snapshotTimestamp
            );

            if (evalResult.triggered) {
              triggeredCount++;
              metricsService.recordAlert('triggered');
            } else if (evalResult.rearmed) {
              rearmedCount++;
              metricsService.recordAlert('rearmed');
              // Realtime broadcast of re-arm
              await realtimePubSub.publish('price_alert', 'alert_rearmed', {
                alertId: alert.id,
                walletAddress: alert.walletAddress,
                tokenSymbol: alert.tokenSymbol,
                targetPrice: alert.targetPrice,
                currentPrice,
                status: 'ARMED',
              });
            } else {
              metricsService.recordAlert('evaluated');
            }
          } catch (err: any) {
            console.error(`[PriceAlertWorker] Error evaluating alert #${alert.id}:`, err.message);
          }
        }

        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      if (evaluatedCount > 0) {
        console.log(
          `[PriceAlertWorker] Evaluated ${evaluatedCount} alerts against snapshot (${Math.round(
            snapshotAgeMs / 1000
          )}s old). Triggered: ${triggeredCount}, Auto-rearmed: ${rearmedCount}`
        );
      }
    } finally {
      await redisLock.releaseLock(lockKey, ownerToken);
    }
  }
}

export const priceAlertWorker = new PriceAlertWorker();
