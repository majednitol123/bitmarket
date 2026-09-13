import axios, { AxiosInstance } from 'axios';
import { MarketDataProvider } from './MarketDataProvider';
import {
  MarketOverview,
  MarketToken,
  ChartResponse,
  CoinListOptions,
  PaginatedTokens,
} from '../modules/market/market.types';
import {
  mapCoinStatsOverview,
  mapCoinStatsCoin,
  mapCoinStatsCoinList,
  mapCoinStatsChart,
} from '../modules/market/market.mapper';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export class CoinStatsProvider implements MarketDataProvider {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.coinstats.baseUrl,
      timeout: config.coinstats.timeoutMs,
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': config.coinstats.apiKey,
      },
    });
  }

  async getMarketOverview(): Promise<MarketOverview> {
    try {
      const response = await this.client.get('/markets');
      return mapCoinStatsOverview(response.data);
    } catch (err: any) {
      console.error('[CoinStatsProvider] Error fetching market overview:', err.message);
      throw new AppError(
        `Failed to fetch market overview from provider: ${err.message}`,
        err.response?.status || 502,
        'PROVIDER_OVERVIEW_ERROR'
      );
    }
  }

  async getCoins(options: CoinListOptions = {}): Promise<PaginatedTokens> {
    const page = options.page || 1;
    const limit = options.limit || 50;

    const params: Record<string, any> = {
      page,
      limit,
    };

    if (options.currency) {
      params.currency = options.currency;
    }

    try {
      const response = await this.client.get('/coins', { params });
      const rawResult = response.data?.result || response.data?.coins || response.data || [];
      const tokens = mapCoinStatsCoinList(Array.isArray(rawResult) ? rawResult : []);

      const hasMore = response.data?.meta?.hasNextPage ?? (tokens.length >= limit);

      return {
        tokens,
        meta: {
          page,
          limit,
          hasMore,
        },
      };
    } catch (err: any) {
      console.error('[CoinStatsProvider] Error fetching coins list:', err.message);
      throw new AppError(
        `Failed to fetch coins list from provider: ${err.message}`,
        err.response?.status || 502,
        'PROVIDER_COINS_ERROR'
      );
    }
  }

  async getCoinById(coinId: string): Promise<MarketToken | null> {
    if (!coinId) return null;

    try {
      const response = await this.client.get(`/coins/${encodeURIComponent(coinId)}`);
      const raw = response.data?.coin || response.data?.result || response.data;
      return mapCoinStatsCoin(raw);
    } catch (err: any) {
      if (err.response?.status === 404) {
        return null;
      }
      console.error(`[CoinStatsProvider] Error fetching coin ${coinId}:`, err.message);
      throw new AppError(
        `Failed to fetch coin ${coinId} from provider: ${err.message}`,
        err.response?.status || 502,
        'PROVIDER_COIN_DETAIL_ERROR'
      );
    }
  }

  async getCoinChart(coinId: string, period: string = '1w'): Promise<ChartResponse> {
    if (!coinId) {
      throw new AppError('coinId is required for chart data', 400, 'INVALID_COIN_ID');
    }

    // Supported periods in CoinStats: 24h, 1w, 1m, 3m, 6m, 1y, all
    // Map common frontend period formats (e.g. 1H, 1D, 1W, 1M, 1Y, ALL) to CoinStats format
    let mappedPeriod = period.toLowerCase();
    if (mappedPeriod === '1h') mappedPeriod = '24h'; // CoinStats min chart window is 24h
    if (mappedPeriod === '1d' || mappedPeriod === 'd') mappedPeriod = '24h';
    if (mappedPeriod === '1w' || mappedPeriod === 'w') mappedPeriod = '1w';
    if (mappedPeriod === '1m' || mappedPeriod === 'm') mappedPeriod = '1m';
    if (mappedPeriod === '3m') mappedPeriod = '3m';
    if (mappedPeriod === '6m') mappedPeriod = '6m';
    if (mappedPeriod === '1y' || mappedPeriod === 'y') mappedPeriod = '1y';
    if (mappedPeriod === 'all') mappedPeriod = 'all';

    try {
      const response = await this.client.get(`/coins/${encodeURIComponent(coinId)}/charts`, {
        params: { period: mappedPeriod },
      });

      return mapCoinStatsChart(coinId, period, response.data);
    } catch (err: any) {
      console.error(`[CoinStatsProvider] Error fetching chart for ${coinId} (${period}):`, err.message);
      throw new AppError(
        `Failed to fetch chart for ${coinId} from provider: ${err.message}`,
        err.response?.status || 502,
        'PROVIDER_CHART_ERROR'
      );
    }
  }

  async searchCoins(query: string): Promise<MarketToken[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // CoinStats supports search via ?name= or coin filtering
      const response = await this.client.get('/coins', {
        params: {
          name: query.trim(),
          limit: 20,
        },
      });

      const rawResult = response.data?.result || response.data?.coins || response.data || [];
      return mapCoinStatsCoinList(Array.isArray(rawResult) ? rawResult : []);
    } catch (err: any) {
      console.error(`[CoinStatsProvider] Error searching coins for "${query}":`, err.message);
      throw new AppError(
        `Failed to search coins from provider: ${err.message}`,
        err.response?.status || 502,
        'PROVIDER_SEARCH_ERROR'
      );
    }
  }
}

export const coinStatsProvider = new CoinStatsProvider();
