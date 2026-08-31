import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";


import { FETCH_PRICES_INTERVAL } from "../constants/price";
import { GeneralStatus } from "./types";
import { 
  fetchPricesByChainIds,
  fetchCoinGeckoMarketData,
  fetchCoinGeckoChartData,
  TESTNET_CHAIN_IDS,
  type CoinGeckoMarketData,
  type CoinGeckoChartData,
} from "../utils/fetchCryptoPrices";

export const loadPriceCache = createAsyncThunk(
  "price/loadCache",
  async () => {
    try {
      const stored = await AsyncStorage.getItem("priceCache");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
);

// 🔹 Fetch multiple prices efficiently (batching)
export const fetchPrices = createAsyncThunk<
  { chainId: number; price: number }[],
  number[],
  { state: any }
>("price/fetchPrices", async (chainIds, { getState }) => {
  const { lastUpdated, data } = getState().price;
  const currentTime = Date.now();

  const isCacheFresh = currentTime - lastUpdated < FETCH_PRICES_INTERVAL;

  // Determine which chainIds actually need a fresh fetch
  const idsToFetch = isCacheFresh
    ? chainIds.filter((chainId) => !data[chainId])
    : chainIds;

  // Fetch new prices in batch
  const fetchedPrices = idsToFetch.length
    ? await fetchPricesByChainIds(idsToFetch)
    : {};

  // Merge cached and fetched prices
  const finalResults: { chainId: number; price: number }[] = [];
  for (const chainId of chainIds) {
    // Testnets always return $0 regardless of cache
    if (TESTNET_CHAIN_IDS.has(chainId)) {
      finalResults.push({ chainId, price: 0 });
      continue;
    }
    const usd =
      (isCacheFresh ? data[chainId]?.usd : undefined) ?? fetchedPrices[chainId]?.usd ?? 0;
    finalResults.push({ chainId, price: usd });
  }

  return finalResults;
});

export interface PriceState {
  data: Record<number, { usd: number }>; // chainId → price
  marketData: Record<number, CoinGeckoMarketData>; // chainId → full market data
  chartData: Record<string, CoinGeckoChartData>; // key: "chainId:days"
  lastUpdated: number;
  marketDataLastUpdated: Record<number, number>; // chainId → timestamp
  chartDataLastUpdated: Record<string, number>; // key → timestamp
  status: GeneralStatus;
  marketDataStatus: GeneralStatus;
  chartDataStatus: GeneralStatus;
}

const initialState: PriceState = {
  data: {},
  marketData: {},
  chartData: {},
  lastUpdated: 0,
  marketDataLastUpdated: {},
  chartDataLastUpdated: {},
  status: GeneralStatus.Idle,
  marketDataStatus: GeneralStatus.Idle,
  chartDataStatus: GeneralStatus.Idle,
};


// ═══════════════════════════════════════════════════════════
// NEW: Fetch full market data for token detail
// ═══════════════════════════════════════════════════════════

// Cache TTLs: Market Price (simple) = 5 min, Market Data/Chart = 12 hours
const MARKET_DATA_CACHE_TTL = 0.5 * 24 * 60 * 60 * 1000; // 12 hours
const CHART_CACHE_TTL = 0.5 * 24 * 60 * 60 * 1000; // 12 hours

export const fetchMarketData = createAsyncThunk<
  { chainId: number; data: CoinGeckoMarketData },
  number,
  { state: any }
>("price/fetchMarketData", async (chainId, { getState }) => {
  const state = getState().price as PriceState;
  const cached = state.marketData[chainId];
  const lastUpdated = state.marketDataLastUpdated[chainId] ?? 0;
  
  if (__DEV__) console.log(`[fetchMarketData] chainId=${chainId}, cached=${!!cached}, age=${Date.now() - lastUpdated}ms`);
  
  // Return cached data if fresh (3 days)
  if (cached && Date.now() - lastUpdated < MARKET_DATA_CACHE_TTL) {
    if (__DEV__) console.log(`[fetchMarketData] Using cached data for chainId=${chainId}`);
    return { chainId, data: cached };
  }
  
  if (__DEV__) console.log(`[fetchMarketData] Fetching from CoinGecko for chainId=${chainId}`);
  const data = await fetchCoinGeckoMarketData(chainId);
  if (__DEV__) console.log(`[fetchMarketData] Result for chainId=${chainId}:`, data ? `price=${data.price}, marketCap=${data.marketCap}` : 'NULL');
  
  if (!data) {
    throw new Error(`Failed to fetch market data for chainId ${chainId}`);
  }
  
  return { chainId, data };
});

export const fetchChartData = createAsyncThunk<
  { key: string; data: CoinGeckoChartData },
  { chainId: number; days: string },
  { state: any }
>("price/fetchChartData", async ({ chainId, days }, { getState }) => {
  const key = `${chainId}:${days}`;
  const state = getState().price as PriceState;
  const cached = state.chartData[key];
  const lastUpdated = state.chartDataLastUpdated[key] ?? 0;
  
  if (__DEV__) console.log(`[fetchChartData] key=${key}, cached=${!!cached}, age=${Date.now() - lastUpdated}ms`);
  
  // Return cached data if fresh (3 days)
  if (cached && Date.now() - lastUpdated < CHART_CACHE_TTL) {
    if (__DEV__) console.log(`[fetchChartData] Using cached data for key=${key}`);
    return { key, data: cached };
  }
  
  if (__DEV__) console.log(`[fetchChartData] Fetching from CoinGecko for key=${key}`);
  const data = await fetchCoinGeckoChartData(chainId, days);
  if (__DEV__) console.log(`[fetchChartData] Result for key=${key}:`, data ? `points=${data.prices.length}` : 'NULL');
  
  if (!data) {
    throw new Error(`Failed to fetch chart data for chainId ${chainId}`);
  }
  
  return { key, data };
});

const priceSlice = createSlice({
  name: "prices",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Fetch prices (simple, multiple)
    builder.addCase(fetchPrices.pending, (state) => {
      state.status = GeneralStatus.Loading;
    });
    builder.addCase(
      fetchPrices.fulfilled,
      (state, action: PayloadAction<{ chainId: number; price: number }[]>) => {
        for (const item of action.payload) {
          state.data[item.chainId] = { usd: item.price };
        }
        state.lastUpdated = Date.now();
        state.status = GeneralStatus.Success;
      }
    );
    builder.addCase(fetchPrices.rejected, (state) => {
      state.status = GeneralStatus.Failed;
    });

    // Fetch market data (full stats)
    builder.addCase(fetchMarketData.pending, (state) => {
      state.marketDataStatus = GeneralStatus.Loading;
    });
    builder.addCase(fetchMarketData.fulfilled, (state, action) => {
      state.marketDataStatus = GeneralStatus.Success;
      const { chainId, data } = action.payload;
      state.marketData[chainId] = data;
      state.marketDataLastUpdated[chainId] = Date.now();
      if (__DEV__) console.log(`[Redux] Market data stored for chainId=${chainId}`);
    });
    builder.addCase(fetchMarketData.rejected, (state) => {
      state.marketDataStatus = GeneralStatus.Failed;
      if (__DEV__) console.log(`[Redux] Market data fetch FAILED`);
    });

    // Fetch chart data
    builder.addCase(fetchChartData.pending, (state) => {
      state.chartDataStatus = GeneralStatus.Loading;
    });
    builder.addCase(fetchChartData.fulfilled, (state, action) => {
      state.chartDataStatus = GeneralStatus.Success;
      const { key, data } = action.payload;
      state.chartData[key] = data;
      state.chartDataLastUpdated[key] = Date.now();
      if (__DEV__) console.log(`[Redux] Chart data stored for key=${key}`);
    });
    builder.addCase(fetchChartData.rejected, (state) => {
      state.chartDataStatus = GeneralStatus.Failed;
      if (__DEV__) console.log(`[Redux] Chart data fetch FAILED`);
    });
    builder.addCase(loadPriceCache.fulfilled, (state, action) => {
      state.data = action.payload;
      state.lastUpdated = Date.now();
    });
  },
});

export default priceSlice.reducer;
