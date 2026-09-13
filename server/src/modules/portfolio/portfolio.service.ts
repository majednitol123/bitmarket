import { coinStatsProvider } from '../../providers/CoinStatsProvider';
import { cacheService } from '../../cache/cacheService';
import { config } from '../../config/env';
import {
  PortfolioHolding,
  PortfolioSummary,
  PortfolioTransaction,
  PortfolioChartData,
  NormalizedPortfolioResponse,
  PaginatedPortfolioTransactions,
  DeFiPosition,
  SwapTransactionRecord,
} from './portfolio.types';
import {
  mapCoinStatsHoldings,
  mapCoinStatsTransactions,
  buildPortfolioChartData,
} from './portfolio.mapper';
import { portfolioCacheKeys, invalidatePortfolioCache } from './portfolio.cache';
import { snapshotService } from './snapshot.service';
import { swapHistoryService } from './swapHistory.service';

export class PortfolioService {
  /**
   * Retrieves the full portfolio (summary, holdings, defi)
   * Cache-first with stampede protection
   */
  private cleanAddress(chain: string, address: string): string {
    const normChain = chain.toLowerCase();
    // EVM addresses are hex (case-insensitive, conventional lowercase)
    // Solana and other base58 addresses are strictly case-sensitive
    return normChain === 'solana' ? address.trim() : address.trim().toLowerCase();
  }

