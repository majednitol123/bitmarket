import {
  MarketOverview,
  MarketToken,
  ChartResponse,
  CoinListOptions,
  PaginatedTokens,
} from '../modules/market/market.types';

export interface MarketDataProvider {
  getMarketOverview(): Promise<MarketOverview>;
  getCoins(options: CoinListOptions): Promise<PaginatedTokens>;
  getCoinById(coinId: string): Promise<MarketToken | null>;
  getCoinChart(coinId: string, period: string): Promise<ChartResponse>;
  searchCoins(query: string): Promise<MarketToken[]>;
}
