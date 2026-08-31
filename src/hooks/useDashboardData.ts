/**
 * useDashboardData — THE SINGLE SOURCE OF TRUTH for dashboard rendering.
 *
 * WHY THIS EXISTS:
 * With 34 EVM chains, each balance fetch mutates globalAddresses in Redux.
 * Using N separate useSelector/useDebouncedSelector hooks means N independent
 * store subscriptions, N independent setTimeout callbacks, and N independent
 * setState calls. React CANNOT batch setState calls from separate setTimeout
 * callbacks, so N hooks = up to N re-renders per dispatch cycle.
 *
 * This hook consolidates ALL dashboard data into:
 *   - ONE store.subscribe() call
 *   - ONE setTimeout debounce
 *   - ONE setState → ONE re-render
 *
 * It also checks screen focus: if the dashboard isn't visible (user is on
 * token detail page), it pauses updates entirely and syncs on return.
 */
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useNavigation } from "expo-router";
import { store } from "../store";
import type { RootState } from "../store";
import { GeneralStatus, type Transaction } from "../store/types";
import { TESTNET_CHAIN_IDS } from "../utils/fetchCryptoPrices";
import { UNLOCK_TIMEOUT } from "../store/biometricsSlice";

// BUG #6 FIX: Cache chain ID arrays to prevent new allocations on every call.
// These only change when networks are added/removed, which is extremely rare.
let cachedEvmChainIds: number[] = [];
let cachedAllChainIds: number[] = [];
let cachedNetworkKeys = "";

// Shared empty arrays to avoid new-reference-on-every-call problem
const EMPTY_TRANSACTIONS: Transaction[] = [];

export interface DashboardData {
  // EVM
  activeChainId: number;
  networks: RootState["ethereum"]["networks"];
  ethWalletAddress: string;
  ethBalance: number;
  ethTransactions: Transaction[];
  failedEthStatus: boolean;
  // Solana
  solWalletAddress: string;
  solBalance: number;
  solTransactions: Transaction[];
  failedSolStatus: boolean;
  // Prices
  prices: RootState["price"]["data"];
  // Derived assets
  ethereumAssets: Array<{
    key: string;
    chainId: number;
    name: string;
    symbol: string;
    balance: number;
    usdValue: number;
    address: string;
    status: GeneralStatus;
  }>;
  totalUsdBalance: number;
  solUsd: number;
  // Chain IDs
  evmChainIds: number[];
  allChainIds: number[];
  // Imported account visibility
  showEvmAssets: boolean;
  showSolAssets: boolean;
}

