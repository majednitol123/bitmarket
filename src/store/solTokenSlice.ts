import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSolBalance,
  getSplTokenBalance,
  getAllSplTokens,
  getWalletNFTs,
  sendSplToken,
  SplTokenAccount,
  setSolTokenNetwork,
  getSplTokenMetadata,
} from "../services/solTokenService";
import { Keypair } from "@solana/web3.js";

/* ---------------- TYPES ---------------- */

export interface TrackedSolToken {
  mint: string; 
  network: "mainnet" | "devnet";
}

export interface SolTokenMetadata {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  programId: string;
}

export interface SolTokenBalance {
  mint: string;
  ata: string;
  amount: number;
  decimals: number;
  name: string;
  symbol: string;
  logo?: string;
  programId?: string;
}

export interface SolTransferResult {
  signature: string;
}

export interface SolNFT {
  mint: string;
  name?: string;
  uri?: string;
  image?: string;
  imageUrl?: string;
}

interface SolTokenState {
  trackedTokens: TrackedSolToken[];
  balances: Record<string, SolTokenBalance>;
  metadataCache: Record<string, SolTokenMetadata>;
  allTokens: SplTokenAccount[];
  allNfts: SolNFT[];
  solBalance?: {
    lamports: number;
    sol: number;
  };
}

/* ---------------- STORAGE KEYS ---------------- */

const STORAGE_KEY = "SOL_TRACKED_TOKENS_V2";
const METADATA_CACHE_KEY = "SOL_METADATA_CACHE_V2";

/* ---------------- INITIAL STATE ---------------- */

const initialState: SolTokenState = {
  trackedTokens: [],
  balances: {},
  metadataCache: {},
  allTokens: [],
  allNfts: [],
};

/* ---------------- STORAGE HELPERS ---------------- */

const saveTokens = async (tokens: TrackedSolToken[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
};

const saveMetadataCache = async (cache: Record<string, SolTokenMetadata>) => {
  await AsyncStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(cache));
};

/* ---------------- LOAD TOKENS ---------------- */

export const loadSolTokens = createAsyncThunk<{
  trackedTokens: TrackedSolToken[];
  metadataCache: Record<string, SolTokenMetadata>;
}>(
  "sol/loadTokens",
  async () => {
    const [storedTokens, storedCache] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(METADATA_CACHE_KEY),
    ]);
    
    let trackedTokens: TrackedSolToken[] = [];
    let metadataCache: Record<string, SolTokenMetadata> = {};
    
    try {
      const parsedTokens = storedTokens ? JSON.parse(storedTokens) : [];
      if (Array.isArray(parsedTokens)) {
        trackedTokens = parsedTokens.map((t: any) => {
          if (typeof t === "string") return { mint: t, network: "mainnet" };
          return { mint: t.mint, network: t.network || "mainnet" };
        });
      }
    } catch (e) {
      if (__DEV__) console.log("Failed to load tracked Solana tokens:", e);
    }
    
    try {
      metadataCache = storedCache ? JSON.parse(storedCache) : {};
    } catch (e) {
      if (__DEV__) console.log("Failed to load metadata cache:", e);
    }
    
    return { trackedTokens, metadataCache };
  }
);

/* ---------------- THUNKS ---------------- */

/* SOL balance */
export const fetchSolBalance = createAsyncThunk(
  "sol/fetchSolBalance",
  async ({ wallet }: { wallet: string }, thunkAPI) => {
    const state = thunkAPI.getState() as any;
    setSolTokenNetwork(state.solana?.selectedNetwork ?? "devnet");
    return await getSolBalance(wallet);
  }
);

/* Single SPL token balance with Metadata Cache */
export const fetchSplTokenBalance = createAsyncThunk<
  SolTokenBalance,
  { mint: string; wallet: string }
>("sol/fetchSplBalance", async ({ mint, wallet }, thunkAPI) => {
  const state = thunkAPI.getState() as any;
  const network = state.solana?.selectedNetwork ?? "devnet";
  setSolTokenNetwork(network);

  try {
    const cachedMetadata = state.solToken?.metadataCache?.[mint];
    if (cachedMetadata) {
      // LOW-LATENCY PATH
      try {
        const balanceData = await getSplTokenBalance(wallet, mint, cachedMetadata.programId);
        return {
          mint,
          ata: balanceData?.ata || "",
          amount: balanceData?.amount || 0,
          decimals: cachedMetadata.decimals,
          name: cachedMetadata.name,
          symbol: cachedMetadata.symbol,
          logo: cachedMetadata.logo,
          programId: cachedMetadata.programId,
        };
      } catch (e) {
        if (__DEV__) console.log("Balance fetch failed inside thunk:", e);
        return {
          mint,
          ata: "",
          amount: 0,
          decimals: cachedMetadata.decimals,
          name: cachedMetadata.name,
          symbol: cachedMetadata.symbol,
          logo: cachedMetadata.logo,
          programId: cachedMetadata.programId,
        };
      }
    }

    // FULL PATH (OPTIMIZED SEQUENCE)
    let metadata: any = { decimals: 9, name: "Unknown Token", symbol: "SPL", programId: "" };
    let balanceData: any = { ata: "", amount: 0, decimals: 9 };

    try {
      // Fetch metadata first to resolve the program ID owner
      const resolvedMetadata = await getSplTokenMetadata(mint, network).catch(err => {
        if (__DEV__) console.log("Metadata fetch failed inside thunk:", err);
        return { decimals: 9, name: "Unknown Token", symbol: "SPL", programId: "" };
      });
      metadata = resolvedMetadata;

      // Query balance using resolved programId directly (0 extra RPC calls to resolve owner!)
      const resolvedBalance = await getSplTokenBalance(wallet, mint, resolvedMetadata.programId).catch(err => {
        if (__DEV__) console.log("Balance fetch failed inside thunk:", err);
        return { ata: "", amount: 0, decimals: 9 };
      });
      balanceData = resolvedBalance;
    } catch (e) {
      if (__DEV__) console.log("Fetch chain failed in thunk:", e);
    }

    return {
      mint,
      ata: balanceData.ata || "",
      amount: balanceData.amount || 0,
      decimals: metadata.decimals ?? balanceData.decimals ?? 9,
      name: metadata.name || "Unknown Token",
      symbol: metadata.symbol || "SPL",
      logo: metadata.logo,
      programId: metadata.programId,
    };
  } catch (err) {
    if (__DEV__) console.log("fetchSplTokenBalance critical failure:", err);
    return {
      mint,
      ata: "",
      amount: 0,
      decimals: 9,
      name: "Unknown Token",
      symbol: "SPL",
    };
  }
});

