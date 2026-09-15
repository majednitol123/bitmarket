import axios, { AxiosInstance } from 'axios';
import { BaseProvider } from './core/BaseProvider';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderError,
} from './core/ProviderErrors';
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

export class CoinStatsProvider extends BaseProvider implements MarketDataProvider, PortfolioDataProvider {
  private clients: AxiosInstance[];
  private activeKeyIndex: number = 0;
  private apiKeys: string[];

  constructor() {
    super('CoinStats', {
      defaultTimeoutMs: config.coinstats.timeoutMs || 10000,
      maxConsecutiveFailures: 5,
      circuitBreakerCooldownMs: 30000,
    });

    this.apiKeys =
      config.coinstats.apiKeys.length > 0
        ? config.coinstats.apiKeys
        : config.coinstats.apiKey
          ? [config.coinstats.apiKey]
          : [];

    if (this.apiKeys.length === 0) {
      console.warn('[CoinStatsProvider] No API keys configured!');
    } else {
      console.log(`[CoinStatsProvider] Initialized with ${this.apiKeys.length} API key(s)`);
    }

    // Create axios clients without blind 1500ms sleep interceptors
    this.clients = this.apiKeys.map((key) => {
      return axios.create({
        baseURL: config.coinstats.baseUrl,
        timeout: config.coinstats.timeoutMs,
        headers: {
          Accept: 'application/json',
          'X-API-KEY': key,
        },
      });
    });

    if (this.apiKeys.length > 0) {
      this.budgetTracker.recordKeyRotation('CoinStats', 0, this.apiKeys.length, 'key_1');
    }
  }

  /**
   * Execute request with immediate key rotation upon receiving 429/406 quota exhaustion.
   * Never sleep-retries the exhausted key.
   */
  private async requestWithRotation<T>(
    operationName: string,
    fn: (client: AxiosInstance) => Promise<T>
  ): Promise<T> {
    const totalKeys = this.clients.length;
    if (totalKeys === 0) {
      throw new ProviderAuthError('CoinStats', 'No CoinStats API keys configured');
    }

    let lastError: any = null;
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIdx = (this.activeKeyIndex + attempt) % totalKeys;
      const client = this.clients[keyIdx];
      const keyIdentifier = `key_${keyIdx + 1}`;

      try {
        const result = await this.executeWithResilience(
          `${operationName}:${keyIdentifier}`,
          async () => {
            return await fn(client);
          },
          {
            timeoutMs: config.coinstats.timeoutMs || 10000,
            retries: 1, // Only 1 network retry before trying next key or propagating
            isRetryable: (err) => {
              // 429 / 406 triggers immediate key rotation, abort retry on this key
              if (err.statusCode === 429 || err.statusCode === 406) {
                return false;
              }
              return err.isRetryable;
            },
          }
        );

        this.budgetTracker.recordKeyUsage('CoinStats', keyIdentifier, true);

        // If rotated successfully to a healthy key, set it as the primary index
        if (keyIdx !== this.activeKeyIndex) {
          console.log(`[CoinStatsProvider] Switched primary key to #${keyIdx + 1}`);
          this.activeKeyIndex = keyIdx;
          this.budgetTracker.recordKeyRotation('CoinStats', this.activeKeyIndex, totalKeys, keyIdentifier);
        }

        return result;
      } catch (err: any) {
        this.budgetTracker.recordKeyUsage('CoinStats', keyIdentifier, false);
        const status = err.statusCode || err.response?.status;
        if (status === 429 || status === 406) {
          console.warn(
            `[CoinStatsProvider] Key #${keyIdx + 1} quota/rate-limit hit (${status}). Instantly rotating to next key...`
          );
          lastError = err;
          continue; // Instantly move to next key without sleeping
        }
        // Non-rate-limit error (e.g. 404, CircuitBreakerOpen, 500)
        throw err;
      }
    }

