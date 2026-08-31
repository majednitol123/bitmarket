import "react-native-get-random-values";
import "@ethersproject/shims";
import { AppState } from "react-native";
import { UNLOCK_TIMEOUT } from "./biometricsSlice";

import { combineReducers } from "redux";
import {
  configureStore,
  Middleware,
  ThunkAction,
  Action,
  createListenerMiddleware,
} from "@reduxjs/toolkit";
import { persistStore, persistReducer, createTransform } from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatEther } from "ethers";

import ethereumReducer, {
  updateBalance,
  fetchEvmTransactions,
} from "./ethereumSlice";
import solanaReducer from "./solanaSlice";
import priceReducer from "./priceSlice";
import biometricsReducer from "./biometricsSlice";
import importedAccountReducer from "./importedAccountSlice";
import { evmServices, registerEvmService } from "../services/EthereumService";
import solanaService from "../services/SolanaService";

import erc20Reducer from "./tokenSlice";
// import nftReducer from "./nftSlice";
import solTokenReducer from "./solTokenSlice";
import settingsReducer from "./settingsSlice";

import { GeneralStatus } from "./types";
import { rpcCircuitBreaker } from "../utils/circuitBreaker";

/* ---------------- Persist ---------------- */

const walletTransform = createTransform(
  (inboundState: any) => {
    if (inboundState.globalAddresses) {
      return {
        ...inboundState,
        globalAddresses: inboundState.globalAddresses.map((addr: any) => ({
          ...addr,
          balanceByChain: {},
          statusByChain: {},
          transactionMetadataByChain: {},
          failedNetworkRequestByChain: {},
        })),
      };
    }
    return inboundState;
  },
  (outboundState) => outboundState,
  { whitelist: ["ethereum"] }
);

const walletPersistConfig = {
  key: "wallet",
  storage: AsyncStorage,
  whitelist: ["globalAddresses", "activeIndex", "networks", "activeChainId"],
  transforms: [walletTransform],
};

const solanaTransform = createTransform(
  (inboundState: any) => {
    if (inboundState.addresses) {
      return {
        ...inboundState,
        addresses: inboundState.addresses.map((addr: any) => ({
          ...addr,
          balance: 0,
          status: GeneralStatus.Idle,
          failedNetworkRequest: false,
          transactionConfirmations: [],
          transactionMetadata: { paginationKey: undefined, transactions: [] },
          balanceByNetwork: { mainnet: 0, devnet: 0 },
          transactionsByNetwork: { mainnet: [], devnet: [] },
        })),
      };
    }
    return inboundState;
  },
  (outboundState) => outboundState,
  { whitelist: ["solana"] }
);

const solanaPersistConfig = {
  key: "solana",
  storage: AsyncStorage,
  whitelist: ["addresses", "activeIndex", "selectedNetwork", "customRpcUrls"],
  transforms: [solanaTransform],
};

const erc20Transform = createTransform(
  (inboundState: any) => ({ ...inboundState, balances: {}, transfers: {}, allNfts: [] }),
  (outboundState) => outboundState,
  { whitelist: ["erc20"] }
);

const erc20PersistConfig = {
  key: "erc20",
  storage: AsyncStorage,
  whitelist: ["trackedTokens"],
  transforms: [erc20Transform],
};

const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["biometrics", "settings", "importedAccounts"],
};

const rootReducer = combineReducers({
  ethereum: persistReducer(walletPersistConfig, ethereumReducer),
  solana: persistReducer(solanaPersistConfig, solanaReducer),
  price: priceReducer,
  biometrics: biometricsReducer,
  erc20: persistReducer(erc20PersistConfig, erc20Reducer),
  solToken: solTokenReducer,
  importedAccounts: importedAccountReducer,
  settings: settingsReducer,
});

const resettableRootReducer = (state: any, action: any) => {
  if (action.type === "RESET_APP_STATE") {
    // Preserve settings (e.g. theme preference) while wiping out all other state
    const settings = state?.settings;
    state = { settings };
  }
  return rootReducer(state, action);
};

const persistedReducer = persistReducer(persistConfig, resettableRootReducer);

/* ---------------- WebSocket Middleware ---------------- */

// BUG #2 FIX: Use a Map<chainId, provider> instead of WeakSet.
// The WeakSet never cleared entries because providers are never GC'd.
// Now we track which chainId has a listener and on which provider,
// so we can skip duplicates and clean up when providers change.
const activeBlockListeners = new Map<number, any>();

// Throttle: only dispatch balance updates at most once per 30s per chain
// to prevent the JS thread from being saturated when 34 chains fire block events.
const lastBlockDispatch = new Map<number, number>();
const BLOCK_THROTTLE_MS = 30_000;

