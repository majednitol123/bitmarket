import axios from 'axios';
import { getApiBaseUrl, attachRequestTracing } from './apiConfig';

export type RouteType = 'swap' | 'bridge';

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number | string;
  logoUrl?: string;
  priceUsd?: number;
}

export interface ExchangeQuoteParams {
  fromChain: string | number;
  toChain: string | number;
  fromToken: string; // address or "native"
  toToken: string;   // address or "native"
  fromAmount: string;
  fromAddress?: string;
  slippage?: string;
}

export interface ExchangeQuoteData {
  quoteId: string;
  routeType: RouteType;
  provider: string;
  fromChain: string | number;
  toChain: string | number;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  exchangeRate: number;
  minReceived: string;
  estimatedGasUsd: number;
  priceImpactPercent: number;
  estimatedDurationSeconds: number;
  isIndicative?: boolean;
}

export interface BuildTxParams {
  fromChain: string | number;
  toChain: string | number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  slippage?: string;
  quoteId?: string;
}

export interface UnsignedTransaction {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
}

export interface ApprovalDetails {
  needed: boolean;
  tokenAddress?: string;
  spender?: string;
  amount?: string;
}

export interface BuildTxData {
  swapId: number;
  type: RouteType;
  provider: string;
  status: 'ready_for_signature' | 'approval_required';
  fromAmount: string;
  toAmount: string;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  transaction: UnsignedTransaction;
  approval?: ApprovalDetails;
  expiresAt: string;
}

export interface ConfirmSwapParams {
  swapId?: number;
  txHash: string;
  walletAddress: string;
  chain: string;
  chainId?: number;
  fromTokenAddress?: string;
  fromTokenSymbol?: string;
  toTokenAddress?: string;
  toTokenSymbol?: string;
  fromAmount?: string;
  toAmount?: string;
  router?: string;
  idempotencyKey?: string;
}

export interface SwapStatusData {
  id?: number;
  txHash: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  chain: string;
  chainId?: number;
  blockNumber?: number;
  gasUsed?: string;
  confirmations?: number;
  errorMessage?: string;
  confirmedAt?: string;
  createdAt?: string;
}

const exchangeApiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

attachRequestTracing(exchangeApiClient);

exchangeApiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  return config;
});

export const exchangeApi = {
  /**
   * Fetches a live quote for single-chain swap or cross-chain bridge
   */
  async getQuote(params: ExchangeQuoteParams): Promise<ExchangeQuoteData> {
    const res = await exchangeApiClient.get('/api/exchange/quote', { params });
    return res.data.data;
  },

  /**
   * Builds the unsigned blockchain transaction calldata for wallet execution
   */
  async buildTransaction(params: BuildTxParams): Promise<BuildTxData> {
    const res = await exchangeApiClient.post('/api/exchange/build-tx', params);
    return res.data.data;
  },

  /**
   * Submits real on-chain tx hash to backend for durable record and cache invalidation
   */
  async confirmSwap(params: ConfirmSwapParams): Promise<any> {
    const res = await exchangeApiClient.post('/api/exchange/confirm', params);
    return res.data.data;
  },

  /**
   * Checks status of a submitted swap transaction with optional live RPC probe
   */
  async getStatus(txHash: string, checkNow?: boolean): Promise<SwapStatusData> {
    const res = await exchangeApiClient.get(`/api/exchange/status/${encodeURIComponent(txHash)}`, {
      params: checkNow ? { checkNow: 'true' } : undefined,
    });
    return res.data.data;
  },
};
