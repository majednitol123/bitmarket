jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("alchemy-sdk", () => ({
  Alchemy: jest.fn(),
  Network: {},
}));

jest.mock("@solana/web3.js", () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn().mockImplementation((val) => ({
    toBase58: () => val,
    toBuffer: () => Buffer.from(val),
  })),
  Keypair: {
    generate: jest.fn(),
    fromSecretKey: jest.fn(),
  },
  SystemProgram: {
    programId: "11111111111111111111111111111111",
  },
  LAMPORTS_PER_SOL: 1000000000,
}));

jest.mock("../services/EthereumService", () => {
  return {
    evmServices: {
      1: {
        getBalance: jest.fn().mockResolvedValue(100n),
      },
    },
    registerEvmService: jest.fn(),
    getEvmService: jest.fn().mockReturnValue({
      createWalletByIndex: jest.fn().mockResolvedValue({
        address: "0x111",
        publicKey: "0x111",
        derivationPath: "m/44'/60'/0'/0/0",
      }),
    }),
    EVMService: jest.fn().mockImplementation(() => ({
      createWallet: jest.fn().mockResolvedValue({
        address: "0x111",
        publicKey: "0x111",
        mnemonic: { phrase: "phrase" },
      }),
    })),
  };
});

// Mock solTokenService to trace metadata fetch calls
const mockGetSplTokenMetadata = jest.fn();
const mockGetSplTokenBalance = jest.fn();

jest.mock("../services/solTokenService", () => ({
  __esModule: true,
  getSolBalance: jest.fn(),
  getSplTokenBalance: (wallet: string, mint: string) => mockGetSplTokenBalance(wallet, mint),
  getAllSplTokens: jest.fn(),
  getWalletNFTs: jest.fn(),
  sendSplToken: jest.fn(),
  setSolTokenNetwork: jest.fn(),
  getSplTokenMetadata: (mint: string, network: string) => mockGetSplTokenMetadata(mint, network),
}));

import { configureStore } from "@reduxjs/toolkit";
import solTokenReducer, {
  addSolToken,
  removeToken,
  clearSolTokens,
  fetchSplTokenBalance,
  loadSolTokens
} from "../store/solTokenSlice";
import solanaReducer from "../store/solanaSlice";
import importedAccountReducer from "../store/importedAccountSlice";
import ethereumReducer from "../store/ethereumSlice";
import settingsReducer from "../store/settingsSlice";
import priceReducer from "../store/priceSlice";
import biometricsReducer from "../store/biometricsSlice";
import erc20Reducer from "../store/tokenSlice";

const createTestStore = () => {
  return configureStore({
    reducer: {
      ethereum: ethereumReducer,
      solana: solanaReducer,
      importedAccounts: importedAccountReducer,
      settings: settingsReducer,
      price: priceReducer,
      biometrics: biometricsReducer,
      erc20: erc20Reducer,
      solToken: solTokenReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }),
  });
};