export const evmWebSocketMiddleware: Middleware =
  (store) => (next) => (action) => {
    const result = next(action);
    const state = store.getState() as any;

    const chainId = state.ethereum?.activeChainId;
    if (!chainId) return result;

    const service = evmServices[chainId];
    if (!service?.provider) return result;

    // Clean up all block listeners for other chain IDs
    for (const [cid, provider] of activeBlockListeners.entries()) {
      if (cid !== chainId) {
        try { provider.removeAllListeners("block"); } catch (e) { /* ignore */ }
        activeBlockListeners.delete(cid);
      }
    }

    // Skip if we already have a listener for this chainId on this exact provider
    if (activeBlockListeners.get(chainId) === service.provider) return result;

    // Clean up old listener if provider changed
    const oldProvider = activeBlockListeners.get(chainId);
    if (oldProvider && oldProvider !== service.provider) {
      try { oldProvider.removeAllListeners("block"); } catch (e) { /* ignore */ }
    }

    activeBlockListeners.set(chainId, service.provider);

    const index = state.ethereum.activeIndex ?? 0;
    const address = state.ethereum.globalAddresses?.[index]?.address;

    if (!address) return result;

    service.provider.on("block", async () => {
      // Skip if app is not active or wallet is locked/session expired
      if (AppState.currentState !== "active") return;
      const lockState = store.getState().biometrics;
      if (!lockState.unlocked || (lockState.unlockedAt && (Date.now() - lockState.unlockedAt >= UNLOCK_TIMEOUT))) {
        return;
      }

      // Circuit-breaker: skip if the circuit is open for this chain
      const chainKey = `evm-${chainId}`;
      if (rpcCircuitBreaker.isOpen(chainKey)) {
        return;
      }

      // Throttle: skip if we dispatched for this chain less than 30s ago
      const lastTime = lastBlockDispatch.get(chainId) ?? 0;
      if (Date.now() - lastTime < BLOCK_THROTTLE_MS) return;

      try {
        let balance: bigint;
        try {
          balance = await service.getBalance(address);
          rpcCircuitBreaker.recordSuccess(chainKey);
        } catch (initialError: any) {
          if (initialError.message?.includes("block with number") || initialError.code === -32000) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            balance = await service.getBalance(address);
            rpcCircuitBreaker.recordSuccess(chainKey);
          } else {
            throw initialError;
          }
        }

        // Only dispatch if balance actually changed (prevents unnecessary re-renders)
        const newBalance = Number(formatEther(balance));
        const currentState = store.getState() as any;
        const currentBalance = currentState.ethereum.globalAddresses?.[index]?.balanceByChain?.[chainId];
        if (currentBalance === newBalance) return; // Skip — no change

        lastBlockDispatch.set(chainId, Date.now());

        store.dispatch(
          updateBalance({
            chainId,
            address,
            balance: newBalance,
          })
        );

        // Fetch transactions for this chain to show the new transaction instantly
        store.dispatch(fetchEvmTransactions({ chainId, address }) as any);
      } catch (e: any) {
        rpcCircuitBreaker.recordFailure(chainKey);
        if (!e.message?.includes("block with number")) {
          console.warn("EVM WS balance sync warning:", e.message || e);
        }
      }
    });

    return result;
  };


/* ---------------- Listener Middleware ---------------- */

const listenerMiddleware = createListenerMiddleware();

/* ---------------- Store ---------------- */

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    })
      .prepend(listenerMiddleware.middleware)
      .concat(evmWebSocketMiddleware),
});

export const persistor = persistStore(store);

// Automatically register EVM Services for any custom networks loaded via redux-persist or added/modified in real-time
let lastNetworksFingerprint = "";
store.subscribe(() => {
  try {
    const state = store.getState() as any;
    const networks = state.ethereum?.networks;
    if (!networks) return;

    const fp = Object.values(networks)
      .map((n: any) => `${n.chainId}:${n.rpcUrl}:${n.chainName}:${n.symbol}`)
      .join(",");
    if (fp === lastNetworksFingerprint) return;
    lastNetworksFingerprint = fp;

    Object.values(networks).forEach((net: any) => {
      if (net?.rpcUrl) {
        registerEvmService(net);
      }
    });
  } catch (err) {
    console.warn("[Store] Error auto-registering EVM Services:", err);
  }
});

// Sync Solana custom RPC in real-time when state changes
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
    console.warn("[Store] Error syncing Solana RPC:", err);
  }
});

AppState.addEventListener("change", (nextState) => {
  if (nextState === "background") {
    AsyncStorage.setItem("priceCache", JSON.stringify(store.getState().price.data));
  }
});

/* ---------------- Helpers ---------------- */

export const clearPersistedState = async () => {
  try {
    await persistor.purge();
    store.dispatch({ type: "RESET_APP_STATE" });
    Object.values(evmServices).forEach((s) =>
      s.provider?.removeAllListeners()
    );
  } catch (err) {
    console.error("Persist purge failed:", err);
  }
};

/* ---------------- Types ---------------- */

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
