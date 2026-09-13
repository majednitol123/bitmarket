import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  portfolioApi,
  PortfolioHolding,
  PortfolioSummary,
  PortfolioTransaction,
  PortfolioChartData,
  DeFiPosition,
  SwapTransactionRecord,
  NormalizedPortfolioResponse,
} from '../api/portfolioApi';
import { getCoinStatsBlockchain } from '../utils/chainMapping';

export interface PortfolioState {
  summary: PortfolioSummary | null;
  holdings: PortfolioHolding[];
  chartsByRange: Record<string, PortfolioChartData>;
  transactions: {
    items: PortfolioTransaction[];
    page: number;
    hasMore: boolean;
  };
  defi: DeFiPosition[];
  swapHistory: {
    items: SwapTransactionRecord[];
    page: number;
    hasMore: boolean;
  };
  selectedTimeframe: string;
  selectedChain: string;
  walletAddress: string | null;

  // Statuses
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  chartStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  transactionsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  historyStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  refreshing: boolean;
  error: string | null;
}

const initialState: PortfolioState = {
  summary: null,
  holdings: [],
  chartsByRange: {},
  transactions: {
    items: [],
    page: 1,
    hasMore: false,
  },
  defi: [],
  swapHistory: {
    items: [],
    page: 1,
    hasMore: false,
  },
  selectedTimeframe: '1D',
  selectedChain: '1',
  walletAddress: null,

  status: 'idle',
  chartStatus: 'idle',
  transactionsStatus: 'idle',
  historyStatus: 'idle',
  refreshing: false,
  error: null,
};

// ─── Async Thunks ───

export const fetchPortfolio = createAsyncThunk<
  NormalizedPortfolioResponse,
  { chain: string; address: string },
  { rejectValue: string }
>('portfolio/fetchPortfolio', async ({ chain, address }, { rejectWithValue }) => {
  try {
    const blockchain = getCoinStatsBlockchain(chain);
    return await portfolioApi.getPortfolio(blockchain, address);
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message || 'Failed to fetch portfolio';
    return rejectWithValue(msg);
  }
});

export const fetchPortfolioChart = createAsyncThunk<
  { range: string; data: PortfolioChartData },
  { chain: string; address: string; range: string },
  { rejectValue: string }
>('portfolio/fetchPortfolioChart', async ({ chain, address, range }, { rejectWithValue }) => {
  try {
    const blockchain = getCoinStatsBlockchain(chain);
    const data = await portfolioApi.getChart(blockchain, address, range);
    return { range: range.toUpperCase(), data };
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message || 'Failed to fetch chart';
    return rejectWithValue(msg);
  }
});

export const fetchPortfolioTransactions = createAsyncThunk<
  { transactions: PortfolioTransaction[]; meta: { page: number; limit: number; hasMore: boolean } },
  { chain: string; address: string; page?: number; limit?: number },
  { rejectValue: string }
>(
  'portfolio/fetchPortfolioTransactions',
  async ({ chain, address, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const blockchain = getCoinStatsBlockchain(chain);
      return await portfolioApi.getTransactions(blockchain, address, page, limit);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to fetch transactions';
      return rejectWithValue(msg);
    }
  }
);

export const fetchSwapHistory = createAsyncThunk<
  { items: SwapTransactionRecord[]; meta: { page: number; limit: number; hasMore: boolean } },
  { chain: string; address: string; page?: number; limit?: number },
  { rejectValue: string }
>(
  'portfolio/fetchSwapHistory',
  async ({ chain, address, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const blockchain = getCoinStatsBlockchain(chain);
      return await portfolioApi.getSwapHistory(blockchain, address, page, limit);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to fetch swap history';
      return rejectWithValue(msg);
    }
  }
);

export const refreshPortfolio = createAsyncThunk<
  NormalizedPortfolioResponse,
  { chain: string; address: string },
  { rejectValue: string }
>('portfolio/refreshPortfolio', async ({ chain, address }, { rejectWithValue }) => {
  try {
    const blockchain = getCoinStatsBlockchain(chain);
    return await portfolioApi.refreshPortfolio(blockchain, address);
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message || 'Failed to refresh portfolio';
    return rejectWithValue(msg);
  }
});

// ─── Slice ───

