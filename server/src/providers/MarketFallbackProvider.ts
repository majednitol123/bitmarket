import axios, { AxiosInstance } from 'axios';
import { BaseProvider } from './core/BaseProvider';
import { MarketDataProvider } from './MarketDataProvider';
import {
  MarketOverview,
  MarketToken,
  ChartResponse,
  CoinListOptions,
  PaginatedTokens,
} from '../modules/market/market.types';
import { config } from '../config/env';


const BINANCE_SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  btc: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  eth: 'ETHUSDT',
  solana: 'SOLUSDT',
  sol: 'SOLUSDT',
  binancecoin: 'BNBUSDT',
  bnb: 'BNBUSDT',
  'wrapped-bitcoin': 'BTCUSDT',
  wbtc: 'BTCUSDT',
  chainlink: 'LINKUSDT',
  link: 'LINKUSDT',
  uniswap: 'UNIUSDT',
  uni: 'UNIUSDT',
  'avalanche-2': 'AVAXUSDT',
  avax: 'AVAXUSDT',
  polygon: 'POLUSDT',
  matic: 'POLUSDT',
  pepe: '1000PEPEUSDT',
  weth: 'ETHUSDT',
};

export class MarketFallbackProvider extends BaseProvider implements MarketDataProvider {
  private client: AxiosInstance;

