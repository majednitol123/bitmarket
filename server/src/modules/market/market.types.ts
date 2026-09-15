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
  id: string; // e.g. "bitcoin", "ethereum"
  symbol: string; // e.g. "BTC", "ETH"
  name: string; // e.g. "Bitcoin"
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

export interface CoinListOptions {
  page?: number;
  limit?: number;
  category?: string;
  currency?: string;
}

export interface PaginatedTokens {
  tokens: MarketToken[];
  meta: {
    page: number;
    limit: number;
    total?: number;
    hasMore: boolean;
  };
}
