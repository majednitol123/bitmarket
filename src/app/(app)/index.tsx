import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, RefreshControl, Text, StyleSheet, InteractionManager, AppState, AppStateStatus, TouchableOpacity } from "react-native";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from "react-native-responsive-screen";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import { useDispatch, useSelector } from "react-redux";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "styled-components/native";
import { ROUTES } from "../../constants/routes";
import type { ThemeType } from "../../styles/theme";
import { type AppDispatch, store, type RootState } from "../../store";
import { UNLOCK_TIMEOUT } from "../../store/biometricsSlice";
import { Transaction } from "../../store/types";
import NETWORKS from "../../services/defaultNetwork";

import { fetchPrices } from "../../store/priceSlice";
import {
  fetchEvmBalance,
  fetchEvmTransactions,
  fetchEvmTransactionsInterval,
  fetchEvmBalanceInterval,
  setActiveChain,
} from "../../store/ethereumSlice";
import {
  fetchSolanaBalance,
  fetchSolanaTransactions,
  fetchSolanaTransactionsInterval,
  fetchSolanaBalanceInterval,
} from "../../store/solanaSlice";
import { capitalizeFirstLetter } from "../../utils/capitalizeFirstLetter";
import { truncateWalletAddress } from "../../utils/truncateWalletAddress";
import { formatDollar, formatDollarRaw } from "../../utils/formatDollars";
import { useStorage } from "../../hooks/useStorageState";
import CryptoInfoCard from "../../components/CryptoInfoCard/CryptoInfoCard";
import AssetCard from "../../components/AssetCard/AssetCard";
import { BlockchainIcon } from "../../components/BlockchainIcon/BlockchainIcon";
import { getChainIconSymbol } from "../../utils/getChainIconSymbol";
import { FETCH_PRICES_INTERVAL } from "../../constants/price";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import InfoBanner from "../../components/InfoBanner/InfoBanner";
import { SNAP_POINTS } from "../../constants/storage";
import { loadSolTokens } from "../../store/solTokenSlice";
import { loadPriceCache } from "../../store/priceSlice";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import Header from "../../components/Header/Header";
import * as Clipboard from "expo-clipboard";
import CopyIcon from "../../assets/svg/copy.svg";
import { selectActiveChainIds, selectEvmChainIds } from "../../store/selectors/dashboardSelectors";

