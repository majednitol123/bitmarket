import { getDbPool, isDatabaseConnected } from '../../config/database';
import {
  PriceAlertRecord,
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertCondition,
} from './alert.types';

function mapAlertRow(row: any): PriceAlertRecord {
  return {
    id: row.id,
    walletAddress: row.wallet_address,
    tokenId: row.token_id,
    tokenSymbol: row.token_symbol,
    tokenName: row.token_name,
    condition: row.condition as AlertCondition,
    targetPrice: parseFloat(row.target_price),
    basePrice: row.base_price !== null && row.base_price !== undefined ? parseFloat(row.base_price) : null,
    cooldownMinutes: parseInt(row.cooldown_minutes, 10),
    enabled: Boolean(row.enabled),
    triggeredAt: row.triggered_at ? new Date(row.triggered_at).toISOString() : null,
    triggerCount: parseInt(row.trigger_count || '0', 10),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class AlertService {
  /**
   * Creates a new price alert record
   */
  public async createAlert(params: CreateAlertRequest): Promise<PriceAlertRecord> {
    if (!isDatabaseConnected()) {
      throw new Error('Database is not connected');
    }
    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const walletAddress = params.walletAddress.trim().toLowerCase();
    const tokenId = params.tokenId.trim().toLowerCase();
    const tokenSymbol = params.tokenSymbol.trim().toUpperCase();
    const tokenName = params.tokenName?.trim() || null;
    const condition = params.condition;
    const targetPrice = Number(params.targetPrice);
    const basePrice = params.basePrice !== undefined ? Number(params.basePrice) : null;
    const cooldownMinutes = params.cooldownMinutes !== undefined ? Math.max(0, params.cooldownMinutes) : 360;

    if (!walletAddress || !tokenId || !tokenSymbol) {
      throw new Error('walletAddress, tokenId, and tokenSymbol are required');
    }

    if (isNaN(targetPrice) || targetPrice <= 0) {
      throw new Error('targetPrice must be a positive number');
    }

    const validConditions: AlertCondition[] = ['above', 'below', 'pct_increase', 'pct_decrease'];
    if (!validConditions.includes(condition)) {
      throw new Error(`Invalid condition. Must be one of: ${validConditions.join(', ')}`);
    }

    const sql = `
      INSERT INTO price_alerts (
        wallet_address, token_id, token_symbol, token_name,
        condition, target_price, base_price, cooldown_minutes,
        enabled, trigger_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 0, NOW(), NOW())
      RETURNING *;
    `;

    const res = await pool.query(sql, [
      walletAddress,
      tokenId,
      tokenSymbol,
      tokenName,
      condition,
      targetPrice,
      basePrice,
      cooldownMinutes,
    ]);

    return mapAlertRow(res.rows[0]);
  }

  /**
   * Retrieves all alerts for a specific wallet address, optionally filtered by token
   */
  public async getAlertsForWallet(
    walletAddress: string,
    tokenId?: string
  ): Promise<PriceAlertRecord[]> {
    if (!isDatabaseConnected()) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const normWallet = walletAddress.trim().toLowerCase();

    let sql = `
      SELECT * FROM price_alerts
      WHERE LOWER(wallet_address) = $1
    `;
    const values: any[] = [normWallet];

    if (tokenId) {
      values.push(tokenId.trim().toLowerCase());
      sql += ` AND LOWER(token_id) = $2`;
    }

    sql += ` ORDER BY created_at DESC;`;

    const res = await pool.query(sql, values);
    return res.rows.map(mapAlertRow);
  }

  /**
   * Retrieves a single alert by ID and optional wallet address
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
   * Updates an alert's thresholds, condition, or enabled state
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
      if (isNaN(price) || price <= 0) throw new Error('targetPrice must be a positive number');
      setClauses.push(`target_price = $${valIdx++}`);
      values.push(price);
    }

    if (update.condition !== undefined) {
      const validConditions: AlertCondition[] = ['above', 'below', 'pct_increase', 'pct_decrease'];
      if (!validConditions.includes(update.condition)) {
        throw new Error(`Invalid condition. Must be one of: ${validConditions.join(', ')}`);
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
   * Re-arms a triggered or disabled alert (Section 37 requirement)
   * Resets triggered_at to NULL and sets enabled = TRUE.
   */
  public async rearmAlert(id: number, walletAddress: string): Promise<PriceAlertRecord | null> {
    if (!isDatabaseConnected()) return null;
    const pool = getDbPool();
    if (!pool) return null;

    const normWallet = walletAddress.trim().toLowerCase();

    const sql = `
      UPDATE price_alerts
      SET enabled = TRUE, triggered_at = NULL, updated_at = NOW()
      WHERE id = $1 AND LOWER(wallet_address) = $2
      RETURNING *;
    `;

    const res = await pool.query(sql, [id, normWallet]);
    if (res.rows.length === 0) return null;
    return mapAlertRow(res.rows[0]);
  }

  /**
   * Deletes a price alert
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
   * Queries all enabled alerts that are eligible for evaluation:
   * 1. Alert is enabled (enabled = TRUE)
   * 2. Either it has never been triggered (triggered_at IS NULL), OR
   * 3. It is not a one-shot alert (cooldown_minutes > 0) AND the cooldown period has elapsed.
   */
  public async getEligibleAlertsForEvaluation(): Promise<PriceAlertRecord[]> {
    if (!isDatabaseConnected()) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const sql = `
      SELECT * FROM price_alerts
      WHERE enabled = TRUE
        AND (
          triggered_at IS NULL
          OR (
            cooldown_minutes > 0
            AND triggered_at <= NOW() - (cooldown_minutes || ' minutes')::INTERVAL
          )
        )
      ORDER BY id ASC;
    `;

    const res = await pool.query(sql);
    return res.rows.map(mapAlertRow);
  }

  /**
   * Records that an alert was triggered.
   * Updates triggered_at = NOW(), increments trigger_count,
   * and disables the alert if it was a one-shot alert (cooldownMinutes === 0).
   */
  public async recordAlertTriggered(id: number, isOneShot: boolean): Promise<void> {
    if (!isDatabaseConnected()) return;
    const pool = getDbPool();
    if (!pool) return;

    if (isOneShot) {
      await pool.query(
        `UPDATE price_alerts
         SET triggered_at = NOW(),
             trigger_count = trigger_count + 1,
             enabled = FALSE,
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    } else {
      await pool.query(
        `UPDATE price_alerts
         SET triggered_at = NOW(),
             trigger_count = trigger_count + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    }
  }
}

export const alertService = new AlertService();
