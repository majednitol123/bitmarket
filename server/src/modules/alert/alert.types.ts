export type AlertCondition = 'above' | 'below' | 'pct_increase' | 'pct_decrease';
export type AlertStatus = 'ARMED' | 'TRIGGERED' | 'DISABLED';

export interface PriceAlertRecord {
  id: number;
  walletAddress: string;
  chain: string;
  tokenAddress: string | null;
  tokenId: string;
  tokenSymbol: string;
  tokenName: string | null;
  condition: AlertCondition;
  targetPrice: number;
  basePrice: number | null;
  currency: string;
  cooldownMinutes: number;
  enabled: boolean;
  status: AlertStatus;
  lastEvaluatedPrice: number | null;
  lastEvaluatedAt: string | null;
  triggeredAt: string | null;
  cooldownUntil: string | null;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRequest {
  walletAddress: string;
  chain?: string;
  tokenAddress?: string;
  tokenId: string;
  tokenSymbol: string;
  tokenName?: string;
  condition: AlertCondition;
  targetPrice: number;
  basePrice?: number;
  currency?: string;
  cooldownMinutes?: number; // 0 = once (one-shot), > 0 = cooldown minutes
}

export interface UpdateAlertRequest {
  targetPrice?: number;
  condition?: AlertCondition;
  cooldownMinutes?: number;
  enabled?: boolean;
  status?: AlertStatus;
}

export interface PriceAlertEvaluationResult {
  alertId: number;
  triggered: boolean;
  rearmed: boolean;
  previousPrice: number | null;
  currentPrice: number;
  targetPrice: number;
  condition: AlertCondition;
  status: AlertStatus;
  reason?: string;
}
