# Solana Custom Token (SPL) Integration Guide

This guide details the complete architecture, implementation patterns, and exact code required to implement **Custom Solana SPL Token Imports** with real-time metadata (name, symbol, decimals, logo) and balance fetching on both **Mainnet** and **Devnet**.

---

## 🏗️ Architecture Overview

The system consists of three main layers that mirror EVM's custom ERC-20 token workflow:
1. **Service Layer (`solTokenService.ts`)**: Connects to the Solana network, parses public keys securely, fetches token balance, and resolves token metadata dynamically using **Jupiter Token API** (Primary Mainnet), **Helius Digital Asset System (DAS) API** (Devnet/Fallback), and direct on-chain **Parsed Account Info** as an ultimate fallback.
2. **Redux State Management (`solTokenSlice.ts`)**: Manages the list of tracked token mints per network, handles async thunks, and maintains dynamic balance records. It includes a race-condition-free AsyncStorage synchronization merge strategy and automatic string-to-object format migrations.
3. **UI Display & Import Screen (`[id].tsx`)**: Renders custom token cards with dynamic logos, symbols, and balances, matching premium ERC-20 style, and redirects to the Send screen. It includes a diagnostic utility panel and utilizes direct state selectors to bypass scoping TDZ bugs.

---

## 1. 🌐 The Service Layer (`solTokenService.ts`)

This layer parses token mints, derives the associated token address (ATA), queries balances, and fetches metadata.

```typescript
import { Connection, PublicKey } from "@solana/web3.js";

// Global connection state
let connection = new Connection("https://api.devnet.solana.com", "confirmed");

export function setSolTokenNetwork(network: "mainnet" | "devnet") {
  const rpcUrl = network === "mainnet"
    ? "https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY"
    : "https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY";
  connection = new Connection(rpcUrl, "confirmed");
}

/**
 * Resolves SPL Token Metadata (Name, Symbol, Decimals, Logo)
 */
export async function getSplTokenMetadata(
  mint: string,
  network: "mainnet" | "devnet"
): Promise<{ name: string; symbol: string; decimals: number; logo?: string }> {
  try {
    // Phase 1: Try Jupiter API (Fast, Free, Rich Mainnet Metadata)
    if (network === "mainnet") {
      try {
        const response = await fetch(`https://tokens.jup.ag/token/${mint}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.symbol) {
            return {
              name: data.name || data.symbol,
              symbol: data.symbol,
              decimals: data.decimals ?? 9,
              logo: data.logoURI || undefined,
            };
          }
        }
      } catch (err) {
        console.log("Jupiter API failed:", err);
      }
    }

    // Phase 2: Try Helius DAS (Digital Asset System) getAsset API (Supports Devnet/Token-2022/Token-2025)
    try {
      const currentRpc = network === "mainnet"
        ? "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
        : "https://devnet.helius-rpc.com/?api-key=YOUR_KEY";

      const res = await fetch(currentRpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "get-asset",
          method: "getAsset",
          params: { id: mint }
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.result) {
          const result = json.result;
          const tokenInfo = result.token_info;
          const metadata = result.content?.metadata;
          const links = result.content?.links;

          if (tokenInfo || metadata) {
            return {
              name: metadata?.name || tokenInfo?.symbol || "Unknown Token",
              symbol: metadata?.symbol || tokenInfo?.symbol || "SPL",
              decimals: tokenInfo?.decimals ?? 9,
              logo: links?.image || result.content?.files?.[0]?.uri || undefined,
            };
          }
        }
      }
    } catch (err) {
      console.log("Helius DAS failed:", err);
    }

    // Phase 3: Direct On-Chain parsed fallbacks for decimals
    try {
      const mintPubkey = new PublicKey(mint);
      const accountInfo = await connection.getParsedAccountInfo(mintPubkey);
      if (accountInfo?.value?.data) {
        const data = accountInfo.value.data as any;
        if (data.parsed?.info) {
          const decimals = data.parsed.info.decimals ?? 9;
          return {
            name: "Unknown Token",
            symbol: "SPL",
            decimals,
            logo: undefined,
          };
        }
      }
    } catch (err) {
      console.log("On-chain parsed fallback failed:", err);
    }

    return { name: "Unknown Token", symbol: "SPL", decimals: 9 };
  } catch (err) {
    return { name: "Unknown Token", symbol: "SPL", decimals: 9 };
  }
}

/**
 * Fetches ATA (Associated Token Account) Address and Balance
 */