  constructor() {
    super('CoinGeckoFallback', {
      defaultTimeoutMs: 10000,
      maxConsecutiveFailures: 4,
      circuitBreakerCooldownMs: 60000,
    });

    this.client = axios.create({
      baseURL: 'https://api.coingecko.com/api/v3',
      timeout: 10000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CryptoAggregator/1.0.0',
      },
    });
  }

  async getMarketOverview(): Promise<MarketOverview> {
    return this.executeWithResilience('getMarketOverview', async () => {
      const res = await this.client.get('/global');
      const data = res.data?.data;
      if (!data) {
        throw new Error('Invalid response structure from CoinGecko /global');
      }

      const totalMarketCap = data.total_market_cap?.usd ?? 0;
      const totalVolume = data.total_volume?.usd ?? 0;
      const btcDominance = data.market_cap_percentage?.btc ?? 0;
      const marketCapChange24h = data.market_cap_change_percentage_24h_usd ?? 0;

      return {
        marketCapUsd: Number(totalMarketCap),
        volume24hUsd: Number(totalVolume),
        btcDominancePercent: Number(btcDominance),
        marketCapChange24hPercent: Number(marketCapChange24h),
        volumeChange24hPercent: 0,
        btcDominanceChangePercent: 0,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async getCoins(options: CoinListOptions = {}): Promise<PaginatedTokens> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(250, Math.max(1, options.limit || 50));

    return this.executeWithResilience(`getCoins:p${page}:l${limit}`, async () => {
      const res = await this.client.get('/coins/markets', {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: limit,
          page: page,
          sparkline: true,
          price_change_percentage: '1h,24h,7d',
        },
      });

      if (!Array.isArray(res.data)) {
        throw new Error('Unexpected non-array response from CoinGecko /coins/markets');
      }

      const tokens: MarketToken[] = res.data.map((item: any) => {
        return {
          id: String(item.id || '').toLowerCase(),
          symbol: String(item.symbol || '').toUpperCase(),
          name: String(item.name || ''),
          logoUrl: String(item.image || ''),
          priceUsd: Number(item.current_price) || 0,
          change24hPercent: Number(item.price_change_percentage_24h) || 0,
          change1hPercent: Number(item.price_change_percentage_1h_in_currency) || 0,
          change1wPercent: Number(item.price_change_percentage_7d_in_currency) || 0,
          marketCapUsd: Number(item.market_cap) || 0,
          volume24hUsd: Number(item.total_volume) || 0,
          rank: Number(item.market_cap_rank) || 999,
          sparkline: Array.isArray(item.sparkline_in_7d?.price) ? item.sparkline_in_7d.price : undefined,
          priceUpdatedAt: item.last_updated || new Date().toISOString(),
        };
      });

      return {
        tokens,
        meta: {
          page,
          limit,
          hasMore: tokens.length === limit,
        },
      };
    });
  }

  async getCoinById(coinId: string): Promise<MarketToken | null> {
    const cleanId = coinId.trim().toLowerCase();
    return this.executeWithResilience(`getCoinById:${cleanId}`, async () => {
      try {
        const res = await this.client.get(`/coins/${encodeURIComponent(cleanId)}`, {
          params: {
            localization: false,
            tickers: false,
            market_data: true,
            community_data: false,
            developer_data: false,
            sparkline: true,
          },
        });

        const data = res.data;
        if (!data || !data.id) return null;

        const md = data.market_data || {};
        return {
          id: String(data.id).toLowerCase(),
          symbol: String(data.symbol || '').toUpperCase(),
          name: String(data.name || ''),
          logoUrl: String(data.image?.large || data.image?.small || ''),
          priceUsd: Number(md.current_price?.usd) || 0,
          change24hPercent: Number(md.price_change_percentage_24h) || 0,
          change1hPercent: Number(md.price_change_percentage_1h_in_currency?.usd) || 0,
          change1wPercent: Number(md.price_change_percentage_7d) || 0,
          marketCapUsd: Number(md.market_cap?.usd) || 0,
          volume24hUsd: Number(md.total_volume?.usd) || 0,
          rank: Number(data.market_cap_rank) || 999,
          contractAddress: data.contract_address,
          sparkline: Array.isArray(md.sparkline_7d?.price) ? md.sparkline_7d.price : undefined,
          priceUpdatedAt: data.last_updated || new Date().toISOString(),
        };
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    });
  }

  private async fetchBinanceKlines(coinId: string, cleanPeriod: string): Promise<ChartResponse | null> {
    const symbolKey = coinId.replace(/_ethereum|_solana|_polygon|_arbitrum/g, '').toLowerCase();
    const binanceSymbol = BINANCE_SYMBOL_MAP[symbolKey];
    if (!binanceSymbol) return null;

    let interval = '1h';
    let limit = 24;

    if (cleanPeriod === '24h' || cleanPeriod === '1d') {
      interval = '1h';
      limit = 24;
    } else if (cleanPeriod === '1w' || cleanPeriod === '7d') {
      interval = '4h';
      limit = 42;
    } else if (cleanPeriod === '1m' || cleanPeriod === '30d') {
      interval = '1d';
      limit = 30;
    } else if (cleanPeriod === '3m' || cleanPeriod === '90d') {
      interval = '1d';
      limit = 90;
    } else if (cleanPeriod === '1y' || cleanPeriod === '365d') {
      interval = '1w';
      limit = 52;
    } else if (cleanPeriod === 'all') {
      interval = '1M';
      limit = 60;
    }

    try {
      const res = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol: binanceSymbol,
          interval,
          limit,
        },
        timeout: 5000,
      });

      if (!Array.isArray(res.data) || res.data.length === 0) return null;

      const points = res.data.map((k: any) => ({
        timestamp: Number(k[0]),
        priceUsd: parseFloat(k[4]),
        volume: parseFloat(k[5]) || 0,
      }));

      return {
        tokenId: coinId,
        period: cleanPeriod,
        points,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getCoinChart(coinId: string, period: string = '1w'): Promise<ChartResponse> {
    const cleanId = coinId.trim().toLowerCase();
    const cleanPeriod = period.trim().toLowerCase();

    let days = '7';
    if (cleanPeriod === '24h' || cleanPeriod === '1d') days = '1';
    else if (cleanPeriod === '1w' || cleanPeriod === '7d') days = '7';
    else if (cleanPeriod === '1m' || cleanPeriod === '30d') days = '30';
    else if (cleanPeriod === '3m' || cleanPeriod === '90d') days = '90';
    else if (cleanPeriod === '1y' || cleanPeriod === '365d') days = '365';
    else if (cleanPeriod === 'all') days = 'max';

    return this.executeWithResilience(`getCoinChart:${cleanId}:${cleanPeriod}`, async () => {
      try {
        let endpoint = `/coins/${encodeURIComponent(cleanId)}/market_chart`;
        if (cleanId.startsWith('0x') && cleanId.length === 42) {
          endpoint = `/coins/ethereum/contract/${encodeURIComponent(cleanId)}/market_chart`;
        }

        const res = await this.client.get(endpoint, {
          params: {
            vs_currency: 'usd',
            days,
          },
        });

        const prices = Array.isArray(res.data?.prices) ? res.data.prices : [];
        const volumes = Array.isArray(res.data?.total_volumes) ? res.data.total_volumes : [];

        const points = prices.map(([ts, price]: [number, number], idx: number) => {
          return {
            timestamp: Number(ts),
            priceUsd: Number(price),
            volume: volumes[idx] ? Number(volumes[idx][1]) : undefined,
          };
        });

        if (points.length === 0) {
          const binanceFallback = await this.fetchBinanceKlines(cleanId, cleanPeriod);
          if (binanceFallback && binanceFallback.points.length > 0) {
            return binanceFallback;
          }
        }

        return {
          tokenId: cleanId,
          period: cleanPeriod,
          points,
          updatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        try {
          const binanceFallback = await this.fetchBinanceKlines(cleanId, cleanPeriod);
          if (binanceFallback && binanceFallback.points.length > 0) {
            return binanceFallback;
          }
        } catch {
          // Continue to empty fallback
        }

        return {
          tokenId: cleanId,
          period: cleanPeriod,
          points: [],
          updatedAt: new Date().toISOString(),
        };
      }
    });
  }

  async searchCoins(query: string): Promise<MarketToken[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    return this.executeWithResilience(`searchCoins:${cleanQuery}`, async () => {
      const res = await this.client.get('/search', {
        params: { query: cleanQuery },
      });

      const coins = Array.isArray(res.data?.coins) ? res.data.coins : [];
      return coins.slice(0, 20).map((c: any) => ({
        id: String(c.id).toLowerCase(),
        symbol: String(c.symbol || '').toUpperCase(),
        name: String(c.name || ''),
        logoUrl: String(c.large || c.thumb || ''),
        priceUsd: 0,
        change24hPercent: 0,
        change1hPercent: 0,
        change1wPercent: 0,
        marketCapUsd: 0,
        volume24hUsd: 0,
        rank: Number(c.market_cap_rank) || 999,
        priceUpdatedAt: new Date().toISOString(),
      }));
    });
  }
}

export const marketFallbackProvider = new MarketFallbackProvider();
