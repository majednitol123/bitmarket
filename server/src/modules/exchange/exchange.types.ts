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

export interface ExchangeQuoteRequest {
  fromChain: string | number;
  toChain: string | number;
  fromToken: string; // address or "native"
  toToken: string;   // address or "native"
  fromAmount: string; // human-readable e.g. "0.5"
  fromAddress?: string;
  slippage?: string; // e.g. "0.5" for 0.5%
}

export interface ExchangeQuoteResponse {
  quoteId: string;
  routeType: RouteType;
  provider: string; // e.g. "Li.Fi / Uniswap V3" or "Li.Fi / Stargate"
  fromChain: string | number;
  toChain: string | number;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  exchangeRate: number; // 1 fromToken = X toToken
  minReceived: string;
  estimatedGasUsd: number;
  priceImpactPercent: number;
  estimatedDurationSeconds: number;
  isIndicative?: boolean; // true if computed via live fallback price oracle
  rawQuote?: any;
}

export interface BuildTxRequest {
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
  value: string; // hex or decimal string
  chainId: number;
  gasLimit?: string;
}

export interface ApprovalDetails {
  needed: boolean;
  tokenAddress?: string;
  spender?: string;
  amount?: string;
  approvalTx?: UnsignedTransaction;
}

export interface BuildTxResponse {
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

export interface ConfirmSwapRequest {
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

export interface SwapStatusResponse {
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

import { SwapTransactionRecord } from '../portfolio/portfolio.types';
export { SwapTransactionRecord };