    console.error(`[CoinStatsProvider] All ${totalKeys} API keys exhausted`);
    throw new ProviderRateLimitError('CoinStats', undefined, lastError);
  }

  async getMarketOverview(): Promise<MarketOverview> {
    try {
      const response = await this.requestWithRotation('getMarketOverview', (c) => c.get('/markets'));
      return mapCoinStatsOverview(response.data);
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('CoinStats', `Failed to fetch market overview: ${err.message}`, 502, 'OVERVIEW_ERROR', false, err);
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
      const response = await this.requestWithRotation('getCoins', (c) => c.get('/coins', { params }));
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
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('CoinStats', `Failed to fetch coins list: ${err.message}`, 502, 'COINS_ERROR', false, err);
    }
  }

  async getCoinById(coinId: string): Promise<MarketToken | null> {
    if (!coinId) return null;

    try {
      const response = await this.requestWithRotation(`getCoinById(${coinId})`, (c) =>
        c.get(`/coins/${encodeURIComponent(coinId)}`)
      );
      const raw = response.data?.coin || response.data?.result || response.data;
      return mapCoinStatsCoin(raw);
    } catch (err: any) {
      if (err.statusCode === 404 || err.response?.status === 404) {
        return null;
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('CoinStats', `Failed to fetch coin ${coinId}: ${err.message}`, 502, 'COIN_DETAIL_ERROR', false, err);
    }
  }

  async getCoinChart(coinId: string, period: string = '1w'): Promise<ChartResponse> {
    if (!coinId) {
      throw new ProviderError('CoinStats', 'coinId is required for chart data', 400, 'INVALID_COIN_ID');
    }

    let mappedPeriod = period.toLowerCase();
    if (mappedPeriod === '1h') mappedPeriod = '24h';
    if (mappedPeriod === '1d' || mappedPeriod === 'd') mappedPeriod = '24h';
    if (mappedPeriod === '1w' || mappedPeriod === 'w') mappedPeriod = '1w';
    if (mappedPeriod === '1m' || mappedPeriod === 'm') mappedPeriod = '1m';
    if (mappedPeriod === '3m') mappedPeriod = '3m';
    if (mappedPeriod === '6m') mappedPeriod = '6m';
    if (mappedPeriod === '1y' || mappedPeriod === 'y') mappedPeriod = '1y';
    if (mappedPeriod === 'all') mappedPeriod = 'all';

    try {
      const response = await this.requestWithRotation(`getCoinChart(${coinId})`, (c) =>
        c.get(`/coins/${encodeURIComponent(coinId)}/charts`, {
          params: { period: mappedPeriod },
        })
      );

      return mapCoinStatsChart(coinId, period, response.data);
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('CoinStats', `Failed to fetch chart for ${coinId}: ${err.message}`, 502, 'CHART_ERROR', false, err);
    }
  }

  async searchCoins(query: string): Promise<MarketToken[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const response = await this.requestWithRotation('searchCoins', (c) =>
        c.get('/coins', {
          params: {
            name: query.trim(),
            limit: 20,
          },
        })
      );

      const rawResult = response.data?.result || response.data?.coins || response.data || [];
      return mapCoinStatsCoinList(Array.isArray(rawResult) ? rawResult : []);
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('CoinStats', `Failed to search coins for "${query}": ${err.message}`, 502, 'SEARCH_ERROR', false, err);
    }
  }

  async getWalletBalance(blockchain: string, address: string): Promise<any[]> {
    if (!blockchain || !address) {
      throw new ProviderError('CoinStats', 'blockchain and address are required', 400, 'INVALID_PARAMS');
    }

    try {
      const response = await this.requestWithRotation(`getWalletBalance(${blockchain})`, (c) =>
        c.get('/wallet/balance', {
          params: {
            blockchain,
            address,
          },
        })
      );

      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      if (raw?.result && Array.isArray(raw.result)) return raw.result;
      if (raw?.coins && Array.isArray(raw.coins)) return raw.coins;
      return [];
    } catch (err: any) {
      if (err.statusCode === 404 || err.response?.status === 404) {
        return [];
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        'CoinStats',
        `Failed to fetch wallet balance: ${err.message}`,
        err.statusCode || 502,
        'WALLET_BALANCE_ERROR',
        false,
        err
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
      throw new ProviderError('CoinStats', 'blockchain and address are required', 400, 'INVALID_PARAMS');
    }

    try {
      const response = await this.requestWithRotation(`getWalletTransactions(${blockchain})`, (c) =>
        c.get('/wallet/transactions', {
          params: {
            blockchain,
            address,
            page,
            limit,
          },
        })
      );

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
      if (err.statusCode === 404 || err.response?.status === 404) {
        return { result: [], meta: { page, limit, hasNextPage: false } };
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        'CoinStats',
        `Failed to fetch wallet transactions: ${err.message}`,
        err.statusCode || 502,
        'WALLET_TRANSACTIONS_ERROR',
        false,
        err
      );
    }
  }

  async getWalletDefi(blockchain: string, address: string): Promise<any> {
    if (!blockchain || !address) {
      return null;
    }

    try {
      const response = await this.requestWithRotation(`getWalletDefi(${blockchain})`, (c) =>
        c.get('/wallet/defi', {
          params: {
            blockchain,
            address,
          },
        })
      );

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
