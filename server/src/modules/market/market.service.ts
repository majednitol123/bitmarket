import { coinStatsProvider } from '../../providers/CoinStatsProvider';
import { cacheService } from '../../cache/cacheService';
import { config } from '../../config/env';
import {
  MarketOverview,
  MarketToken,
  ChartResponse,
  PaginatedTokens,
} from './market.types';
import {
  CATEGORY_IDS,
  LAYER_1_COIN_IDS,
  LAYER_2_COIN_IDS,
  DEFI_COIN_IDS,
  normalizeCategory,
} from './market.categories';

export class MarketService {
  async getOverview(): Promise<MarketOverview> {
    const cacheKey = 'market:overview';
    return cacheService.getOrFetch(cacheKey, config.cacheTtl.overview, async () => {
      return coinStatsProvider.getMarketOverview();
    });
  }

  async getTokens(
    page: number = 1,
    limit: number = 50,
    categoryRaw: string = 'all'
  ): Promise<PaginatedTokens> {
    const category = normalizeCategory(categoryRaw);
    const cacheKey = `market:tokens:${category}:p${page}:l${limit}`;

    return cacheService.getOrFetch(cacheKey, config.cacheTtl.tokens, async () => {
      // Top Gainers category
      if (category === CATEGORY_IDS.TOP_GAINERS) {
        // Fetch top 100 coins to find the best gainers
        const res = await coinStatsProvider.getCoins({ page: 1, limit: 100 });
        const gainers = res.tokens
          .filter((t) => t.change24hPercent > 0)
          .sort((a, b) => b.change24hPercent - a.change24hPercent);

        const startIdx = (page - 1) * limit;
        const pageTokens = gainers.slice(startIdx, startIdx + limit);

        return {
          tokens: pageTokens,
          meta: {
            page,
            limit,
            hasMore: startIdx + limit < gainers.length,
          },
        };
      }

      // Layer 1 category
      if (category === CATEGORY_IDS.LAYER_1) {
        const res = await coinStatsProvider.getCoins({ page: 1, limit: 150 });
        const l1Tokens = res.tokens
          .filter((t) => LAYER_1_COIN_IDS.has(t.id.toLowerCase()))
          .sort((a, b) => a.rank - b.rank);

        const startIdx = (page - 1) * limit;
        const pageTokens = l1Tokens.slice(startIdx, startIdx + limit);

        return {
          tokens: pageTokens,
          meta: {
            page,
            limit,
            hasMore: startIdx + limit < l1Tokens.length,
          },
        };
      }

      // Layer 2 category
      if (category === CATEGORY_IDS.LAYER_2) {
        const res = await coinStatsProvider.getCoins({ page: 1, limit: 200 });
        const l2Tokens = res.tokens
          .filter((t) => LAYER_2_COIN_IDS.has(t.id.toLowerCase()))
          .sort((a, b) => a.rank - b.rank);

        const startIdx = (page - 1) * limit;
        const pageTokens = l2Tokens.slice(startIdx, startIdx + limit);

        return {
          tokens: pageTokens,
          meta: {
            page,
            limit,
            hasMore: startIdx + limit < l2Tokens.length,
          },
        };
      }

      // DeFi category
      if (category === CATEGORY_IDS.DEFI) {
        const res = await coinStatsProvider.getCoins({ page: 1, limit: 200 });
        const defiTokens = res.tokens
          .filter((t) => DEFI_COIN_IDS.has(t.id.toLowerCase()))
          .sort((a, b) => a.rank - b.rank);

        const startIdx = (page - 1) * limit;
        const pageTokens = defiTokens.slice(startIdx, startIdx + limit);

        return {
          tokens: pageTokens,
          meta: {
            page,
            limit,
            hasMore: startIdx + limit < defiTokens.length,
          },
        };
      }

      // Default: "All" tokens
      return coinStatsProvider.getCoins({ page, limit });
    });
  }

  async getTokenById(coinId: string): Promise<MarketToken | null> {
    const cleanId = coinId.trim().toLowerCase();
    const cacheKey = `market:token:${cleanId}`;

    return cacheService.getOrFetch(cacheKey, config.cacheTtl.price, async () => {
      return coinStatsProvider.getCoinById(cleanId);
    });
  }

  async getTokenChart(coinId: string, period: string = '1w'): Promise<ChartResponse> {
    const cleanId = coinId.trim().toLowerCase();
    const cleanPeriod = period.trim().toLowerCase();
    const cacheKey = `market:chart:${cleanId}:${cleanPeriod}`;

    return cacheService.getOrFetch(cacheKey, config.cacheTtl.chart, async () => {
      return coinStatsProvider.getCoinChart(cleanId, cleanPeriod);
    });
  }

  async searchTokens(query: string): Promise<MarketToken[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const cacheKey = `market:search:${cleanQuery}`;
    return cacheService.getOrFetch(cacheKey, config.cacheTtl.search, async () => {
      return coinStatsProvider.searchCoins(cleanQuery);
    });
  }

  async getGainers(limit: number = 20): Promise<MarketToken[]> {
    const cacheKey = `market:gainers:limit:${limit}`;
    return cacheService.getOrFetch(cacheKey, config.cacheTtl.tokens, async () => {
      const res = await coinStatsProvider.getCoins({ page: 1, limit: 100 });
      return res.tokens
        .filter((t) => t.change24hPercent > 0)
        .sort((a, b) => b.change24hPercent - a.change24hPercent)
        .slice(0, limit);
    });
  }
}

export const marketService = new MarketService();