// ─── THE SINGLE DATA HOOK ───
import { useDashboardData } from "../../hooks/useDashboardData";
import { rpcCircuitBreaker } from "../../utils/circuitBreaker";

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export default function Index() {
  const dispatch = useDispatch<AppDispatch>();
  const selectedSolanaNetwork = useSelector((state: RootState) => state.solana.selectedNetwork ?? "devnet");
  const networks = useSelector((state: RootState) => state.ethereum.networks);

  const chainIdToNetwork = useMemo(() => {
    const map: Record<number, any> = {};
    for (const net of NETWORKS) {
      map[net.chainId] = net;
    }
    for (const net of Object.values(networks || {})) {
      if (net && typeof net === "object" && "chainId" in net) {
        map[(net as any).chainId] = net;
      }
    }
    return map;
  }, [networks]);

  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const theme = useTheme() as ThemeType;

  // ─── Theme-derived styles: computed ONCE per theme change, not per render ───
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const [copiedBanner, setCopiedBanner] = useState<{ visible: boolean; type: "EVM" | "SOL" | null }>({
    visible: false,
    type: null,
  });
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyAddress = useCallback(async (address: string, type: "EVM" | "SOL") => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    setCopiedBanner({ visible: true, type });
    bannerTimeoutRef.current = setTimeout(() => {
      setCopiedBanner({ visible: false, type: null });
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // ONE hook → ONE subscription → ONE state → ONE re-render
  // 800ms debounce + fingerprint skip = minimal re-renders
  // ═══════════════════════════════════════════════════════════
  const {
    ethWalletAddress,
    ethTransactions,
    solTransactions,
    failedEthStatus,
    failedSolStatus,
    solBalance,
    prices,
    ethereumAssets,
    totalUsdBalance,
    solUsd,
    evmChainIds,
    allChainIds,
    solWalletAddress,
    showEvmAssets,
    showSolAssets,
    isFocused,
  } = useDashboardData(800);

  const handleSelectChain = useCallback(
    (chainId: number, address: string) => {
      dispatch(setActiveChain(chainId));
      dispatch(fetchEvmBalance({ chainId, address }));
      dispatch(fetchEvmTransactions({ chainId, address }));
    },
    [dispatch]
  );

  useEffect(() => {
    dispatch(loadPriceCache());
    dispatch(loadSolTokens());
  }, [dispatch]);

  // ─── Fetch helpers: read from store.getState() to avoid any selector deps ───
  const fetchTokenBalances = useCallback(async (lazy = false) => {
    const s = store.getState();
    const importedEvm = s.importedAccounts?.activeEvmAddress;
    const importedSol = s.importedAccounts?.activeSolAddress;
    const isImportedActive = !!(importedEvm || importedSol);
    const skipEvm = isImportedActive && !importedEvm;
    const skipSolana = isImportedActive && !importedSol;

    if (!skipEvm) {
      const idx = s.ethereum.activeIndex ?? 0;
      const acct = importedEvm
        ? s.ethereum.globalAddresses?.find(a => a.address?.toLowerCase() === importedEvm.toLowerCase())
        : s.ethereum.globalAddresses?.[idx];
      const addr = acct?.address;
      const cid = s.ethereum.activeChainId;

      if (addr && cid !== null) {
        // Fetch active chain balance — fire-and-forget (NON-BLOCKING)
        // Previously this was `await`, which blocked the entire init when the
        // active chain RPC was down (e.g. SecureChain outage = 5-10s freeze).
        dispatch(fetchEvmBalance({ chainId: cid, address: addr }));

        // Fetch other active chains
        const activeChainIds = selectActiveChainIds(s);
        const others = activeChainIds.filter(id => id !== cid);

        const fetchOthers = async () => {
          const BATCH = 4;
          for (let i = 0; i < others.length; i += BATCH) {
            const batch = others.slice(i, i + BATCH);
            await Promise.all(
              batch.map(c =>
                dispatch(fetchEvmBalance({ chainId: c, address: addr })).catch(() => {})
              )
            );
            if (i + BATCH < others.length) {
              await new Promise(r => setTimeout(r, 200));
            }
          }
        };

        if (lazy) {
          setTimeout(() => {
            fetchOthers();
          }, 3000);
        } else {
          await fetchOthers();
        }
      }
    }

    if (!skipSolana) {
      // Fetch Solana balance
      const solIdx = s.solana.activeIndex ?? 0;
      const solAddr = importedSol || s.solana.addresses?.[solIdx]?.address;
      if (solAddr) dispatch(fetchSolanaBalance(solAddr));
    }
  }, [dispatch]);

  const fetchTransactions = useCallback(async (lazy = false) => {
    const s = store.getState();
    const importedEvm = s.importedAccounts?.activeEvmAddress;
    const importedSol = s.importedAccounts?.activeSolAddress;
    const isImportedActive = !!(importedEvm || importedSol);
    const skipEvm = isImportedActive && !importedEvm;
    const skipSolana = isImportedActive && !importedSol;

    if (!skipEvm) {
      const idx = s.ethereum.activeIndex ?? 0;
      const acct = importedEvm
        ? s.ethereum.globalAddresses?.find(a => a.address?.toLowerCase() === importedEvm.toLowerCase())
        : s.ethereum.globalAddresses?.[idx];
      const addr = acct?.address;
      const cid = s.ethereum.activeChainId;

      if (addr && cid !== null) {
        // Fetch active chain first (highest priority)
        await dispatch(fetchEvmTransactions({ chainId: cid, address: addr })).catch(() => {});

        // Fetch other active chains (those with balance or cached transactions)
        const activeChainIds = selectActiveChainIds(s);
        const others = activeChainIds.filter(id => id !== cid);

        const fetchOthers = async () => {
          const TX_BATCH = 3;
          for (let i = 0; i < others.length; i += TX_BATCH) {
            await Promise.all(
              others.slice(i, i + TX_BATCH).map(chainId =>
                dispatch(fetchEvmTransactions({ chainId, address: addr })).catch(() => {})
              )
            );
            if (i + TX_BATCH < others.length) {
              await new Promise(r => setTimeout(r, 200));
            }
          }
        };

        if (lazy) {
          setTimeout(() => {
            fetchOthers();
          }, 3000);
        } else {
          await fetchOthers();
        }
      }
    }

    if (!skipSolana) {
      // Fetch Solana transactions
      const solIdx = s.solana.activeIndex ?? 0;
      const solAddr = importedSol || s.solana.addresses?.[solIdx]?.address;
      if (solAddr) await dispatch(fetchSolanaTransactions(solAddr)).catch(() => {});
    }
  }, [dispatch]);

  const fetchAndUpdatePricesInternal = useCallback(async () => {
    if (AppState.currentState !== "active" || !isFocused) return;

    // Skip all fetches if the wallet is locked or session has expired
    const lockState = store.getState().biometrics;
    if (!lockState.unlocked || (lockState.unlockedAt && (Date.now() - lockState.unlockedAt >= UNLOCK_TIMEOUT))) {
      if (__DEV__) console.log("[Dashboard] Wallet is locked or session expired. Skipping background prices and balance polling.");
      return;
    }

    const s = store.getState();
    const importedEvm = s.importedAccounts?.activeEvmAddress;
    const importedSol = s.importedAccounts?.activeSolAddress;
    const isImportedActive = !!(importedEvm || importedSol);
    const skipEvm = isImportedActive && !importedEvm;
    const skipSolana = isImportedActive && !importedSol;

    await dispatch(fetchPrices(allChainIds));

    if (!skipEvm) {
      const cid = s.ethereum.activeChainId;
      const idx = s.ethereum.activeIndex ?? 0;
      const acct = importedEvm
        ? s.ethereum.globalAddresses?.find(a => a.address?.toLowerCase() === importedEvm.toLowerCase())
        : s.ethereum.globalAddresses?.[idx];
      const addr = acct?.address;

      if (addr && cid !== null) {
        // Fetch active chain balance + transactions first (highest priority)
        dispatch(fetchEvmBalanceInterval({ chainId: cid, address: addr }));
        dispatch(fetchEvmTransactionsInterval({ chainId: cid, address: addr }));

        // Fetch balances for all other chains (batched)
        const others = evmChainIds.filter(id => id !== cid);
        const BATCH = 4;
        for (let i = 0; i < others.length; i += BATCH) {
          await Promise.all(
            others.slice(i, i + BATCH).map(c =>
              dispatch(fetchEvmBalanceInterval({ chainId: c, address: addr })).catch(() => {})
            )
          );
          if (i + BATCH < others.length) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
      }
    }

    if (!skipSolana) {
      const solIdx = s.solana.activeIndex ?? 0;
      const solAddr = importedSol || s.solana.addresses?.[solIdx]?.address;
      if (solAddr) {
        dispatch(fetchSolanaBalanceInterval(solAddr));
        dispatch(fetchSolanaTransactionsInterval(solAddr));
      }
    }
  }, [dispatch, allChainIds, evmChainIds, isFocused]);

  useEffect(() => {
    if (isFocused) {
      fetchAndUpdatePricesInternal();
    }
  }, [isFocused, fetchAndUpdatePricesInternal]);

  const [refreshing, setRefreshing] = useState(false);
  const [bottomSheetIndex, setBottomSheetIndex, bottomSheetIndexLoading] = useStorage(SNAP_POINTS);
  const snapPoints = useMemo(() => ["10%", "33%", "69%", "88%"], []);

  const initialIndex = useMemo(() => {
    if (bottomSheetIndex === null) return 1;
    const parsed = parseInt(bottomSheetIndex, 10);
    if (isNaN(parsed) || parsed < -1 || parsed >= snapPoints.length) {
      return 1; // Fallback to safe default index if storage is invalid or corrupted
    }
    return parsed;
  }, [bottomSheetIndex, snapPoints]);

  const refreshingRef = useRef(false);
  const onRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchPrices(allChainIds)),
        fetchTokenBalances(false),
        fetchTransactions(false)
      ]);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [dispatch, allChainIds, fetchTokenBalances, fetchTransactions]);
  

  // Re-init: fires whenever the active wallet address changes (import, switch account)
  // OR when a new unlock session starts (ensures fresh data after lock/unlock cycle)
  const unlockedAt = useSelector((state: RootState) => state.biometrics.unlockedAt);
  const prevEthAddrRef = useRef<string>("");
  const prevSolAddrRef = useRef<string>("");
  const prevUnlockRef = useRef<number | undefined>(undefined);
  const initRetryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if ((!ethWalletAddress && !solWalletAddress) || !unlockedAt) return;

    // Skip if same address AND same unlock session (prevents duplicate fetches)
    const sameEthAddr = ethWalletAddress === prevEthAddrRef.current;
    const sameSolAddr = solWalletAddress === prevSolAddrRef.current;
    const sameSession = unlockedAt === prevUnlockRef.current;
    if (sameEthAddr && sameSolAddr && sameSession) return;

    prevEthAddrRef.current = ethWalletAddress;
    prevSolAddrRef.current = solWalletAddress;
    prevUnlockRef.current = unlockedAt;

    let isEffectActive = true;

    // Defer ALL network work until after React finishes rendering and animating.
    // Without this, RPC responses block the JS thread and freeze the UI.
    const handle = InteractionManager.runAfterInteractions(() => {
      const init = async (attempt = 1): Promise<void> => {
        if (!isEffectActive) return;
        let anyFailed = false;

        // Run initial fetches in parallel to optimize startup time
        const pricePromise = dispatch(fetchPrices(allChainIds)).catch((err) => {
          console.warn(`[Init] fetchPrices failed (attempt ${attempt}):`, err);
          anyFailed = true;
        });

        const balancePromise = fetchTokenBalances(true).catch((err) => {
          console.warn(`[Init] fetchTokenBalances failed (attempt ${attempt}):`, err);
          anyFailed = true;
        });

        const txPromise = fetchTransactions(true).catch((err) => {
          console.warn(`[Init] fetchTransactions failed (attempt ${attempt}):`, err);
          anyFailed = true;
        });

        // Fire-and-forget: don't block the UI waiting for RPC responses.
        // Dashboard renders immediately with cached data; balances update as RPCs respond.
        Promise.all([pricePromise, balancePromise, txPromise]).catch(() => {});

        if (!isEffectActive) return;

        // Watchdog: if anything failed and we haven't exhausted retries,
        // schedule another attempt with exponential backoff
        if (anyFailed && attempt < 3) {
          const delay = attempt * 3000; // 3s, 6s
          if (__DEV__) console.log(`[Init] Scheduling retry #${attempt + 1} in ${delay / 1000}s...`);
          initRetryRef.current = setTimeout(() => {
            if (AppState.currentState === "active" && isEffectActive) {
              init(attempt + 1);
            }
          }, delay);
        }
      };
      init();
    });
    return () => {
      isEffectActive = false;
      handle.cancel();
      if (initRetryRef.current) clearTimeout(initRetryRef.current);
    };
  }, [ethWalletAddress, solWalletAddress, unlockedAt, allChainIds, fetchTokenBalances, fetchTransactions, dispatch]);

  // BUG #1 FIX: Use a ref so setInterval never restarts when the callback changes.
  // Previously, fetchAndUpdatePricesInternal changed reference on every dashboard
  // data update (~800ms), causing the interval to teardown/recreate continuously.
  const fetchPricesRef = useRef(fetchAndUpdatePricesInternal);
  fetchPricesRef.current = fetchAndUpdatePricesInternal;

  useEffect(() => {
    const interval = setInterval(() => fetchPricesRef.current(), FETCH_PRICES_INTERVAL);
    return () => clearInterval(interval);
  }, []); // ← Stable: interval created once, never restarts

  // Handle app coming from background to foreground
  // Throttled: only refreshes if the app was in background for >5 seconds
  // This prevents duplicate fetches that conflict with the unlock-init effect
  useEffect(() => {
    let lastBackgroundedAt = Date.now();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        const elapsed = Date.now() - lastBackgroundedAt;
        if (elapsed > 5000) {
          // If the lock timer has expired, the app will auto-lock.
          // We should skip refreshing if:
          // 1. The store currently says we are locked
          // 2. The unlock session has expired (elapsed time since unlockedAt > UNLOCK_TIMEOUT)
          const state = store.getState();
          const { unlocked, unlockedAt } = state.biometrics;
          const sessionExpired = unlocked && unlockedAt && (Date.now() - unlockedAt >= UNLOCK_TIMEOUT);
          
          if (!unlocked || sessionExpired) {
            if (__DEV__) console.log("[Dashboard] App resumed but wallet is locked or session expired. Skipping foreground refresh.");
            return;
          }

          if (__DEV__) console.log(`[Dashboard] App returned to active after ${Math.round(elapsed / 1000)}s, refreshing...`);
          // Clear any pending retry
          if (retryTimer) clearTimeout(retryTimer);

          const refreshWithRetry = async (attempt = 1) => {
            try {
              await onRefresh();
            } catch (err) {
              if (attempt < 3) {
                console.warn(`[Dashboard] Foreground refresh failed (attempt ${attempt}), retrying...`);
                retryTimer = setTimeout(() => refreshWithRetry(attempt + 1), attempt * 2000);
              }
            }
          };
          refreshWithRetry();
        }
      } else if (nextAppState === "background" || nextAppState === "inactive") {
        lastBackgroundedAt = Date.now();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [onRefresh]);

  // ─── Network reconnection auto-refresh ───
  // Two strategies:
  // 1. NetInfo native listener (requires rebuild after install)
  // 2. Pure-JS polling fallback (works immediately without rebuild)
  useEffect(() => {
    let wasOffline = false;
    let netInfoUnsub: (() => void) | null = null;

    // Strategy 1: Try NetInfo (needs native rebuild)
    try {
      NetInfo.fetch().then((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        wasOffline = offline;
        if (offline) {
          if (__DEV__) console.log("[Dashboard] App started offline (NetInfo), waiting for connectivity...");
        }
      }).catch(() => { /* NetInfo not linked yet */ });

      netInfoUnsub = NetInfo.addEventListener((state) => {
        const isOffline = state.isConnected === false || state.isInternetReachable !== true;
        const isOnline = state.isConnected === true && state.isInternetReachable === true;

        if (isOnline && wasOffline) {
          if (__DEV__) console.log("[Dashboard] Network reconnected (NetInfo)! Refreshing...");
          onRefresh();
        }
        wasOffline = isOffline;
      });
    } catch (e) {
      console.warn("[Dashboard] NetInfo not available");
    }

    return () => {
      if (netInfoUnsub) netInfoUnsub();
    };
  }, [onRefresh]);

  const mergedAndSortedTransactions = useMemo(() => {
    const ethTx = ethTransactions ?? [];
    const solTx = solTransactions ?? [];
    return [...solTx, ...ethTx]
      .filter((tx) => tx && tx.blockTime != null)
      .sort((a, b) => b.blockTime - a.blockTime)
      .slice(0, 100);
  }, [solTransactions, ethTransactions]);

  const renderTx = useCallback(({ item }: { item: Transaction }) => {
    const sign = item.direction === "received" ? "+" : "-";
    // Guard against NaN, undefined, and falsy values
    const rawValue = typeof item.value === "number" && !isNaN(item.value) ? item.value : 0;
    // Format: small values get more decimals, strip trailing zeros
    const formattedValue = rawValue === 0
      ? "0"
      : rawValue.toFixed(rawValue < 0.001 ? 6 : 4).replace(/\.?0+$/, "");

    // Check Redux networks first (includes custom chains), then hardcoded list
    const net = (() => {
      if (item.chainId === 101) {
        return {
          chainName: selectedSolanaNetwork === "mainnet" ? "Solana Mainnet" : "Solana devnet",
          symbol: "SOL",
          explorerUrl: "https://explorer.solana.com"
        };
      }
      return chainIdToNetwork[item.chainId ?? 0];
    })();

    const explorerBase = (() => {
      if (item.chainId === 101) return "https://explorer.solana.com";
      return net?.explorerUrl || "https://etherscan.io";
    })();

    return (
      <CryptoInfoCard
        icon={
          <BlockchainIcon
            symbol={getChainIconSymbol(net?.chainName || "", net?.symbol || item.asset || "ETH", item.chainId)}
            chainId={item.chainId}
            chainName={net?.chainName || ""}
            size={35}
          />
        }
        title={capitalizeFirstLetter(item.direction)}
        caption={item.direction === "received" ? `From ${truncateWalletAddress(item.from)}` : `To ${truncateWalletAddress(item.to)}`}
        details={`${sign}${formattedValue}`}
        onPress={() => {
          const solNetwork = item.solanaNetwork || selectedSolanaNetwork;
          const url = item.chainId === 101 && solNetwork === "devnet"
            ? `https://explorer.solana.com/tx/${item.hash}?cluster=devnet`
            : `${explorerBase}/tx/${item.hash}`;
          WebBrowser.openBrowserAsync(url);
        }}
      />
    );
  }, [selectedSolanaNetwork, chainIdToNetwork]);

  const renderAsset = useCallback(({ item: asset }: any) => (
    <View style={styles.cardView}>
      <AssetCard
        chainId={asset.chainId}
        name={asset.name}
        symbol={asset.symbol}
        balance={asset.balance}
        usdValue={asset.usdValue}
        address={asset.address}
        price={prices[asset.chainId]?.usd ?? 0}
        onSelectChain={handleSelectChain}
      />
    </View>
  ), [prices, handleSelectChain, styles.cardView]);

  const handleSheetChange = useCallback((index: number) => {
    setBottomSheetIndex(JSON.stringify(index));
  }, [setBottomSheetIndex]);

  const handleSolPress = useCallback(() => {
    const isDevnet = selectedSolanaNetwork === "devnet";
    router.push({
      pathname: ROUTES.solDetails,
      params: {
        asset: JSON.stringify({
          symbol: "SOL",
          numberOfTokens: solBalance,
          chainId: 101,
          address: solWalletAddress,
          price: isDevnet ? 0 : (prices[101]?.usd ?? 0),
        }),
      },
    });
  }, [solBalance, solWalletAddress, prices, selectedSolanaNetwork]);

  useEffect(() => {
    const initDidcomm = async () => {
      try {
        const DidcommModule = (await import("../../../native-modules/didcomm")).default;
        await DidcommModule.helloWorld();
      } catch (err) {
        console.error("Didcomm error:", err);
      }
    };
    initDidcomm();
  }, []);

  // ─── Memoized style overrides ───
  const contentContainerStyle = useMemo(() => ({
    ...styles.contentContainer,
    marginTop: 0,
  }), [styles.contentContainer]);

  const mainListContentStyle = useMemo(() => ({
    paddingBottom: hp("10%") + 40,
  }), []);

  const bottomSheetContentStyle = useMemo(() => ({
    paddingBottom: insets.bottom + 40,
  }), [insets.bottom]);
  const bottomSheetBgStyle = useMemo(() => ({
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: theme.colors.lightDark,
  }), [theme.colors.lightDark]);
  const handleIndicatorStyle = useMemo(() => ({
    backgroundColor: theme.colors.muted,
    width: 40,
  }), [theme.colors.muted]);

  const totalAssets = ethereumAssets.length + (showSolAssets ? 1 : 0);

  // ─── Memoized list components ───
  const assetListHeader = useMemo(() => (
    <View style={styles.assetHeader}>
      <Text style={styles.bottomSectionTitle}>Assets</Text>
      <View style={styles.assetCountBadge}>
        <Text style={styles.assetCountText}>{totalAssets}</Text>
      </View>
    </View>
  ), [totalAssets, styles]);

  const assetListFooter = useMemo(() => (
    showSolAssets ? (
      <View style={styles.cardView}>
        <CryptoInfoCard
          onPress={handleSolPress}
          title={selectedSolanaNetwork === "mainnet" ? "Solana Mainnet" : "Solana devnet"}
          caption={`${solBalance} SOL`}
          details={formatDollar(solUsd)}
          icon={<BlockchainIcon symbol="SOL" size={25} />}
          hideBackground
        />
      </View>
    ) : null
  ), [showSolAssets, solBalance, solUsd, handleSolPress, styles.cardView, selectedSolanaNetwork]);

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header />
      <View style={contentContainerStyle}>
        <View style={styles.cardContainer}>
          <View style={styles.cardBalanceContainer}>
            <Text 
              style={styles.cardBalanceLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Total Balance
            </Text>
            <Text 
              style={styles.cardBalanceText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              <Text style={styles.cardDollarSign}>$</Text>
              {formatDollarRaw(totalUsdBalance)}
            </Text>
          </View>

          <View style={styles.addressesRow}>
            {ethWalletAddress ? (
              <TouchableOpacity 
                style={styles.addressBadge}
                onPress={() => handleCopyAddress(ethWalletAddress, "EVM")}
                activeOpacity={0.7}
              >
                <View style={styles.badgeLabelContainer}>
                  <Text style={styles.badgeLabelText}>EVM</Text>
                </View>
                <Text style={styles.badgeAddressText}>{truncateWalletAddress(ethWalletAddress, 5, 4)}</Text>
                <CopyIcon width={12} height={12} fill={theme.colors.lightGrey} />
              </TouchableOpacity>
            ) : null}

            {solWalletAddress ? (
              <TouchableOpacity 
                style={styles.addressBadge}
                onPress={() => handleCopyAddress(solWalletAddress, "SOL")}
                activeOpacity={0.7}
              >
                <View style={styles.badgeLabelContainer}>
                  <Text style={styles.badgeLabelText}>SOL</Text>
                </View>
                <Text style={styles.badgeAddressText}>{truncateWalletAddress(solWalletAddress, 5, 5)}</Text>
                <CopyIcon width={12} height={12} fill={theme.colors.lightGrey} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {rpcCircuitBreaker.hasOpenCircuits() && (
          <View style={styles.networkBanner}>
            <Text style={styles.networkBannerText}>
              ⚠️ Some networks are temporarily unreachable. Balances may be outdated.
            </Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        <FlashList
          contentContainerStyle={mainListContentStyle as any}
          estimatedItemSize={72}
          ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
          refreshControl={
            <RefreshControl
              tintColor={theme.colors.primary}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          data={mergedAndSortedTransactions}
          renderItem={renderTx}
          keyExtractor={(item: Transaction) => `${item.uniqueId}-${item.chainId}`}
          ListEmptyComponent={<InfoBanner />}
        />

        {failedEthStatus && failedSolStatus && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ Network error — please try again later</Text>
          </View>
        )}
      </View>

      {!bottomSheetIndexLoading && (
        <BottomSheet
          ref={sheetRef}
          index={initialIndex}
          onChange={handleSheetChange}
          snapPoints={snapPoints}
          backgroundStyle={bottomSheetBgStyle}
          handleIndicatorStyle={handleIndicatorStyle}
          enableOverDrag={false}
          enableDynamicSizing={false}
        >
          <BottomSheetFlatList
            key={ethWalletAddress + "-" + solWalletAddress}
            data={ethereumAssets}
            extraData={{
              totalAssets,
              showSolAssets,
              solBalance,
              solUsd,
              selectedSolanaNetwork,
              prices,
            }}
            keyExtractor={(item) => item.key}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            contentContainerStyle={bottomSheetContentStyle as any}
            ListHeaderComponent={assetListHeader}
            renderItem={renderAsset}
            ListFooterComponent={assetListFooter}
            ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
          />
        </BottomSheet>
      )}
      {copiedBanner.visible && (
        <View style={styles.copiedBannerContainer}>
          <Text style={styles.copiedBannerTitle}>Copied!</Text>
          <Text style={styles.copiedBannerSubtitle}>
            {copiedBanner.type === "EVM" ? "EVM" : "Solana"} address copied to clipboard
          </Text>
        </View>
      )}
    </SafeAreaContainer>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES — computed once per theme, cached by useMemo
// Unlike styled-components which re-evaluate template literals
// on every render, StyleSheet.create runs once.
// ═══════════════════════════════════════════════════════════

function createStyles(theme: ThemeType, insets: EdgeInsets) {
  const sp = (val: string | number) => (typeof val === "number" ? val : parseFloat(val));

  return StyleSheet.create({
    contentContainer: {
      flex: 1,
      justifyContent: "flex-start",
      padding: sp(theme.spacing.medium),
    },
    cardContainer: {
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: sp(theme.borderRadius.large),
      padding: sp(theme.spacing.large),
      width: "100%",
      marginBottom: sp(theme.spacing.large),
      alignItems: "center",
    },
    cardBalanceContainer: {
      alignItems: "center",
      marginBottom: sp(theme.spacing.medium),
    },
    cardBalanceLabel: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: wp("3.5%"),
      color: theme.colors.lightGrey,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      marginBottom: 8,
      width: "100%",
      textAlign: "center",
    },
    cardBalanceText: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: wp("12%"),
      color: theme.colors.white,
      textAlign: "center",
      letterSpacing: -1,
      width: "100%",
    },
    cardDollarSign: {
      color: theme.colors.primary,
      fontFamily: theme.fonts.families.openBold,
      fontSize: wp("8%"),
      textAlign: "center",
    },
    addressesRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      gap: 10,
    },
    addressBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: sp(theme.borderRadius.pill),
      paddingLeft: 6,
      paddingRight: 10,
      paddingVertical: 6,
      gap: 6,
    },
    badgeLabelContainer: {
      backgroundColor: theme.colors.primary,
      borderRadius: sp(theme.borderRadius.pill),
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeLabelText: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: wp("2.8%"),
      color: "#000000",
    },
    badgeAddressText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: wp("3.2%"),
      color: theme.colors.white,
    },
    copiedBannerContainer: {
      position: "absolute",
      bottom: insets.bottom + 80,
      left: 16,
      right: 16,
      backgroundColor: "#151920",
      borderWidth: 1,
      borderColor: "#2A2F3E",
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
      zIndex: 9999,
    },
    copiedBannerTitle: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: wp("4%"),
      color: "#FFFFFF",
      marginBottom: 2,
    },
    copiedBannerSubtitle: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: wp("3.5%"),
      color: "#FFFFFF",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: sp(theme.spacing.medium),
      marginTop: sp(theme.spacing.small),
    },
    sectionTitle: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: sp(theme.fonts.sizes.header),
      color: theme.colors.white,
      letterSpacing: 0.3,
      flex: 1,
    },
    sectionAction: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: sp(theme.fonts.sizes.small),
      color: theme.colors.primary,
      flexShrink: 0,
      marginLeft: sp(theme.spacing.small),
    },
    cardView: {
      marginBottom: sp(theme.spacing.small),
      width: "100%",
    },
    bottomSectionTitle: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: sp(theme.fonts.sizes.title),
      color: theme.colors.white,
      marginBottom: sp(theme.spacing.medium),
      marginLeft: sp(theme.spacing.small),
      letterSpacing: 0.3,
      flex: 1,
    },
    errorContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      backgroundColor: "rgba(255, 77, 79, 0.15)",
      borderWidth: 1,
      borderColor: "rgba(255, 77, 79, 0.3)",
      borderRadius: sp(theme.borderRadius.medium),
      height: 56,
      padding: sp(theme.spacing.medium),
      marginTop: sp(theme.spacing.medium),
    },
    errorText: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: sp(theme.fonts.sizes.small),
      color: theme.colors.error,
    },
    assetCountBadge: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: sp(theme.borderRadius.pill),
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    assetCountText: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: sp(theme.fonts.sizes.small),
      color: theme.colors.lightGrey,
    },
    assetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    networkBanner: {
      backgroundColor: "rgba(255, 193, 7, 0.15)",
      borderWidth: 1,
      borderColor: "rgba(255, 193, 7, 0.3)",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    networkBannerText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: sp(theme.fonts.sizes.small),
      color: "rgba(255, 193, 7, 1)",
      textAlign: "center",
    },
  });
}
