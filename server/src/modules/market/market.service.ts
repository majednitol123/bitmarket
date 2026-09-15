import { coinStatsProvider } from '../../providers/CoinStatsProvider';
import { marketFallbackProvider } from '../../providers/MarketFallbackProvider';
import { cacheService } from '../../cache/cacheService';
import { cacheKeys } from '../../cache/cacheKeys';
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
  /**
   * Get Market Overview with multi-provider fallback.
   * Primary: CoinStats -> Secondary: CoinGecko fallback -> Stale Redis cache
   */
  async getOverview(forceRefresh: boolean = false): Promise<MarketOverview> {
    const cacheKey = cacheKeys.marketOverview();
    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.overview, staleSeconds: config.cacheTtl.overview * 4 },
      async () => {
        try {
          return await coinStatsProvider.getMarketOverview();
        } catch (err: any) {
          console.warn(
            `[MarketService] Primary CoinStats overview failed (${err.message}). Using MarketFallbackProvider...`
          );
          return await marketFallbackProvider.getMarketOverview();
        }
      },
      { forceRefresh, source: 'market_multi' }
    );
  }

  /**
   * Shared Master Token List
   * Retrieves and caches the master dataset of top 250 coins in Redis (`market:tokens:master`).
   * Eliminates >80% of upstream API calls by deriving category slices and pagination in-memory.
   */
  async getMasterTokenList(forceRefresh: boolean = false): Promise<MarketToken[]> {
    const cacheKey = cacheKeys.marketMasterTokens();
    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.tokens, staleSeconds: config.cacheTtl.tokens * 4 },
      async () => {
        try {
          const res = await coinStatsProvider.getCoins({ page: 1, limit: 250 });
          if (res && res.tokens && res.tokens.length > 0) {
            return res.tokens;
          }
        } catch (err: any) {
          console.warn(
            `[MarketService] Primary CoinStats getCoins failed (${err.message}). Using MarketFallbackProvider...`
          );
        }

        const fallbackRes = await marketFallbackProvider.getCoins({ page: 1, limit: 250 });
        return fallbackRes.tokens;
      },
      { forceRefresh, source: 'market_master' }
    );
  }

  /**
   * Get Paginated Tokens by Category
   * Slices categories (Top Gainers, Layer 1, Layer 2, DeFi, All) and pages from the shared master cache.
   */
  async getTokens(
    page: number = 1,
    limit: number = 50,
    categoryRaw: string = 'all',
    forceRefresh: boolean = false
  ): Promise<PaginatedTokens> {
    const category = normalizeCategory(categoryRaw);
    const allTokens = await this.getMasterTokenList(forceRefresh);

    let filtered: MarketToken[] = allTokens;

    if (category === CATEGORY_IDS.TOP_GAINERS) {
      filtered = allTokens
        .filter((t) => t.change24hPercent > 0)
        .sort((a, b) => b.change24hPercent - a.change24hPercent);
    } else if (category === CATEGORY_IDS.LAYER_1) {
      filtered = allTokens
        .filter((t) => LAYER_1_COIN_IDS.has(t.id.toLowerCase()))
        .sort((a, b) => a.rank - b.rank);
    } else if (category === CATEGORY_IDS.LAYER_2) {
      filtered = allTokens
        .filter((t) => LAYER_2_COIN_IDS.has(t.id.toLowerCase()))
        .sort((a, b) => a.rank - b.rank);
    } else if (category === CATEGORY_IDS.DEFI) {
      filtered = allTokens
        .filter((t) => DEFI_COIN_IDS.has(t.id.toLowerCase()))
        .sort((a, b) => a.rank - b.rank);
    } else {
      // Default: 'all'
      filtered = allTokens.slice().sort((a, b) => a.rank - b.rank);
    }

    const total = filtered.length;
    const startIdx = (page - 1) * limit;
    const pageTokens = filtered.slice(startIdx, startIdx + limit);

    return {
      tokens: pageTokens,
      meta: {
        page,
        limit,
        total,
        hasMore: startIdx + limit < total,
      },
    };
  }

  /**
   * Get Token by ID or Symbol
   * Fast-path: checks cached master token list. Fallback: upstream lookup.
   */
  async getTokenById(coinId: string): Promise<MarketToken | null> {
    const cleanId = coinId.trim().toLowerCase();

    // 1. Fast lookup from cached master list (if contract addresses are already present)
    try {
      const master = await this.getMasterTokenList(false);
      const found = master.find(
        (t) => t.id.toLowerCase() === cleanId || t.symbol.toLowerCase() === cleanId
      );
      if (
        found &&
        (found.contractAddress || (found.contractAddresses && found.contractAddresses.length > 0))
      ) {
        return found;
      }
    } catch {
      // Continue to direct provider query
    }

    // 2. Direct provider lookup with fallback
    const cacheKey = cacheKeys.marketToken(cleanId);
    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.price, staleSeconds: config.cacheTtl.price * 4 },
      async () => {
        try {
          const token = await coinStatsProvider.getCoinById(cleanId);
          if (token) return token;
        } catch (err: any) {
          console.warn(
            `[MarketService] Primary CoinStats getCoinById failed for "${cleanId}" (${err.message}). Trying fallback...`
          );
        }
        return await marketFallbackProvider.getCoinById(cleanId);
      },
      { source: 'market_token' }
    );
  }


  async getTokenChart(coinId: string, period: string = '1w'): Promise<ChartResponse> {
    const cleanId = coinId.trim().toLowerCase();
    const cleanPeriod = period.trim().toLowerCase();
    const cacheKey = cacheKeys.marketChart(cleanId, cleanPeriod);

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.chart, staleSeconds: config.cacheTtl.chart * 2 },
      async () => {
        try {
          const chart = await coinStatsProvider.getCoinChart(cleanId, cleanPeriod);
          if (chart && chart.points && chart.points.length > 0) {
            return chart;
          }
        } catch (err: any) {
          console.warn(
            `[MarketService] Primary CoinStats chart failed for "${cleanId}" (${err.message}). Trying fallback...`
          );
        }

        try {
          const fallbackChart = await marketFallbackProvider.getCoinChart(cleanId, cleanPeriod);
          if (fallbackChart && fallbackChart.points && fallbackChart.points.length > 0) {
            return fallbackChart;
          }
        } catch (fallbackErr: any) {
          console.warn(
            `[MarketService] Fallback chart failed for "${cleanId}" (${fallbackErr.message})`
          );
        }

        // Strict real data rule: return empty points, never fabricate synthetic curves
        return {
          tokenId: cleanId,
          period: cleanPeriod,
          points: [],
          updatedAt: new Date().toISOString(),
        };
      },
      { source: 'market_chart' }
    );
  }

  /**
   * Search Tokens with Multi-Identity Resolution
   * Resolves EVM contracts (`0x...`), Solana mint addresses, and symbols/names with ranking.
   */
  async searchTokens(query: string): Promise<MarketToken[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const cacheKey = cacheKeys.marketSearch(cleanQuery);
    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.search, staleSeconds: config.cacheTtl.search * 3 },
      async () => {
        const isEvmAddress = /^0x[a-f0-9]{40}$/i.test(cleanQuery);
        const isSolanaAddress = /^[1-9a-km-z]{32,44}$/i.test(cleanQuery);

        let masterTokens: MarketToken[] = [];
        try {
          masterTokens = await this.getMasterTokenList(false);
        } catch {
          masterTokens = [];
        }

        // 1. Match EVM contract address or Solana mint address
        if (isEvmAddress || isSolanaAddress) {
          const matched = masterTokens.filter((t) => {
            if (t.contractAddress && t.contractAddress.toLowerCase() === cleanQuery) return true;
            if (
              t.contractAddresses &&
              t.contractAddresses.some((c) => c.contractAddress.toLowerCase() === cleanQuery)
            ) {
              return true;
            }
            return false;
          });
          if (matched.length > 0) return matched;
        }

        // 3. Multi-Identity Symbol & Name Ranking
        const exactSymbolMatches: MarketToken[] = [];
        const prefixSymbolMatches: MarketToken[] = [];
        const nameMatches: MarketToken[] = [];

        for (const token of masterTokens) {
          const sym = token.symbol.toLowerCase();
          const name = token.name.toLowerCase();

          if (sym === cleanQuery) {
            exactSymbolMatches.push(token);
          } else if (sym.startsWith(cleanQuery)) {
            prefixSymbolMatches.push(token);
          } else if (name.includes(cleanQuery)) {
            nameMatches.push(token);
          }
        }

        const localRanked = [...exactSymbolMatches, ...prefixSymbolMatches, ...nameMatches];

        // If local search returns ample matches, return top 20 immediately
        if (localRanked.length >= 5) {
          return localRanked.slice(0, 20);
        }

        // 4. Fallback/Supplement with provider search for obscure or unindexed tokens
        try {
          const providerMatches = await coinStatsProvider.searchCoins(cleanQuery);
          const seenIds = new Set(localRanked.map((t) => t.id));
          for (const pm of providerMatches) {
            if (!seenIds.has(pm.id)) {
              seenIds.add(pm.id);
              localRanked.push(pm);
            }
          }
        } catch (err: any) {
          try {
            const fbMatches = await marketFallbackProvider.searchCoins(cleanQuery);
            const seenIds = new Set(localRanked.map((t) => t.id));
            for (const fm of fbMatches) {
              if (!seenIds.has(fm.id)) {
                seenIds.add(fm.id);
                localRanked.push(fm);
              }
            }
          } catch {
            // Ignore fallback search error
          }
        }

        return localRanked.slice(0, 20);
      },
      { source: 'market_search' }
    );
  }

  /**
   * Get Top Gainers
   * Derived from the shared master token list.
   */
  async getGainers(limit: number = 20): Promise<MarketToken[]> {
    const tokens = await this.getMasterTokenList(false);
    return tokens
      .filter((t) => t.change24hPercent > 0)
      .sort((a, b) => b.change24hPercent - a.change24hPercent)
      .slice(0, limit);
  }
}

export const marketService = new MarketService();