  async getPortfolio(chain: string, address: string): Promise<NormalizedPortfolioResponse> {
    const normChain = chain.toLowerCase();
    const targetAddress = this.cleanAddress(normChain, address);
    const cacheKey = portfolioCacheKeys.portfolio(normChain, targetAddress);

    return cacheService.getOrFetch(cacheKey, config.cacheTtl.portfolio, async () => {
      const rawBalance = await coinStatsProvider.getWalletBalance(normChain, targetAddress);
      const { holdings, summary } = mapCoinStatsHoldings(normChain, rawBalance);

      // Asynchronously record snapshot for historical tracking (fire-and-forget)
      if (summary.totalValueUsd > 0) {
        snapshotService.createSnapshot(normChain, targetAddress, summary.totalValueUsd).catch((err) => {
          console.warn('[PortfolioService] Non-critical snapshot error:', err.message);
        });
      }

      return {
        wallet: {
          address: targetAddress,
          chain: normChain,
        },
        summary,
        holdings,
        defi: [], // Honest empty state per plan2.md (CoinStats has no DeFi endpoint)
        updatedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Retrieves only the portfolio summary
   */
  async getSummary(chain: string, address: string): Promise<PortfolioSummary> {
    const portfolio = await this.getPortfolio(chain, address);
    return portfolio.summary;
  }

  /**
   * Retrieves only the token holdings
   */
  async getHoldings(chain: string, address: string): Promise<PortfolioHolding[]> {
    const portfolio = await this.getPortfolio(chain, address);
    return portfolio.holdings;
  }

  /**
   * Retrieves paginated wallet transactions
   */
  async getTransactions(
    chain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedPortfolioTransactions> {
    const normChain = chain.toLowerCase();
    const targetAddress = this.cleanAddress(normChain, address);
    const cacheKey = portfolioCacheKeys.transactions(normChain, targetAddress, page, limit);

    return cacheService.getOrFetch(cacheKey, config.cacheTtl.transactions, async () => {
      const raw = await coinStatsProvider.getWalletTransactions(normChain, targetAddress, page, limit);
      const transactions = mapCoinStatsTransactions(normChain, raw.result);

      return {
        transactions,
        meta: {
          page,
          limit,
          hasMore: raw.meta?.hasNextPage ?? (transactions.length >= limit),
        },
      };
    });
  }

  /**
   * Computes or retrieves portfolio chart data for a specified timeframe
   * Timeframes: '1D', '1W', '1M', '1Y', 'ALL'
   */
  async getChart(
    chain: string,
    address: string,
    timeframe: string = '1D'
  ): Promise<PortfolioChartData> {
    const normChain = chain.toLowerCase();
    const targetAddress = this.cleanAddress(normChain, address);
    const upperTf = timeframe.toUpperCase();
    const cacheKey = portfolioCacheKeys.chart(normChain, targetAddress, upperTf);

    return cacheService.getOrFetch(cacheKey, config.cacheTtl.portfolioChart, async () => {
      const portfolio = await this.getPortfolio(normChain, targetAddress);
      const holdings = portfolio.holdings;

      if (!holdings || holdings.length === 0 || portfolio.summary.totalValueUsd === 0) {
        return buildPortfolioChartData(upperTf, []);
      }

      // Check for stored snapshots first
      let fromDate: Date;
      if (upperTf === '1D') fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      else if (upperTf === '1W') fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      else if (upperTf === '1M') fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      else if (upperTf === '1Y') fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      else fromDate = new Date(0);

      const snapshots = await snapshotService.getSnapshots(normChain, targetAddress, fromDate);
      if (snapshots.length >= 8) {
        return buildPortfolioChartData(upperTf, snapshots);
      }

      // If insufficient snapshots, compute from top token price histories
      // Take top 5 holdings by value to construct weighted chart
      const topHoldings = holdings.slice(0, 5);

      // Period mapping for CoinStats /coins/{id}/charts
      let period = '24h';
      if (upperTf === '1W') period = '1w';
      else if (upperTf === '1M') period = '1m';
      else if (upperTf === '1Y') period = '1y';
      else if (upperTf === 'ALL') period = 'all';

      try {
        const chartPromises = topHoldings.map(async (h) => {
          try {
            const chartData = await coinStatsProvider.getCoinChart(h.coinId, period);
            return {
              amount: h.amount,
              points: chartData.points,
            };
          } catch {
            return null;
          }
        });

        const results = await Promise.all(chartPromises);
        const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null && r.points.length > 0);

        if (validResults.length === 0) {
          // Fallback: create slight variation around current portfolio value for display
          const now = Date.now();
          const curVal = portfolio.summary.totalValueUsd;
          const syntheticPoints = [
            { timestamp: now - 86400000, value: curVal - portfolio.summary.change24hUsd },
            { timestamp: now - 43200000, value: curVal - portfolio.summary.change24hUsd / 2 },
            { timestamp: now, value: curVal },
          ];
          return buildPortfolioChartData(upperTf, syntheticPoints);
        }

        // Align timestamps by using the first result's points
        const basePoints = validResults[0].points;
        const aggregatedPoints: { timestamp: number; value: number }[] = basePoints.map((basePt, idx) => {
          let totalUsdAtTime = 0;
          for (const item of validResults) {
            const pt = item.points[idx] || item.points[item.points.length - 1];
            totalUsdAtTime += item.amount * (pt?.priceUsd || 0);
          }

          // Add un-modeled token value proportion (from lower rank holdings)
          const modeledFraction = topHoldings
            .slice(0, validResults.length)
            .reduce((s, h) => s + h.valueUsd, 0) / (portfolio.summary.totalValueUsd || 1);

          const totalEstimated = modeledFraction > 0 ? totalUsdAtTime / modeledFraction : totalUsdAtTime;

          return {
            timestamp: basePt.timestamp,
            value: totalEstimated,
          };
        });

        return buildPortfolioChartData(upperTf, aggregatedPoints);
      } catch (err: any) {
        console.warn('[PortfolioService] Error computing portfolio chart:', err.message);
        return buildPortfolioChartData(upperTf, [
          { timestamp: Date.now() - 86400000, value: portfolio.summary.totalValueUsd },
          { timestamp: Date.now(), value: portfolio.summary.totalValueUsd },
        ]);
      }
    });
  }

  /**
   * Retrieves DeFi positions (honest empty state)
   */
  async getDefi(chain: string, address: string): Promise<DeFiPosition[]> {
    return [];
  }

  /**
   * Retrieves swap history from database
   */
  async getSwapHistory(
    chain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ items: SwapTransactionRecord[]; meta: { page: number; limit: number; hasMore: boolean } }> {
    return swapHistoryService.getSwapHistory(chain, address, page, limit);
  }

  /**
   * Records a swap transaction
   */
  async recordSwap(
    chain: string,
    address: string,
    swapData: Partial<SwapTransactionRecord>
  ): Promise<SwapTransactionRecord | null> {
    return swapHistoryService.recordSwap(chain, address, swapData);
  }

  /**
   * Invalidates cached portfolio data
   */
  async invalidateCache(chain: string, address: string): Promise<void> {
    await invalidatePortfolioCache(chain, address);
  }
}

export const portfolioService = new PortfolioService();
