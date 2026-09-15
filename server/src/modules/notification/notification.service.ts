import { getDbPool, isDatabaseConnected } from '../../config/database';
import {
  RegisterDeviceRequest,
  UnregisterDeviceRequest,
  NotificationDeviceRecord,
  NotificationEventRecord,
  NotificationDeliveryRecord,
  CreateNotificationEventParams,
  DeliveryStatus,
} from './notification.types';

export class NotificationService {
  /**
   * Registers or updates a device push token for a wallet address
   */
  public async registerDevice(
    params: RegisterDeviceRequest
  ): Promise<NotificationDeviceRecord> {
    if (!isDatabaseConnected()) {
      throw new Error('Database is not connected');
    }

    const pool = getDbPool();
    if (!pool) throw new Error('Database pool unavailable');

    const walletAddress = params.walletAddress.trim().toLowerCase();
    const deviceId = params.deviceId.trim();
    const expoPushToken = params.expoPushToken.trim();
    const platform = params.platform || 'android';
    const appVersion = params.appVersion || null;
    const enabled = params.enabled !== undefined ? params.enabled : true;

    const sql = `
      INSERT INTO notification_devices (
        wallet_address, device_id, expo_push_token, platform, app_version, enabled, error_message, last_active_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NULL, NOW(), NOW())
      ON CONFLICT (expo_push_token) DO UPDATE SET
        wallet_address = EXCLUDED.wallet_address,
        device_id = EXCLUDED.device_id,
        platform = EXCLUDED.platform,
        app_version = EXCLUDED.app_version,
        enabled = EXCLUDED.enabled,
        error_message = NULL,
        last_active_at = NOW(),
        updated_at = NOW()
      RETURNING
        id, wallet_address as "walletAddress", device_id as "deviceId",
        expo_push_token as "expoPushToken", platform, app_version as "appVersion",
        enabled, error_message as "errorMessage", last_active_at as "lastActiveAt",
        created_at as "createdAt", updated_at as "updatedAt";
    `;

    const res = await pool.query(sql, [
      walletAddress,
      deviceId,
      expoPushToken,
      platform,
      appVersion,
      enabled,
    ]);

    return res.rows[0];
  }

  /**
   * Disables push notifications for a device or token
   */
  public async unregisterDevice(
    params: UnregisterDeviceRequest
  ): Promise<boolean> {
    if (!isDatabaseConnected()) return false;
    const pool = getDbPool();
    if (!pool) return false;

    if (params.expoPushToken) {
      await pool.query(
        'UPDATE notification_devices SET enabled = FALSE, updated_at = NOW() WHERE expo_push_token = $1',
        [params.expoPushToken.trim()]
      );
      return true;
    }

    if (params.deviceId) {
      await pool.query(
        'UPDATE notification_devices SET enabled = FALSE, updated_at = NOW() WHERE device_id = $1',
        [params.deviceId.trim()]
      );
      return true;
    }

    return false;
  }