describe("Solana Custom Token Caching & Network Isolation Tests", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    mockGetSplTokenMetadata.mockReset();
    mockGetSplTokenBalance.mockReset();
  });

  test("Should support adding and removing tracked tokens isolated by network environment", () => {
    const mainnetMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const devnetMint = "FND22255AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    // 1. Add Mainnet token
    store.dispatch(addSolToken({ mint: mainnetMint, network: "mainnet" }));
    let state = store.getState();
    expect(state.solToken.trackedTokens).toHaveLength(1);
    expect(state.solToken.trackedTokens[0]).toEqual({ mint: mainnetMint, network: "mainnet" });

    // 2. Add Devnet token
    store.dispatch(addSolToken({ mint: devnetMint, network: "devnet" }));
    state = store.getState();
    expect(state.solToken.trackedTokens).toHaveLength(2);
    expect(state.solToken.trackedTokens[1]).toEqual({ mint: devnetMint, network: "devnet" });

    // 3. Prevent duplicate mint-network combinations
    store.dispatch(addSolToken({ mint: mainnetMint, network: "mainnet" }));
    state = store.getState();
    expect(state.solToken.trackedTokens).toHaveLength(2);

    // 4. Remove Devnet token selectively
    store.dispatch(removeToken({ mint: devnetMint, network: "devnet" }));
    state = store.getState();
    expect(state.solToken.trackedTokens).toHaveLength(1);
    expect(state.solToken.trackedTokens[0].mint).toBe(mainnetMint);
  });

  test("Should execute parallel metadata and balance fetching when token is NOT cached", async () => {
    const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const wallet = "SolWalletAddress111";

    mockGetSplTokenMetadata.mockResolvedValue({
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logo: "https://mocklogo.com/usdc.png",
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    });

    mockGetSplTokenBalance.mockResolvedValue({
      mint,
      ata: "ATAAddressUSDC",
      amount: 250.75,
      decimals: 6,
    });

    // Verify cache is empty initially
    let state = store.getState();
    expect(state.solToken.metadataCache[mint]).toBeUndefined();

    // Execute thunk
    await store.dispatch(fetchSplTokenBalance({ mint, wallet }));

    // Verify calls were made to both services
    expect(mockGetSplTokenMetadata).toHaveBeenCalledTimes(1);
    expect(mockGetSplTokenBalance).toHaveBeenCalledTimes(1);

    // Verify metadata was populated in the state cache
    state = store.getState();
    expect(state.solToken.metadataCache[mint]).toBeDefined();
    expect(state.solToken.metadataCache[mint].symbol).toBe("USDC");
    expect(state.solToken.metadataCache[mint].decimals).toBe(6);

    // Verify balance matches
    const balance = state.solToken.balances[mint];
    expect(balance.amount).toBe(250.75);
    expect(balance.name).toBe("USD Coin");
  });

  test("Should bypass metadata API query entirely (LOW-LATENCY PATH) if token metadata is cached", async () => {
    const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const wallet = "SolWalletAddress111";

    // 1. Manually prime/populate the cache
    mockGetSplTokenMetadata.mockResolvedValue({
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logo: "https://mocklogo.com/usdc.png",
      programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    });

    mockGetSplTokenBalance.mockResolvedValue({
      mint,
      ata: "ATAAddressUSDC",
      amount: 250.75,
      decimals: 6,
    });

    // First fetch populates cache
    await store.dispatch(fetchSplTokenBalance({ mint, wallet }));
    expect(mockGetSplTokenMetadata).toHaveBeenCalledTimes(1);

    // Reset mocks for tracing next fetch
    mockGetSplTokenMetadata.mockClear();
    mockGetSplTokenBalance.mockClear();

    mockGetSplTokenBalance.mockResolvedValue({
      mint,
      ata: "ATAAddressUSDC",
      amount: 500.0,
      decimals: 6,
    });

    // 2. Fetch again - should bypass getSplTokenMetadata entirely!
    await store.dispatch(fetchSplTokenBalance({ mint, wallet }));

    expect(mockGetSplTokenMetadata).not.toHaveBeenCalled(); // Cached metadata utilized!
    expect(mockGetSplTokenBalance).toHaveBeenCalledTimes(1); // Balance queried

    const state = store.getState();
    const balance = state.solToken.balances[mint];
    expect(balance.amount).toBe(500.0);
    expect(balance.symbol).toBe("USDC"); // Sourced from cache
    expect(balance.name).toBe("USD Coin"); // Sourced from cache
  });

  test("Should purge tracked tokens, balance metrics, and cache cleanly upon clearSolTokens", () => {
    const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    store.dispatch(addSolToken({ mint, network: "mainnet" }));
    
    store.dispatch(clearSolTokens());
    const state = store.getState();
    
    expect(state.solToken.trackedTokens).toHaveLength(0);
    expect(Object.keys(state.solToken.balances)).toHaveLength(0);
    expect(Object.keys(state.solToken.metadataCache)).toHaveLength(0);
  });

  test("Should handle network/API rejection gracefully inside fetchSplTokenBalance and resolve with fallback instead of rejecting", async () => {
    const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const wallet = "SolWalletAddress111";

    mockGetSplTokenMetadata.mockRejectedValue(new Error("Jupiter API / Network block"));
    mockGetSplTokenBalance.mockRejectedValue(new Error("RPC network connection failed"));

    // Execute thunk
    const result = await store.dispatch(fetchSplTokenBalance({ mint, wallet }));

    // The Redux Toolkit thunk action should be FULFILLED and not rejected
    expect(result.type).toBe("sol/fetchSplBalance/fulfilled");

    // The balance entry should be populated with fallback properties to clear any UI loading card
    const state = store.getState();
    const balance = state.solToken.balances[mint];
    expect(balance).toBeDefined();
    expect(balance.amount).toBe(0);
    expect(balance.name).toBe("Unknown Token");
    expect(balance.symbol).toBe("SPL");
  });
});
