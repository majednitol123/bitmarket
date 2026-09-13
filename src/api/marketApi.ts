import axios from 'axios';
import { Platform } from 'react-native';

export interface MarketOverview {
  marketCapUsd: number;
  volume24hUsd: number;
  btcDominancePercent: number;
  marketCapChange24hPercent: number;
  volumeChange24hPercent?: number;
  btcDominanceChangePercent?: number;
  updatedAt: string;
}

export interface ContractAddressInfo {
  blockchain: string;
  contractAddress: string;
}

export interface MarketToken {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string;
  priceUsd: number;
  change24hPercent: number;
  change1hPercent: number;
  change1wPercent: number;
  marketCapUsd: number;
  volume24hUsd: number;
  rank: number;
  contractAddress?: string;
  contractAddresses?: ContractAddressInfo[];
  priceUpdatedAt: string;
  sparkline?: number[];
}

export interface ChartPoint {
  timestamp: number;
  priceUsd: number;
  volume?: number;
}

export interface ChartResponse {
  tokenId: string;
  period: string;
  points: ChartPoint[];
  updatedAt: string;
}

export interface PaginatedTokensResponse {
  tokens: MarketToken[];
  meta: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    // If running on android emulator and set to localhost, replace with 10.0.2.2
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

const marketApiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const marketApi = {
  async getOverview(): Promise<MarketOverview> {
    const res = await marketApiClient.get('/api/market/overview');
    return res.data.data;
  },

  async getTokens(
    page: number = 1,
    limit: number = 50,
    category: string = 'all'
  ): Promise<PaginatedTokensResponse> {
    const res = await marketApiClient.get('/api/market/tokens', {
      params: { page, limit, category },
    });
    return {
      tokens: res.data.data,
      meta: res.data.meta || { page, limit, hasMore: false },
    };
  },

  async getTokenById(coinId: string): Promise<MarketToken> {
    const res = await marketApiClient.get(`/api/market/tokens/${encodeURIComponent(coinId)}`);
    return res.data.data;
  },

  async getTokenChart(coinId: string, period: string = '1w'): Promise<ChartResponse> {
    const res = await marketApiClient.get(
      `/api/market/tokens/${encodeURIComponent(coinId)}/chart`,
      { params: { period } }
    );
    return res.data.data;
  },

  async searchTokens(query: string): Promise<MarketToken[]> {
    if (!query || query.trim().length === 0) return [];
    const res = await marketApiClient.get('/api/market/search', {
      params: { q: query.trim() },
    });
    return res.data.data || [];
  },

  async getGainers(limit: number = 20): Promise<MarketToken[]> {
    const res = await marketApiClient.get('/api/market/gainers', {
      params: { limit },
    });
    return res.data.data || [];
  },
};
