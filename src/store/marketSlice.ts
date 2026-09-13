import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  marketApi,
  MarketOverview,
  MarketToken,
  ChartResponse,
  PaginatedTokensResponse,
} from '../api/marketApi';
import { GeneralStatus } from './types';

export interface MarketState {
  overview: MarketOverview | null;
  overviewStatus: GeneralStatus;
  tokens: MarketToken[];
  tokensStatus: GeneralStatus;
  selectedCategory: string;
  searchQuery: string;
  searchResults: MarketToken[];
  searchStatus: GeneralStatus;
  selectedChart: ChartResponse | null;
  chartStatus: GeneralStatus;
  currentPage: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  refreshing: boolean;
  lastUpdated: number | null;
  error: string | null;
}

const initialState: MarketState = {
  overview: null,
  overviewStatus: GeneralStatus.Idle,
  tokens: [],
  tokensStatus: GeneralStatus.Idle,
  selectedCategory: 'All',
  searchQuery: '',
  searchResults: [],
  searchStatus: GeneralStatus.Idle,
  selectedChart: null,
  chartStatus: GeneralStatus.Idle,
  currentPage: 1,
  hasMore: true,
  isLoadingMore: false,
  refreshing: false,
  lastUpdated: null,
  error: null,
};

// Async Thunks
export const fetchMarketOverview = createAsyncThunk(
  'market/fetchOverview',
  async (_, { rejectWithValue }) => {
    try {
      const data = await marketApi.getOverview();
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch market overview');
    }
  }
);

export const fetchMarketTokens = createAsyncThunk<
  { response: PaginatedTokensResponse; append: boolean; page: number },
  { page?: number; limit?: number; category?: string; append?: boolean } | undefined
>(
  'market/fetchTokens',
  async (args, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const category = args?.category || state.market?.selectedCategory || 'All';
      const page = args?.page || 1;
      const limit = args?.limit || 50;
      const append = !!args?.append;

      const response = await marketApi.getTokens(page, limit, category);
      return { response, append, page };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch market tokens');
    }
  }
);

export const fetchTokenChart = createAsyncThunk<
  ChartResponse,
  { coinId: string; period?: string }
>(
  'market/fetchTokenChart',
  async ({ coinId, period = '1w' }, { rejectWithValue }) => {
    try {
      const data = await marketApi.getTokenChart(coinId, period);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch token chart');
    }
  }
);

export const searchMarketTokens = createAsyncThunk<MarketToken[], string>(
  'market/searchTokens',
  async (query, { rejectWithValue }) => {
    try {
      if (!query || query.trim().length === 0) return [];
      const data = await marketApi.searchTokens(query);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to search tokens');
    }
  }
);

export const refreshMarketData = createAsyncThunk(
  'market/refreshAll',
  async (_, { dispatch, getState }) => {
    const state = getState() as any;
    const category = state.market?.selectedCategory || 'All';

    await Promise.allSettled([
      dispatch(fetchMarketOverview()),
      dispatch(fetchMarketTokens({ page: 1, limit: 50, category, append: false })),
    ]);
  }
);

