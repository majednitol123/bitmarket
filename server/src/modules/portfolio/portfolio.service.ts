import { coinStatsProvider } from '../../providers/CoinStatsProvider';
import { blockchainRpcProvider } from '../../providers/BlockchainRpcProvider';
import { marketService } from '../market/market.service';
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
  mapCoinStatsDefi,
} from './portfolio.mapper';
import { portfolioCacheKeys, invalidatePortfolioCache } from './portfolio.cache';
import { snapshotService } from './snapshot.service';
import { swapHistoryService } from './swapHistory.service';

interface KnownTokenConfig {
  symbol: string;
  name: string;
  contract: string;
  decimals: number;
  coinId: string;
  logoUrl?: string;
}

const TOP_EVM_TOKENS: Record<string, KnownTokenConfig[]> = {
  ethereum: [
    {
      symbol: 'USDT',
      name: 'Tether',
      contract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
      coinId: 'tether',
      logoUrl: 'https://static.coinstats.app/coins/1650455771843.png',
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      coinId: 'usd-coin',
      logoUrl: 'https://static.coinstats.app/coins/1650455771565.png',
    },
    {
      symbol: 'DAI',
      name: 'Dai',
      contract: '0x6b175474e89094c44da98b954eedeac495271d0f',
      decimals: 18,
      coinId: 'dai',
      logoUrl: 'https://static.coinstats.app/coins/1650455771743.png',
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      contract: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
      coinId: 'weth',
      logoUrl: 'https://static.coinstats.app/coins/1650455629727.png',
    },
  ],
  polygon: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      contract: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      decimals: 6,
      coinId: 'usd-coin',
      logoUrl: 'https://static.coinstats.app/coins/1650455771565.png',
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      contract: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      decimals: 6,
      coinId: 'tether',
      logoUrl: 'https://static.coinstats.app/coins/1650455771843.png',
    },
    {
      symbol: 'WETH',
      name: 'Wrapped Ether',
      contract: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      decimals: 18,
      coinId: 'weth',
      logoUrl: 'https://static.coinstats.app/coins/1650455629727.png',
    },
  ],
};

export class PortfolioService {
  private cleanAddress(chain: string, address: string): string {
    const normChain = chain.toLowerCase();
    return normChain === 'solana' ? address.trim() : address.trim().toLowerCase();
  }