/* All SPL tokens */
export const fetchAllSplTokens = createAsyncThunk<
  SplTokenAccount[],
  { wallet: string }
>("sol/fetchAllSplTokens", async ({ wallet }, thunkAPI) => {
  const state = thunkAPI.getState() as any;
  setSolTokenNetwork(state.solana?.selectedNetwork ?? "devnet");
  return await getAllSplTokens(wallet);
});

/* NFTs */
export const fetchSolNfts = createAsyncThunk<
  SolNFT[],
  { wallet: string }
>("sol/fetchNfts", async ({ wallet }, thunkAPI) => {
  const state = thunkAPI.getState() as any;
  setSolTokenNetwork(state.solana?.selectedNetwork ?? "devnet");
  const nfts = await getWalletNFTs(wallet);
  return nfts;
});

/* Send SPL token */
export const sendSolToken = createAsyncThunk<
  SolTransferResult,
  {
    mint: string;
    to: string;
    amount: number;
    decimals: number;
    secretKey: Uint8Array;
  }
>("sol/sendToken", async ({ mint, to, amount, decimals, secretKey }, thunkAPI) => {
  const state = thunkAPI.getState() as any;
  setSolTokenNetwork(state.solana?.selectedNetwork ?? "devnet");
  const keypair = Keypair.fromSecretKey(secretKey);

  return await sendSplToken({
    mint,
    fromKeypair: keypair,
    toAddress: to,
    amount,
    decimals,
  });
});

/* ---------------- SLICE ---------------- */

const solTokenSlice = createSlice({
  name: "sol",
  initialState,
  reducers: {
    addSolToken(state, action: PayloadAction<TrackedSolToken>) {
      const { mint, network } = action.payload;
      if (!state.trackedTokens) state.trackedTokens = [];

      const exists = state.trackedTokens.some(
        t => t.mint === mint && t.network === network
      );

      if (!exists) {
        state.trackedTokens.push({ mint, network });
        saveTokens(state.trackedTokens);
      }
    },

    removeToken(state, action: PayloadAction<TrackedSolToken>) {
      const { mint, network } = action.payload;
      if (!state.trackedTokens) state.trackedTokens = [];
      state.trackedTokens = state.trackedTokens.filter(
        t => !(t.mint === mint && t.network === network)
      );
      saveTokens(state.trackedTokens);
    },

    clearSolTokens(state) {
      state.trackedTokens = [];
      state.balances = {};
      state.metadataCache = {};
      saveTokens([]);
      saveMetadataCache({});
    }
  },

  extraReducers: builder => {
    builder
      /* load tracked tokens */
      .addCase(loadSolTokens.fulfilled, (state, action) => {
        state.trackedTokens = action.payload.trackedTokens || [];
        state.metadataCache = action.payload.metadataCache || {};
      })

      /* SOL balance */
      .addCase(fetchSolBalance.fulfilled, (state, action) => {
        state.solBalance = action.payload;
      })

      /* single SPL token */
      .addCase(fetchSplTokenBalance.fulfilled, (state, action) => {
        const key = action.payload.mint;
        state.balances[key] = action.payload;

        // Auto-cache metadata if not present or missing programId
        if (!state.metadataCache[key] || !state.metadataCache[key].programId) {
          state.metadataCache[key] = {
            mint: key,
            name: action.payload.name,
            symbol: action.payload.symbol,
            decimals: action.payload.decimals,
            logo: action.payload.logo,
            programId: action.payload.programId || state.metadataCache[key]?.programId || "",
          };
          saveMetadataCache(state.metadataCache);
        }
      })

      /* all SPL tokens */
      .addCase(fetchAllSplTokens.fulfilled, (state, action) => {
        state.allTokens = action.payload;
      })

      /* NFTs */
      .addCase(fetchSolNfts.fulfilled, (state, action) => {
        state.allNfts = action.payload;
      });
  },
});

/* ---------------- EXPORTS ---------------- */

export const { addSolToken, removeToken, clearSolTokens } = solTokenSlice.actions;
export default solTokenSlice.reducer;
