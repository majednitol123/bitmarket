import { cacheService } from '../../cache/cacheService';
import { cacheKeys } from '../../cache/cacheKeys';

export const portfolioCacheKeys = {
  portfolio: (chain: string, address: string) => cacheKeys.portfolio(chain, address),
  holdings: (chain: string, address: string) => cacheKeys.portfolioHoldings(chain, address),
  summary: (chain: string, address: string) => cacheKeys.portfolioSummary(chain, address),
  chart: (chain: string, address: string, range: string) => cacheKeys.portfolioChart(chain, address, range),
  transactions: (chain: string, address: string, page: number, limit: number) =>
    cacheKeys.portfolioTransactions(chain, address, page, limit),
  defi: (chain: string, address: string) => cacheKeys.portfolioDefi(chain, address),
  price: (chain: string, tokenAddress: string) => cacheKeys.price(chain, tokenAddress),
};

export async function invalidatePortfolioCache(chain: string, address: string): Promise<void> {
  const c = chain.toLowerCase();
  const a = address.toLowerCase();

  // Non-blocking pattern invalidation clears all sub-keys for this wallet across any timeframe/page
  await cacheService.invalidatePattern(`*${c}*${a}*`);
}