export async function getSplTokenBalance(walletAddress: string, mintAddress: string) {
  try {
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(mintAddress);
    
    // Derive Associated Token Account Address
    const ata = await PublicKey.findProgramAddressSync(
      [wallet.toBuffer(), new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toBuffer(), mint.toBuffer()],
      new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
    )[0];

    try {
      const balanceRes = await connection.getTokenAccountBalance(ata);
      return {
        ata: ata.toBase58(),
        amount: balanceRes.value.uiAmount ?? 0,
        decimals: balanceRes.value.decimals,
      };
    } catch {
      // ATA account does not exist / has 0 balance
      return { ata: ata.toBase58(), amount: 0, decimals: 9 };
    }
  } catch (err) {
    console.error("getSplTokenBalance failed:", err);
    return null;
  }
}
```

---

## 2. 🎛️ Redux State Management (`solTokenSlice.ts`)

This slice maintains a lists of tracked token objects `{ mint, network }` per network. 

### 💡 Critical Defensive Strategy: Auto-Migration & Race Condition Resolution
1. **Hybrid Migration**: Reducers map any old format strings (e.g. `["EPjF..."]`) to structured objects `{ mint: string, network: string }` on the fly to avoid crashing when older persisted states load.
2. **Safe Thunk Merging**: Instead of overriding stored tokens, `loadSolTokens.fulfilled` merges loaded items defensively using a `.some` comparison to prevent race conditions during fast refreshes.

```typescript
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSplTokenMetadata, getSplTokenBalance, setSolTokenNetwork } from "../services/solTokenService";

export interface TrackedSolToken {
  mint: string;
  network: "mainnet" | "devnet";
}

export interface SolTokenBalance {
  mint: string;
  ata: string;
  amount: number;
  decimals: number;
  name: string;
  symbol: string;
  logo?: string;
}

interface SolTokenState {
  trackedTokens: TrackedSolToken[];
  balances: Record<string, SolTokenBalance>;
}

const STORAGE_KEY = "SOL_TRACKED_TOKENS_V1";
const initialState: SolTokenState = { trackedTokens: [], balances: {} };

const saveTokens = async (tokens: TrackedSolToken[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
};

export const loadSolTokens = createAsyncThunk<TrackedSolToken[]>("sol/loadTokens", async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  try {
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) {
      return parsed.map((t: any) => {
        if (typeof t === "string") return { mint: t, network: "mainnet" };
        return { mint: t.mint, network: t.network || "mainnet" };
      });
    }
    return [];
  } catch {
    return [];
  }
});

export const fetchSplTokenBalance = createAsyncThunk<
  SolTokenBalance,
  { mint: string; wallet: string }
>("sol/fetchSplBalance", async ({ mint, wallet }, thunkAPI) => {
  const state = thunkAPI.getState() as any;
  const network = state.solana?.selectedNetwork ?? "devnet";
  setSolTokenNetwork(network);

  try {
    const metadata = await getSplTokenMetadata(mint, network);
    const balanceData = await getSplTokenBalance(wallet, mint);

    return {
      mint,
      ata: balanceData?.ata ?? "",
      amount: balanceData?.amount ?? 0,
      decimals: metadata.decimals ?? balanceData?.decimals ?? 9,
      name: metadata.name || "Unknown Token",
      symbol: metadata.symbol || "SPL",
      logo: metadata.logo,
    };
  } catch (err) {
    return { mint, ata: "", amount: 0, decimals: 9, name: "Unknown Token", symbol: "SPL" };
  }
});

const solTokenSlice = createSlice({
  name: "sol",
  initialState,
  reducers: {
    addSolToken(state, action: PayloadAction<TrackedSolToken>) {
      const { mint, network } = action.payload;
      if (!state.trackedTokens) state.trackedTokens = [];

      // Auto-migrate strings to objects
      state.trackedTokens = state.trackedTokens.map((t: any) => 
        typeof t === "string" ? { mint: t, network: "mainnet" } : { mint: t.mint, network: t.network || "mainnet" }
      );

      const exists = state.trackedTokens.some(t => t.mint === mint && t.network === network);
      if (!exists) {
        state.trackedTokens.push({ mint, network });
        saveTokens(state.trackedTokens);
      }
    },
    removeToken(state, action: PayloadAction<TrackedSolToken>) {
      const { mint, network } = action.payload;
      if (!state.trackedTokens) state.trackedTokens = [];
      state.trackedTokens = state.trackedTokens
        .map((t: any) => typeof t === "string" ? { mint: t, network: "mainnet" } : t)
        .filter(t => !(t.mint === mint && t.network === network));
      saveTokens(state.trackedTokens);
    },
    clearSolTokens(state) {
      state.trackedTokens = [];
      state.balances = {};
      AsyncStorage.removeItem(STORAGE_KEY);
    }
  },
  extraReducers: builder => {
    builder
      .addCase(loadSolTokens.fulfilled, (state, action) => {
        const loaded = Array.isArray(action.payload) ? action.payload : [];
        if (!state.trackedTokens) state.trackedTokens = [];

        // Auto-migrate on mount
        state.trackedTokens = state.trackedTokens.map((t: any) => 
          typeof t === "string" ? { mint: t, network: "mainnet" } : t
        );

        loaded.forEach((item: any) => {
          const itemMint = typeof item === "string" ? item : item.mint;
          const itemNetwork = typeof item === "object" ? item.network : "mainnet";
          const exists = state.trackedTokens.some(t => t.mint === itemMint && t.network === itemNetwork);
          if (!exists) {
            state.trackedTokens.push({ mint: itemMint, network: itemNetwork });
          }
        });
      })
      .addCase(fetchSplTokenBalance.fulfilled, (state, action) => {
        if (!state.balances) state.balances = {};
        state.balances[action.payload.mint] = action.payload;
      });
  }
});