export const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    setSelectedTimeframe(state, action: PayloadAction<string>) {
      state.selectedTimeframe = action.payload;
    },
    setSelectedChain(state, action: PayloadAction<string>) {
      state.selectedChain = action.payload;
    },
    setWalletAddress(state, action: PayloadAction<string | null>) {
      state.walletAddress = action.payload;
    },
    clearPortfolioData(state) {
      state.summary = null;
      state.holdings = [];
      state.chartsByRange = {};
      state.transactions = { items: [], page: 1, hasMore: false };
      state.defi = [];
      state.swapHistory = { items: [], page: 1, hasMore: false };
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchPortfolio
    builder
      .addCase(fetchPortfolio.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPortfolio.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.summary = action.payload.summary;
        state.holdings = action.payload.holdings;
        state.defi = action.payload.defi || [];
        state.walletAddress = action.payload.wallet.address;
      })
      .addCase(fetchPortfolio.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch portfolio';
      });

    // fetchPortfolioChart
    builder
      .addCase(fetchPortfolioChart.pending, (state) => {
        state.chartStatus = 'loading';
      })
      .addCase(fetchPortfolioChart.fulfilled, (state, action) => {
        state.chartStatus = 'succeeded';
        state.chartsByRange[action.payload.range] = action.payload.data;
      })
      .addCase(fetchPortfolioChart.rejected, (state) => {
        state.chartStatus = 'failed';
      });

    // fetchPortfolioTransactions
    builder
      .addCase(fetchPortfolioTransactions.pending, (state) => {
        state.transactionsStatus = 'loading';
      })
      .addCase(fetchPortfolioTransactions.fulfilled, (state, action) => {
        state.transactionsStatus = 'succeeded';
        const { transactions, meta } = action.payload;
        if (meta.page === 1) {
          state.transactions.items = transactions;
        } else {
          state.transactions.items = [...state.transactions.items, ...transactions];
        }
        state.transactions.page = meta.page;
        state.transactions.hasMore = meta.hasMore;
      })
      .addCase(fetchPortfolioTransactions.rejected, (state) => {
        state.transactionsStatus = 'failed';
      });

    // fetchSwapHistory
    builder
      .addCase(fetchSwapHistory.pending, (state) => {
        state.historyStatus = 'loading';
      })
      .addCase(fetchSwapHistory.fulfilled, (state, action) => {
        state.historyStatus = 'succeeded';
        const { items, meta } = action.payload;
        if (meta.page === 1) {
          state.swapHistory.items = items;
        } else {
          state.swapHistory.items = [...state.swapHistory.items, ...items];
        }
        state.swapHistory.page = meta.page;
        state.swapHistory.hasMore = meta.hasMore;
      })
      .addCase(fetchSwapHistory.rejected, (state) => {
        state.historyStatus = 'failed';
      });

    // refreshPortfolio
    builder
      .addCase(refreshPortfolio.pending, (state) => {
        state.refreshing = true;
      })
      .addCase(refreshPortfolio.fulfilled, (state, action) => {
        state.refreshing = false;
        state.summary = action.payload.summary;
        state.holdings = action.payload.holdings;
        state.defi = action.payload.defi || [];
        state.status = 'succeeded';
      })
      .addCase(refreshPortfolio.rejected, (state) => {
        state.refreshing = false;
      });
  },
});

export const {
  setSelectedTimeframe,
  setSelectedChain,
  setWalletAddress,
  clearPortfolioData,
} = portfolioSlice.actions;

// ─── Selectors ───

export const selectPortfolioSummary = (state: { portfolio: PortfolioState }) =>
  state.portfolio.summary;

export const selectPortfolioHoldings = (state: { portfolio: PortfolioState }) =>
  state.portfolio.holdings;

export const selectPortfolioChartData = (timeframe: string) => (state: { portfolio: PortfolioState }) =>
  state.portfolio.chartsByRange[timeframe.toUpperCase()] || null;

export const selectPortfolioTransactions = (state: { portfolio: PortfolioState }) =>
  state.portfolio.transactions;

export const selectSwapHistory = (state: { portfolio: PortfolioState }) =>
  state.portfolio.swapHistory;

export const selectPortfolioDefi = (state: { portfolio: PortfolioState }) =>
  state.portfolio.defi;

export const selectPortfolioStatus = (state: { portfolio: PortfolioState }) =>
  state.portfolio.status;

export const selectPortfolioRefreshing = (state: { portfolio: PortfolioState }) =>
  state.portfolio.refreshing;

export const selectPortfolioSelectedTimeframe = (state: { portfolio: PortfolioState }) =>
  state.portfolio.selectedTimeframe;

export const selectPortfolioSelectedChain = (state: { portfolio: PortfolioState }) =>
  state.portfolio.selectedChain;

export const selectPortfolioError = (state: { portfolio: PortfolioState }) =>
  state.portfolio.error;

export default portfolioSlice.reducer;
