import axios from 'axios';
import { getApiBaseUrl } from './apiConfig';

export type AlertCondition = 'above' | 'below' | 'pct_increase' | 'pct_decrease';

export interface PriceAlert {
  id: number;
  walletAddress: string;
  tokenId: string;
  tokenSymbol: string;
  tokenName: string | null;
  condition: AlertCondition;
  targetPrice: number;
  basePrice: number | null;
  cooldownMinutes: number;
  enabled: boolean;
  triggeredAt: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertParams {
  walletAddress: string;
  tokenId: string;
  tokenSymbol: string;
  tokenName?: string;
  condition: AlertCondition;
  targetPrice: number;
  basePrice?: number;
  cooldownMinutes?: number;
}

export interface UpdateAlertParams {
  targetPrice?: number;
  condition?: AlertCondition;
  cooldownMinutes?: number;
  enabled?: boolean;
}

export const alertApi = {
  /**
   * Creates a new price alert
   */
  async createAlert(params: CreateAlertParams): Promise<PriceAlert> {
    const res = await axios.post<{ success: boolean; data: PriceAlert }>(
      `${getApiBaseUrl()}/api/alerts`,
      params,
      { timeout: 8000 }
    );
    return res.data.data;
  },

  /**
   * Retrieves all alerts for a wallet, optionally filtered by token
   */
  async getAlerts(walletAddress: string, tokenId?: string): Promise<PriceAlert[]> {
    const res = await axios.get<{ success: boolean; data: PriceAlert[] }>(
      `${getApiBaseUrl()}/api/alerts`,
      {
        params: { walletAddress, tokenId },
        timeout: 8000,
      }
    );
    return res.data.data || [];
  },

  /**
   * Retrieves a single alert by ID
   */
  async getAlertById(id: number, walletAddress?: string): Promise<PriceAlert | null> {
    const res = await axios.get<{ success: boolean; data: PriceAlert }>(
      `${getApiBaseUrl()}/api/alerts/${id}`,
      {
        params: { walletAddress },
        timeout: 8000,
      }
    );
    return res.data.data || null;
  },

  /**
   * Updates an alert
   */
  async updateAlert(
    id: number,
    walletAddress: string,
    updates: UpdateAlertParams
  ): Promise<PriceAlert> {
    const res = await axios.patch<{ success: boolean; data: PriceAlert }>(
      `${getApiBaseUrl()}/api/alerts/${id}`,
      { walletAddress, ...updates },
      { timeout: 8000 }
    );
    return res.data.data;
  },

  /**
   * Re-arms a triggered or disabled alert
   */
  async rearmAlert(id: number, walletAddress: string): Promise<PriceAlert> {
    const res = await axios.post<{ success: boolean; data: PriceAlert }>(
      `${getApiBaseUrl()}/api/alerts/${id}/rearm`,
      { walletAddress },
      { timeout: 8000 }
    );
    return res.data.data;
  },

  /**
   * Deletes a price alert
   */
  async deleteAlert(id: number, walletAddress: string): Promise<boolean> {
    const res = await axios.delete<{ success: boolean }>(
      `${getApiBaseUrl()}/api/alerts/${id}`,
      {
        data: { walletAddress },
        timeout: 8000,
      }
    );
    return res.data.success ?? true;
  },
};
