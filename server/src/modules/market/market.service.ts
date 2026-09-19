import { coinMarketCapProvider } from '../../providers/CoinMarketCapProvider';
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
   * Get Market Overview exclusively from CoinMarketCap.
   */
  async getOverview(forceRefresh: boolean = false): Promise<MarketOverview> {
    const cacheKey = cacheKeys.marketOverview();
    const ttlSeconds = config.cacheTtl.overview || 7;

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: ttlSeconds, staleSeconds: ttlSeconds * 2 },
      async () => {
        return await coinMarketCapProvider.getMarketOverview();
      },
      { forceRefresh, source: 'cmc_overview' }
    );
  }

  /**
   * Shared Master Token List
   * Exclusively retrieves and caches the master dataset from CoinMarketCap.
   */
  async getMasterTokenList(forceRefresh: boolean = false): Promise<MarketToken[]> {
    const cacheKey = cacheKeys.marketMasterTokens();
    const ttlSeconds = config.cacheTtl.tokens || 7;

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: ttlSeconds, staleSeconds: ttlSeconds * 2 },
      async () => {
        const res = await coinMarketCapProvider.getCoins({ page: 1, limit: 100 });
        return res?.tokens || [];
      },
      { forceRefresh, source: 'cmc_master' }
    );
  }

  /**
   * Get Paginated Tokens by Category
   * Slices categories (Top Gainers, Layer 1, Layer 2, DeFi, All) and pages from the shared CMC cache.
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
        .filter(
          (t) =>
            LAYER_1_COIN_IDS.has(t.id.toLowerCase()) ||
            LAYER_1_COIN_IDS.has(t.symbol.toLowerCase()) ||
            t.tags?.includes('layer-1')
        )
        .sort((a, b) => a.rank - b.rank);
    } else if (category === CATEGORY_IDS.LAYER_2) {
      filtered = allTokens
        .filter(
          (t) =>
            LAYER_2_COIN_IDS.has(t.id.toLowerCase()) ||
            LAYER_2_COIN_IDS.has(t.symbol.toLowerCase()) ||
            t.tags?.includes('layer-2')
        )
        .sort((a, b) => a.rank - b.rank);
    } else if (category === CATEGORY_IDS.DEFI) {
      filtered = allTokens
        .filter(
          (t) =>
            DEFI_COIN_IDS.has(t.id.toLowerCase()) ||
            DEFI_COIN_IDS.has(t.symbol.toLowerCase()) ||
            t.tags?.includes('defi')
        )
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
   * Fast-path: checks cached master token list. Fallback: CoinMarketCap query.
   */
  async getTokenById(coinId: string): Promise<MarketToken | null> {
    const cleanId = coinId.trim().toLowerCase();

    // 1. Fast lookup from cached master list
    try {
      const master = await this.getMasterTokenList(false);
      const found = master.find(
        (t) => t.id.toLowerCase() === cleanId || t.symbol.toLowerCase() === cleanId
      );
      if (found) {
        return found;
      }
    } catch {
      // Continue to direct CMC lookup
    }

    // 2. Direct CoinMarketCap lookup
    const cacheKey = cacheKeys.marketToken(cleanId);
    const ttlSeconds = config.cacheTtl.price || 7;

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: ttlSeconds, staleSeconds: ttlSeconds * 2 },
      async () => {
        return await coinMarketCapProvider.getCoinById(cleanId);
      },
      { source: 'cmc_token' }
    );
  }

  /**
   * Get Coin Chart
   * Exclusively retrieves historical price points from CoinMarketCap.
   */
  async getTokenChart(coinId: string, period: string = '1w'): Promise<ChartResponse> {
    const cleanId = coinId.trim().toLowerCase();
    const cleanPeriod = period.trim().toLowerCase();
    const cacheKey = cacheKeys.marketChart(cleanId, cleanPeriod);
    const ttlSeconds = config.cacheTtl.chart || 300;

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: ttlSeconds, staleSeconds: ttlSeconds * 2 },
      async () => {
        let cmcId: number | null = null;
        try {
          const master = await this.getMasterTokenList(false);
          const found = master.find(
            (t) =>
              t.id.toLowerCase() === cleanId ||
              t.symbol.toLowerCase() === cleanId ||
              String(t.cmcId) === cleanId
          );
          if (found && found.cmcId) {
            cmcId = found.cmcId;
          }
        } catch {
          // continue
        }

        return await coinMarketCapProvider.getCoinChart(
          cmcId ? String(cmcId) : cleanId,
          cleanPeriod
        );
      },
      { source: 'cmc_chart' }
    );
  }

  /**
   * Search Tokens
   * Resolves EVM contracts, Solana mint addresses, and symbols/names exclusively via CoinMarketCap data.
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

        // 2. Symbol & Name Ranking from master list
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

        if (localRanked.length >= 5) {
          return localRanked.slice(0, 20);
        }

        // 3. Fallback to CoinMarketCap search
        try {
          const cmcMatches = await coinMarketCapProvider.searchCoins(cleanQuery);
          const seenIds = new Set(localRanked.map((t) => t.id));
          for (const cm of cmcMatches) {
            if (!seenIds.has(cm.id)) {
              seenIds.add(cm.id);
              localRanked.push(cm);
            }
          }
        } catch {
          // Ignore
        }

        return localRanked.slice(0, 20);
      },
      { source: 'cmc_search' }
    );
  }

  /**
   * Get Top Gainers
   * Derived exclusively from CoinMarketCap master token list.
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
