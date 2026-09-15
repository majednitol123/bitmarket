export type AlertCondition = 'above' | 'below' | 'pct_increase' | 'pct_decrease';

export interface PriceAlertRecord {
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

export interface CreateAlertRequest {
  walletAddress: string;
  tokenId: string;
  tokenSymbol: string;
  tokenName?: string;
  condition: AlertCondition;
  targetPrice: number;
  basePrice?: number;
  cooldownMinutes?: number; // 0 = once (one-shot), > 0 = cooldown minutes
}

export interface UpdateAlertRequest {
  targetPrice?: number;
  condition?: AlertCondition;
  cooldownMinutes?: number;
  enabled?: boolean;
}

export interface PriceAlertEvaluationResult {
  alertId: number;
  triggered: boolean;
  currentPrice: number;
  targetPrice: number;
  condition: AlertCondition;
  reason?: string;
}
