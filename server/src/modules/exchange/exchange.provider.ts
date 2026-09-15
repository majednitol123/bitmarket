import axios from 'axios';
import { BaseProvider } from '../../providers/core/BaseProvider';
import {
  ExchangeQuoteRequest,
  ExchangeQuoteResponse,
  BuildTxRequest,
  BuildTxResponse,
  RouteType,
  UnsignedTransaction,
} from './exchange.types';
import { coinStatsProvider } from '../../providers/CoinStatsProvider';

const LIFI_BASE_URL = 'https://li.quest/v1';

// Standard EVM zero address for native gas tokens
const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// Known token decimals mapping
const KNOWN_DECIMALS: Record<string, number> = {
  ETH: 18,
  WETH: 18,
  USDT: 6,
  USDC: 6,
  DAI: 18,
  WBTC: 8,
  MATIC: 18,
  POL: 18,
  BNB: 18,
  AVAX: 18,
  SOL: 9,
};

// Chain name to ID mapping
const CHAIN_NAME_TO_ID: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  '1': 1,
  polygon: 137,
  matic: 137,
  '137': 137,
  arbitrum: 42161,
  '42161': 42161,
  optimism: 10,
  '10': 10,
  base: 8453,
  '8453': 8453,
  bsc: 56,
  binance: 56,
  '56': 56,
  avalanche: 43114,
  '43114': 43114,
  fantom: 250,
  '250': 250,
};

export class ExchangeProvider extends BaseProvider {
  private client = axios.create({
    baseURL: LIFI_BASE_URL,
    timeout: 10000,
    headers: {
      Accept: 'application/json',
    },
  });

  constructor() {
    super('LiFi', {
      defaultTimeoutMs: 10000,
      maxConsecutiveFailures: 5,
      circuitBreakerCooldownMs: 30000,
    });
  }

