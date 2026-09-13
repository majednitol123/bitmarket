// ═══════════════════════════════════════════════════════════
// TOKEN PRICING & SWAP ESTIMATION UTILITIES
// ═══════════════════════════════════════════════════════════

export const TOKEN_USD_PRICES: Record<string, number> = {
  ETH: 2642.50,
  WETH: 2642.50,
  stETH: 2642.50,
  BTC: 64520.00,
  WBTC: 64520.00,
  USDT: 1.00,
  USDC: 1.00,
  DAI: 1.00,
  xDAI: 1.00,
  BNB: 582.10,
  SOL: 138.45,
  AVAX: 28.30,
  FTM: 0.52,
  MATIC: 0.42,
  POL: 0.42,
  CRO: 0.09,
  CELO: 0.54,
  GLMR: 0.22,
  MOVR: 12.40,
  MNT: 0.78,
  LINK: 11.60,
  UNI: 7.85,
  AAVE: 142.50,
  MKR: 1940.00,
  LDO: 1.15,
  CRV: 0.31,
  SHIB: 0.0000185,
  PEPE: 0.0000092,
  APE: 0.78,
  SNX: 1.65,
  COMP: 48.20,
  ENS: 18.40,
  GRT: 0.18,
  "1INCH": 0.32,
  SUSHI: 0.82,
  FXS: 2.40,
  RPL: 19.50,
  BAL: 2.10,
};

/**
 * Dynamically update token price from live market data
 */
export function updateTokenPrice(symbol: string, price: number): void {
  if (!symbol || typeof price !== 'number' || isNaN(price) || price <= 0) return;
  TOKEN_USD_PRICES[symbol.toUpperCase()] = price;
}

/**
 * Bulk update token prices from live market tokens list
 */
export function updateTokenPrices(tokens: { symbol: string; priceUsd?: number }[]): void {
  if (!Array.isArray(tokens)) return;
  for (const t of tokens) {
    if (t?.symbol && typeof t.priceUsd === 'number' && t.priceUsd > 0) {
      TOKEN_USD_PRICES[t.symbol.toUpperCase()] = t.priceUsd;
    }
  }
}

/**
 * Get USD price for a given token symbol.
 */
export function getTokenPrice(symbol?: string): number {
  if (!symbol) return 1.0;
  const sym = symbol.toUpperCase();
  return TOKEN_USD_PRICES[sym] ?? 1.0;
}

/**
 * Calculate the exchange rate from Token A to Token B.
 */
export function getExchangeRate(fromSymbol?: string, toSymbol?: string): number {
  const fromPrice = getTokenPrice(fromSymbol);
  const toPrice = getTokenPrice(toSymbol);
  if (toPrice === 0) return 1.0;
  return fromPrice / toPrice;
}

/**
 * Calculate expected receive amount from a pay amount.
 */
export function calculateToAmount(
  fromAmount: string,
  fromSymbol?: string,
  toSymbol?: string
): string {
  if (!fromAmount || isNaN(Number(fromAmount)) || Number(fromAmount) <= 0) {
    return "";
  }
  const rate = getExchangeRate(fromSymbol, toSymbol);
  const result = Number(fromAmount) * rate;
  if (result >= 1000) {
    return result.toFixed(2);
  } else if (result >= 1) {
    return result.toFixed(4);
  } else if (result >= 0.0001) {
    return result.toFixed(6);
  } else {
    return result.toFixed(8);
  }
}

/**
 * Format a number to currency/compact string.
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
