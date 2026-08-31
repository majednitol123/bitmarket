

import axios from "axios";

export const CHAINID_TO_COINGECKO_ID: Record<number, string | null> = {
  // ───────────── Ethereum (mainnet only) ─────────────
  1: "ethereum",

  // ───────────── Polygon (mainnet only) ─────────────
  137: "polygon-ecosystem-token",

  // ───────────── Arbitrum (mainnet only) ─────────────
  42161: "ethereum",

  // ───────────── Optimism (mainnet only) ─────────────
  10: "ethereum",

  // ───────────── Base (mainnet only) ─────────────
  8453: "ethereum",

  // ───────────── zkSync (mainnet only) ─────────────
  324: "ethereum",

  // ───────────── Polygon zkEVM (mainnet only) ─────────────
  1101: "ethereum",

  // ───────────── Scroll (mainnet only) ─────────────
  534352: "ethereum",

  // ───────────── Blast (mainnet only) ─────────────
  81457: "ethereum",

  // ───────────── Linea (mainnet only) ─────────────
  59144: "ethereum",

  // ───────────── Avalanche (mainnet only) ─────────────
  43114: "avalanche-2",

  // ───────────── Celo (mainnet only) ─────────────
  42220: "celo",

  // ───────────── Gnosis ─────────────
  100: "gnosis",

  // ───────────── BSC (mainnet only) ─────────────
  56: "binancecoin",

  // ───────────── SecureChain (custom) ─────────────
  34: "securechain-ai-2",

  // ───────────── Solana (mainnet only) ─────────────
  101: "solana",
};

export const TESTNET_CHAIN_IDS = new Set<number>([
  11155111, // Ethereum Sepolia
  421614,   // Arbitrum Sepolia
  11155420, // Optimism Sepolia
  84532,    // Base Sepolia
  300,      // zkSync Sepolia
  2442,     // Polygon zkEVM Cardona
  534351,   // Scroll Sepolia
  168587773,// Blast Sepolia
  59141,    // Linea Sepolia
  80002,    // Polygon Amoy
  43113,    // Avalanche Fuji
  11142220, // Celo Sepolia
  97
]);

export type PriceResult = { usd: number };

// 🔹 Batch fetch for multiple chainIds
export const fetchPricesByChainIds = async (
  chainIds: number[]
): Promise<Record<number, PriceResult>> => {
  const result: Record<number, PriceResult> = {};
  const coingeckoIds = new Set<string>();

  // Prepare: handle testnets and special chains
  for (const chainId of chainIds) {
    if (TESTNET_CHAIN_IDS.has(chainId)) {
      result[chainId] = { usd: 0 };
      continue;
    }



    const coingeckoId = CHAINID_TO_COINGECKO_ID[chainId];
    if (!coingeckoId) {
      result[chainId] = { usd: 0 };
      continue;
    }

    coingeckoIds.add(coingeckoId);
  }

  // 🔹 Fetch CoinGecko prices in **one request** to prevent 429
  if (coingeckoIds.size > 0) {
    try {
      const idsParam = Array.from(coingeckoIds).join(",");
      const res = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
        params: { ids: idsParam, vs_currencies: "usd" },
      });

      for (const chainId of chainIds) {
        const id = CHAINID_TO_COINGECKO_ID[chainId];
        if (id && res.data[id]?.usd !== undefined) {
          result[chainId] = { usd: res.data[id].usd };
        } else if (!result[chainId]) {
          if (chainId === 34) {
            try {
              const secureRes = await axios.get("https://price-api.securechain.ai/");
              result[chainId] = { usd: secureRes.data?.prices?.scai?.usd ?? 0 };
            } catch {
              result[chainId] = { usd: 0 };
            }
          } else {
            result[chainId] = { usd: 0 };
          }
        }
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        console.warn("CoinGecko rate limit hit! Returning $0 for all affected chains.");
      } else {
        console.warn("Error fetching CoinGecko prices:", err.message);
      }
      for (const chainId of chainIds) {
        if (!result[chainId]) result[chainId] = { usd: 0 };
      }
    }
  }

  return result;
};



// ═══════════════════════════════════════════════════════════
// NEW: Full Market Data + Chart Data (for Token Detail Screen)
// ═══════════════════════════════════════════════════════════

