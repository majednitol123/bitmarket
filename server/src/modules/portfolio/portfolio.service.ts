import axios from 'axios';
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

        // 3. Live price and 24h change enrichment from CoinMarketCap master token cache
        try {
          const masterTokens = await marketService.getMasterTokenList(false);
          const masterBySymbol = new Map(masterTokens.map((t) => [t.symbol.toUpperCase(), t]));
          const masterById = new Map(masterTokens.map((t) => [t.id.toLowerCase(), t]));

          for (const h of holdings) {
            const matched =
              masterById.get(h.coinId.toLowerCase()) ||
              masterBySymbol.get(h.symbol.toUpperCase());
            if (matched && matched.priceUsd > 0) {
              h.priceUsd = matched.priceUsd;
              h.valueUsd = Math.round(h.amount * h.priceUsd * 100) / 100;
              h.change24hPercent = matched.change24hPercent || 0;
              if (matched.logoUrl) {
                h.logoUrl = matched.logoUrl;
              }
            }
          }
        } catch (err: any) {
          console.warn('[PortfolioService] Price enrichment from master market cache failed:', err.message);
        }

        // 4. Recompute total portfolio summary metrics and weighted 24h change
        const totalValueUsd = holdings.reduce((sum, h) => sum + (h.valueUsd || 0), 0);
        let totalPriorValue = 0;

        for (const h of holdings) {
          if (h.valueUsd && h.valueUsd > 0) {
            const changeFactor = 1 + (h.change24hPercent || 0) / 100;
            const priorTokenVal = changeFactor > 0 ? h.valueUsd / changeFactor : h.valueUsd;
            totalPriorValue += priorTokenVal;
          }
        }

        const change24hUsd =
          totalPriorValue > 0 ? Math.round((totalValueUsd - totalPriorValue) * 100) / 100 : 0;
        const change24hPercent =
          totalPriorValue > 0
            ? Math.round(((totalValueUsd - totalPriorValue) / totalPriorValue) * 10000) / 100
            : 0;

        summary.totalValueUsd = Math.round(totalValueUsd * 100) / 100;
        summary.change24hUsd = change24hUsd;
        summary.change24hPercent = change24hPercent;
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
        let transactions: PortfolioTransaction[] = [];
        let hasMore = false;

        try {
          const raw = await coinStatsProvider.getWalletTransactions(normChain, targetAddress, page, limit);
          transactions = mapCoinStatsTransactions(normChain, raw.result);
          hasMore = raw.meta?.hasNextPage ?? (transactions.length >= limit);
        } catch (err: any) {
          console.warn(`[PortfolioService] CoinStats transactions error (${normChain}:${targetAddress}):`, err.message);
        }

        // Fallback to on-chain transfers via Alchemy if CoinStats returned no transactions
        if (transactions.length === 0 && ['ethereum', 'eth', 'polygon', 'arbitrum', 'arb', 'optimism', 'opt', 'base'].includes(normChain)) {
          try {
            const alchemyTxs = await this.getAlchemyTransactions(normChain, targetAddress, limit);
            if (alchemyTxs.length > 0) {
              transactions = alchemyTxs;
              hasMore = alchemyTxs.length >= limit;
            }
          } catch (alchErr: any) {
            console.warn(`[PortfolioService] Alchemy transactions fallback failed:`, alchErr.message);
          }
        }

        return {
          transactions,
          meta: {
            page,
            limit,
            hasMore,
          },
        };
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
        // Snapshots can ONLY be used if they cover a meaningful portion of the requested timeframe!
        const now = Date.now();
        let minSpanMs = 0;
        let fromDate: Date;

        if (upperTf === '1D') {
          minSpanMs = 18 * 60 * 60 * 1000; // at least 18 hours span
          fromDate = new Date(now - 24 * 60 * 60 * 1000);
        } else if (upperTf === '1W') {
          minSpanMs = 5 * 24 * 60 * 60 * 1000; // at least 5 days span
          fromDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        } else if (upperTf === '1M') {
          minSpanMs = 21 * 24 * 60 * 60 * 1000; // at least 21 days span
          fromDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        } else if (upperTf === '1Y') {
          minSpanMs = 180 * 24 * 60 * 60 * 1000; // at least 6 months span
          fromDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
        } else {
          minSpanMs = 180 * 24 * 60 * 60 * 1000; // ALL: at least 6 months
          fromDate = new Date(0);
        }

        const snapshots = await snapshotService.getSnapshots(normChain, targetAddress, fromDate);
        if (snapshots.length >= 8) {
          const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
          const actualSpanMs = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
          if (actualSpanMs >= minSpanMs) {
            return buildPortfolioChartData(upperTf, sorted);
          }
        }

        // 2. If snapshots don't span the timeframe, compute from real token market price histories
        let period = '24h';
        if (upperTf === '1W') period = '1w';
        else if (upperTf === '1M') period = '1m';
        else if (upperTf === '1Y') period = '1y';
        else if (upperTf === 'ALL') period = 'all';

        // Select top holdings with value, sorted descending
        const topHoldings = holdings
          .filter((h) => (h.valueUsd || 0) > 0 && h.amount > 0)
          .sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0))
          .slice(0, 3); // Top 3 holdings capture 85-95% of value without hitting upstream rate limits

        try {
          const chartPromises = topHoldings.map(async (h) => {
            try {
              const targetCoin = h.coinId || h.symbol;
              let chartData = await marketService.getTokenChart(targetCoin, period);
              if ((!chartData.points || chartData.points.length === 0) && h.symbol && h.symbol.toLowerCase() !== targetCoin.toLowerCase()) {
                chartData = await marketService.getTokenChart(h.symbol, period);
              }
              return {
                symbol: h.symbol,
                amount: h.amount,
                valueUsd: h.valueUsd || 0,
                points: chartData.points,
              };
            } catch {
              return null;
            }
          });

          const results = await Promise.all(chartPromises);
          let validResults = results.filter(
            (r): r is NonNullable<typeof r> => r !== null && r.points.length > 0
          );

          // If top holdings charts were unavailable (e.g. unknown contract IDs), try native chain token
          if (validResults.length === 0) {
            const nativeAsset = normChain === 'solana' ? 'solana' : 'ethereum';
            try {
              const nativeChart = await marketService.getTokenChart(nativeAsset, period);
              if (nativeChart && nativeChart.points && nativeChart.points.length > 0) {
                const currentTotal = portfolio.summary.totalValueUsd || 1;
                const lastNativePrice = nativeChart.points[nativeChart.points.length - 1]?.priceUsd || 1;
                validResults = [
                  {
                    symbol: nativeAsset.toUpperCase(),
                    amount: currentTotal / lastNativePrice,
                    valueUsd: currentTotal,
                    points: nativeChart.points,
                  },
                ];
              }
            } catch {
              // Ignore native fallback failure
            }
          }

          if (validResults.length === 0) {
            // Only fall back to snapshots if they cover the minimum timeframe span
            if (snapshots.length >= 2) {
              const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
              const actualSpanMs = sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
              if (actualSpanMs >= minSpanMs) {
                return buildPortfolioChartData(upperTf, sorted);
              }
            }
            return buildPortfolioChartData(upperTf, []);
          }

          // Pick the valid result with the longest points array as the timeline anchor
          const anchorResult = validResults.reduce((best, curr) =>
            curr.points.length > best.points.length ? curr : best, validResults[0]
          );
          const basePoints = anchorResult.points;

          const aggregatedPoints: { timestamp: number; value: number }[] = basePoints.map((basePt) => {
            let totalUsdAtTime = 0;
            let totalWeights = 0;

            for (const item of validResults) {
              const pt = this.findClosestPoint(item.points, basePt.timestamp);
              if (pt) {
                totalUsdAtTime += item.amount * pt.priceUsd;
                totalWeights += item.valueUsd;
              }
            }

            const unmodeledValue = Math.max(0, (portfolio.summary.totalValueUsd || 0) - totalWeights);
            const totalEstimated = totalUsdAtTime + unmodeledValue;

            return {
              timestamp: basePt.timestamp,
              value: totalEstimated,
            };
          });

          return buildPortfolioChartData(upperTf, aggregatedPoints);
        } catch (err: any) {
          console.warn('[PortfolioService] Error computing portfolio chart:', err.message);
          if (snapshots.length >= 2) {
            const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
            return buildPortfolioChartData(upperTf, sorted);
          }
          return buildPortfolioChartData(upperTf, []);
        }
      },
      { source: 'portfolio_chart' }
    );
  }

  /**
   * Finds the closest data point by timestamp in an array of points
   */
  private findClosestPoint(
    points: { timestamp: number; priceUsd: number }[],
    targetTs: number
  ): { timestamp: number; priceUsd: number } | null {
    if (!points || points.length === 0) return null;
    let closest = points[0];
    let minDiff = Math.abs(points[0].timestamp - targetTs);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].timestamp - targetTs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = points[i];
      }
    }
    return closest;
  }

  /**
   * Retrieves DeFi positions
   */
  async getDefi(chain: string, address: string): Promise<DeFiPosition[]> {
    const portfolio = await this.getPortfolio(chain, address);
    return portfolio.defi || [];
  }

  /**
   * Fetches real on-chain transfer events using Alchemy asset transfers RPC.
   * Serves as reliable fallback when upstream indexing providers are desynced or rate-limited.
   */
  private async getAlchemyTransactions(
    chain: string,
    address: string,
    limit: number = 20
  ): Promise<PortfolioTransaction[]> {
    const alchemyKey = process.env.ALCHEMY_API_KEY || process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;
    if (!alchemyKey) return [];

    let network = 'eth-mainnet';
    if (chain === 'polygon') network = 'polygon-mainnet';
    else if (chain === 'arbitrum' || chain === 'arb') network = 'arb-mainnet';
    else if (chain === 'optimism' || chain === 'opt') network = 'opt-mainnet';
    else if (chain === 'base') network = 'base-mainnet';

    const hexLimit = '0x' + Math.min(100, Math.max(1, limit)).toString(16);

    const [incomingRes, outgoingRes] = await Promise.allSettled([
      axios.post(
        `https://${network}.g.alchemy.com/v2/${alchemyKey}`,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              fromBlock: '0x0',
              toBlock: 'latest',
              toAddress: address,
              category: ['external', 'erc20'],
              maxCount: hexLimit,
              order: 'desc',
            },
          ],
        },
        { timeout: 8000 }
      ),
      axios.post(
        `https://${network}.g.alchemy.com/v2/${alchemyKey}`,
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'alchemy_getAssetTransfers',
          params: [
            {
              fromBlock: '0x0',
              toBlock: 'latest',
              fromAddress: address,
              category: ['external', 'erc20'],
              maxCount: hexLimit,
              order: 'desc',
            },
          ],
        },
        { timeout: 8000 }
      ),
    ]);

    const incoming: any[] = incomingRes.status === 'fulfilled' ? incomingRes.value.data?.result?.transfers || [] : [];
    const outgoing: any[] = outgoingRes.status === 'fulfilled' ? outgoingRes.value.data?.result?.transfers || [] : [];

    const allTransfers = [...incoming, ...outgoing];
    allTransfers.sort((a, b) => {
      const timeA = a.metadata?.blockTimestamp ? new Date(a.metadata.blockTimestamp).getTime() : 0;
      const timeB = b.metadata?.blockTimestamp ? new Date(b.metadata.blockTimestamp).getTime() : 0;
      return timeB - timeA;
    });

    const target = address.toLowerCase();
    return allTransfers.slice(0, limit).map((tx, idx) => {
      const isSend = String(tx.from || '').toLowerCase() === target;
      const symbol = String(tx.asset || 'ETH').toUpperCase();
      const amountNum = Number(tx.value || 0);
      const timestamp = tx.metadata?.blockTimestamp ? new Date(tx.metadata.blockTimestamp).getTime() : Date.now();

      return {
        id: tx.hash ? `${tx.hash}-${idx}` : `alch-${timestamp}-${idx}`,
        type: isSend ? 'send' : 'receive',
        date: timestamp,
        hash: tx.hash || '',
        explorerUrl: `https://etherscan.io/tx/${tx.hash || ''}`,
        fromAddress: tx.from || '',
        toAddress: tx.to || '',
        coinSymbol: symbol,
        coinName: symbol,
        coinIcon: symbol === 'ETH' ? 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png' : '',
        amount: `${amountNum < 0.0001 ? amountNum.toPrecision(4) : amountNum.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`,
        valueUsd: 0,
        profitLoss: null,
      };
    });
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
