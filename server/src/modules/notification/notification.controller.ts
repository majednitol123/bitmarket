import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { RegisterDeviceRequest } from './notification.types';
import { isValidEvmAddress, isValidSolanaAddress } from '../../middleware/validation.middleware';

export class NotificationController {
  /**
   * POST /api/notifications/devices/register
   * Registers or updates a device's push token for an active wallet
   */
  public async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress, deviceId, expoPushToken, platform, appVersion, enabled } =
        req.body as RegisterDeviceRequest;

      if (!walletAddress || !deviceId || !expoPushToken) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: walletAddress, deviceId, expoPushToken',
        });
        return;
      }

      if (!isValidEvmAddress(walletAddress) && !isValidSolanaAddress(walletAddress)) {
        res.status(400).json({
          success: false,
          error: 'Invalid walletAddress format. Must be a valid EVM (0x...) or Solana address.',
        });
        return;
      }

      const device = await notificationService.registerDevice({
        walletAddress,
        deviceId,
        expoPushToken,
        platform,
        appVersion,
        enabled,
      });

      res.status(200).json({
        success: true,
        data: device,
      });
    } catch (err: any) {
      console.error('[NotificationController] registerDevice error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * POST /api/notifications/devices/unregister
   * Disables push notifications for a device or token
   */
  public async unregisterDevice(req: Request, res: Response): Promise<void> {
    try {
      const { expoPushToken, deviceId } = req.body;

      if (!expoPushToken && !deviceId) {
        res.status(400).json({
          success: false,
          error: 'Must provide either expoPushToken or deviceId to unregister',
        });
        return;
      }

      const unregistered = await notificationService.unregisterDevice({
        expoPushToken,
        deviceId,
      });

      res.status(200).json({
        success: true,
        data: { unregistered },
      });
    } catch (err: any) {
      console.error('[NotificationController] unregisterDevice error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * GET /api/notifications/devices?walletAddress=0x...
   * Lists registered devices for a wallet
   */
  public async getDevices(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.query.walletAddress as string;

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          error: 'Query parameter walletAddress is required',
        });
        return;
      }

      if (!isValidEvmAddress(walletAddress) && !isValidSolanaAddress(walletAddress)) {
        res.status(400).json({
          success: false,
          error: 'Invalid walletAddress format. Must be a valid EVM (0x...) or Solana address.',
        });
        return;
      }

      const devices = await notificationService.getDevicesForWallet(walletAddress);
      res.status(200).json({
        success: true,
        data: devices,
      });
    } catch (err: any) {
      console.error('[NotificationController] getDevices error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * GET /api/notifications/events?walletAddress=0x...&limit=20
   * Lists persistent notification history for a wallet
   */
  public async getEvents(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.query.walletAddress as string;
      const limit = parseInt((req.query.limit as string) || '20', 10);

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          error: 'Query parameter walletAddress is required',
        });
        return;
      }

      const events = await notificationService.getRecentEvents(walletAddress, limit);
      res.status(200).json({
        success: true,
        data: events,
      });
    } catch (err: any) {
      console.error('[NotificationController] getEvents error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * POST /api/notifications/test
   * Emits a test notification event to test worker delivery and receipt flow
   */
  public async sendTestNotification(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress, title, body, data } = req.body;

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          error: 'walletAddress is required',
        });
        return;
      }

      const idempotencyKey = `test:${Date.now()}:${Math.random().toString(36).substring(2, 7)}`;
      const result = await notificationService.createNotificationEvent({
        walletAddress,
        eventType: 'system_test',
        title: title || '🔔 BitMarket Test Notification',
        body: body || 'Your notification pipeline is fully connected and operational!',
        data: data || { timestamp: Date.now() },
        idempotencyKey,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[NotificationController] sendTestNotification error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }
}

export const notificationController = new NotificationController();
