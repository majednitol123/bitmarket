import { PoolClient } from 'pg';
import { getDbPool, isDatabaseConnected } from '../../config/database';
import { cacheService } from '../../cache/cacheService';
import { cacheKeys } from '../../cache/cacheKeys';
import { MarketToken } from '../market/market.types';
import { notificationService } from '../notification/notification.service';
import { realtimePubSub } from '../realtime/realtimePubSub';
import { AppError } from '../../middleware/errorHandler';
import {
  PriceAlertRecord,
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertCondition,
  AlertStatus,
  PriceAlertEvaluationResult,
} from './alert.types';

export const MAX_ALERTS_PER_USER = 50;
export const MAX_ACTIVE_ALERTS_PER_USER = 20;

function formatPrice(val: number): string {
  if (val >= 1000) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.0001) return val.toFixed(4);
  return val.toExponential(2);
}

function mapAlertRow(row: any): PriceAlertRecord {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    chain: row.chain || 'ethereum',
    tokenAddress: row.token_address || null,
    tokenId: row.token_id,
    tokenSymbol: row.token_symbol,
    tokenName: row.token_name,
    condition: row.condition as AlertCondition,
    targetPrice: parseFloat(row.target_price),
    basePrice: row.base_price !== null && row.base_price !== undefined ? parseFloat(row.base_price) : null,
    currency: row.currency || 'USD',
    cooldownMinutes:
      row.cooldown_minutes !== null && row.cooldown_minutes !== undefined
        ? parseInt(row.cooldown_minutes, 10)
        : 360,
    enabled: Boolean(row.enabled),
    status: (row.status || 'ARMED') as AlertStatus,
    lastEvaluatedPrice: row.last_evaluated_price !== null && row.last_evaluated_price !== undefined ? parseFloat(row.last_evaluated_price) : null,
    lastEvaluatedAt: row.last_evaluated_at ? new Date(row.last_evaluated_at).toISOString() : null,
    triggeredAt: row.triggered_at ? new Date(row.triggered_at).toISOString() : null,
    cooldownUntil: row.cooldown_until ? new Date(row.cooldown_until).toISOString() : null,
    triggerCount: parseInt(row.trigger_count || '0', 10),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class AlertService {
  /**
   * Creates a new price alert record
   * Adheres to Section 7: Uses shared Redis market snapshot if fresh (zero external API calls).
   * Enforces configurable user limits (MAX_ALERTS_PER_USER, MAX_ACTIVE_ALERTS_PER_USER).
   */
  public async createAlert(params: CreateAlertRequest): Promise<PriceAlertRecord> {
    if (!isDatabaseConnected()) {
      throw new AppError('Database is not connected', 503, 'DATABASE_UNAVAILABLE');
    }
    const pool = getDbPool();
    if (!pool) throw new AppError('Database pool unavailable', 503, 'DATABASE_UNAVAILABLE');

    const walletAddress = params.walletAddress.trim().toLowerCase();
    const chain = (params.chain || 'ethereum').trim().toLowerCase();
    const tokenAddress = params.tokenAddress?.trim() || null;
    const tokenId = params.tokenId.trim().toLowerCase();
    const tokenSymbol = params.tokenSymbol.trim().toUpperCase();
    const tokenName = params.tokenName?.trim() || null;
    const condition = params.condition;
    const targetPrice = Number(params.targetPrice);
    const currency = (params.currency || 'USD').trim().toUpperCase();
    const cooldownMinutes = params.cooldownMinutes !== undefined ? Math.max(0, params.cooldownMinutes) : 360;

    if (!walletAddress || !tokenId || !tokenSymbol) {
      throw new AppError('walletAddress, tokenId, and tokenSymbol are required', 400, 'INVALID_INPUT');
    }

    if (isNaN(targetPrice) || targetPrice <= 0) {
      throw new AppError('targetPrice must be a positive number', 400, 'INVALID_TARGET_PRICE');
    }

    const validConditions: AlertCondition[] = ['above', 'below', 'pct_increase', 'pct_decrease'];
    if (!validConditions.includes(condition)) {
      throw new AppError(`Invalid condition. Must be one of: ${validConditions.join(', ')}`, 400, 'INVALID_CONDITION');
    }

    // 1. Enforce user alert limits
    const countRes = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE enabled = TRUE) as active
       FROM price_alerts 
       WHERE LOWER(wallet_address) = $1`,
      [walletAddress]
    );
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
    const activeCount = parseInt(countRes.rows[0]?.active || '0', 10);

    if (totalCount >= MAX_ALERTS_PER_USER) {
      throw new AppError(`Maximum limit of ${MAX_ALERTS_PER_USER} alerts per wallet reached.`, 400, 'ALERT_LIMIT_REACHED');
    }
    if (activeCount >= MAX_ACTIVE_ALERTS_PER_USER) {
      throw new AppError(`Maximum limit of ${MAX_ACTIVE_ALERTS_PER_USER} active alerts reached. Please disable or delete an existing alert.`, 400, 'ACTIVE_ALERT_LIMIT_REACHED');
    }

    // 2. Prevent duplicate active alerts for the same wallet, token, condition, and target price
    const dupCheckSql = `
      SELECT id, enabled, status, target_price 
      FROM price_alerts
      WHERE LOWER(wallet_address) = $1
        AND (LOWER(token_id) = $2 OR UPPER(token_symbol) = $3)
        AND condition = $4
        AND target_price = $5
      ORDER BY id DESC
      LIMIT 1;
    `;
    const dupRes = await pool.query(dupCheckSql, [walletAddress, tokenId, tokenSymbol, condition, targetPrice]);
    if (dupRes.rows.length > 0) {
      const existing = dupRes.rows[0];
      if (existing.enabled) {
        const condLabel = condition === 'above' ? '≥' : condition === 'below' ? '≤' : condition;
        const formattedPrice =
          targetPrice >= 1
            ? targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : targetPrice;
        throw new AppError(
          `An active alert for ${tokenSymbol} (${condLabel} $${formattedPrice}) already exists.`,
          409,
          'DUPLICATE_ALERT'
        );
      } else {
        // Automatically re-arm / re-enable the previously disabled alert instead of creating a duplicate row
        const rearmed = await this.rearmAlert(existing.id, walletAddress);
        if (rearmed) return rearmed;
      }
    }

    // 3. Section 7: Read current price from shared Redis snapshot if fresh (never makes a new provider call)
    let initialPrice: number | null = params.basePrice !== undefined ? Number(params.basePrice) : null;
    if (initialPrice === null || isNaN(initialPrice)) {
      try {
        const cachedTokens = await cacheService.get<MarketToken[]>(cacheKeys.marketMasterTokens());
        if (cachedTokens && Array.isArray(cachedTokens)) {
          const matched = cachedTokens.find(
            (t) => t.id?.toLowerCase() === tokenId || t.symbol?.toUpperCase() === tokenSymbol
          );
          if (matched && typeof matched.priceUsd === 'number' && matched.priceUsd > 0) {
            initialPrice = matched.priceUsd;
          }
        }
      } catch (err: any) {
        console.warn('[AlertService] Could not read cached master tokens:', err.message);
      }
    }

    const sql = `
      INSERT INTO price_alerts (
        wallet_address, chain, token_address, token_id, token_symbol, token_name,
        condition, target_price, base_price, currency, cooldown_minutes,
        enabled, status, last_evaluated_price, last_evaluated_at, trigger_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, 'ARMED', $12, NOW(), 0, NOW(), NOW())
      RETURNING *;
    `;

    try {
      const res = await pool.query(sql, [
        walletAddress,
        chain,
        tokenAddress,
        tokenId,
        tokenSymbol,
        tokenName,
        condition,
        targetPrice,
        initialPrice,
        currency,
        cooldownMinutes,
        initialPrice,
      ]);

      return mapAlertRow(res.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        const condLabel = condition === 'above' ? '≥' : condition === 'below' ? '≤' : condition;
        throw new AppError(
          `An active alert for ${tokenSymbol} (${condLabel} $${targetPrice}) already exists.`,
          409,
          'DUPLICATE_ALERT'
        );
      }
      throw err;
    }
  }

  /**
   * Retrieves all alerts for a specific wallet address, optionally filtered by tokenId, chain, or status
   */
  public async getAlertsForWallet(
    walletAddress: string,
    tokenId?: string,
    status?: AlertStatus
  ): Promise<PriceAlertRecord[]> {
    if (!isDatabaseConnected()) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const normWallet = walletAddress.trim().toLowerCase();
    const values: any[] = [normWallet];
    let sql = `SELECT * FROM price_alerts WHERE LOWER(wallet_address) = $1`;

    if (tokenId) {
      values.push(tokenId.trim().toLowerCase());
      sql += ` AND LOWER(token_id) = $${values.length}`;
    }

    if (status) {
      values.push(status);
      sql += ` AND status = $${values.length}`;
    }

    sql += ` ORDER BY created_at DESC;`;

    const res = await pool.query(sql, values);
    return res.rows.map(mapAlertRow);
  }

  /**
   * Retrieves a single alert by ID and optional wallet address for ownership verification
   */
  public async getAlertById(
    id: number,
    walletAddress?: string
  ): Promise<PriceAlertRecord | null> {
    if (!isDatabaseConnected()) return null;
    const pool = getDbPool();
    if (!pool) return null;

    let sql = `SELECT * FROM price_alerts WHERE id = $1`;
    const values: any[] = [id];

    if (walletAddress) {
      values.push(walletAddress.trim().toLowerCase());
      sql += ` AND LOWER(wallet_address) = $2`;
    }

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;
    return mapAlertRow(res.rows[0]);
  }

  /**
   * Updates an alert's thresholds, condition, enabled state, or status
   * Enforces wallet ownership.
   */
  public async updateAlert(
    id: number,
    walletAddress: string,
    update: UpdateAlertRequest
  ): Promise<PriceAlertRecord | null> {
    if (!isDatabaseConnected()) return null;
    const pool = getDbPool();
    if (!pool) return null;

    const normWallet = walletAddress.trim().toLowerCase();
    const setClauses: string[] = [];
    const values: any[] = [id, normWallet];
    let valIdx = 3;

    if (update.targetPrice !== undefined) {
      const price = Number(update.targetPrice);
      if (isNaN(price) || price <= 0) throw new AppError('targetPrice must be a positive number', 400, 'INVALID_TARGET_PRICE');
      setClauses.push(`target_price = $${valIdx++}`);
      values.push(price);
    }

    if (update.condition !== undefined) {
      const validConditions: AlertCondition[] = ['above', 'below', 'pct_increase', 'pct_decrease'];
      if (!validConditions.includes(update.condition)) {
        throw new AppError(`Invalid condition. Must be one of: ${validConditions.join(', ')}`, 400, 'INVALID_CONDITION');
      }
      setClauses.push(`condition = $${valIdx++}`);
      values.push(update.condition);
    }

    if (update.cooldownMinutes !== undefined) {
      setClauses.push(`cooldown_minutes = $${valIdx++}`);
      values.push(Math.max(0, update.cooldownMinutes));
    }

    if (update.enabled !== undefined) {
      setClauses.push(`enabled = $${valIdx++}`);
      values.push(Boolean(update.enabled));
      if (update.enabled) {
        setClauses.push(`status = 'ARMED'`);
      } else {
        setClauses.push(`status = 'DISABLED'`);
      }
    }

    if (update.status !== undefined) {
      setClauses.push(`status = $${valIdx++}`);
      values.push(update.status);
    }

    if (setClauses.length === 0) {
      return this.getAlertById(id, normWallet);
    }

    setClauses.push(`updated_at = NOW()`);

    const sql = `
      UPDATE price_alerts
      SET ${setClauses.join(', ')}
      WHERE id = $1 AND LOWER(wallet_address) = $2
      RETURNING *;
    `;

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;
    return mapAlertRow(res.rows[0]);
  }

  /**
   * Re-arms a triggered or disabled alert (Section 11 & 35)
   * Resets status = 'ARMED', enabled = TRUE, triggered_at = NULL, cooldown_until = NULL.
   */
  public async rearmAlert(id: number, walletAddress: string): Promise<PriceAlertRecord | null> {
    if (!isDatabaseConnected()) return null;
    const pool = getDbPool();
    if (!pool) return null;

    const normWallet = walletAddress.trim().toLowerCase();

    const sql = `
      UPDATE price_alerts
      SET enabled = TRUE,
          status = 'ARMED',
          triggered_at = NULL,
          cooldown_until = NULL,
          updated_at = NOW()
      WHERE id = $1 AND LOWER(wallet_address) = $2
      RETURNING *;
    `;

    const res = await pool.query(sql, [id, normWallet]);
    if (res.rows.length === 0) return null;
    return mapAlertRow(res.rows[0]);
  }

  /**
   * Deletes a price alert with ownership check
   */
  public async deleteAlert(id: number, walletAddress: string): Promise<boolean> {
    if (!isDatabaseConnected()) return false;
    const pool = getDbPool();
    if (!pool) return false;

    const normWallet = walletAddress.trim().toLowerCase();
    const res = await pool.query(
      `DELETE FROM price_alerts WHERE id = $1 AND LOWER(wallet_address) = $2`,
      [id, normWallet]
    );

    return (res.rowCount ?? 0) > 0;
  }

  /**
   * High-Scale Query: Fetches enabled alerts for specific tokens in batches (Section 14 & 15).
   */
  public async getActiveAlertsForTokens(
    tokens: { id: string; symbol: string }[],
    limit = 500,
    offset = 0
  ): Promise<PriceAlertRecord[]> {
    if (!isDatabaseConnected() || tokens.length === 0) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const tokenIds = tokens.map((t) => t.id.toLowerCase().trim());
    const tokenSymbols = tokens.map((t) => t.symbol.toUpperCase().trim());

    const sql = `
      SELECT * FROM price_alerts
      WHERE enabled = TRUE
        AND status IN ('ARMED', 'TRIGGERED')
        AND (
          LOWER(token_id) = ANY($1)
          OR UPPER(token_symbol) = ANY($2)
        )
      ORDER BY id ASC
      LIMIT $3 OFFSET $4;
    `;

    const res = await pool.query(sql, [tokenIds, tokenSymbols, limit, offset]);
    return res.rows.map(mapAlertRow);
  }

  /**
   * Evaluates an alert against current market price inside a PostgreSQL row-locked transaction.
   * Section 8, 9, 10, 11, 12, 13:
   * - Concurrency: SELECT ... FOR UPDATE ensures multiple workers never double-trigger.
   * - True Crossing: previousPrice < threshold && currentPrice >= threshold (or downward for below).
   * - Hysteresis / Anti-Spam: Price remaining on the triggered side does NOT re-trigger.
   * - Auto Re-arm: If price recrosses to the safe side AND cooldown expired, auto re-arm to 'ARMED'.
   * - Idempotency: Deterministic idempotency key for notification events.
   */
  public async evaluateAndTriggerAtomic(
    alertId: number,
    currentPrice: number,
    snapshotTimestampMs: number
  ): Promise<PriceAlertEvaluationResult> {
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    // Section 24: Protect against stale data (>120s old) or non-positive price
    if (currentPrice <= 0 || (Date.now() - snapshotTimestampMs > 120000)) {
      return {
        alertId,
        triggered: false,
        rearmed: false,
        previousPrice: null,
        currentPrice,
        targetPrice: 0,
        condition: 'above',
        status: 'DISABLED',
        reason: 'Stale or invalid market price skipped',
      };
    }

    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock alert row for update
      const selectSql = `
        SELECT * FROM price_alerts
        WHERE id = $1
        FOR UPDATE;
      `;
      const selRes = await client.query(selectSql, [alertId]);
      if (selRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          alertId,
          triggered: false,
          rearmed: false,
          previousPrice: null,
          currentPrice,
          targetPrice: 0,
          condition: 'above',
          status: 'DISABLED',
          reason: 'Alert not found',
        };
      }

      const alert = mapAlertRow(selRes.rows[0]);
      if (!alert.enabled) {
        await client.query('ROLLBACK');
        return {
          alertId,
          triggered: false,
          rearmed: false,
          previousPrice: alert.lastEvaluatedPrice,
          currentPrice,
          targetPrice: alert.targetPrice,
          condition: alert.condition,
          status: alert.status,
          reason: 'Alert disabled',
        };
      }

      const targetPrice = alert.targetPrice;
      const previousPrice = alert.lastEvaluatedPrice !== null ? alert.lastEvaluatedPrice : alert.basePrice;
      const isOneShot = alert.cooldownMinutes === 0;

      // 2. Cooldown check: if still in cooldown window, do not trigger
      const now = Date.now();
      const inCooldown = alert.cooldownUntil !== null && new Date(alert.cooldownUntil).getTime() > now;

      // 3. Auto Re-Arm check:
      // If currently TRIGGERED, and price returned to safe side, and cooldown expired => Re-arm!
      if (alert.status === 'TRIGGERED' && !inCooldown) {
        let isSafeSide = false;
        if (alert.condition === 'above' && currentPrice < targetPrice) {
          isSafeSide = true;
        } else if (alert.condition === 'below' && currentPrice > targetPrice) {
          isSafeSide = true;
        }

        if (isSafeSide) {
          await client.query(
            `UPDATE price_alerts 
             SET status = 'ARMED', 
                 cooldown_until = NULL, 
                 last_evaluated_price = $2, 
                 last_evaluated_at = NOW(),
                 updated_at = NOW() 
             WHERE id = $1`,
            [alert.id, currentPrice]
          );
          await client.query('COMMIT');
          return {
            alertId,
            triggered: false,
            rearmed: true,
            previousPrice,
            currentPrice,
            targetPrice,
            condition: alert.condition,
            status: 'ARMED',
            reason: 'Price returned across threshold; alert auto-rearmed',
          };
        }
      }

      // 4. True Threshold Crossing Detection:
      let isCrossing = false;

      if (alert.condition === 'above') {
        if (previousPrice !== null) {
          // Upward crossing: was below, now at or above target
          isCrossing = previousPrice < targetPrice && currentPrice >= targetPrice;
        } else {
          // First evaluation without history: only trigger if >= target
          isCrossing = currentPrice >= targetPrice;
        }
      } else if (alert.condition === 'below') {
        if (previousPrice !== null) {
          // Downward crossing: was above, now at or below target
          isCrossing = previousPrice > targetPrice && currentPrice <= targetPrice;
        } else {
          isCrossing = currentPrice <= targetPrice;
        }
      }

      // 5. If Crossing Occurred and alert is ARMED and NOT in cooldown:
      if (isCrossing && alert.status === 'ARMED' && !inCooldown) {
        const nextTriggerCount = alert.triggerCount + 1;
        const cooldownMinutes = alert.cooldownMinutes;
        const newCooldownUntil = cooldownMinutes > 0 ? new Date(now + cooldownMinutes * 60 * 1000) : null;
        const newStatus: AlertStatus = isOneShot ? 'DISABLED' : 'TRIGGERED';
        const newEnabled = !isOneShot;

        // Update alert state
        await client.query(
          `UPDATE price_alerts
           SET status = $2,
               enabled = $3,
               triggered_at = NOW(),
               cooldown_until = $4,
               trigger_count = $5,
               last_evaluated_price = $6,
               last_evaluated_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [alert.id, newStatus, newEnabled, newCooldownUntil, nextTriggerCount, currentPrice]
        );

        // Deterministic idempotency key: price-alert:{alertId}:{triggerCount}:{minuteBucket}
        const minuteBucket = Math.floor(now / 60000);
        const idempotencyKey = `price-alert:${alert.id}:${nextTriggerCount}:${minuteBucket}`;

        const symbol = alert.tokenSymbol.toUpperCase();
        const currentFormatted = formatPrice(currentPrice);
        const targetFormatted = formatPrice(targetPrice);
        const conditionText = alert.condition === 'above' ? `surpassed target of ≥ $${targetFormatted}` : `dropped below target of ≤ $${targetFormatted}`;

        const title = `🚨 ${symbol} Price Alert: $${currentFormatted}`;
        const body = `${symbol} is currently $${currentFormatted} and has ${conditionText}!`;

        // Create durable notification event inside the transaction
        const insertEventSql = `
          INSERT INTO notification_events (
            wallet_address, event_type, title, body, data, idempotency_key, status, created_at
          ) VALUES ($1, 'price_alert', $2, $3, $4, $5, 'pending', NOW())
          ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
          RETURNING id;
        `;

        const eventData = {
          type: 'PRICE_ALERT',
          alertId: alert.id,
          chain: alert.chain,
          tokenAddress: alert.tokenAddress,
          tokenId: alert.tokenId,
          tokenSymbol: alert.tokenSymbol,
          condition: alert.condition,
          targetPrice: alert.targetPrice,
          currentPrice,
          previousPrice,
          isOneShot,
          triggeredAt: new Date().toISOString(),
        };

        const eventRes = await client.query(insertEventSql, [
          alert.walletAddress,
          title,
          body,
          JSON.stringify(eventData),
          idempotencyKey,
        ]);

        // Enqueue device deliveries if event was inserted
        if (eventRes.rows.length > 0) {
          const eventId = eventRes.rows[0].id;
          const devicesRes = await client.query(
            `SELECT id, expo_push_token FROM notification_devices WHERE LOWER(wallet_address) = $1 AND enabled = TRUE`,
            [alert.walletAddress.toLowerCase()]
          );

          for (const dev of devicesRes.rows) {
            await client.query(
              `INSERT INTO notification_deliveries (event_id, device_id, expo_push_token, status, attempts, next_attempt_at)
               VALUES ($1, $2, $3, 'queued', 0, NOW())`,
              [eventId, dev.id, dev.expo_push_token]
            );
          }
        }

        await client.query('COMMIT');

        // Publish real-time event to multi-instance Pub/Sub
        await realtimePubSub.publish('price_alert', 'alert_triggered', {
          alertId: alert.id,
          walletAddress: alert.walletAddress,
          tokenSymbol: alert.tokenSymbol,
          condition: alert.condition,
          targetPrice: alert.targetPrice,
          currentPrice,
          isOneShot,
          status: newStatus,
        });

        return {
          alertId,
          triggered: true,
          rearmed: false,
          previousPrice,
          currentPrice,
          targetPrice,
          condition: alert.condition,
          status: newStatus,
        };
      }

      // No crossing occurred: just record current price as last evaluated price
      await client.query(
        `UPDATE price_alerts
         SET last_evaluated_price = $2,
             last_evaluated_at = NOW()
         WHERE id = $1`,
        [alert.id, currentPrice]
      );
      await client.query('COMMIT');

      return {
        alertId,
        triggered: false,
        rearmed: false,
        previousPrice,
        currentPrice,
        targetPrice,
        condition: alert.condition,
        status: alert.status,
        reason: isCrossing ? 'In cooldown or already triggered' : 'Threshold not crossed',
      };
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const alertService = new AlertService();
