/**
 * Centralized Cache Key Factory
 * Standardizes normalized key namespaces per Section 27 of plan.md.
 */

export const cacheKeys = {
  // Market namespaces
  marketOverview: (): string => 'market:overview',

  marketMasterTokens: (): string => 'market:tokens:master',

  marketTokens: (category: string = 'all', page: number = 1, limit: number = 50): string =>
    `market:tokens:${category.toLowerCase()}:p${page}:l${limit}`,

  marketGainers: (limit: number = 50): string =>
    `market:gainers:l${limit}`,

  marketCategories: (): string => 'market:categories',

  marketSearch: (query: string): string =>
    `market:search:${query.toLowerCase().trim()}`,

  marketToken: (coinId: string): string =>
    `market:token:${coinId.toLowerCase().trim()}`,

  marketChart: (coinId: string, period: string = '24h'): string =>
    `market:chart:${coinId.toLowerCase().trim()}:${period.toLowerCase()}`,

  price: (chain: string, tokenAddress: string): string =>
    `price:${chain.toLowerCase().trim()}:${tokenAddress.toLowerCase().trim()}`,

  // Portfolio namespaces
  portfolio: (chain: string, address: string): string =>
    `portfolio:${chain.toLowerCase().trim()}:${address.toLowerCase().trim()}`,

  portfolioSummary: (chain: string, address: string): string =>
    `portfolio:summary:${chain.toLowerCase().trim()}:${address.toLowerCase().trim()}`,

  portfolioHoldings: (chain: string, address: string): string =>
    `portfolio:holdings:${chain.toLowerCase().trim()}:${address.toLowerCase().trim()}`,

  portfolioChart: (chain: string, address: string, range: string = '1D'): string =>
    `portfolio:chart:${chain.toLowerCase().trim()}:${address.toLowerCase().trim()}:${range.toLowerCase()}`,

  portfolioTransactions: (
    chain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): string =>
    `portfolio:txs:${chain.toLowerCase().trim()}:${address.toLowerCase().trim()}:p${page}:l${limit}`,

  portfolioDefi: (chain: string, address: string): string =>
    `portfolio:defi:${chain.toLowerCase().trim()}:${address.toLowerCase().trim()}`,

  // Swap quote namespace
  swapQuote: (
    fromChain: string | number,
    toChain: string | number,
    fromToken: string,
    toToken: string,
    amount: string
  ): string =>
    `swap:quote:${fromChain}:${toChain}:${fromToken.toLowerCase().trim()}:${toToken.toLowerCase().trim()}:${amount.trim()}`,

  // Lock key helper
  lockKey: (resourceKey: string): string => `lock:${resourceKey}`,

  // Pattern helper for wallet-wide cache invalidation
  portfolioPattern: (chain: string, address: string): string =>
    `portfolio*${chain.toLowerCase().trim()}*${address.toLowerCase().trim()}*`,
};