export const { addSolToken, removeToken, clearSolTokens } = solTokenSlice.actions;
export default solTokenSlice.reducer;
```

---

## 3. 🎨 UI Display & Integration Layer (`[id].tsx`)

This handles rendering the Solana Custom Token section, prompting forms, and mapping tokens in the list.

### ⚠️ Lexical Closure Order / Temporal Dead Zone (TDZ) Fix
Inside the component, `solTrackedTokens` selector references the active network. If `selectedSolanaNetwork` is declared *below* `solTrackedTokens`, the closure evaluates it as `undefined` at hook setup, which filters out all tokens on screen (`filteredCount: 0`). 
**To prevent this closure dependency issue, retrieve the active network directly inside the selector callback from state:**

```typescript
// ✅ Safe Selector - Queries active network directly from state to avoid TDZ closure bugs
const solTrackedTokens = useSelector(
  (state: RootState) => {
    const activeSolNetwork = state.solana.selectedNetwork ?? "devnet";
    return state.solToken.trackedTokens?.map((t: any) => {
      if (typeof t === "string") return { mint: t, network: "mainnet" as const };
      return { mint: t.mint, network: (t.network || "mainnet") as "mainnet" | "devnet" };
    }).filter((t) => t.network === activeSolNetwork) ?? EMPTY_ARRAY;
  },
  shallowEqual
);

const allTrackedTokens = useSelector(
  (state: RootState) =>
    state.solToken.trackedTokens?.map((t: any) => 
      typeof t === "string" ? { mint: t, network: "mainnet" as const } : t
    ) ?? EMPTY_ARRAY,
  shallowEqual
);

const solBalances = useSelector((state: RootState) => state.solToken.balances);
```

### Rendering custom cards under the "Token" Tab:
```tsx
{/* SPL Solana Tokens */}
{isSolana &&
  solTrackedTokens.map((t) => {
    const data = solBalances[t.mint];
    const title = data ? data.name : "Loading Token...";
    const symbol = data ? data.symbol : "SPL";
    const amount = data ? `${data.amount} ${data.symbol}` : "0.00 SPL";
    const logo = data ? data.logo : undefined;

    return (
      <CryptoInfoCard
        key={`sol-${t.mint}`}
        title={title}
        caption={data ? symbol : `Mint: ${t.mint.slice(0, 8)}...${t.mint.slice(-8)}`}
        details={amount}
        icon={<BlockchainIcon symbol={symbol} size={35} logoUrl={logo} />}
        onPress={() => {
          router.push({
            pathname: "token/send/send-options",
            params: {
              symbol,
              balance: data ? data.amount.toString() : "0",
              mintAddress: t.mint,
              decimals: data ? data.decimals : 9,
              tokenName: title,
              isSpl: "true"
            }
          });
        }}
      />
    );
  })
}
```

---

## 🧠 Key Development Pitfalls & Lessons Learned

1. **Closure Scoping / TDZ (Temporal Dead Zone)**:
   - *Pitfall*: If React hooks reference an outer scope variable that is declared *below* them, that variable is closed over as `undefined` at hook instantiation.
   - *Rule*: Always declare hook state or configure selectors to fetch independent values directly from the Redux state parameter (`state.solana.selectedNetwork`) instead of local closures to guarantee stability.

2. **Base58 Public Key Validation**:
   - *Pitfall*: Pasting Ethereum ERC-20 contract addresses (which are hex, like `0xdAC1...`) into Solana public key utilities will crash the Javascript engine with a fatal `Invalid public key input` base58 error.
   - *Rule*: Always execute validation wrapping inside try/catch blocks when creating `new PublicKey(input)` objects dynamically.

3. **Store Whitelist Refreshing**:
   - *Pitfall*: Modifying state structures inside slices or appending slices to `persistConfig` whitelists does not automatically clear the physical device's active AsyncStorage cache.
   - *Rule*: Always provide an on-screen diagnostic panel with a **"Reset Solana Tokens State"** purge dispatch (`dispatch(clearSolTokens())`) during development. This lets developers and users wipe any corrupted state arrays and refresh dynamically without requiring a full device wipe.
