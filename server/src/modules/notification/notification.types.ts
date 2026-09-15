export type DevicePlatform = 'ios' | 'android' | 'web';

export type NotificationEventType =
  | 'swap_confirmed'
  | 'swap_failed'
  | 'price_alert'
  | 'wallet_connected'
  | 'system_test';

export type DeliveryStatus =
  | 'queued'
  | 'retry'
  | 'sent'
  | 'confirmed'
  | 'failed'
  | 'invalid_token';

export interface RegisterDeviceRequest {
  walletAddress: string;
  deviceId: string;
  expoPushToken: string;
  platform?: DevicePlatform;
  appVersion?: string;
  enabled?: boolean;
}

export interface UnregisterDeviceRequest {
  expoPushToken?: string;
  deviceId?: string;
}

export interface NotificationDeviceRecord {
  id: number;
  walletAddress: string;
  deviceId: string;
  expoPushToken: string;
  platform: DevicePlatform;
  appVersion?: string | null;
  enabled: boolean;
  errorMessage?: string | null;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEventRecord {
  id: number;
  walletAddress: string;
  eventType: NotificationEventType | string;
  title: string;
  body: string;
  data: Record<string, any>;
  idempotencyKey?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface NotificationDeliveryRecord {
  id: number;
  eventId: number;
  deviceId: number;
  expoPushToken: string;
  ticketId?: string | null;
  ticketStatus?: string | null;
  ticketError?: string | null;
  receiptId?: string | null;
  receiptStatus?: string | null;
  receiptError?: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: string | null;
  status: DeliveryStatus;
  createdAt: string;
  updatedAt: string;
  // Joined event fields for worker dispatch
  title?: string;
  body?: string;
  data?: Record<string, any>;
}

export interface CreateNotificationEventParams {
  walletAddress: string;
  eventType: NotificationEventType | string;
  title: string;
  body: string;
  data?: Record<string, any>;
  idempotencyKey?: string;
}
