import axios, { AxiosInstance } from 'axios';
import { MarketDataProvider } from './MarketDataProvider';
import { PortfolioDataProvider } from './PortfolioDataProvider';
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

export class CoinStatsProvider implements MarketDataProvider, PortfolioDataProvider {
  private clients: AxiosInstance[];
  private activeKeyIndex: number = 0;

  constructor() {
    const keys = config.coinstats.apiKeys.length > 0
      ? config.coinstats.apiKeys
      : config.coinstats.apiKey
        ? [config.coinstats.apiKey]
        : [];

    if (keys.length === 0) {
      console.warn('[CoinStatsProvider] No API keys configured!');
    }

    console.log(`[CoinStatsProvider] Initialized with ${keys.length} API key(s)`);

    // Create one axios client per API key
    this.clients = keys.map((key, idx) => {
      const client = axios.create({
        baseURL: config.coinstats.baseUrl,
        timeout: config.coinstats.timeoutMs,
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': key,
        },
      });

      // Auto-retry once on 429 with 1500ms delay for transient rate limits (same key)
      client.interceptors.response.use(
        (response) => response,
        async (error) => {
          const reqConfig = error.config;
          if (error.response?.status === 429 && reqConfig && !reqConfig._retry) {
            reqConfig._retry = true;
            await new Promise((resolve) => setTimeout(resolve, 1500));
            return client(reqConfig);
          }
          return Promise.reject(error);
        }
      );

      return client;
    });
  }

  /** Get the currently active client */
  private get client(): AxiosInstance {
    if (this.clients.length === 0) {
      throw new AppError('No CoinStats API keys configured', 500, 'NO_API_KEYS');
    }
    return this.clients[this.activeKeyIndex % this.clients.length];
  }

  /**
   * Execute a request with automatic key rotation on rate-limit (429/406).
   * Tries each key once before giving up.
   */
  private async requestWithRotation<T>(fn: (client: AxiosInstance) => Promise<T>): Promise<T> {
    const totalKeys = this.clients.length;
    if (totalKeys === 0) {
      throw new AppError('No CoinStats API keys configured', 500, 'NO_API_KEYS');
    }

    let lastError: any = null;
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIdx = (this.activeKeyIndex + attempt) % totalKeys;
      try {
        const result = await fn(this.clients[keyIdx]);
        // If a different key worked, make it the new default
        if (keyIdx !== this.activeKeyIndex) {
          console.log(`[CoinStatsProvider] Rotated to API key #${keyIdx + 1}`);
          this.activeKeyIndex = keyIdx;
        }
        return result;
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 429 || status === 406) {
          console.warn(`[CoinStatsProvider] Key #${keyIdx + 1} rate-limited (${status}), trying next...`);
          lastError = err;
          continue;
        }
        // Non-rate-limit error — don't rotate, just throw
        throw err;
      }
    }

    // All keys exhausted
    console.error(`[CoinStatsProvider] All ${totalKeys} API keys exhausted (rate-limited)`);
    throw lastError;
  }

  async getMarketOverview(): Promise<MarketOverview> {
    try {
      const response = await this.requestWithRotation(c => c.get('/markets'));
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
      const response = await this.requestWithRotation(c => c.get('/coins', { params }));
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
      const response = await this.requestWithRotation(c => c.get(`/coins/${encodeURIComponent(coinId)}`));
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
      const response = await this.requestWithRotation(c => c.get(`/coins/${encodeURIComponent(coinId)}/charts`, {
        params: { period: mappedPeriod },
      }));

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
      const response = await this.requestWithRotation(c => c.get('/coins', {
        params: {
          name: query.trim(),
          limit: 20,
        },
      }));

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

  async getWalletBalance(blockchain: string, address: string): Promise<any[]> {
    if (!blockchain || !address) {
      throw new AppError('blockchain and address are required', 400, 'INVALID_PARAMS');
    }

    try {
      const response = await this.requestWithRotation(c => c.get('/wallet/balance', {
        params: {
          blockchain,
          address,
        },
      }));

      const raw = response.data;
      if (Array.isArray(raw)) {
        return raw;
      }
      if (raw?.result && Array.isArray(raw.result)) {
        return raw.result;
      }
      if (raw?.coins && Array.isArray(raw.coins)) {
        return raw.coins;
      }
      return [];
    } catch (err: any) {
      console.error(`[CoinStatsProvider] Error fetching wallet balance (${blockchain}:${address}):`, err.message);
      if (err.response?.status === 404) {
        return [];
      }
      throw new AppError(
        `Failed to fetch wallet balance: ${err.message}`,
        err.response?.status || 502,
        'PROVIDER_WALLET_BALANCE_ERROR'
      );
    }
  }

  async getWalletTransactions(
    blockchain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ result: any[]; meta?: any }> {
    if (!blockchain || !address) {
      throw new AppError('blockchain and address are required', 400, 'INVALID_PARAMS');
    }

    try {
      const response = await this.requestWithRotation(c => c.get('/wallet/transactions', {
        params: {
          blockchain,
          address,
          page,
          limit,
        },
      }));

      const raw = response.data;
      const result = Array.isArray(raw?.result)
        ? raw.result
        : Array.isArray(raw)
        ? raw
        : [];

      return {
        result,
        meta: raw?.meta || { page, limit, hasNextPage: result.length >= limit },
      };
    } catch (err: any) {
      console.error(
        `[CoinStatsProvider] Error fetching wallet transactions (${blockchain}:${address}):`,
        err.message
      );
      if (err.response?.status === 404) {
        return { result: [], meta: { page, limit, hasNextPage: false } };
      }
      throw new AppError(
        `Failed to fetch wallet transactions: ${err.message}`,
        err.response?.status || 502,
        'PROVIDER_WALLET_TRANSACTIONS_ERROR'
      );
    }
  }

  async getWalletDefi(
    blockchain: string,
    address: string
  ): Promise<any> {
    if (!blockchain || !address) {
      return null;
    }

    try {
      const response = await this.requestWithRotation(c => c.get('/wallet/defi', {
        params: {
          blockchain,
          address,
        },
      }));

      return response.data;
    } catch (err: any) {
      console.warn(
        `[CoinStatsProvider] Non-critical error fetching wallet defi (${blockchain}:${address}):`,
        err.message
      );
      return null;
    }
  }
}

export const coinStatsProvider = new CoinStatsProvider();

