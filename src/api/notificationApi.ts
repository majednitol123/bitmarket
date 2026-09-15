import axios from 'axios';
import { getApiBaseUrl } from './apiConfig';

export interface RegisterDeviceParams {
  walletAddress: string;
  deviceId: string;
  expoPushToken: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  enabled?: boolean;
}

export interface UnregisterDeviceParams {
  expoPushToken?: string;
  deviceId?: string;
}

export interface NotificationDevice {
  id: number;
  walletAddress: string;
  deviceId: string;
  expoPushToken: string;
  platform: string;
  appVersion?: string | null;
  enabled: boolean;
  errorMessage?: string | null;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEvent {
  id: number;
  walletAddress: string;
  eventType: string;
  title: string;
  body: string;
  data: Record<string, any>;
  idempotencyKey?: string | null;
  status: string;
  createdAt: string;
}

export interface SendTestNotificationParams {
  walletAddress: string;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

export const notificationApi = {
  /**
   * Registers a device push token with the backend
   */
  async registerDevice(params: RegisterDeviceParams): Promise<NotificationDevice> {
    const res = await axios.post<{ success: boolean; data: NotificationDevice }>(
      `${getApiBaseUrl()}/api/notifications/devices/register`,
      params,
      { timeout: 8000 }
    );
    return res.data.data;
  },

  /**
   * Disables push notifications for a device or token
   */
  async unregisterDevice(params: UnregisterDeviceParams): Promise<boolean> {
    const res = await axios.post<{ success: boolean; data: { unregistered: boolean } }>(
      `${getApiBaseUrl()}/api/notifications/devices/unregister`,
      params,
      { timeout: 8000 }
    );
    return res.data.data?.unregistered ?? false;
  },

  /**
   * Fetches registered devices for a wallet
   */
  async getDevices(walletAddress: string): Promise<NotificationDevice[]> {
    const res = await axios.get<{ success: boolean; data: NotificationDevice[] }>(
      `${getApiBaseUrl()}/api/notifications/devices`,
      { params: { walletAddress }, timeout: 8000 }
    );
    return res.data.data || [];
  },

  /**
   * Fetches persistent notification history for a wallet
   */
  async getEvents(walletAddress: string, limit: number = 20): Promise<NotificationEvent[]> {
    const res = await axios.get<{ success: boolean; data: NotificationEvent[] }>(
      `${getApiBaseUrl()}/api/notifications/events`,
      { params: { walletAddress, limit }, timeout: 8000 }
    );
    return res.data.data || [];
  },

  /**
   * Triggers a test push notification from backend
   */
  async sendTestNotification(
    params: SendTestNotificationParams
  ): Promise<{ event: NotificationEvent; deliveriesEnqueued: number }> {
    const res = await axios.post<{
      success: boolean;
      data: { event: NotificationEvent; deliveriesEnqueued: number };
    }>(`${getApiBaseUrl()}/api/notifications/test`, params, { timeout: 8000 });
    return res.data.data;
  },
};