export function computeDashboardData(state: RootState): DashboardData {
  // ── EVM account ──
  const activeChainId = state.ethereum.activeChainId;
  const networks = state.ethereum.networks;
  const activeIndex = state.ethereum.activeIndex ?? 0;
  const importedEvm = state.importedAccounts?.activeEvmAddress;
  const importedSol = state.importedAccounts?.activeSolAddress;
  const globalAddresses = state.ethereum.globalAddresses;

  // ── Imported account visibility ──
  // If an imported account is active, only show chains that were imported.
  // Seed-derived accounts always have both EVM + Solana.
  const isImportedActive = !!(importedEvm || importedSol);
  const showEvmAssets = isImportedActive ? !!importedEvm : true;
  const showSolAssets = isImportedActive ? !!importedSol : true;

  const currentEvmAccount = importedEvm
    ? globalAddresses?.find(
        (a) => a.address?.toLowerCase() === importedEvm.toLowerCase()
      )
    : isImportedActive
      ? null
      : globalAddresses?.[activeIndex];

  const ethWalletAddress = currentEvmAccount?.address || "";
  const ethBalance = currentEvmAccount?.balanceByChain?.[activeChainId] ?? 0;

  // Aggregate transactions from ALL EVM chains for the home screen
  const txByChain = currentEvmAccount?.transactionMetadataByChain ?? {};
  const ethTransactions: Transaction[] = Object.entries(txByChain)
    .flatMap(([chainId, meta]) => 
      (meta?.transactions ?? []).map(tx => ({
        ...tx,
        chainId: tx.chainId ?? Number(chainId)
      }))
    );

  const failedEthStatus =
    currentEvmAccount?.statusByChain?.[activeChainId] === GeneralStatus.Failed;

  // ── Solana account ──
  const solIdx = state.solana.activeIndex ?? 0;
  const currentSolAccount = importedSol
    ? state.solana.addresses?.find((a) => a.address === importedSol)
    : isImportedActive
      ? null
      : state.solana.addresses?.[solIdx];

  const solWalletAddress = currentSolAccount?.address || "";
  const solBalance = currentSolAccount?.balance ?? 0;
  const solTransactions =
    (currentSolAccount?.transactionMetadata?.transactions ?? EMPTY_TRANSACTIONS).map(tx => ({
      ...tx,
      chainId: 101
    }));
  const failedSolStatus =
    currentSolAccount?.status === GeneralStatus.Failed;

  // ── Prices ──
  const prices = state.price.data;

  // ── Chain IDs (cached to avoid new array allocation every call) ──
  const networkKeys = Object.keys(networks).join(",");
  if (networkKeys !== cachedNetworkKeys) {
    cachedNetworkKeys = networkKeys;
    cachedEvmChainIds = Object.keys(networks).map(Number);
    cachedAllChainIds = [...cachedEvmChainIds, 101];
  }
  const evmChainIds = cachedEvmChainIds;
  const allChainIds = cachedAllChainIds;

  // ── Build asset list (only if EVM assets should be shown) ──
  const ethereumAssets = showEvmAssets
    ? Object.values(networks)
        .map((network) => {
          const chainId = network.chainId;
          const isTestnet = TESTNET_CHAIN_IDS.has(chainId);
          const price = isTestnet ? 0 : (prices?.[chainId]?.usd ?? 0);
          const balance = currentEvmAccount?.balanceByChain?.[chainId] ?? 0;
          return {
            key: `evm-${chainId}`,
            chainId,
            name: network.chainName,
            symbol: network.symbol,
            balance,
            usdValue: balance * price,
            address: ethWalletAddress,
            status:
              (currentEvmAccount?.statusByChain?.[chainId] as GeneralStatus) ??
              GeneralStatus.Idle,
          };
        })
        .sort((a, b) => b.usdValue - a.usdValue)
    : [];

  // ── Totals (only include visible assets) ──
  const evmTotal = ethereumAssets.reduce(
    (sum, a) => sum + (a.usdValue ?? 0),
    0
  );
  const solUsd = showSolAssets && state.solana.selectedNetwork !== "devnet"
    ? (prices[101]?.usd ?? 0) * solBalance
    : 0;
  const totalUsdBalance = evmTotal + solUsd;

  return {
    activeChainId,
    networks,
    ethWalletAddress,
    ethBalance,
    ethTransactions,
    failedEthStatus,
    solWalletAddress,
    solBalance,
    solTransactions,
    failedSolStatus,
    prices,
    ethereumAssets,
    totalUsdBalance,
    solUsd,
    evmChainIds,
    allChainIds,
    showEvmAssets,
    showSolAssets,
  };
}

/**
 * Compact fingerprint of all values that affect the UI.
 * Comparing one string is O(1) vs deep-comparing entire data tree.
 */
function fingerprint(d: DashboardData): string {
  const bals = d.ethereumAssets.map(a => `${a.chainId}:${a.balance}`).join(",");
  return `${d.ethWalletAddress}|${d.solWalletAddress}|${d.activeChainId}|${d.totalUsdBalance.toFixed(2)}|${d.solBalance}|${d.solUsd.toFixed(2)}|${d.ethTransactions.length}|${d.solTransactions.length}|${d.failedEthStatus}|${d.failedSolStatus}|${d.showEvmAssets}|${d.showSolAssets}|${bals}`;
}

/**
 * @param debounceMs How long to wait after the last dispatch before updating.
 *   Default 800ms — enough to absorb a full 34-chain balance fetch storm.
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

  // Track focus/blur via navigation events (uses ref to avoid re-subscribing to store)
  useEffect(() => {
    const syncIfActive = () => {
      // If the app is locked or about to lock, don't waste performance syncing dashboard state
      const state = store.getState();
      const { unlocked, unlockedAt } = state.biometrics;
      const sessionExpired = unlocked && unlockedAt && (Date.now() - unlockedAt >= UNLOCK_TIMEOUT);
      if (!unlocked || sessionExpired) {
        needsSyncRef.current = true; // Sync later when we unlock
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

  // ONE store subscription — never re-subscribes because isFocusedRef is read via ref
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      if (!isFocusedRef.current || AppState.currentState !== "active") {
        needsSyncRef.current = true;
        return;
      }

      // If the app is locked or about to lock, skip queueing updates
      const state = store.getState();
      const { unlocked, unlockedAt } = state.biometrics;
      const sessionExpired = unlocked && unlockedAt && (Date.now() - unlockedAt >= UNLOCK_TIMEOUT);
      if (!unlocked || sessionExpired) {
        needsSyncRef.current = true;
        return;
      }

      // Debounce: reset timer on every dispatch, only fire once after storm settles
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // Double check focus status when the timer fires to prevent background rendering
        if (!isFocusedRef.current || AppState.currentState !== "active") {
          needsSyncRef.current = true;
          return;
        }
        const newData = computeDashboardData(store.getState());
        const newFp = fingerprint(newData);
        // SKIP if nothing visible has changed — prevents ghost re-renders
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