export interface CoinGeckoMarketData {
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  priceChangePercentage7d: number;
  priceChangePercentage30d: number;
  priceChangePercentage1y: number;
  marketCap: number;
  totalVolume: number;
  circulatingSupply: number;
  totalSupply: number;
  ath: number;
  athChangePercentage: number;
  atl: number;
  atlChangePercentage: number;
  lastUpdated: string;
}

export interface ChartDataPoint {
  timestamp: number;
  price: number;
}

export interface CoinGeckoChartData {
  prices: ChartDataPoint[];
}

/**
 * Fetch full market data from CoinGecko for a single coin
 * Uses /coins/{id} endpoint (not /simple/price)
 */
export const fetchCoinGeckoMarketData = async (
  chainId: number
): Promise<CoinGeckoMarketData | null> => {


  // Handle testnets
  if (TESTNET_CHAIN_IDS.has(chainId)) {
    return null;
  }

  const coingeckoId = CHAINID_TO_COINGECKO_ID[chainId];
  if (!coingeckoId) {
    return null;
  }

  try {
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${coingeckoId}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false,
      },
    });

    const md = res.data.market_data;
    if (!md) return null;

    return {
      price: md.current_price?.usd ?? 0,
      priceChange24h: md.price_change_24h ?? 0,
      priceChangePercentage24h: md.price_change_percentage_24h ?? 0,
      priceChangePercentage7d: md.price_change_percentage_7d ?? 0,
      priceChangePercentage30d: md.price_change_percentage_30d ?? 0,
      priceChangePercentage1y: md.price_change_percentage_1y ?? 0,
      marketCap: md.market_cap?.usd ?? 0,
      totalVolume: md.total_volume?.usd ?? 0,
      circulatingSupply: md.circulating_supply ?? 0,
      totalSupply: md.total_supply ?? 0,
      ath: md.ath?.usd ?? 0,
      athChangePercentage: md.ath_change_percentage?.usd ?? 0,
      atl: md.atl?.usd ?? 0,
      atlChangePercentage: md.atl_change_percentage?.usd ?? 0,
      lastUpdated: md.last_updated ?? new Date().toISOString(),
    };
  } catch (err: any) {
    if (err.response?.status === 429) {
      console.warn("CoinGecko rate limit hit for market data!");
    } else {
      console.warn("Error fetching CoinGecko market data:", err.message);
    }
    
    if (chainId === 34) {
      try {
        const secureRes = await axios.get("https://price-api.securechain.ai/");
        const price = secureRes.data?.prices?.scai?.usd ?? 0;
        return {
          price,
          priceChange24h: 0,
          priceChangePercentage24h: 0,
          priceChangePercentage7d: 0,
          priceChangePercentage30d: 0,
          priceChangePercentage1y: 0,
          marketCap: 0,
          totalVolume: 0,
          circulatingSupply: 0,
          totalSupply: 0,
          ath: price,
          athChangePercentage: 0,
          atl: price,
          atlChangePercentage: 0,
          lastUpdated: new Date().toISOString(),
        };
      } catch (fallbackErr) {
        console.warn("SecureChain fallback market data fetch failed:", fallbackErr);
      }
    }
    return null;
  }
};

/**
 * Fetch chart data (price history) from CoinGecko
 * Uses /coins/{id}/market_chart endpoint
 */
export const fetchCoinGeckoChartData = async (
  chainId: number,
  days: string = "1"
): Promise<CoinGeckoChartData | null> => {

  // Handle testnets
  if (TESTNET_CHAIN_IDS.has(chainId)) {
    return null;
  }

  const coingeckoId = CHAINID_TO_COINGECKO_ID[chainId];
  if (!coingeckoId) {
    return null;
  }

  try {
    const res = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart`,
      {
        params: {
          vs_currency: "usd",
          days,
        },
      }
    );

    const prices = res.data.prices;
    if (!Array.isArray(prices)) return null;

    return {
      prices: prices.map(([timestamp, price]: [number, number]) => ({
        timestamp,
        price,
      })),
    };
  } catch (err: any) {
    if (err.response?.status === 429) {
      console.warn("CoinGecko rate limit hit for chart data!");
    } else {
      console.warn("Error fetching CoinGecko chart data:", err.message);
    }
    return null;
  }
};

