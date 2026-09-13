import axios from 'axios';
import { Platform } from 'react-native';

export interface PortfolioHolding {
  id: string;
  chain: string;
  coinId: string;
  symbol: string;
  name: string;
  balance: string;
  amount: number;
  decimals: number;
  contractAddress?: string;
  priceUsd: number;
  valueUsd: number;
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
  date: number;
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

export interface PortfolioCandlePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioChartData {
  timeframe: string;
  points: PortfolioCandlePoint[];
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

export interface SwapTransactionRecord {
  id?: number;
  walletId?: number;
  chain: string;
  txHash: string;
  fromTokenAddress?: string;
  fromTokenSymbol?: string;
  fromAmount?: string;
  toTokenAddress?: string;
  toTokenSymbol?: string;
  toAmount?: string;
  router?: string;
  status: 'pending' | 'completed' | 'failed';
  gasUsed?: string;
  createdAt?: string;
  confirmedAt?: string;
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

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    if (Platform.OS === 'android' && process.env.EXPO_PUBLIC_API_URL.includes('localhost')) {
      return process.env.EXPO_PUBLIC_API_URL.replace('localhost', '10.0.2.2');
    }
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }
  return 'http://localhost:4000';
};

const portfolioApiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const portfolioApi = {
  async getPortfolio(chain: string, address: string): Promise<NormalizedPortfolioResponse> {
    const res = await portfolioApiClient.get(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`);
    return res.data.data;
  },

  async getSummary(chain: string, address: string): Promise<PortfolioSummary> {
    const res = await portfolioApiClient.get(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/summary`);
    return res.data.data;
  },

  async getHoldings(chain: string, address: string): Promise<PortfolioHolding[]> {
    const res = await portfolioApiClient.get(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/holdings`);
    return res.data.data;
  },

  async getChart(chain: string, address: string, range: string = '1D'): Promise<PortfolioChartData> {
    const res = await portfolioApiClient.get(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/chart`, {
      params: { range },
    });
    return res.data.data;
  },

  async getTransactions(
    chain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ transactions: PortfolioTransaction[]; meta: { page: number; limit: number; hasMore: boolean } }> {
    const res = await portfolioApiClient.get(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/transactions`, {
      params: { page, limit },
    });
    return {
      transactions: res.data.data || [],
      meta: res.data.meta || { page, limit, hasMore: false },
    };
  },

  async getDefi(chain: string, address: string): Promise<DeFiPosition[]> {
    const res = await portfolioApiClient.get(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/defi`);
    return res.data.data || [];
  },

  async getSwapHistory(
    chain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ items: SwapTransactionRecord[]; meta: { page: number; limit: number; hasMore: boolean } }> {
    const res = await portfolioApiClient.get(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/swap-history`, {
      params: { page, limit },
    });
    return {
      items: res.data.data || [],
      meta: res.data.meta || { page, limit, hasMore: false },
    };
  },

  async recordSwap(chain: string, address: string, data: Partial<SwapTransactionRecord>): Promise<SwapTransactionRecord> {
    const res = await portfolioApiClient.post(
      `/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/swap-history`,
      data
    );
    return res.data.data;
  },

  async refreshPortfolio(chain: string, address: string): Promise<NormalizedPortfolioResponse> {
    const res = await portfolioApiClient.post(`/api/portfolio/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/refresh`);
    return res.data.data;
  },
};
