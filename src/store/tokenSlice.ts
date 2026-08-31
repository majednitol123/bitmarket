import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { evmServices } from "../services/EthereumService";
import { INFT } from "../services/helper";



export interface TrackedToken {
  chainId: number;
  token: string;
}

interface TokenBalance {
  chainId: number;
  token: string;
  name: string;
  symbol: string;
  balance: string;
}

interface ERC20State {
  trackedTokens: TrackedToken[];
  balances: Record<string, TokenBalance>;
  transfers: Record<string, any[]>;
  allNfts: INFT[];
}

const initialState: ERC20State = {
  trackedTokens: [],
  balances: {},
  transfers: {},
  allNfts: [],
};

/* -------------------- thunks -------------------- */

export const fetchTokenErc20Balance = createAsyncThunk<
  TokenBalance,
  { chainId: number; token: string; wallet: string }
>("erc20/fetchBalance", async ({ chainId, token, wallet }) => {
  const service = evmServices[chainId];
  if (!service) throw new Error("EVM service not initialized");
  if (__DEV__) console.log("chainId, token, wallet",chainId, token, wallet)
  const data = await service.getTokenBalance(chainId, token, wallet);
if (__DEV__) console.log("data",data)
  return data 
  
});

export const fetchTrackedTokenBalances = createAsyncThunk<
  TokenBalance[],
  { chainId: number; tokens: TrackedToken[]; wallet: string }
>("erc20/fetchTrackedBalances", async ({ chainId, tokens, wallet }) => {
  const service = evmServices[chainId];
  if (!service) throw new Error("EVM service not initialized");
  const tokenAddresses = tokens.map(t => t.token);
  return await service.getErc20DataBatch(tokenAddresses, wallet);
});
export const fetchNfts = createAsyncThunk<
  INFT[],
  { chainId: number; wallet: string }
>("token/fetchNfts", async ({ chainId, wallet }) => {
  const service = evmServices[chainId];
  if (!service) throw new Error("EVM service not initialized");

  return await service.fetchAllNFTs(wallet, chainId);
});
export const fetchTokenTransfers = createAsyncThunk<
  any[],
  { chainId: number; token: string; wallet: string }
>("erc20/fetchTransfers", async ({ chainId, token, wallet }) => {
  const service = evmServices[chainId];
  if (!service) throw new Error("EVM service not initialized");

  // token = contractAddress
  return await service.getTransfers(token, wallet);
});

export const sendErc20 = createAsyncThunk<
  string,
  {
    chainId: number;
    token: string;
    privateKey: string;
    to: string;
    amount: string;
  }
>("erc20/send", async ({ chainId, token, privateKey, to, amount }) => {
  const service = evmServices[chainId];
  if (!service) throw new Error("EVM service not initialized");

  return await service.sendToken(token, privateKey, to, amount);
});

/* -------------------- slice -------------------- */

const erc20Slice = createSlice({
  name: "erc20",
  initialState,
  reducers: {
    addToken(state, action: PayloadAction<TrackedToken>) {
  const token = action.payload.token.toLowerCase();

  const exists = state.trackedTokens.some(
    t => t.chainId === action.payload.chainId && t.token === token
  );

  if (!exists) {
    state.trackedTokens.push({
      chainId: action.payload.chainId,
      token,
    });
  }
}
,

    removeToken(state, action: PayloadAction<TrackedToken>) {
      state.trackedTokens = state.trackedTokens.filter(
        t =>
          t.chainId !== action.payload.chainId ||
          t.token.toLowerCase() !== action.payload.token.toLowerCase()
      );
    },
  },

  extraReducers: builder => {
    builder

      .addCase(fetchTokenErc20Balance.fulfilled, (state, action) => {
        const token = action.payload.token.toLowerCase();
        const key = `${action.payload.chainId}:${token}`;
        state.balances[key] = {
          ...action.payload,
          token,
        };
      })
      .addCase(fetchTrackedTokenBalances.fulfilled, (state, action) => {
        action.payload.forEach((tb) => {
          const token = tb.token.toLowerCase();
          const key = `${tb.chainId}:${token}`;
          state.balances[key] = {
            ...tb,
            token,
          };
        });
      }).addCase(fetchTokenTransfers.fulfilled, (state, action) => {
        const { chainId, token } = action.meta.arg;
        const key = `${chainId}:${token.toLowerCase()}`;

        state.transfers[key] = action.payload;
      }).addCase(fetchNfts.fulfilled, (state, action) => {
        state.allNfts = action.payload;
      });

  },
});

export const { addToken, removeToken } = erc20Slice.actions;
export default erc20Slice.reducer;
