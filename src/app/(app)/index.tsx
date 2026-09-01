import { useEffect, useCallback, useRef, useMemo, useState } from "react";
import { View, RefreshControl, Text, StyleSheet, InteractionManager, AppState, AppStateStatus, ScrollView } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import NetInfo from "@react-native-community/netinfo";
import { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";
import { type AppDispatch, store, type RootState } from "../../store";
import { UNLOCK_TIMEOUT } from "../../store/biometricsSlice";
import {
  fetchEvmBalance,
  fetchEvmBalanceInterval,
} from "../../store/ethereumSlice";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import Header from "../../components/Header/Header";
import { selectActiveChainIds } from "../../store/selectors/dashboardSelectors";
import { useDashboardData } from "../../hooks/useDashboardData";

export default function Index() {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const theme = useTheme() as ThemeType;

  // ─── Theme-derived styles ───
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const {
    ethWalletAddress,
    failedEthStatus,
    evmChainIds,
    isFocused,
  } = useDashboardData(800);

  // ─── Fetch helpers: read from store.getState() to avoid any selector deps ───
  const fetchTokenBalances = useCallback(async (lazy = false) => {
    const s = store.getState();
    const idx = s.ethereum.activeIndex ?? 0;
    const acct = s.ethereum.globalAddresses?.[idx];
    const addr = acct?.address;
    const cid = s.ethereum.activeChainId;

    if (addr && cid !== null) {
      // Fetch active chain balance — fire-and-forget (NON-BLOCKING)
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
  }, [dispatch]);

  const fetchBalancesInterval = useCallback(async () => {
    if (AppState.currentState !== "active" || !isFocused) return;

    // Skip all fetches if the wallet is locked or session has expired
    const lockState = store.getState().biometrics;
    if (!lockState.unlocked || (lockState.unlockedAt && (Date.now() - lockState.unlockedAt >= UNLOCK_TIMEOUT))) {
      return;
    }

    const s = store.getState();
    const cid = s.ethereum.activeChainId;
    const idx = s.ethereum.activeIndex ?? 0;
    const acct = s.ethereum.globalAddresses?.[idx];
    const addr = acct?.address;

    if (addr && cid !== null) {
      // Fetch active chain balance
      dispatch(fetchEvmBalanceInterval({ chainId: cid, address: addr }));

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
  }, [dispatch, evmChainIds, isFocused]);

  useEffect(() => {
    if (isFocused) {
      fetchBalancesInterval();
    }
  }, [isFocused, fetchBalancesInterval]);

  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const onRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await fetchTokenBalances(false);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [fetchTokenBalances]);

  // Re-init: fires whenever the active wallet address changes
  // OR when a new unlock session starts (ensures fresh data after lock/unlock cycle)
  const unlockedAt = useSelector((state: RootState) => state.biometrics.unlockedAt);
  const prevEthAddrRef = useRef<string>("");
  const prevUnlockRef = useRef<number | undefined>(undefined);
  const initRetryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!ethWalletAddress || !unlockedAt) return;

    // Skip if same address AND same unlock session (prevents duplicate fetches)
    const sameEthAddr = ethWalletAddress === prevEthAddrRef.current;
    const sameSession = unlockedAt === prevUnlockRef.current;
    if (sameEthAddr && sameSession) return;

    prevEthAddrRef.current = ethWalletAddress;
    prevUnlockRef.current = unlockedAt;

    let isEffectActive = true;

    // Defer ALL network work until after React finishes rendering and animating.
    const handle = InteractionManager.runAfterInteractions(() => {
      const init = async (attempt = 1): Promise<void> => {
        if (!isEffectActive) return;
        let anyFailed = false;

        const balancePromise = fetchTokenBalances(true).catch((err) => {
          console.warn(`[Init] fetchTokenBalances failed (attempt ${attempt}):`, err);
          anyFailed = true;
        });

        await balancePromise;

        if (!isEffectActive) return;

        // Watchdog: if anything failed and we haven't exhausted retries,
        // schedule another attempt with exponential backoff
        if (anyFailed && attempt < 3) {
          const delay = attempt * 3000; // 3s, 6s
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
  }, [ethWalletAddress, unlockedAt, fetchTokenBalances]);

  // Handle app coming from background to foreground
  useEffect(() => {
    let lastBackgroundedAt = Date.now();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        const elapsed = Date.now() - lastBackgroundedAt;
        if (elapsed > 5000) {
          const state = store.getState();
          const { unlocked, unlockedAt } = state.biometrics;
          const sessionExpired = unlocked && unlockedAt && (Date.now() - unlockedAt >= UNLOCK_TIMEOUT);
          
          if (!unlocked || sessionExpired) {
            return;
          }

          if (retryTimer) clearTimeout(retryTimer);

          const refreshWithRetry = async (attempt = 1) => {
            try {
              await onRefresh();
            } catch (err) {
              if (attempt < 3) {
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
  useEffect(() => {
    let wasOffline = false;
    let netInfoUnsub: (() => void) | null = null;

    try {
      NetInfo.fetch().then((state) => {
        const offline = state.isConnected === false || state.isInternetReachable === false;
        wasOffline = offline;
      }).catch(() => {});

      netInfoUnsub = NetInfo.addEventListener((state) => {
        const isOffline = state.isConnected === false || state.isInternetReachable !== true;
        const isOnline = state.isConnected === true && state.isInternetReachable === true;

        if (isOnline && wasOffline) {
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

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header />
      <ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {failedEthStatus && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ Network error — please try again later</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaContainer>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES — computed once per theme, cached by useMemo
// ═══════════════════════════════════════════════════════════

function createStyles(theme: ThemeType, insets: EdgeInsets) {
  const sp = (val: string | number) => (typeof val === "number" ? val : parseFloat(val));

  return StyleSheet.create({
    contentContainer: {
      flexGrow: 1,
      justifyContent: "flex-start",
      padding: sp(theme.spacing.medium),
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
  });
}
