/**
 * Solana Network Switch — Comprehensive Tests
 *
 * Covers all edge cases for switching between Solana Mainnet and Devnet,
 * including rapid switching, stuck states, stale fetch results, and
 * multi-address scenarios.
 *
 * We mock SolanaService to avoid pulling @solana/web3.js (ESM) into Jest.
 */

// Mock SolanaService BEFORE importing the slice
jest.mock("../services/SolanaService", () => ({
  __esModule: true,
  default: {
    selectNetwork: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(0),
    getTransactionsByWallet: jest.fn().mockResolvedValue([]),
    sendTransaction: jest.fn(),
    confirmTransaction: jest.fn(),
    restoreWalletFromPhrase: jest.fn(),
  },
}));

import { configureStore } from "@reduxjs/toolkit";
import solanaReducer, {
  setSelectedNetwork,
  fetchSolanaBalance,
} from "../store/solanaSlice";
import { GeneralStatus } from "../store/types";

// ─── Helpers ───

/** Creates a fresh Redux store with solana slice for each test */
function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: { solana: solanaReducer },
    preloadedState: preloadedState ? { solana: preloadedState } : undefined,
  });
}

/** Default address state matching initialState shape */
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

describe("Solana Network Switching", () => {
  // ─── Test 1: devnet → mainnet ───
  it("switches from devnet to mainnet correctly", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          balance: 5.5,
          balanceByNetwork: { mainnet: 10.2, devnet: 5.5 },
          transactionsByNetwork: {
            mainnet: [{ hash: "tx-main-1" }],
            devnet: [{ hash: "tx-dev-1" }],
          },
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("mainnet"));

    const state = store.getState().solana;
    expect(state.selectedNetwork).toBe("mainnet");
    expect(state.addresses[0].balance).toBe(10.2);
    expect(state.addresses[0].transactionMetadata.transactions).toEqual([
      { hash: "tx-main-1" },
    ]);
  });

  // ─── Test 2: mainnet → devnet ───
  it("switches from mainnet to devnet correctly", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "mainnet",
      addresses: [
        makeAddress({
          balance: 10.2,
          balanceByNetwork: { mainnet: 10.2, devnet: 3.3 },
          transactionsByNetwork: {
            mainnet: [{ hash: "tx-main-1" }],
            devnet: [{ hash: "tx-dev-1" }, { hash: "tx-dev-2" }],
          },
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("devnet"));

    const state = store.getState().solana;
    expect(state.selectedNetwork).toBe("devnet");
    expect(state.addresses[0].balance).toBe(3.3);
    expect(state.addresses[0].transactionMetadata.transactions).toHaveLength(2);
  });

  // ─── Test 3: Tap already-active network (idempotent) ───
  it("is idempotent when selecting the already-active network", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          balance: 5.5,
          balanceByNetwork: { mainnet: 0, devnet: 5.5 },
          transactionsByNetwork: {
            mainnet: [],
            devnet: [{ hash: "tx-1" }],
          },
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("devnet"));
    const stateAfter = store.getState().solana;

    // Network stays devnet, balance stays 5.5 (read from devnet cache)
    expect(stateAfter.selectedNetwork).toBe("devnet");
    expect(stateAfter.addresses[0].balance).toBe(5.5);
    expect(stateAfter.addresses[0].transactionMetadata.transactions).toEqual([
      { hash: "tx-1" },
    ]);
  });

  // ─── Test 4: Rapid double-tap (devnet → mainnet → devnet) ───
  it("handles rapid switching without crash", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          balanceByNetwork: { mainnet: 10.0, devnet: 5.0 },
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("mainnet"));
    store.dispatch(setSelectedNetwork("devnet"));

    const state = store.getState().solana;
    expect(state.selectedNetwork).toBe("devnet");
    expect(state.addresses[0].balance).toBe(5.0);
    expect(state.addresses[0].status).toBe(GeneralStatus.Idle);
  });

  // ─── Test 5: Switch while status is Loading (not blocked) ───
  it("allows network switch even when status is Loading", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          status: GeneralStatus.Loading,
          balanceByNetwork: { mainnet: 8.0, devnet: 2.0 },
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("mainnet"));

    const state = store.getState().solana;
    expect(state.selectedNetwork).toBe("mainnet");
    expect(state.addresses[0].balance).toBe(8.0);
    expect(state.addresses[0].status).toBe(GeneralStatus.Idle);
  });

  // ─── Test 6: Switch after a failed fetch (status=Failed) ───
  it("allows network switch after a failed fetch and resets status", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          status: GeneralStatus.Failed,
          failedNetworkRequest: true,
          balanceByNetwork: { mainnet: 7.0, devnet: 1.0 },
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("mainnet"));

    const state = store.getState().solana;
    expect(state.selectedNetwork).toBe("mainnet");
    expect(state.addresses[0].status).toBe(GeneralStatus.Idle);
    expect(state.addresses[0].failedNetworkRequest).toBe(false);
    expect(state.addresses[0].balance).toBe(7.0);
  });

  // ─── Test 7: balanceByNetwork initializes correctly ───
  it("initializes missing balanceByNetwork to defaults on switch", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          balanceByNetwork: undefined,
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("mainnet"));

    const state = store.getState().solana;
    expect(state.addresses[0].balanceByNetwork).toEqual({
      mainnet: 0,
      devnet: 0,
    });
    expect(state.addresses[0].balance).toBe(0);
  });

  // ─── Test 8: transactionsByNetwork initializes correctly ───
  it("initializes missing transactionsByNetwork to defaults on switch", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          transactionsByNetwork: undefined,
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("mainnet"));

    const state = store.getState().solana;
    expect(state.addresses[0].transactionsByNetwork).toEqual({
      mainnet: [],
      devnet: [],
    });
    expect(state.addresses[0].transactionMetadata.transactions).toEqual([]);
  });

  // ─── Test 9: Multiple addresses all update on switch ───
  it("updates all addresses when switching networks", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "devnet",
      addresses: [
        makeAddress({
          address: "addr1",
          balanceByNetwork: { mainnet: 10.0, devnet: 5.0 },
          transactionsByNetwork: {
            mainnet: [{ hash: "m1" }],
            devnet: [{ hash: "d1" }],
          },
        }),
        makeAddress({
          address: "addr2",
          balanceByNetwork: { mainnet: 20.0, devnet: 15.0 },
          transactionsByNetwork: {
            mainnet: [{ hash: "m2" }],
            devnet: [{ hash: "d2" }],
          },
        }),
        makeAddress({
          address: "addr3",
          status: GeneralStatus.Failed,
          balanceByNetwork: { mainnet: 30.0, devnet: 25.0 },
        }),
      ],
    });

    store.dispatch(setSelectedNetwork("mainnet"));

    const state = store.getState().solana;
    expect(state.addresses[0].balance).toBe(10.0);
    expect(state.addresses[1].balance).toBe(20.0);
    expect(state.addresses[2].balance).toBe(30.0);
    // All statuses reset
    expect(state.addresses[0].status).toBe(GeneralStatus.Idle);
    expect(state.addresses[1].status).toBe(GeneralStatus.Idle);
    expect(state.addresses[2].status).toBe(GeneralStatus.Idle);
    // Transactions updated
    expect(state.addresses[0].transactionMetadata.transactions).toEqual([
      { hash: "m1" },
    ]);
    expect(state.addresses[1].transactionMetadata.transactions).toEqual([
      { hash: "m2" },
    ]);
  });

  // ─── Test 10: Stale fetch result is ignored ───
  it("ignores fulfilled balance fetch for a network that is no longer active", () => {
    const store = createTestStore({
      activeIndex: 0,
      selectedNetwork: "mainnet",
      addresses: [
        makeAddress({
          balance: 10.0,
          balanceByNetwork: { mainnet: 10.0, devnet: 5.0 },
        }),
      ],
    });

    // Simulate a stale devnet fetch result arriving after user switched to mainnet
    store.dispatch({
      type: fetchSolanaBalance.fulfilled.type,
      payload: {
        bal: 99.99,
        network: "devnet",
        address: store.getState().solana.addresses[0].address,
      },
    });

    const state = store.getState().solana;
    // Balance should NOT have changed — stale result was ignored
    expect(state.addresses[0].balance).toBe(10.0);
  });
});
