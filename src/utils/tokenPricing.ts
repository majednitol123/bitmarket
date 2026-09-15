// ═══════════════════════════════════════════════════════════
// TOKEN PRICING & SWAP ESTIMATION UTILITIES
// Live dynamic prices populated from market and portfolio APIs
// ═══════════════════════════════════════════════════════════

export const LIVE_TOKEN_USD_PRICES: Record<string, number> = {};

// Keep backwards-compatible alias
export const TOKEN_USD_PRICES = LIVE_TOKEN_USD_PRICES;

/**
 * Dynamically update token price from live market data
 */
export function updateTokenPrice(symbol: string, price: number): void {
  if (!symbol || typeof price !== 'number' || isNaN(price) || price <= 0) return;
  LIVE_TOKEN_USD_PRICES[symbol.toUpperCase()] = price;
}

/**
 * Bulk update token prices from live market tokens list or portfolio holdings
 */
export function updateTokenPrices(tokens: { symbol: string; priceUsd?: number | null }[]): void {
  if (!Array.isArray(tokens)) return;
  for (const t of tokens) {
    if (t?.symbol && typeof t.priceUsd === 'number' && t.priceUsd > 0) {
      LIVE_TOKEN_USD_PRICES[t.symbol.toUpperCase()] = t.priceUsd;
    }
  }
}

/**
 * Get USD price for a given token symbol.
 * Returns null if price is unavailable or unknown.
 */
export function getTokenPrice(symbol?: string): number | null {
  if (!symbol) return null;
  const sym = symbol.toUpperCase();
  const price = LIVE_TOKEN_USD_PRICES[sym];
  return typeof price === 'number' && price > 0 ? price : null;
}

/**
 * Calculate the exchange rate from Token A to Token B.
 * Returns null if either token's price is unknown or <= 0.
 */
export function getExchangeRate(fromSymbol?: string, toSymbol?: string): number | null {
  const fromPrice = getTokenPrice(fromSymbol);
  const toPrice = getTokenPrice(toSymbol);
  if (fromPrice === null || toPrice === null || toPrice <= 0) return null;
  return fromPrice / toPrice;
}

/**
 * Calculate expected receive amount from a pay amount.
 * Returns empty string if either token price is unknown or input is invalid.
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
  if (rate === null) {
    return "";
  }
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
export function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
