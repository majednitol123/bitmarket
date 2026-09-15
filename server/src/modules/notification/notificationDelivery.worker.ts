import { redisLock } from '../../cache/redisLock';
import { expoPushProvider, ExpoPushMessage } from '../../providers/ExpoPushProvider';
import { notificationService } from './notification.service';
import { NotificationDeliveryRecord } from './notification.types';

export class NotificationDeliveryWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number = 10000; // 10 seconds

  /**
   * Starts the autonomous notification delivery worker loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[NotificationDeliveryWorker] Started worker loop (interval: ${this.intervalMs}ms)`);
    this.tick();
  }

  /**
   * Gracefully stops the worker loop
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[NotificationDeliveryWorker] Stopped worker loop');
  }

  /**
   * Worker tick execution
   */
  private async tick(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.processQueuedDeliveries();
      await this.processSentReceipts();
    } catch (err: any) {
      console.error('[NotificationDeliveryWorker] Error during worker tick:', err.message);
    }

    if (this.isRunning) {
      this.timer = setTimeout(() => this.tick(), this.intervalMs);
    }
  }

  /**
   * Dispatches queued deliveries to the Expo Push Service
   */
  public async processQueuedDeliveries(): Promise<void> {
    const ownerToken = redisLock.generateOwnerToken();
    const lockAcquired = await redisLock.acquireLock('locks:notification_worker', 8, ownerToken);
    if (!lockAcquired) {
      return;
    }

    try {
      const deliveries = await notificationService.getQueuedDeliveries(50);
      if (deliveries.length === 0) {
        return;
      }

      console.log(`[NotificationDeliveryWorker] Processing ${deliveries.length} queued delivery record(s)...`);

      const validDeliveries: NotificationDeliveryRecord[] = [];
      const messages: ExpoPushMessage[] = [];

      for (const delivery of deliveries) {
        // Validate token format
        if (!expoPushProvider.isExpoPushToken(delivery.expoPushToken)) {
          console.warn(
            `[NotificationDeliveryWorker] Invalid token format for delivery ${delivery.id}: ${delivery.expoPushToken}`
          );
          await notificationService.updateDeliveryTicket(delivery.id, {
            status: 'invalid_token',
            ticketError: 'InvalidTokenFormat',
          });
          await notificationService.markDeviceInvalid(
            delivery.expoPushToken,
            'Malformed Expo push token format'
          );
          continue;
        }

        validDeliveries.push(delivery);
        messages.push({
          to: delivery.expoPushToken,
          title: delivery.title || 'BitMarket Alert',
          body: delivery.body || 'You have a new portfolio notification',
          data: delivery.data || {},
          sound: 'default',
          priority: 'high',
          channelId: 'wallet',
        });
      }

      if (messages.length === 0) {
        return;
      }

      // Send batch to Expo
      const tickets = await expoPushProvider.sendPushNotifications(messages);

      for (let i = 0; i < validDeliveries.length; i++) {
        const delivery = validDeliveries[i];
        const ticket = tickets[i];

        if (!ticket) continue;

        if (ticket.status === 'ok') {
          await notificationService.updateDeliveryTicket(delivery.id, {
            status: 'sent',
            ticketId: ticket.id,
            ticketStatus: 'ok',
          });
        } else {
          const errorCode = ticket.details?.error || 'UnknownError';
          console.warn(
            `[NotificationDeliveryWorker] Ticket error for delivery ${delivery.id}: ${errorCode} (${ticket.message})`
          );

          if (errorCode === 'DeviceNotRegistered') {
            await notificationService.updateDeliveryTicket(delivery.id, {
              status: 'invalid_token',
              ticketStatus: 'error',
              ticketError: errorCode,
            });
            await notificationService.markDeviceInvalid(
              delivery.expoPushToken,
              'DeviceNotRegistered'
            );
          } else {
            const nextAttempts = delivery.attempts + 1;
            const isExceeded = nextAttempts >= delivery.maxAttempts;
            const backoffMs = Math.pow(2, nextAttempts) * 30000; // 60s, 120s, 240s
            const nextAttemptAt = isExceeded ? null : new Date(Date.now() + backoffMs);

            await notificationService.updateDeliveryTicket(delivery.id, {
              status: isExceeded ? 'failed' : 'retry',
              ticketStatus: 'error',
              ticketError: errorCode,
              attempts: nextAttempts,
              nextAttemptAt,
            });
          }
        }
      }
    } finally {
      await redisLock.releaseLock('locks:notification_worker', ownerToken);
    }
  }

  /**
   * Verifies delivery receipts from Expo for previously sent notifications
   */
  public async processSentReceipts(): Promise<void> {
    const deliveries = await notificationService.getSentDeliveriesForReceipts(100);
    if (deliveries.length === 0) return;

    const ticketMap = new Map<string, NotificationDeliveryRecord>();
    const ticketIds: string[] = [];

    for (const d of deliveries) {
      if (d.ticketId) {
        ticketIds.push(d.ticketId);
        ticketMap.set(d.ticketId, d);
      }
    }

    if (ticketIds.length === 0) return;

    try {
      const receipts = await expoPushProvider.getPushReceipts(ticketIds);

      for (const [ticketId, receipt] of Object.entries(receipts)) {
        const delivery = ticketMap.get(ticketId);
        if (!delivery) continue;

        if (receipt.status === 'ok') {
          await notificationService.updateDeliveryReceipt(delivery.id, {
            status: 'confirmed',
            receiptId: ticketId,
            receiptStatus: 'ok',
          });
        } else {
          const errCode = receipt.details?.error || 'UnknownReceiptError';
          console.warn(
            `[NotificationDeliveryWorker] Receipt failure for delivery ${delivery.id}: ${errCode}`
          );

          if (errCode === 'DeviceNotRegistered') {
            await notificationService.updateDeliveryReceipt(delivery.id, {
              status: 'invalid_token',
              receiptStatus: 'error',
              receiptError: errCode,
            });
            await notificationService.markDeviceInvalid(
              delivery.expoPushToken,
              'DeviceNotRegistered'
            );
          } else {
            await notificationService.updateDeliveryReceipt(delivery.id, {
              status: 'failed',
              receiptStatus: 'error',
              receiptError: errCode,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[NotificationDeliveryWorker] Error fetching push receipts:', err.message);
    }
  }
}

export const notificationDeliveryWorker = new NotificationDeliveryWorker();