  /**
   * Cross-verifies native on-chain gas token balances using BlockchainRpcProvider.
   * Ensures that real on-chain balance is never zeroed or omitted due to indexing latency.
   */
  private async enrichNativeOnChainBalance(
    chain: string,
    address: string,
    holdings: PortfolioHolding[],
    summary: PortfolioSummary
  ): Promise<void> {
    const evmChains = ['ethereum', 'eth', 'polygon', 'matic', 'pol', 'arbitrum', 'arb', 'optimism', 'opt', 'base', 'bsc', 'binance'];
    if (!evmChains.includes(chain.toLowerCase())) {
      return;
    }

    const nativeHolding = holdings.find((h) => h.id.endsWith(':native') || !h.contractAddress);
    if (nativeHolding && nativeHolding.amount > 0) {
      return;
    }

    try {
      const rpcBal = await blockchainRpcProvider.getNativeBalance(chain, address);
      const amount = parseFloat(rpcBal.formattedEther);
      if (amount > 0.000001) {
        let price = 0;
        let coinId = 'ethereum';
        let logoUrl = 'https://static.coinstats.app/coins/1650455629555.png';

        if (chain === 'polygon' || chain === 'matic' || chain === 'pol') {
          coinId = 'matic-network';
          logoUrl = 'https://static.coinstats.app/coins/1650455648842.png';
        } else if (chain === 'bsc' || chain === 'binance') {
          coinId = 'binancecoin';
          logoUrl = 'https://static.coinstats.app/coins/1650455771843.png';
        }

        try {
          const coinData = await marketService.getTokenById(coinId);
          if (coinData && coinData.priceUsd > 0) {
            price = coinData.priceUsd;
          }
        } catch (err: any) {
          console.warn(`[PortfolioService] Live price fetch failed for ${coinId}:`, err.message);
        }

        const valueUsd = price > 0 ? Math.round(amount * price * 100) / 100 : null;

        if (nativeHolding) {
          nativeHolding.balance = `${amount < 0.0001 ? amount.toPrecision(4) : amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${rpcBal.symbol}`;
          nativeHolding.amount = amount;
          nativeHolding.priceUsd = price;
          nativeHolding.valueUsd = valueUsd;
        } else {
          holdings.unshift({
            id: `${chain}:native`,
            chain,
            coinId,
            symbol: rpcBal.symbol,
            name: rpcBal.chain,
            balance: `${amount < 0.0001 ? amount.toPrecision(4) : amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${rpcBal.symbol}`,
            amount,
            decimals: 18,
            priceUsd: price,
            valueUsd,
            change24hPercent: 0,
            logoUrl,
            allocationPercent: 0,
          });
        }

        const newTotalValue = holdings.reduce((sum, h) => sum + (h.valueUsd || 0), 0);
        summary.totalValueUsd = Math.round(newTotalValue * 100) / 100;
        summary.holdingsCount = holdings.length;
        if (summary.totalValueUsd > 0) {
          for (const h of holdings) {
            h.allocationPercent =
              h.valueUsd !== null ? Math.round((h.valueUsd / summary.totalValueUsd) * 10000) / 100 : 0;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[PortfolioService] On-chain RPC balance verification failed (${chain}:${address}):`, err.message);
    }
  }

  /**
   * Enriches ERC20 token balances on EVM chains using BlockchainRpcProvider
   * when indexing providers return empty or fail.
   */
  private async enrichTopErc20Balances(
    chain: string,
    address: string,
    holdings: PortfolioHolding[],
    summary: PortfolioSummary
  ): Promise<void> {
    const chainTokens = TOP_EVM_TOKENS[chain.toLowerCase()];
    if (!chainTokens || chainTokens.length === 0) return;

    const existingContracts = new Set(
      holdings
        .filter((h) => h.contractAddress)
        .map((h) => h.contractAddress!.toLowerCase())
    );

    for (const tokenConfig of chainTokens) {
      if (existingContracts.has(tokenConfig.contract.toLowerCase())) continue;

      try {
        const bal = await blockchainRpcProvider.getTokenBalance(
          chain,
          tokenConfig.contract,
          address,
          tokenConfig.decimals
        );
        const amount = parseFloat(bal.formattedUnits);
        if (amount > 0.0001) {
          let price = 0;
          try {
            const coinData = await marketService.getTokenById(tokenConfig.coinId);
            if (coinData && coinData.priceUsd > 0) {
              price = coinData.priceUsd;
            }
          } catch {
            // Price will remain 0 / null
          }

          const valueUsd = price > 0 ? Math.round(amount * price * 100) / 100 : null;

          holdings.push({
            id: `${chain}:${tokenConfig.contract}`,
            chain,
            coinId: tokenConfig.coinId,
            symbol: tokenConfig.symbol,
            name: tokenConfig.name,
            balance: `${amount < 0.0001 ? amount.toPrecision(4) : amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${tokenConfig.symbol}`,
            amount,
            decimals: tokenConfig.decimals,
            contractAddress: tokenConfig.contract,
            priceUsd: price,
            valueUsd,
            change24hPercent: 0,
            logoUrl: tokenConfig.logoUrl || '',
            allocationPercent: 0,
          });
        }
      } catch {
        // Non-critical: continue to next token
      }
    }
  }

  /**
   * Retrieves full portfolio (summary, holdings, defi)
   * Cache-first with stampede protection and fallback to on-chain RPC.
   */
  async getPortfolio(
    chain: string,
    address: string,
    forceRefresh: boolean = false
  ): Promise<NormalizedPortfolioResponse> {
    const normChain = chain.toLowerCase();
    const targetAddress = this.cleanAddress(normChain, address);
    const cacheKey = portfolioCacheKeys.portfolio(normChain, targetAddress);

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.portfolio, staleSeconds: config.cacheTtl.portfolio * 4 },
      async () => {
        let rawBalance: any[] = [];
        try {
          rawBalance = await coinStatsProvider.getWalletBalance(normChain, targetAddress);
        } catch (err: any) {
          const status = err.statusCode || err.response?.status;
          console.warn(
            `[PortfolioService] Upstream wallet balance error (${status || err.message}) for ${normChain}:${targetAddress}. Falling back to on-chain RPC...`
          );
          rawBalance = [];
        }

        const { holdings, summary } = mapCoinStatsHoldings(normChain, rawBalance);

        // 1. On-chain ground truth verification for EVM native tokens (ETH, POL, BNB)
        await this.enrichNativeOnChainBalance(normChain, targetAddress, holdings, summary);

        // 2. On-chain check for top ERC20s if holdings list is empty or sparse
        if (holdings.length <= 1) {
          await this.enrichTopErc20Balances(normChain, targetAddress, holdings, summary);
        }

        // 3. Price enrichment from shared master token cache
        try {
          const masterTokens = await marketService.getMasterTokenList(false);
          const masterBySymbol = new Map(masterTokens.map((t) => [t.symbol.toUpperCase(), t]));
          const masterById = new Map(masterTokens.map((t) => [t.id.toLowerCase(), t]));

          for (const h of holdings) {
            if (!h.priceUsd || h.priceUsd === 0) {
              const matched =
                masterById.get(h.coinId.toLowerCase()) ||
                masterBySymbol.get(h.symbol.toUpperCase());
              if (matched && matched.priceUsd > 0) {
                h.priceUsd = matched.priceUsd;
                h.valueUsd = Math.round(h.amount * h.priceUsd * 100) / 100;
                if (!h.change24hPercent && matched.change24hPercent) {
                  h.change24hPercent = matched.change24hPercent;
                }
                if (!h.logoUrl && matched.logoUrl) {
                  h.logoUrl = matched.logoUrl;
                }
              }
            }
          }
        } catch (err: any) {
          console.warn('[PortfolioService] Price enrichment from master market cache failed:', err.message);
        }

        // 4. Recompute total portfolio summary metrics
        const totalValueUsd = holdings.reduce((sum, h) => sum + (h.valueUsd || 0), 0);
        summary.totalValueUsd = Math.round(totalValueUsd * 100) / 100;
        summary.holdingsCount = holdings.length;

        // Recompute allocations
        if (summary.totalValueUsd > 0) {
          for (const h of holdings) {
            h.allocationPercent =
              h.valueUsd !== null ? Math.round((h.valueUsd / summary.totalValueUsd) * 10000) / 100 : 0;
          }
        }

        // 5. Asynchronously record snapshot for historical tracking (fire-and-forget)
        if (summary.totalValueUsd > 0) {
          snapshotService.createSnapshot(normChain, targetAddress, summary.totalValueUsd).catch((err) => {
            console.warn('[PortfolioService] Non-critical snapshot error:', err.message);
          });
        }

        // 6. Fetch DeFi protocol investments
        let defi: DeFiPosition[] = [];
        try {
          const rawDefi = await coinStatsProvider.getWalletDefi(normChain, targetAddress);
          defi = mapCoinStatsDefi(normChain, rawDefi, holdings);
        } catch (err: any) {
          defi = mapCoinStatsDefi(normChain, null, holdings);
        }

        return {
          wallet: {
            address: targetAddress,
            chain: normChain,
          },
          summary,
          holdings,
          defi,
          updatedAt: new Date().toISOString(),
        };
      },
      { forceRefresh, source: 'coinstats_rpc' }
    );
  }

  /**
   * Retrieves portfolio summary with optional force refresh
   */
  async getSummary(
    chain: string,
    address: string,
    forceRefresh: boolean = false
  ): Promise<PortfolioSummary> {
    const portfolio = await this.getPortfolio(chain, address, forceRefresh);
    return portfolio.summary;
  }

  /**
   * Retrieves token holdings with optional force refresh
   */
  async getHoldings(
    chain: string,
    address: string,
    forceRefresh: boolean = false
  ): Promise<PortfolioHolding[]> {
    const portfolio = await this.getPortfolio(chain, address, forceRefresh);
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

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.transactions, staleSeconds: config.cacheTtl.transactions * 4 },
      async () => {
        try {
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
        } catch (err: any) {
          console.warn(`[PortfolioService] Non-critical transactions error (${normChain}:${targetAddress}):`, err.message);
          return {
            transactions: [],
            meta: {
              page,
              limit,
              hasMore: false,
            },
          };
        }
      },
      { source: 'coinstats' }
    );
  }

  /**
   * Computes or retrieves portfolio chart data for a specified timeframe.
   * Checks PostgreSQL snapshots first. If insufficient, aggregates real historical
   * price curves of top holdings via marketService.getTokenChart.
   * Strictly avoids synthetic data or fabricated curves.
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

    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: config.cacheTtl.portfolioChart, staleSeconds: config.cacheTtl.portfolioChart * 3 },
      async () => {
        const portfolio = await this.getPortfolio(normChain, targetAddress);
        const holdings = portfolio.holdings;

        if (!holdings || holdings.length === 0 || portfolio.summary.totalValueUsd === 0) {
          return buildPortfolioChartData(upperTf, []);
        }

        // 1. Check for stored PostgreSQL snapshots first
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

        // 2. If insufficient snapshots, compute from top token real price histories
        const topHoldings = holdings.slice(0, 5);

        let period = '24h';
        if (upperTf === '1W') period = '1w';
        else if (upperTf === '1M') period = '1m';
        else if (upperTf === '1Y') period = '1y';
        else if (upperTf === 'ALL') period = 'all';

        try {
          const chartPromises = topHoldings.map(async (h) => {
            try {
              const chartData = await marketService.getTokenChart(h.coinId, period);
              return {
                amount: h.amount,
                points: chartData.points,
              };
            } catch {
              return null;
            }
          });

          const results = await Promise.all(chartPromises);
          const validResults = results.filter(
            (r): r is NonNullable<typeof r> => r !== null && r.points.length > 0
          );

          if (validResults.length === 0) {
            // No valid historical points available: return clean empty chart per Section 22
            return buildPortfolioChartData(upperTf, []);
          }

          // Align timestamps using the first valid result's points
          const basePoints = validResults[0].points;
          const aggregatedPoints: { timestamp: number; value: number }[] = basePoints.map((basePt, idx) => {
            let totalUsdAtTime = 0;
            for (const item of validResults) {
              const pt = item.points[idx] || item.points[item.points.length - 1];
              totalUsdAtTime += item.amount * (pt?.priceUsd || 0);
            }

            const modeledFraction =
              topHoldings
                .slice(0, validResults.length)
                .reduce((s, h) => s + (h.valueUsd || 0), 0) / (portfolio.summary.totalValueUsd || 1);

            const totalEstimated = modeledFraction > 0 ? totalUsdAtTime / modeledFraction : totalUsdAtTime;

            return {
              timestamp: basePt.timestamp,
              value: totalEstimated,
            };
          });

          return buildPortfolioChartData(upperTf, aggregatedPoints);
        } catch (err: any) {
          console.warn('[PortfolioService] Error computing portfolio chart:', err.message);
          return buildPortfolioChartData(upperTf, []);
        }
      },
      { source: 'portfolio_chart' }
    );
  }

  /**
   * Retrieves DeFi positions
   */
  async getDefi(chain: string, address: string): Promise<DeFiPosition[]> {
    const portfolio = await this.getPortfolio(chain, address);
    return portfolio.defi || [];
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
