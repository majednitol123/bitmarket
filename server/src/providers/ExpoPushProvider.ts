import axios from 'axios';
import { BaseProvider } from './core/BaseProvider';
import { ProviderError } from './core/ProviderErrors';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  badge?: number;
}

export interface ExpoPushTicketResult {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded' | string;
    [key: string]: any;
  };
}

export interface ExpoPushReceiptResult {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded' | string;
    [key: string]: any;
  };
}

export class ExpoPushProvider extends BaseProvider {
  private readonly baseUrl = 'https://exp.host/--/api/v2/push';

  constructor() {
    super('ExpoPush', {
      defaultTimeoutMs: 8000,
      maxConsecutiveFailures: 5,
      circuitBreakerCooldownMs: 30000,
    });
  }

  /**
   * Validates if a string is a properly formatted Expo Push Token
   */
  public isExpoPushToken(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    return /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token.trim());
  }

  /**
   * Sends a batch of push notifications through the Expo Push API
   * Automatically chunks messages into groups of 100 as required by Expo.
   */
  public async sendPushNotifications(
    messages: ExpoPushMessage[]
  ): Promise<ExpoPushTicketResult[]> {
    if (!messages || messages.length === 0) return [];

    const CHUNK_SIZE = 100;
    const allTickets: ExpoPushTicketResult[] = [];

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      const chunkTickets = await this.executeWithResilience(
        'sendPushChunk',
        async () => {
          const response = await axios.post<{ data: ExpoPushTicketResult[] }>(
            `${this.baseUrl}/send`,
            chunk,
            {
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
              },
              timeout: this.defaultTimeoutMs,
            }
          );

          if (!response.data || !Array.isArray(response.data.data)) {
            throw new ProviderError(
              'ExpoPush',
              'Malformed response from Expo Push Service',
              502,
              'BAD_GATEWAY'
            );
          }

          return response.data.data;
        },
        { timeoutMs: this.defaultTimeoutMs, retries: 2 }
      );

      allTickets.push(...chunkTickets);
    }

    return allTickets;
  }

  /**
   * Retrieves delivery receipts for previously issued Expo ticket IDs
   * Automatically chunks ticket IDs into groups of 300 as required by Expo.
   */
  public async getPushReceipts(
    ticketIds: string[]
  ): Promise<Record<string, ExpoPushReceiptResult>> {
    if (!ticketIds || ticketIds.length === 0) return {};

    const CHUNK_SIZE = 300;
    const combinedReceipts: Record<string, ExpoPushReceiptResult> = {};

    for (let i = 0; i < ticketIds.length; i += CHUNK_SIZE) {
      const chunk = ticketIds.slice(i, i + CHUNK_SIZE);
      const receipts = await this.executeWithResilience(
        'getReceiptsChunk',
        async () => {
          const response = await axios.post<{
            data: Record<string, ExpoPushReceiptResult>;
          }>(
            `${this.baseUrl}/getReceipts`,
            { ids: chunk },
            {
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
              },
              timeout: this.defaultTimeoutMs,
            }
          );

          return response.data?.data || {};
        },
        { timeoutMs: this.defaultTimeoutMs, retries: 2 }
      );

      Object.assign(combinedReceipts, receipts);
    }

    return combinedReceipts;
  }
}

export const expoPushProvider = new ExpoPushProvider();
