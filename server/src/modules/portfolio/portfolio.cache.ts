import { cacheService } from '../../cache/cacheService';

export const portfolioCacheKeys = {
  portfolio: (chain: string, address: string) =>
    `portfolio:${chain.toLowerCase()}:${address.toLowerCase()}`,
  holdings: (chain: string, address: string) =>
    `holdings:${chain.toLowerCase()}:${address.toLowerCase()}`,
  summary: (chain: string, address: string) =>
    `summary:${chain.toLowerCase()}:${address.toLowerCase()}`,
  chart: (chain: string, address: string, range: string) =>
    `chart:${chain.toLowerCase()}:${address.toLowerCase()}:${range.toLowerCase()}`,
  transactions: (chain: string, address: string, page: number, limit: number) =>
    `txs:${chain.toLowerCase()}:${address.toLowerCase()}:p${page}:l${limit}`,
  defi: (chain: string, address: string) =>
    `defi:${chain.toLowerCase()}:${address.toLowerCase()}`,
  price: (chain: string, tokenAddress: string) =>
    `price:${chain.toLowerCase()}:${tokenAddress.toLowerCase()}`,
};

export async function invalidatePortfolioCache(chain: string, address: string): Promise<void> {
  const c = chain.toLowerCase();
  const a = address.toLowerCase();

  const keysToDelete = [
    portfolioCacheKeys.portfolio(c, a),
    portfolioCacheKeys.holdings(c, a),
    portfolioCacheKeys.summary(c, a),
    portfolioCacheKeys.defi(c, a),
    portfolioCacheKeys.chart(c, a, '1d'),
    portfolioCacheKeys.chart(c, a, '1w'),
    portfolioCacheKeys.chart(c, a, '1m'),
    portfolioCacheKeys.chart(c, a, '1y'),
    portfolioCacheKeys.chart(c, a, 'all'),
    portfolioCacheKeys.transactions(c, a, 1, 10),
    portfolioCacheKeys.transactions(c, a, 1, 20),
  ];

  await Promise.allSettled(keysToDelete.map((k) => cacheService.delete(k)));
}
