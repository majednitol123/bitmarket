import axios, { AxiosInstance } from 'axios';
import { BaseProvider } from './core/BaseProvider';
import { ProviderError, ProviderRateLimitError } from './core/ProviderErrors';
import { MarketDataProvider } from './MarketDataProvider';
import {
  MarketOverview,
  MarketToken,
  ChartPoint,
  ChartResponse,
  CoinListOptions,
  PaginatedTokens,
} from '../modules/market/market.types';
import {
  mapCoinMarketCapOverview,
  mapCoinMarketCapCoin,
  mapCoinMarketCapCoinList,
} from '../modules/market/market.mapper';
import { config } from '../config/env';

const KNOWN_CMC_SLUGS: Record<string, number> = {
  'liquity-usd': 9566,
  'lusd': 9566,
  'trueusd': 2563,
  'tusd': 2563,
  'ethereum': 1027,
  'eth': 1027,
  'bitcoin': 1,
  'btc': 1,
  'maker': 1518,
  'mkr': 1518,
  'dai': 4943,
  'usd-coin': 3408,
  'usdc': 3408,
  'tether': 825,
  'usdt': 825,
  'grok': 28386,
  'human-protocol': 10323,
  'hmt': 10323,
  'deri-protocol': 8555,
  'deri': 8555,
};

export class CoinMarketCapProvider extends BaseProvider implements MarketDataProvider {
  private client: AxiosInstance;

