/**
 * useDashboardData — THE SINGLE SOURCE OF TRUTH for dashboard rendering.
 */
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";
import { store } from "../store";
import type { RootState } from "../store";
import { GeneralStatus } from "../store/types";
import { UNLOCK_TIMEOUT } from "../store/biometricsSlice";

let cachedEvmChainIds: number[] = [];
let cachedAllChainIds: number[] = [];
let cachedNetworkKeys = "";

export interface DashboardData {
  // EVM
  activeChainId: number | null;
  networks: RootState["ethereum"]["networks"];
  ethWalletAddress: string;
  ethBalance: number;
  failedEthStatus: boolean;
  // Derived assets
  ethereumAssets: Array<{
    key: string;
    chainId: number;
    name: string;
    symbol: string;
    balance: number;
    address: string;
    status: GeneralStatus;
  }>;
  // Chain IDs
  evmChainIds: number[];
  allChainIds: number[];
}

export function computeDashboardData(state: RootState): DashboardData {
  // ── EVM account ──
  const activeChainId = state.ethereum.activeChainId;
  const networks = state.ethereum.networks;
  const activeIndex = state.ethereum.activeIndex ?? 0;
  const globalAddresses = state.ethereum.globalAddresses;

  const currentEvmAccount = globalAddresses?.[activeIndex];
  const ethWalletAddress = currentEvmAccount?.address || "";
  const ethBalance = activeChainId != null ? currentEvmAccount?.balanceByChain?.[activeChainId] ?? 0 : 0;

  const failedEthStatus =
    activeChainId != null && currentEvmAccount?.statusByChain?.[activeChainId] === GeneralStatus.Failed;

  // ── Chain IDs ──
  const networkKeys = Object.keys(networks).join(",");
  if (networkKeys !== cachedNetworkKeys) {
    cachedNetworkKeys = networkKeys;
    cachedEvmChainIds = Object.keys(networks).map(Number);
    cachedAllChainIds = [...cachedEvmChainIds];
  }
  const evmChainIds = cachedEvmChainIds;
  const allChainIds = cachedAllChainIds;

  // ── Build asset list ──
  const ethereumAssets = Object.values(networks)
    .map((network) => {
      const chainId = network.chainId;
      const balance = currentEvmAccount?.balanceByChain?.[chainId] ?? 0;
      return {
        key: `evm-${chainId}`,
        chainId,
        name: network.chainName,
        symbol: network.symbol,
        balance,
        address: ethWalletAddress,
        status:
          (currentEvmAccount?.statusByChain?.[chainId] as GeneralStatus) ??
          GeneralStatus.Idle,
      };
    });

  return {
    activeChainId,
    networks,
    ethWalletAddress,
    ethBalance,
    failedEthStatus,
    ethereumAssets,
    evmChainIds,
    allChainIds,
  };
}

/**
 * Compact fingerprint of all values that affect the UI.
 */
function fingerprint(d: DashboardData): string {
  const bals = d.ethereumAssets.map(a => `${a.chainId}:${a.balance}`).join(",");
  return `${d.ethWalletAddress}|${d.activeChainId}|${d.failedEthStatus}|${bals}`;
}

/**
 * @param debounceMs How long to wait after the last dispatch before updating.
 */
export function useDashboardData(debounceMs = 800): DashboardData & { isFocused: boolean } {
  const navigation = useNavigation();
  const [data, setData] = useState<DashboardData>(() =>
    computeDashboardData(store.getState())
  );
  const [isFocused, setIsFocused] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFocusedRef = useRef(true);
  const needsSyncRef = useRef(false);
  const lastFpRef = useRef<string>("");

  useEffect(() => {
    const syncIfActive = () => {
      const state = store.getState();
      const { unlocked, unlockedAt } = state.biometrics;
      const sessionExpired = unlocked && unlockedAt && (Date.now() - unlockedAt >= UNLOCK_TIMEOUT);
      if (!unlocked || sessionExpired) {
        needsSyncRef.current = true;
        return;
      }

      if (isFocusedRef.current && AppState.currentState === "active" && needsSyncRef.current) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = undefined;
        }
        needsSyncRef.current = false;
        const newData = computeDashboardData(state);
        lastFpRef.current = fingerprint(newData);
        setData(newData);
      }
    };

    const onFocus = () => {
      isFocusedRef.current = true;
      setIsFocused(true);
      syncIfActive();
    };
    const onBlur = () => {
      isFocusedRef.current = false;
      setIsFocused(false);
    };

    const unsubFocus = navigation.addListener("focus", onFocus);
    const unsubBlur = navigation.addListener("blur", onBlur);
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncIfActive();
      }
    });
    
    return () => {
      unsubFocus();
      unsubBlur();
      appStateSub.remove();
    };
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      if (!isFocusedRef.current || AppState.currentState !== "active") {
        needsSyncRef.current = true;
        return;
      }

      const state = store.getState();
      const { unlocked, unlockedAt } = state.biometrics;
      const sessionExpired = unlocked && unlockedAt && (Date.now() - unlockedAt >= UNLOCK_TIMEOUT);
      if (!unlocked || sessionExpired) {
        needsSyncRef.current = true;
        return;
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (!isFocusedRef.current || AppState.currentState !== "active") {
          needsSyncRef.current = true;
          return;
        }
        const newData = computeDashboardData(store.getState());
        const newFp = fingerprint(newData);
        if (newFp === lastFpRef.current) return;
        lastFpRef.current = newFp;
        setData(newData);
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [debounceMs]);

  return {
    ...data,
    isFocused,
  };
}
