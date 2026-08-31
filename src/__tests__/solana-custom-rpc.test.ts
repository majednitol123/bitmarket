/**
 * Solana Custom RPC Configuration — Comprehensive Tests
 *
 * Verifies all states, actions, thunks, and service integration for custom Solana RPC URL editing.
 */

// Mock SolanaService BEFORE importing the slice or store
jest.mock("../services/SolanaService", () => ({
  __esModule: true,
  default: {
    selectNetwork: jest.fn(),
    updateRpcUrl: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(1.25),
    getTransactionsByWallet: jest.fn().mockResolvedValue([{ hash: "tx-test" }]),
    sendTransaction: jest.fn(),
    confirmTransaction: jest.fn(),
    restoreWalletFromPhrase: jest.fn(),
  },
}));

import { configureStore } from "@reduxjs/toolkit";
import solanaReducer, {
  setSelectedNetwork,
  setCustomRpcUrl,
  fetchSolanaBalance,
  fetchSolanaTransactions,
} from "../store/solanaSlice";
import solanaService from "../services/SolanaService";
import { GeneralStatus } from "../store/types";

// ─── Helpers ───

function createTestStore(preloadedState?: any) {
  const store = configureStore({
    reducer: { solana: solanaReducer },
    preloadedState: preloadedState ? { solana: preloadedState } : undefined,
  });

  // Attach store subscriber to sync the mocked SolanaService, mirroring store/index.ts
  const initialState = store.getState() as any;
  const initialNetwork = initialState.solana?.selectedNetwork ?? "devnet";
  const initialCustomUrl = initialState.solana?.customRpcUrls?.[initialNetwork];
  let lastSolanaFingerprint = `${initialNetwork}:${initialCustomUrl || ""}`;

  store.subscribe(() => {
    try {
      const state = store.getState() as any;
      const selectedNetwork = state.solana?.selectedNetwork ?? "devnet";
      const customUrl = state.solana?.customRpcUrls?.[selectedNetwork];
      const fp = `${selectedNetwork}:${customUrl || ""}`;
      if (fp === lastSolanaFingerprint) return;
      lastSolanaFingerprint = fp;

      if (customUrl) {
        solanaService.selectNetwork(selectedNetwork, customUrl);
      } else {
        solanaService.selectNetwork(selectedNetwork);
      }
    } catch (err) {
      console.warn("[Store Test] Error syncing Solana RPC:", err);
    }
  });

  return store;
}

const makeAddress = (overrides: any = {}) => ({
  accountName: "Account 1",
  derivationPath: "m/44'/501'/0'/0'",
  address: "B9hBF4uGunmyFU3R8Wuiq2kQVudofVuTqoYc6PzkV85s",
  publicKey: "B9hBF4uGunmyFU3R8Wuiq2kQVudofVuTqoYc6PzkV85s",
  balance: 0,
  failedNetworkRequest: false,
  status: GeneralStatus.Idle,
  transactionConfirmations: [],
  transactionMetadata: { paginationKey: undefined, transactions: [] },
  balanceByNetwork: { mainnet: 0, devnet: 0 },
  transactionsByNetwork: { mainnet: [], devnet: [] },
  ...overrides,
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════

describe("Solana Custom RPC Configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Test 1: Set Custom RPC URL ───
  it("sets and stores a custom RPC URL for a network", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      customRpcUrls: {},
      addresses: [makeAddress()],
    });

    // Set custom RPC for active devnet network
    store.dispatch(
      setCustomRpcUrl({
        network: "devnet",
        rpcUrl: "https://my-custom-solana-devnet-rpc.com",
      })
    );

    const state = store.getState().solana;
    expect(state.customRpcUrls?.devnet).toBe("https://my-custom-solana-devnet-rpc.com");
    // Since it's currently active, the store subscriber instantly calls selectNetwork
    expect(solanaService.selectNetwork).toHaveBeenCalledWith("devnet", "https://my-custom-solana-devnet-rpc.com");
  });

  // ─── Test 2: Set Custom RPC for Inactive Network ───
  it("stores custom RPC but does not update active connection if network is inactive", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      customRpcUrls: {},
      addresses: [makeAddress()],
    });

    // Set custom RPC for mainnet (while devnet is active)
    store.dispatch(
      setCustomRpcUrl({
        network: "mainnet",
        rpcUrl: "https://my-custom-solana-mainnet-rpc.com",
      })
    );

    const state = store.getState().solana;
    expect(state.customRpcUrls?.mainnet).toBe("https://my-custom-solana-mainnet-rpc.com");
    // Active connection should NOT be updated because mainnet is not active
    expect(solanaService.selectNetwork).not.toHaveBeenCalled();
  });

  // ─── Test 3: Clear Custom RPC URL ───
  it("deletes the custom RPC URL and resets to default when empty string is passed", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      customRpcUrls: {
        devnet: "https://my-custom-solana-devnet-rpc.com",
      },
      addresses: [makeAddress()],
    });

    // Clear custom RPC
    store.dispatch(
      setCustomRpcUrl({
        network: "devnet",
        rpcUrl: "  ", // whitespace/empty
      })
    );

    const state = store.getState().solana;
    expect(state.customRpcUrls?.devnet).toBeUndefined();
    // Should revert back to default network selection
    expect(solanaService.selectNetwork).toHaveBeenCalledWith("devnet");
  });

  // ─── Test 4: setSelectedNetwork with Custom RPC ───
  it("passes custom RPC URL when switching active network", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      customRpcUrls: {
        mainnet: "https://my-custom-solana-mainnet-rpc.com",
      },
      addresses: [makeAddress()],
    });

    store.dispatch(setSelectedNetwork("mainnet"));

    const state = store.getState().solana;
    expect(state.selectedNetwork).toBe("mainnet");
    // Should pass the custom RPC URL to selectNetwork
    expect(solanaService.selectNetwork).toHaveBeenCalledWith(
      "mainnet",
      "https://my-custom-solana-mainnet-rpc.com"
    );
  });

  // ─── Test 5: fetchSolanaBalance Thunk with Custom RPC ───
  it("uses custom RPC URL in fetchSolanaBalance thunk", async () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      customRpcUrls: {
        devnet: "https://my-custom-solana-devnet-rpc.com",
      },
      addresses: [makeAddress({ address: "addr-test-1" })],
    });

    await store.dispatch(
      fetchSolanaBalance({
        address: "addr-test-1",
        network: "devnet",
      }) as any
    );

    // Thunk should load custom RPC and select it
    expect(solanaService.selectNetwork).toHaveBeenCalledWith(
      "devnet",
      "https://my-custom-solana-devnet-rpc.com"
    );
    expect(solanaService.getBalance).toHaveBeenCalledWith("addr-test-1");
  });

  // ─── Test 6: fetchSolanaTransactions Thunk with Custom RPC ───
  it("uses custom RPC URL in fetchSolanaTransactions thunk", async () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      customRpcUrls: {
        devnet: "https://my-custom-solana-devnet-rpc.com",
      },
      addresses: [makeAddress({ address: "addr-test-2" })],
    });

    await store.dispatch(
      fetchSolanaTransactions({
        address: "addr-test-2",
        network: "devnet",
      }) as any
    );

    // Thunk should load custom RPC and select it
    expect(solanaService.selectNetwork).toHaveBeenCalledWith(
      "devnet",
      "https://my-custom-solana-devnet-rpc.com"
    );
    expect(solanaService.getTransactionsByWallet).toHaveBeenCalledWith("addr-test-2");
  });
});
