import { alertService } from './alert.service';
import { cacheService } from '../../cache/cacheService';
import { cacheKeys } from '../../cache/cacheKeys';
import { redisLock } from '../../cache/redisLock';
import { notificationService } from '../notification/notification.service';
import { marketService } from '../market/market.service';
import { MarketToken } from '../market/market.types';
import { PriceAlertRecord } from './alert.types';
import { realtimePubSub } from '../realtime/realtimePubSub';

function formatPrice(val: number): string {
  if (val >= 1000) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.0001) return val.toFixed(4);
  return val.toExponential(2);
}

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
    console.log(`[PriceAlertWorker] Started alert evaluator loop (interval: ${this.intervalMs}ms)`);

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
   * Section 37 Guarantee: Zero provider requests per user; reads shared master snapshot only.
   */
  private async evaluateAlerts(): Promise<void> {
    const lockKey = 'locks:price_alert_worker';
    const ownerToken = redisLock.generateOwnerToken();
    const acquired = await redisLock.acquireLock(lockKey, 12, ownerToken);

    if (!acquired) {
      // Lock held by another instance/thread
      return;
    }

    try {
      // 1. Fetch eligible alerts from database
      const eligibleAlerts = await alertService.getEligibleAlertsForEvaluation();
      if (!eligibleAlerts || eligibleAlerts.length === 0) {
        return;
      }

      // 2. Read shared market master snapshot from Redis
      let tokens = await cacheService.get<MarketToken[]>(cacheKeys.marketMasterTokens());
      if (!tokens || tokens.length === 0) {
        // Safe read from market service without external API storm
        tokens = await marketService.getMasterTokenList(false);
      }

      if (!tokens || tokens.length === 0) {
        return;
      }

      // 3. Construct in-memory fast price lookup map
      const priceMap = new Map<string, number>();
      for (const token of tokens) {
        if (token.id && typeof token.priceUsd === 'number') {
          priceMap.set(token.id.toLowerCase().trim(), token.priceUsd);
        }
        if (token.symbol && typeof token.priceUsd === 'number') {
          priceMap.set(token.symbol.toLowerCase().trim(), token.priceUsd);
        }
      }

      let triggeredCount = 0;

      // 4. Evaluate each alert in-memory
      for (const alert of eligibleAlerts) {
        const tokenIdKey = alert.tokenId.toLowerCase().trim();
        const symbolKey = alert.tokenSymbol.toLowerCase().trim();
        const currentPrice = priceMap.get(tokenIdKey) ?? priceMap.get(symbolKey);

        if (currentPrice === undefined || isNaN(currentPrice)) {
          continue;
        }

        const isTriggered = this.checkCondition(alert, currentPrice);

        if (isTriggered) {
          triggeredCount++;
          await this.triggerAlert(alert, currentPrice);
        }
      }

      if (triggeredCount > 0) {
        console.log(`[PriceAlertWorker] Processed ${eligibleAlerts.length} eligible alerts, triggered ${triggeredCount}`);
      }
    } finally {
      await redisLock.releaseLock(lockKey, ownerToken);
    }
  }

  /**
   * Checks if an alert threshold has been crossed
   */
  private checkCondition(alert: PriceAlertRecord, currentPrice: number): boolean {
    switch (alert.condition) {
      case 'above':
        return currentPrice >= alert.targetPrice;

      case 'below':
        return currentPrice <= alert.targetPrice;

      case 'pct_increase':
        if (alert.basePrice && alert.basePrice > 0) {
          const pct = ((currentPrice - alert.basePrice) / alert.basePrice) * 100;
          return pct >= alert.targetPrice;
        }
        return currentPrice >= alert.targetPrice;

      case 'pct_decrease':
        if (alert.basePrice && alert.basePrice > 0) {
          const pct = ((alert.basePrice - currentPrice) / alert.basePrice) * 100;
          return pct >= alert.targetPrice;
        }
        return currentPrice <= alert.targetPrice;

      default:
        return false;
    }
  }

  /**
   * Emits a durable notification event and records the alert trigger in DB
   */
  private async triggerAlert(alert: PriceAlertRecord, currentPrice: number): Promise<void> {
    try {
      const cooldownMinutes = alert.cooldownMinutes;
      const isOneShot = cooldownMinutes === 0;

      // Deterministic idempotency key: prevents duplicate notifications within same cooldown window
      const cooldownWindow = !isOneShot
        ? Math.floor(Date.now() / (cooldownMinutes * 60 * 1000))
        : 'once';
      const idempotencyKey = `price_alert:${alert.id}:${cooldownWindow}`;

      const symbol = alert.tokenSymbol.toUpperCase();
      const currentFormatted = formatPrice(currentPrice);
      const targetFormatted = formatPrice(alert.targetPrice);

      let conditionText = 'target';
      if (alert.condition === 'above') conditionText = `surpassed target of ≥ $${targetFormatted}`;
      else if (alert.condition === 'below') conditionText = `dropped below target of ≤ $${targetFormatted}`;
      else if (alert.condition === 'pct_increase') conditionText = `surged +${targetFormatted}%`;
      else if (alert.condition === 'pct_decrease') conditionText = `dropped -${targetFormatted}%`;

      const title = `🚨 ${symbol} Price Alert: $${currentFormatted}`;
      const body = `${symbol} is currently $${currentFormatted} and has ${conditionText}!`;

      console.log(`[PriceAlertWorker] Alert ${alert.id} triggered for ${symbol} ($${currentFormatted})`);

      // 1. Create durable notification event
      await notificationService.createNotificationEvent({
        walletAddress: alert.walletAddress,
        eventType: 'price_alert',
        title,
        body,
        data: {
          alertId: alert.id,
          tokenId: alert.tokenId,
          tokenSymbol: alert.tokenSymbol,
          condition: alert.condition,
          targetPrice: alert.targetPrice,
          currentPrice,
          basePrice: alert.basePrice,
          cooldownMinutes: alert.cooldownMinutes,
          triggeredAt: new Date().toISOString(),
        },
        idempotencyKey,
      });

      // 2. Record trigger in database (updates triggered_at and disables if one-shot)
      await alertService.recordAlertTriggered(alert.id, isOneShot);

      // 3. Publish real-time event to multi-instance Pub/Sub
      await realtimePubSub.publish('price_alert', 'alert_triggered', {
        alertId: alert.id,
        walletAddress: alert.walletAddress,
        tokenSymbol: alert.tokenSymbol,
        condition: alert.condition,
        targetPrice: alert.targetPrice,
        currentPrice,
        isOneShot,
      });
    } catch (err: any) {
      console.error(`[PriceAlertWorker] Error triggering alert ${alert.id}:`, err.message);
    }
  }
}

export const priceAlertWorker = new PriceAlertWorker();