  constructor() {
    super('CoinMarketCap', {
      defaultTimeoutMs: config.coinmarketcap?.timeoutMs || 10000,
      maxConsecutiveFailures: 4,
      circuitBreakerCooldownMs: 30000,
    });

    this.client = axios.create({
      baseURL: config.coinmarketcap?.baseUrl || 'https://pro-api.coinmarketcap.com/public-api/v1',
      timeout: config.coinmarketcap?.timeoutMs || 10000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BitMarket/1.0.0',
      },
    });
  }

  private outboundWindowMs = 60000;
  private maxOutboundRequests = 24; // 24 calls per minute max (comfortably below 30 limit)
  private outboundTimestamps: number[] = [];

  public hasOutboundCapacity(slots: number = 1): boolean {
    const now = Date.now();
    const windowStart = now - this.outboundWindowMs;
    this.outboundTimestamps = this.outboundTimestamps.filter((t) => t > windowStart);
    return this.outboundTimestamps.length + slots <= this.maxOutboundRequests;
  }

  private checkOutboundRateLimit(): void {
    const now = Date.now();
    const windowStart = now - this.outboundWindowMs;
    this.outboundTimestamps = this.outboundTimestamps.filter((t) => t > windowStart);

    if (this.outboundTimestamps.length >= this.maxOutboundRequests) {
      const oldest = this.outboundTimestamps[0] || now;
      const waitSeconds = Math.max(1, Math.ceil((oldest + this.outboundWindowMs - now) / 1000));
      const err = new ProviderRateLimitError(
        'CoinMarketCap',
        waitSeconds * 1000,
        new Error(`Outbound rate limit threshold reached (${this.maxOutboundRequests} req/min). Serving cache.`)
      );
      (err as any).code = 'OUTBOUND_RATE_LIMIT_GUARD';
      throw err;
    }
    this.outboundTimestamps.push(now);
  }

  async getMarketOverview(): Promise<MarketOverview> {
    return this.executeWithResilience('getMarketOverview', async () => {
      this.checkOutboundRateLimit();
      try {
        const response = await this.client.get('/global-metrics/quotes/latest');
        return mapCoinMarketCapOverview(response.data);
      } catch (err: any) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(
          'CoinMarketCap',
          `Failed to fetch market overview: ${err.message}`,
          err.response?.status || 502,
          'CMC_OVERVIEW_ERROR',
          true,
          err
        );
      }
    });
  }

  async getCoins(options: CoinListOptions = {}): Promise<PaginatedTokens> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    const start = (page - 1) * limit + 1;

    return this.executeWithResilience(`getCoins:start${start}:limit${limit}`, async () => {
      this.checkOutboundRateLimit();
      try {
        const response = await this.client.get('/cryptocurrency/listings/latest', {
          params: {
            start,
            limit,
            convert: options.currency || 'USD',
          },
        });

        const rawList = response.data?.data || [];
        const tokens = mapCoinMarketCapCoinList(rawList);
        const totalCount = response.data?.status?.total_count;
        const hasMore = totalCount ? start + tokens.length - 1 < totalCount : tokens.length === limit;

        return {
          tokens,
          meta: {
            page,
            limit,
            total: totalCount,
            hasMore,
          },
        };
      } catch (err: any) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(
          'CoinMarketCap',
          `Failed to fetch coins list: ${err.message}`,
          err.response?.status || 502,
          'CMC_LISTINGS_ERROR',
          true,
          err
        );
      }
    });
  }

  async getCoinById(coinId: string): Promise<MarketToken | null> {
    if (!coinId) return null;
    const cleanId = coinId.trim().toLowerCase();

    // CMC public API does not provide open single-coin quote without key.
    // Query top 100 listings to find matching coin by slug, symbol, or id
    return this.executeWithResilience(`getCoinById:${cleanId}`, async () => {
      this.checkOutboundRateLimit();
      try {
        const response = await this.client.get('/cryptocurrency/listings/latest', {
          params: {
            start: 1,
            limit: 100,
            convert: 'USD',
          },
        });

        const rawList = response.data?.data || [];
        const matched = rawList.find(
          (c: any) =>
            String(c.slug || '').toLowerCase() === cleanId ||
            String(c.symbol || '').toLowerCase() === cleanId ||
            String(c.id) === cleanId
        );

        if (matched) {
          return mapCoinMarketCapCoin(matched);
        }
        return null;
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    });
  }

  async getCoinChart(cmcIdOrSlug: string, period: string = '1w'): Promise<ChartResponse> {
    const cleanId = cmcIdOrSlug.trim().toLowerCase();
    let cmcId: number | null = null;

    const parsedNum = parseInt(cleanId, 10);
    if (!isNaN(parsedNum) && String(parsedNum) === cleanId && parsedNum > 0) {
      cmcId = parsedNum;
    } else if (KNOWN_CMC_SLUGS[cleanId]) {
      cmcId = KNOWN_CMC_SLUGS[cleanId];
    } else {
      try {
        const coin = await this.getCoinById(cleanId);
        if (coin?.cmcId) {
          cmcId = coin.cmcId;
        }
      } catch {
        // continue
      }
    }

    if (!cmcId) {
      return {
        tokenId: cleanId,
        period,
        points: [],
        updatedAt: new Date().toISOString(),
      };
    }

    let range = '7D';
    const p = period.toUpperCase();
    if (p === '1D' || p === '24H') range = '1D';
    else if (p === '1W' || p === '7D') range = '7D';
    else if (p === '1M' || p === '30D') range = '1M';
    else if (p === '3M' || p === '90D') range = '3M';
    else if (p === '1Y' || p === '365D') range = '1Y';
    else if (p === 'ALL') range = 'ALL';

    return this.executeWithResilience(`getCoinChart:${cmcId}:${range}`, async () => {
      try {
        const response = await axios.get(
          `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail/chart?id=${cmcId}&range=${range}`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
            timeout: 10000,
          }
        );

        const rawPoints = response.data?.data?.points || {};
        const points: ChartPoint[] = [];

        for (const [timestampStr, val] of Object.entries<any>(rawPoints)) {
          let ts = Number(timestampStr);
          if (ts < 1e11) {
            ts = ts * 1000;
          }
          const priceUsd = Array.isArray(val?.v)
            ? Number(val.v[0])
            : Array.isArray(val?.c)
            ? Number(val.c[0])
            : 0;
          const volume =
            Array.isArray(val?.v) && val.v.length > 1 ? Number(val.v[1]) : undefined;

          if (!isNaN(ts) && !isNaN(priceUsd) && priceUsd > 0) {
            points.push({
              timestamp: ts,
              priceUsd,
              volume,
            });
          }
        }

        points.sort((a, b) => a.timestamp - b.timestamp);

        return {
          tokenId: cleanId,
          period,
          points,
          updatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        console.warn(`[CoinMarketCapProvider] Chart fetch error for id=${cmcId}: ${err.message}`);
        return {
          tokenId: cleanId,
          period,
          points: [],
          updatedAt: new Date().toISOString(),
        };
      }
    });
  }

  async searchCoins(query: string): Promise<MarketToken[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanQuery = query.trim().toLowerCase();

    return this.executeWithResilience(`searchCoins:${cleanQuery}`, async () => {
      this.checkOutboundRateLimit();
      try {
        const response = await this.client.get('/cryptocurrency/listings/latest', {
          params: {
            start: 1,
            limit: 100,
            convert: 'USD',
          },
        });

        const rawList = response.data?.data || [];
        const matches = rawList.filter(
          (c: any) =>
            String(c.slug || '').toLowerCase().includes(cleanQuery) ||
            String(c.symbol || '').toLowerCase().includes(cleanQuery) ||
            String(c.name || '').toLowerCase().includes(cleanQuery)
        );

        return mapCoinMarketCapCoinList(matches.slice(0, 20));
      } catch (err: any) {
        return [];
      }
    });
  }
}

export const coinMarketCapProvider = new CoinMarketCapProvider();