  /**
   * Normalizes chain identifier (e.g. "ethereum" or "1") to numeric chain ID
   */
  public normalizeChainId(chain: string | number): number {
    if (typeof chain === 'number') return chain;
    const lower = String(chain).toLowerCase().trim();
    if (CHAIN_NAME_TO_ID[lower]) {
      return CHAIN_NAME_TO_ID[lower];
    }
    const parsed = parseInt(lower, 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  /**
   * Normalizes token address: converts "native", gas symbols, or empty to 0x0...0
   */
  public normalizeTokenAddress(token: string): string {
    const trimmed = (token || '').trim();
    if (
      !trimmed ||
      trimmed.toLowerCase() === 'native' ||
      trimmed.toUpperCase() === 'ETH' ||
      trimmed.toUpperCase() === 'MATIC' ||
      trimmed.toUpperCase() === 'POL' ||
      trimmed.toUpperCase() === 'BNB' ||
      trimmed.toUpperCase() === 'AVAX' ||
      trimmed.toUpperCase() === 'SOL'
    ) {
      return NATIVE_TOKEN_ADDRESS;
    }
    return trimmed;
  }

  /**
   * Resiliently resolves a token symbol or address to its verified on-chain contract address.
   */
  public async resolveTokenAddress(chainId: number, token: string): Promise<string> {
    const normalized = this.normalizeTokenAddress(token);
    if (normalized === NATIVE_TOKEN_ADDRESS || /^0x[a-fA-F0-9]{40}$/.test(normalized)) {
      return normalized;
    }
    // Attempt live resolution via LiFi /token endpoint
    try {
      const res = await this.client.get('/token', {
        params: { chain: chainId, token: normalized },
      });
      if (res.data?.address && /^0x[a-fA-F0-9]{40}$/.test(res.data.address)) {
        return res.data.address;
      }
    } catch {
      // Fallback
    }
    return normalized;
  }

  /**
   * Converts human-readable token amount (e.g. "0.5") to raw atomic integer units (e.g. 500000000000000000)
   */
  public toRawUnits(amountStr: string, decimals: number = 18): string {
    const val = parseFloat(amountStr);
    if (isNaN(val) || val <= 0) return '0';

    // Split on decimal point to avoid floating point imprecision
    const parts = amountStr.trim().split('.');
    const integerPart = parts[0] || '0';
    let fractionalPart = parts[1] || '';

    if (fractionalPart.length > decimals) {
      fractionalPart = fractionalPart.slice(0, decimals);
    } else {
      fractionalPart = fractionalPart.padEnd(decimals, '0');
    }

    const combined = integerPart + fractionalPart;
    const trimmedLeadingZeros = combined.replace(/^0+/, '') || '0';
    return trimmedLeadingZeros;
  }

  /**
   * Converts raw atomic units (e.g. 500000000000000000) to human-readable string (e.g. "0.5")
   */
  public fromRawUnits(rawStr: string, decimals: number = 18): string {
    if (!rawStr || rawStr === '0') return '0';
    const padded = rawStr.padStart(decimals + 1, '0');
    const intPart = padded.slice(0, padded.length - decimals);
    const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
    return fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  }

  /**
   * Fetches live quote from Li.Fi DEX & Bridge aggregator with resilience wrapper
   */
  public async getQuote(params: ExchangeQuoteRequest): Promise<ExchangeQuoteResponse> {
    const fromChainId = this.normalizeChainId(params.fromChain);
    const toChainId = this.normalizeChainId(params.toChain);
    const fromTokenAddress = await this.resolveTokenAddress(fromChainId, params.fromToken);
    const toTokenAddress = await this.resolveTokenAddress(toChainId, params.toToken);
    const isBridge: RouteType = fromChainId === toChainId ? 'swap' : 'bridge';

    // Guess token decimals for input
    const fromDecimals = this.guessDecimals(params.fromToken);
    const rawFromAmount = this.toRawUnits(params.fromAmount, fromDecimals);
    const slippageNum = parseFloat(params.slippage || '0.5') / 100;

    try {
      const response = await this.executeWithResilience(
        `getQuote(${fromChainId}->${toChainId})`,
        () =>
          this.client.get('/quote', {
            params: {
              fromChain: fromChainId,
              toChain: toChainId,
              fromToken: fromTokenAddress,
              toToken: toTokenAddress,
              fromAmount: rawFromAmount,
              fromAddress: params.fromAddress || '0x0000000000000000000000000000000000000001',
              slippage: slippageNum,
            },
          }),
        {
          timeoutMs: 10000,
          retries: 1,
        }
      );

      const quote = response.data;
      const estimate = quote.estimate;
      const action = quote.action;

      const toDecimals = estimate?.toToken?.decimals || action?.toToken?.decimals || 18;
      const parsedToAmount = this.fromRawUnits(estimate.toAmount, toDecimals);
      const minReceivedAmount = this.fromRawUnits(estimate.toAmountMin, toDecimals);

      const fromNum = parseFloat(params.fromAmount);
      const toNum = parseFloat(parsedToAmount);
      const exchangeRate = fromNum > 0 ? toNum / fromNum : 0;

      // Estimate gas cost in USD
      let gasUsd = 0;
      if (Array.isArray(estimate.gasCosts)) {
        gasUsd = estimate.gasCosts.reduce((sum: number, g: any) => sum + parseFloat(g.amountUSD || '0'), 0);
      } else if (estimate.gasCosts?.amountUSD) {
        gasUsd = parseFloat(estimate.gasCosts.amountUSD);
      }

      const providerName = quote.toolDetails?.name || quote.tool || (isBridge ? 'Cross-Chain Bridge' : 'DEX Aggregator');

      return {
        quoteId: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        routeType: isBridge,
        provider: `Li.Fi / ${providerName}`,
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: {
          symbol: action.fromToken?.symbol || 'ETH',
          name: action.fromToken?.name || action.fromToken?.symbol || 'Ethereum',
          address: action.fromToken?.address || fromTokenAddress,
          decimals: action.fromToken?.decimals || fromDecimals,
          chainId: fromChainId,
          logoUrl: action.fromToken?.logoURI,
          priceUsd: parseFloat(action.fromToken?.priceUSD || '0'),
        },
        toToken: {
          symbol: action.toToken?.symbol || 'USDC',
          name: action.toToken?.name || action.toToken?.symbol || 'USD Coin',
          address: action.toToken?.address || toTokenAddress,
          decimals: toDecimals,
          chainId: toChainId,
          logoUrl: action.toToken?.logoURI,
          priceUsd: parseFloat(action.toToken?.priceUSD || '0'),
        },
        fromAmount: params.fromAmount,
        toAmount: parsedToAmount,
        exchangeRate,
        minReceived: minReceivedAmount,
        estimatedGasUsd: Math.round(gasUsd * 100) / 100,
        priceImpactPercent: 0.1,
        estimatedDurationSeconds: estimate.executionDuration || (isBridge ? 180 : 15),
        rawQuote: quote,
      };
    } catch (err: any) {
      console.warn(`[ExchangeProvider] Li.Fi quote error: ${err.message}. Engaging CoinStats fallback pricing...`);
      return this.getCoinStatsFallbackQuote(params, fromChainId, toChainId, isBridge);
    }
  }

  /**
   * Generates unsigned transaction call data and approval requirements for wallet execution
   */
  public async buildTransaction(params: BuildTxRequest): Promise<BuildTxResponse> {
    const fromChainId = this.normalizeChainId(params.fromChain);
    const toChainId = this.normalizeChainId(params.toChain);
    const fromTokenAddress = await this.resolveTokenAddress(fromChainId, params.fromToken);
    const toTokenAddress = await this.resolveTokenAddress(toChainId, params.toToken);
    const isBridge: RouteType = fromChainId === toChainId ? 'swap' : 'bridge';

    const fromDecimals = this.guessDecimals(params.fromToken);
    const rawFromAmount = this.toRawUnits(params.fromAmount, fromDecimals);
    const slippageNum = parseFloat(params.slippage || '0.5') / 100;

    const response = await this.executeWithResilience(
      `buildTx(${fromChainId}->${toChainId})`,
      () =>
        this.client.get('/quote', {
          params: {
            fromChain: fromChainId,
            toChain: toChainId,
            fromToken: fromTokenAddress,
            toToken: toTokenAddress,
            fromAmount: rawFromAmount,
            fromAddress: params.fromAddress,
            slippage: slippageNum,
          },
        }),
      {
        timeoutMs: 12000,
        retries: 1,
      }
    );

    const quote = response.data;
    const txReq = quote.transactionRequest;
    const estimate = quote.estimate;
    const action = quote.action;

    const toDecimals = estimate?.toToken?.decimals || action?.toToken?.decimals || 18;
    const parsedToAmount = this.fromRawUnits(estimate.toAmount, toDecimals);

    // Check if token approval is required
    let approval: any = undefined;
    if (estimate?.approvalAddress && fromTokenAddress !== NATIVE_TOKEN_ADDRESS) {
      approval = {
        needed: true,
        tokenAddress: fromTokenAddress,
        spender: estimate.approvalAddress,
        amount: rawFromAmount,
      };
    }

    const transaction: UnsignedTransaction = {
      to: txReq.to,
      data: txReq.data,
      value: txReq.value || '0x0',
      chainId: txReq.chainId || fromChainId,
      gasLimit: txReq.gasLimit ? String(txReq.gasLimit) : undefined,
    };

    const providerName = quote.toolDetails?.name || quote.tool || (isBridge ? 'Bridge Router' : 'DEX Router');

    return {
      swapId: 0,
      type: isBridge,
      provider: `Li.Fi / ${providerName}`,
      status: approval?.needed ? 'approval_required' : 'ready_for_signature',
      fromAmount: params.fromAmount,
      toAmount: parsedToAmount,
      fromToken: {
        symbol: action.fromToken?.symbol || 'ETH',
        name: action.fromToken?.name || 'Token',
        address: fromTokenAddress,
        decimals: fromDecimals,
        chainId: fromChainId,
      },
      toToken: {
        symbol: action.toToken?.symbol || 'USDC',
        name: action.toToken?.name || 'Token',
        address: toTokenAddress,
        decimals: toDecimals,
        chainId: toChainId,
      },
      transaction,
      approval,
      expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
    };
  }

  /**
   * Safe fallback quote using live CoinStats market token prices if external DEX API is unreachable
   */
  private async getCoinStatsFallbackQuote(
    params: ExchangeQuoteRequest,
    fromChainId: number,
    toChainId: number,
    routeType: RouteType
  ): Promise<ExchangeQuoteResponse> {
    let fromPrice = 2600; // default ETH estimate
    let toPrice = 1.0; // default stablecoin estimate

    try {
      const overview = await coinStatsProvider.getCoins({ page: 1, limit: 100 });
      const fromCoin = overview.tokens.find(
        (c: any) =>
          c.symbol?.toLowerCase() === params.fromToken?.toLowerCase() ||
          c.id?.toLowerCase() === params.fromToken?.toLowerCase()
      );
      const toCoin = overview.tokens.find(
        (c: any) =>
          c.symbol?.toLowerCase() === params.toToken?.toLowerCase() ||
          c.id?.toLowerCase() === params.toToken?.toLowerCase()
      );

      if (fromCoin?.priceUsd) fromPrice = fromCoin.priceUsd;
      if (toCoin?.priceUsd) toPrice = toCoin.priceUsd;
    } catch {
      // Ignore provider error on fallback
    }

    const fromNum = parseFloat(params.fromAmount) || 0;
    const toNum = toPrice > 0 ? (fromNum * fromPrice) / toPrice : 0;
    const exchangeRate = fromNum > 0 ? toNum / fromNum : fromPrice / toPrice;

    return {
      quoteId: `quote_fallback_${Date.now()}`,
      routeType,
      provider: routeType === 'bridge' ? 'Multi-Chain Bridge' : 'DEX Aggregator',
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: {
        symbol: params.fromToken?.toUpperCase() || 'ETH',
        name: params.fromToken || 'Token',
        address: this.normalizeTokenAddress(params.fromToken),
        decimals: this.guessDecimals(params.fromToken),
        chainId: fromChainId,
        priceUsd: fromPrice,
      },
      toToken: {
        symbol: params.toToken?.toUpperCase() || 'USDC',
        name: params.toToken || 'Token',
        address: this.normalizeTokenAddress(params.toToken),
        decimals: this.guessDecimals(params.toToken),
        chainId: toChainId,
        priceUsd: toPrice,
      },
      fromAmount: params.fromAmount,
      toAmount: toNum.toFixed(6).replace(/\.?0+$/, ''),
      exchangeRate,
      minReceived: (toNum * 0.995).toFixed(6).replace(/\.?0+$/, ''),
      estimatedGasUsd: routeType === 'bridge' ? 8.5 : 2.5,
      priceImpactPercent: 0.05,
      estimatedDurationSeconds: routeType === 'bridge' ? 180 : 15,
      isIndicative: true,
    };
  }

  private guessDecimals(symbolOrAddress: string): number {
    const sym = (symbolOrAddress || '').toUpperCase();
    if (KNOWN_DECIMALS[sym]) {
      return KNOWN_DECIMALS[sym];
    }
    return 18;
  }
}

export const exchangeProvider = new ExchangeProvider();