  /**
   * Creates a durable notification event and enqueues deliveries for all registered active devices
   * Strictly respects idempotencyKey to prevent duplicate notifications.
   */
  public async createNotificationEvent(
    params: CreateNotificationEventParams
  ): Promise<{ event: NotificationEventRecord | null; deliveriesEnqueued: number }> {
    if (!isDatabaseConnected()) {
      return { event: null, deliveriesEnqueued: 0 };
    }
    const pool = getDbPool();
    if (!pool) return { event: null, deliveriesEnqueued: 0 };

    const walletAddress = params.walletAddress.trim().toLowerCase();
    const idempotencyKey = params.idempotencyKey || null;

    // 1. Check idempotency deduplication
    if (idempotencyKey) {
      const checkRes = await pool.query(
        `SELECT id, wallet_address as "walletAddress", event_type as "eventType",
                title, body, data, idempotency_key as "idempotencyKey", status,
                created_at as "createdAt"
         FROM notification_events
         WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (checkRes.rows.length > 0) {
        console.log(`[NotificationService] Duplicate event skipped for key: ${idempotencyKey}`);
        return { event: checkRes.rows[0], deliveriesEnqueued: 0 };
      }
    }

    // 2. Insert event
    const insertEventSql = `
      INSERT INTO notification_events (
        wallet_address, event_type, title, body, data, idempotency_key, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING
        id, wallet_address as "walletAddress", event_type as "eventType",
        title, body, data, idempotency_key as "idempotencyKey", status,
        created_at as "createdAt";
    `;

    const eventRes = await pool.query(insertEventSql, [
      walletAddress,
      params.eventType,
      params.title,
      params.body,
      JSON.stringify(params.data || {}),
      idempotencyKey,
    ]);

    const createdEvent: NotificationEventRecord = eventRes.rows[0];

    // 3. Find active registered devices for this wallet
    const devicesRes = await pool.query(
      `SELECT id, expo_push_token as "expoPushToken"
       FROM notification_devices
       WHERE LOWER(wallet_address) = $1 AND enabled = TRUE`,
      [walletAddress]
    );

    if (devicesRes.rows.length === 0) {
      // Mark event completed (no devices registered to receive push)
      await pool.query(
        "UPDATE notification_events SET status = 'completed' WHERE id = $1",
        [createdEvent.id]
      );
      return { event: createdEvent, deliveriesEnqueued: 0 };
    }

    // 4. Enqueue deliveries for each device
    let count = 0;
    for (const dev of devicesRes.rows) {
      await pool.query(
        `INSERT INTO notification_deliveries (
          event_id, device_id, expo_push_token, status, attempts, max_attempts
        ) VALUES ($1, $2, $3, 'queued', 0, 3)`,
        [createdEvent.id, dev.id, dev.expoPushToken]
      );
      count++;
    }

    console.log(
      `[NotificationService] Created event ${createdEvent.id} ("${createdEvent.title}") with ${count} delivery record(s)`
    );

    return { event: createdEvent, deliveriesEnqueued: count };
  }

  /**
   * Retrieves registered devices for a wallet address
   */
  public async getDevicesForWallet(
    walletAddress: string
  ): Promise<NotificationDeviceRecord[]> {
    if (!isDatabaseConnected()) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const res = await pool.query(
      `SELECT id, wallet_address as "walletAddress", device_id as "deviceId",
              expo_push_token as "expoPushToken", platform, app_version as "appVersion",
              enabled, error_message as "errorMessage", last_active_at as "lastActiveAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM notification_devices
       WHERE LOWER(wallet_address) = $1
       ORDER BY last_active_at DESC`,
      [walletAddress.trim().toLowerCase()]
    );

    return res.rows;
  }

  /**
   * Retrieves persistent notification events for a wallet address
   */
  public async getRecentEvents(
    walletAddress: string,
    limit: number = 20
  ): Promise<NotificationEventRecord[]> {
    if (!isDatabaseConnected()) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const res = await pool.query(
      `SELECT id, wallet_address as "walletAddress", event_type as "eventType",
              title, body, data, idempotency_key as "idempotencyKey", status,
              created_at as "createdAt"
       FROM notification_events
       WHERE LOWER(wallet_address) = $1
       ORDER BY id DESC
       LIMIT $2`,
      [walletAddress.trim().toLowerCase(), Math.min(limit, 100)]
    );

    return res.rows;
  }

  /**
   * Marks a device token as invalid and disables future delivery attempts
   */
  public async markDeviceInvalid(
    expoPushToken: string,
    errorMessage: string
  ): Promise<void> {
    if (!isDatabaseConnected()) return;
    const pool = getDbPool();
    if (!pool) return;

    await pool.query(
      `UPDATE notification_devices
       SET enabled = FALSE, error_message = $2, updated_at = NOW()
       WHERE expo_push_token = $1`,
      [expoPushToken, errorMessage]
    );

    console.warn(
      `[NotificationService] Disabled invalid device token: ${expoPushToken.slice(0, 20)}... Reason: ${errorMessage}`
    );
  }

  /**
   * Fetches queued or retry deliveries ready to be dispatched
   */
  public async getQueuedDeliveries(
    limit: number = 50
  ): Promise<NotificationDeliveryRecord[]> {
    if (!isDatabaseConnected()) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const sql = `
      SELECT d.id, d.event_id as "eventId", d.device_id as "deviceId",
             d.expo_push_token as "expoPushToken", d.ticket_id as "ticketId",
             d.ticket_status as "ticketStatus", d.ticket_error as "ticketError",
             d.receipt_id as "receiptId", d.receipt_status as "receiptStatus",
             d.receipt_error as "receiptError", d.attempts, d.max_attempts as "maxAttempts",
             d.next_attempt_at as "nextAttemptAt", d.status,
             d.created_at as "createdAt", d.updated_at as "updatedAt",
             e.title, e.body, e.data
      FROM notification_deliveries d
      JOIN notification_events e ON d.event_id = e.id
      WHERE d.status IN ('queued', 'retry')
        AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= NOW())
      ORDER BY d.id ASC
      LIMIT $1;
    `;

    const res = await pool.query(sql, [limit]);
    return res.rows;
  }

  /**
   * Updates delivery status after push dispatch / ticket return
   */
  public async updateDeliveryTicket(
    deliveryId: number,
    update: {
      status: DeliveryStatus;
      ticketId?: string | null;
      ticketStatus?: string | null;
      ticketError?: string | null;
      attempts?: number;
      nextAttemptAt?: Date | null;
    }
  ): Promise<void> {
    if (!isDatabaseConnected()) return;
    const pool = getDbPool();
    if (!pool) return;

    const sets: string[] = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [deliveryId, update.status];
    let idx = 3;

    if (update.ticketId !== undefined) {
      sets.push(`ticket_id = $${idx++}`);
      values.push(update.ticketId);
    }
    if (update.ticketStatus !== undefined) {
      sets.push(`ticket_status = $${idx++}`);
      values.push(update.ticketStatus);
    }
    if (update.ticketError !== undefined) {
      sets.push(`ticket_error = $${idx++}`);
      values.push(update.ticketError);
    }
    if (update.attempts !== undefined) {
      sets.push(`attempts = $${idx++}`);
      values.push(update.attempts);
    }
    if (update.nextAttemptAt !== undefined) {
      sets.push(`next_attempt_at = $${idx++}`);
      values.push(update.nextAttemptAt);
    }

    await pool.query(
      `UPDATE notification_deliveries SET ${sets.join(', ')} WHERE id = $1`,
      values
    );
  }

  /**
   * Fetches sent deliveries that have ticket IDs and are awaiting receipt confirmation
   */
  public async getSentDeliveriesForReceipts(
    limit: number = 100
  ): Promise<NotificationDeliveryRecord[]> {
    if (!isDatabaseConnected()) return [];
    const pool = getDbPool();
    if (!pool) return [];

    const sql = `
      SELECT id, event_id as "eventId", device_id as "deviceId",
             expo_push_token as "expoPushToken", ticket_id as "ticketId",
             ticket_status as "ticketStatus", ticket_error as "ticketError",
             receipt_id as "receiptId", receipt_status as "receiptStatus",
             receipt_error as "receiptError", attempts, max_attempts as "maxAttempts",
             next_attempt_at as "nextAttemptAt", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM notification_deliveries
      WHERE status = 'sent'
        AND ticket_id IS NOT NULL
        AND updated_at <= NOW() - INTERVAL '15 SECONDS'
        AND created_at >= NOW() - INTERVAL '24 HOURS'
      ORDER BY id ASC
      LIMIT $1;
    `;

    const res = await pool.query(sql, [limit]);
    return res.rows;
  }

  /**
   * Updates delivery status after receipt inspection
   */
  public async updateDeliveryReceipt(
    deliveryId: number,
    update: {
      status: DeliveryStatus;
      receiptId?: string | null;
      receiptStatus?: string | null;
      receiptError?: string | null;
      attempts?: number;
      nextAttemptAt?: Date | null;
    }
  ): Promise<void> {
    if (!isDatabaseConnected()) return;
    const pool = getDbPool();
    if (!pool) return;

    const sets: string[] = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [deliveryId, update.status];
    let idx = 3;

    if (update.receiptId !== undefined) {
      sets.push(`receipt_id = $${idx++}`);
      values.push(update.receiptId);
    }
    if (update.receiptStatus !== undefined) {
      sets.push(`receipt_status = $${idx++}`);
      values.push(update.receiptStatus);
    }
    if (update.receiptError !== undefined) {
      sets.push(`receipt_error = $${idx++}`);
      values.push(update.receiptError);
    }
    if (update.attempts !== undefined) {
      sets.push(`attempts = $${idx++}`);
      values.push(update.attempts);
    }
    if (update.nextAttemptAt !== undefined) {
      sets.push(`next_attempt_at = $${idx++}`);
      values.push(update.nextAttemptAt);
    }

    await pool.query(
      `UPDATE notification_deliveries SET ${sets.join(', ')} WHERE id = $1`,
      values
    );
  }
}

export const notificationService = new NotificationService();