export const marketSlice = createSlice({
  name: 'market',
  initialState,
  reducers: {
    setSelectedCategory: (state, action: PayloadAction<string>) => {
      state.selectedCategory = action.payload;
      state.currentPage = 1;
      state.tokens = [];
      state.hasMore = true;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      if (!action.payload.trim()) {
        state.searchResults = [];
        state.searchStatus = GeneralStatus.Idle;
      }
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchQuery = '';
      state.searchStatus = GeneralStatus.Idle;
    },
    clearSelectedChart: (state) => {
      state.selectedChart = null;
      state.chartStatus = GeneralStatus.Idle;
    },
  },
  extraReducers: (builder) => {
    // Overview
    builder
      .addCase(fetchMarketOverview.pending, (state) => {
        state.overviewStatus = GeneralStatus.Loading;
      })
      .addCase(fetchMarketOverview.fulfilled, (state, action) => {
        state.overviewStatus = GeneralStatus.Success;
        state.overview = action.payload;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchMarketOverview.rejected, (state, action) => {
        state.overviewStatus = GeneralStatus.Failed;
        state.error = action.payload as string;
      });

    // Tokens
    builder
      .addCase(fetchMarketTokens.pending, (state, action) => {
        if (action.meta.arg?.append) {
          state.isLoadingMore = true;
        } else {
          state.tokensStatus = GeneralStatus.Loading;
          state.isLoadingMore = false;
        }
      })
      .addCase(fetchMarketTokens.fulfilled, (state, action) => {
        state.tokensStatus = GeneralStatus.Success;
        state.isLoadingMore = false;
        const { response, append, page } = action.payload;

        if (append) {
          // De-duplicate any tokens by id
          const existingIds = new Set(state.tokens.map((t) => t.id));
          const newTokens = response.tokens.filter((t) => !existingIds.has(t.id));
          state.tokens = [...state.tokens, ...newTokens];
        } else {
          state.tokens = response.tokens;
        }

        state.currentPage = page;
        state.hasMore = response.meta.hasMore;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchMarketTokens.rejected, (state, action) => {
        state.tokensStatus = GeneralStatus.Failed;
        state.isLoadingMore = false;
        state.error = action.payload as string;
      });

    // Chart
    builder
      .addCase(fetchTokenChart.pending, (state) => {
        state.chartStatus = GeneralStatus.Loading;
      })
      .addCase(fetchTokenChart.fulfilled, (state, action) => {
        state.chartStatus = GeneralStatus.Success;
        state.selectedChart = action.payload;
      })
      .addCase(fetchTokenChart.rejected, (state, action) => {
        state.chartStatus = GeneralStatus.Failed;
        state.error = action.payload as string;
      });

    // Search
    builder
      .addCase(searchMarketTokens.pending, (state) => {
        state.searchStatus = GeneralStatus.Loading;
      })
      .addCase(searchMarketTokens.fulfilled, (state, action) => {
        state.searchStatus = GeneralStatus.Success;
        state.searchResults = action.payload;
      })
      .addCase(searchMarketTokens.rejected, (state, action) => {
        state.searchStatus = GeneralStatus.Failed;
        state.error = action.payload as string;
      });

    // Refresh
    builder
      .addCase(refreshMarketData.pending, (state) => {
        state.refreshing = true;
      })
      .addCase(refreshMarketData.fulfilled, (state) => {
        state.refreshing = false;
      })
      .addCase(refreshMarketData.rejected, (state) => {
        state.refreshing = false;
      });
  },
});

export const {
  setSelectedCategory,
  setSearchQuery,
  clearSearchResults,
  clearSelectedChart,
} = marketSlice.actions;

// Selectors
export const selectMarketOverview = (state: { market: MarketState }) => state.market.overview;
export const selectMarketOverviewStatus = (state: { market: MarketState }) => state.market.overviewStatus;
export const selectMarketTokens = (state: { market: MarketState }) => state.market.tokens;
export const selectMarketTokensStatus = (state: { market: MarketState }) => state.market.tokensStatus;
export const selectSelectedCategory = (state: { market: MarketState }) => state.market.selectedCategory;
export const selectSearchQuery = (state: { market: MarketState }) => state.market.searchQuery;
export const selectSearchResults = (state: { market: MarketState }) => state.market.searchResults;
export const selectSearchStatus = (state: { market: MarketState }) => state.market.searchStatus;
export const selectSelectedChart = (state: { market: MarketState }) => state.market.selectedChart;
export const selectChartStatus = (state: { market: MarketState }) => state.market.chartStatus;
export const selectIsRefreshing = (state: { market: MarketState }) => state.market.refreshing;
export const selectHasMoreTokens = (state: { market: MarketState }) => state.market.hasMore;
export const selectIsLoadingMore = (state: { market: MarketState }) => state.market.isLoadingMore;
export const selectCurrentPage = (state: { market: MarketState }) => state.market.currentPage;

export default marketSlice.reducer;
