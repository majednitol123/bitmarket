export interface PortfolioHolding {
  id: string; // {chain}:{contractAddress} or {chain}:native
  chain: string;
  coinId: string;
  symbol: string;
  name: string;
  balance: string;
  amount: number;
  decimals: number;
  contractAddress?: string;
  priceUsd: number;
  valueUsd: number | null;
  change24hPercent: number;
  logoUrl: string;
  allocationPercent: number;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  change24hUsd: number;
  change24hPercent: number;
  profitLossUsd: number | null;
  profitLossPercent: number | null;
  holdingsCount: number;
}

export interface PortfolioTransaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'execution' | 'other';
  date: number; // Unix timestamp in ms
  hash: string;
  explorerUrl: string;
  fromAddress: string;
  toAddress: string;
  coinSymbol: string;
  coinName: string;
  coinIcon: string;
  amount: string;
  valueUsd: number;
  profitLoss: number | null;
}

export interface PortfolioChartPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioChartData {
  timeframe: string;
  points: PortfolioChartPoint[];
  pnl: string;
  pnlPercent: string;
  isPositive: boolean;
  high: string;
  low: string;
  volume24h: string;
}

export interface DeFiPosition {
  protocol: string;
  pool: string;
  type: string;
  deposited: string;
  apy: string;
  earnings: string;
  chain: string;
  icon?: string;
}

export interface NormalizedPortfolioResponse {
  wallet: {
    address: string;
    chain: string;
  };
  summary: PortfolioSummary;
  holdings: PortfolioHolding[];
  defi: DeFiPosition[];
  updatedAt: string;
}

export interface PaginatedPortfolioTransactions {
  transactions: PortfolioTransaction[];
  meta: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface SwapTransactionRecord {
  id?: number;
  walletId?: number;
  chain: string;
  chainId?: number;
  txHash: string;
  fromTokenAddress?: string;
  fromTokenSymbol?: string;
  fromAmount?: string;
  toTokenAddress?: string;
  toTokenSymbol?: string;
  toAmount?: string;
  router?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'failed';
  gasUsed?: string;
  blockNumber?: number;
  errorMessage?: string;
  lastCheckedAt?: string;
  checkAttempts?: number;
  idempotencyKey?: string;
  createdAt?: string;
  confirmedAt?: string;
  updatedAt?: string;
}
