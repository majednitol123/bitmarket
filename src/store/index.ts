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

import ethereumReducer from "./ethereumSlice";
import biometricsReducer from "./biometricsSlice";
import { evmServices, registerEvmService } from "../services/EthereumService";

import settingsReducer from "./settingsSlice";
import connectedUserReducer from "./connectedUserSlice";
import marketReducer from "./marketSlice";
import portfolioReducer from "./portfolioSlice";

import { GeneralStatus } from "./types";

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

const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  whitelist: ["biometrics", "settings", "market", "portfolio"],
};

const rootReducer = combineReducers({
  ethereum: persistReducer(walletPersistConfig, ethereumReducer),
  biometrics: biometricsReducer,
  settings: settingsReducer,
  connectedUser: connectedUserReducer,
  market: marketReducer,
  portfolio: portfolioReducer,
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

const activeBlockListeners = new Map<number, any>();

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

      // Throttle: skip if we dispatched for this chain less than 30s ago
      const lastTime = lastBlockDispatch.get(chainId) ?? 0;
      if (Date.now() - lastTime < BLOCK_THROTTLE_MS) return;

      try {
        let balance: bigint;
        try {
          balance = await service.getBalance(address);
        } catch (initialError: any) {
          if (initialError.message?.includes("block with number") || initialError.code === -32000) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            balance = await service.getBalance(address);
          } else {
            throw initialError;
          }
        }

        // Only dispatch if balance actually changed
        const newBalance = Number(formatEther(balance));
        const currentState = store.getState() as any;
        const currentBalance = currentState.ethereum.globalAddresses?.[index]?.balanceByChain?.[chainId];
        if (currentBalance === newBalance) return; // Skip — no change

        lastBlockDispatch.set(chainId, Date.now());
      } catch (e: any) {
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

/* ---------------- Helpers ---------------- */

export const clearPersistedState = async () => {
  try {
    await persistor.purge();
    store.dispatch({ type: "RESET_APP_STATE" });
    Object.values(evmServices).forEach((s) =>
      s?.provider?.removeAllListeners()
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
