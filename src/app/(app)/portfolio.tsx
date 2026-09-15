import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Linking,
  AppState,
} from "react-native";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAccount, useAppKit } from "@reown/appkit-react-native";
import { useDispatch, useSelector } from "react-redux";

import type { ThemeType } from "../../styles/theme";
import type { RootState, AppDispatch } from "../../store";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import Header from "../../components/Header/Header";
import { BlockchainIcon } from "../../components/BlockchainIcon/BlockchainIcon";
import { ChainSelectorModal } from "../../components/ChainSelectorModal/ChainSelectorModal";
import { CHAINS, type Chain } from "../../constants/tokenRegistry";

import {
  PortfolioChart,
  Timeframe,
} from "../../components/PortfolioChart/PortfolioChart";
import {
  SwapIcon,
  CoinsIcon,
  YieldIcon,
  HistoryIcon,
} from "../../components/Icons/AppIcons";
import { getChainExplorerTxUrl } from "../../utils/chainMapping";

import {
  fetchPortfolio,
  fetchPortfolioChart,
  fetchPortfolioTransactions,
  fetchSwapHistory,
  refreshPortfolio,
  clearPortfolioData,
  setSelectedTimeframe,
  setSelectedChain,
  selectPortfolioSummary,
  selectPortfolioHoldings,
  selectPortfolioChartData,
  selectPortfolioTransactions,
  selectSwapHistory,
  selectPortfolioDefi,
  selectPortfolioStatus,
  selectPortfolioRefreshing,
  selectPortfolioSelectedTimeframe,
  selectPortfolioError,
} from "../../store/portfolioSlice";
import { resolveTokenForSwap } from "../../utils/tokenResolution";
import { setPendingSwapFromToken } from "../../store/swapSlice";
import { PortfolioHolding } from "../../api/portfolioApi";

type TabType = "tokens" | "defi" | "activity";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "1Y", "ALL"];

export default function PortfolioScreen() {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const dispatch = useDispatch<AppDispatch>();

  const { isConnected, address: appKitAddress } = useAccount();
  const { open } = useAppKit();

  // Check for internal wallet address if appKitAddress not present
  const internalAddress = useSelector((state: RootState) => {
    const eth = state.ethereum;
    return eth?.globalAddresses?.[eth?.activeIndex ?? 0]?.address;
  });

  // Debug override address from Settings → Developer Tools
  const debugOverrideAddress = useSelector(
    (state: RootState) => state.settings?.debugOverrideAddress ?? ""
  );

  const activeAddress = debugOverrideAddress || appKitAddress || internalAddress || null;

  // Redux portfolio selectors
  const summary = useSelector(selectPortfolioSummary);
  const holdings = useSelector(selectPortfolioHoldings);
  const reduxTimeframe = useSelector(selectPortfolioSelectedTimeframe) as Timeframe;
  const chartData = useSelector(selectPortfolioChartData(reduxTimeframe));
  const transactions = useSelector(selectPortfolioTransactions);
  const swapHistory = useSelector(selectSwapHistory);
  const defiPositions = useSelector(selectPortfolioDefi);
  const status = useSelector(selectPortfolioStatus);
  const isRefreshing = useSelector(selectPortfolioRefreshing);
  const portfolioError = useSelector(selectPortfolioError);

  const [selectedChainState, setSelectedChainState] = useState<Chain>(CHAINS[0]);
  const [chainModalVisible, setChainModalVisible] = useState(false);
  const [scrubPoint, setScrubPoint] = useState<{ time: string; value: number } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("tokens");

  // Fetch portfolio data and transactions when activeAddress or selectedChain changes
  useEffect(() => {
    if (activeAddress) {
      dispatch(fetchPortfolio({ chain: selectedChainState.id, address: activeAddress }));
      dispatch(fetchPortfolioTransactions({ chain: selectedChainState.id, address: activeAddress, page: 1, limit: 20 }));
      dispatch(fetchSwapHistory({ chain: selectedChainState.id, address: activeAddress, page: 1, limit: 20 }));
    }
  }, [dispatch, activeAddress, selectedChainState.id]);

  // Fetch portfolio chart when activeAddress, selectedChain, or timeframe changes
  useEffect(() => {
    if (activeAddress) {
      dispatch(fetchPortfolioChart({ chain: selectedChainState.id, address: activeAddress, range: reduxTimeframe }));
    }
  }, [dispatch, activeAddress, selectedChainState.id, reduxTimeframe]);

  // App foreground active refresh: updates portfolio using cache-first freshness on resume
  useEffect(() => {
    if (!activeAddress) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        dispatch(fetchPortfolio({ chain: selectedChainState.id, address: activeAddress }));
        dispatch(fetchPortfolioChart({ chain: selectedChainState.id, address: activeAddress, range: reduxTimeframe }));
      }
    });

    return () => subscription.remove();
  }, [dispatch, activeAddress, selectedChainState.id, reduxTimeframe]);

  const onRefresh = useCallback(async () => {
    if (activeAddress) {
      await dispatch(refreshPortfolio({ chain: selectedChainState.id, address: activeAddress }));
      dispatch(fetchPortfolioChart({ chain: selectedChainState.id, address: activeAddress, range: reduxTimeframe }));
      dispatch(fetchPortfolioTransactions({ chain: selectedChainState.id, address: activeAddress, page: 1, limit: 20 }));
      dispatch(fetchSwapHistory({ chain: selectedChainState.id, address: activeAddress, page: 1, limit: 20 }));
    }
  }, [dispatch, activeAddress, selectedChainState.id, reduxTimeframe]);

  const handleNavigateSwap = async (holding?: PortfolioHolding | unknown) => {
    if (holding && typeof holding === "object" && "symbol" in holding) {
      const h = holding as PortfolioHolding;
      try {
        const resolved = await resolveTokenForSwap({
          symbol: h.symbol,
          name: h.name,
          coinId: h.coinId,
          contractAddress: h.contractAddress,
          chainId: selectedChainState.id,
          logoUrl: h.logoUrl,
        });

        dispatch(
          setPendingSwapFromToken({
            symbol: resolved.token.symbol,
            name: resolved.token.name,
            address: resolved.token.address,
            chainId: resolved.chain.id,
            logoUrl: resolved.token.icon,
            color: resolved.token.color,
          })
        );
      } catch (e) {
        console.warn("Failed to resolve holding for swap:", e);
      }
    }
    router.replace("/(app)");
  };

  const handleSelectChain = (chain: Chain) => {
    // 1. Immediately wipe previous chain state to prevent showing stale data
    dispatch(clearPortfolioData());
    setScrubPoint(null);
    setActiveTab("tokens");
    setSelectedChainState(chain);
    dispatch(setSelectedChain(chain.id));
    setChainModalVisible(false);
  };

  const handleSelectTimeframe = (tf: Timeframe) => {
    dispatch(setSelectedTimeframe(tf));
    setScrubPoint(null);
  };

  const handleOpenExplorer = (url: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => console.warn("Could not open explorer URL:", err));
    }
  };

  // Balance display
  const totalVal = summary?.totalValueUsd ?? 0;
  const displayBalance = scrubPoint
    ? `$${scrubPoint.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayLabel = scrubPoint
    ? `Portfolio at ${scrubPoint.time}`
    : "Total Net Worth";

  // PnL display — uses only real data, no mock fallback
  const pnlText = useMemo(() => {
    if (chartData?.pnl && chartData?.pnlPercent) {
      return `${chartData.pnl} (${chartData.pnlPercent})`;
    }
    if (summary) {
      const isPos = summary.change24hPercent >= 0;
      const usdSign = isPos ? "+$" : "-$";
      const pctSign = isPos ? "+" : "";
      return `${usdSign}${Math.abs(summary.change24hUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pctSign}${summary.change24hPercent.toFixed(2)}%)`;
    }
    return "$0.00 (0.00%)";
  }, [chartData, summary]);

  const isPositivePnl = chartData ? chartData.isPositive : (summary ? summary.change24hPercent >= 0 : true);

  // Combined activities (app swap records + on-chain transactions)
  const combinedActivities = useMemo(() => {
    const swapItems = swapHistory.items.map((s) => ({
      id: `swap-${s.id || s.txHash}`,
      title: `${s.fromAmount || ""} ${s.fromTokenSymbol || ""} ➔ ${s.toAmount || ""} ${s.toTokenSymbol || ""}`.trim() || "Token Swap",
      subtitle: s.router || "Aggregated Swap",
      time: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "Recent",
      hash: s.txHash ? `${s.txHash.slice(0, 6)}...${s.txHash.slice(-4)}` : "",
      status: s.status === "completed" ? "Completed" : s.status === "failed" ? "Failed" : "Pending",
      isSwap: true,
      explorerUrl: getChainExplorerTxUrl(s.chain || selectedChainState.id, s.txHash),
    }));

    const txItems = transactions.items.map((t) => ({
      id: t.id,
      title: `${t.type.toUpperCase()}: ${t.amount}`,
      subtitle: t.coinName || t.coinSymbol,
      time: t.date ? new Date(t.date).toLocaleDateString() : "Recent",
      hash: t.hash ? `${t.hash.slice(0, 6)}...${t.hash.slice(-4)}` : "",
      status: "Completed",
      isSwap: t.type === "swap",
      explorerUrl: t.explorerUrl || getChainExplorerTxUrl(selectedChainState.id, t.hash),
    }));

    return [...swapItems, ...txItems];
  }, [swapHistory.items, transactions.items, selectedChainState.id]);

  const isLoadingInitial = status === "loading" && !summary;
  const isRateLimited = status === "failed" && portfolioError && (
    portfolioError.includes('rate limit') ||
    portfolioError.includes('Rate limit') ||
    portfolioError.includes('429') ||
    portfolioError.includes('406') ||
    portfolioError.includes('Credits limit')
  );

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header
        title="Portfolio"
        rightAction="network"
        currentChainName={selectedChainState.name}
        onOpenChainModal={() => setChainModalVisible(true)}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={isRefreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* ═══ API Rate-limit / Error Banner ═══ */}
        {isRateLimited && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTitle}>⏳ Data Provider Temporarily Unavailable</Text>
            <Text style={styles.errorBannerText}>
              API rate limit reached. Pull down to retry or wait a few minutes for data to refresh automatically.
            </Text>
          </View>
        )}
        {status === "failed" && !isRateLimited && portfolioError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTitle}>⚠️ Portfolio Error</Text>
            <Text style={styles.errorBannerText}>{portfolioError}</Text>
          </View>
        )}

        {/* ═══ Wallet Connection Banner (if not connected) ═══ */}
        {!activeAddress && (
          <View style={styles.connectPromptCard}>
            <Text style={styles.connectPromptTitle}>Connect Your Wallet</Text>
            <Text style={styles.connectPromptSubtitle}>
              Connect your Web3 wallet to track your real balances, tokens, and swap history.
            </Text>
            <TouchableOpacity style={styles.connectButton} onPress={() => open()} activeOpacity={0.85}>
              <LinearGradient
                colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.connectGradient}
              >
                <Text style={styles.connectButtonText}>Connect Wallet</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ Hero Net Worth Card ═══ */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBalanceContainer}>
              <Text style={styles.heroLabel}>{displayLabel}</Text>
              <Text
                style={styles.heroBalance}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {isLoadingInitial ? "$---" : displayBalance}
              </Text>
            </View>
            <View
              style={[
                styles.pnlBadge,
                !isPositivePnl && { backgroundColor: `${theme.colors.error}22`, borderColor: `${theme.colors.error}35` },
              ]}
            >
              <Text
                style={[
                  styles.pnlText,
                  !isPositivePnl && { color: theme.colors.error },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {isLoadingInitial ? "Loading..." : pnlText}
              </Text>
            </View>
          </View>

          {/* Interactive Chart */}
          <PortfolioChart
            timeframe={reduxTimeframe}
            data={chartData}
            isLoading={isLoadingInitial}
            onScrubChange={setScrubPoint}
          />

          {/* Timeframe Selector */}
          <View style={styles.timeframeRow}>
            {TIMEFRAMES.map((tf) => {
              const isSelected = reduxTimeframe === tf;
              return (
                <TouchableOpacity
                  key={tf}
                  onPress={() => handleSelectTimeframe(tf)}
                  style={[
                    styles.tfPill,
                    isSelected && { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.tfText,
                      isSelected && { color: "#FFFFFF", fontWeight: "700" },
                    ]}
                  >
                    {tf}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ═══ Primary Swap Action Button ═══ */}
          <TouchableOpacity
            style={styles.mainSwapBtn}
            onPress={handleNavigateSwap}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.mainSwapGradient}
            >
              <SwapIcon size={18} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.mainSwapBtnText}>Swap Tokens</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ═══ Segmented Tabs (Tokens / DeFi / Activity) ═══ */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "tokens" && styles.tabButtonActive]}
            onPress={() => setActiveTab("tokens")}
            activeOpacity={0.75}
          >
            <CoinsIcon
              size={16}
              color={activeTab === "tokens" ? "#FFFFFF" : theme.colors.lightGrey}
              strokeWidth={2}
            />
            <Text
              style={[styles.tabText, activeTab === "tokens" && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              Holdings ({holdings.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "defi" && styles.tabButtonActive]}
            onPress={() => setActiveTab("defi")}
            activeOpacity={0.75}
          >
            <YieldIcon
              size={16}
              color={activeTab === "defi" ? "#FFFFFF" : theme.colors.lightGrey}
              strokeWidth={2}
            />
            <Text
              style={[styles.tabText, activeTab === "defi" && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              DeFi Yield ({defiPositions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "activity" && styles.tabButtonActive]}
            onPress={() => setActiveTab("activity")}
            activeOpacity={0.75}
          >
            <HistoryIcon
              size={16}
              color={activeTab === "activity" ? "#FFFFFF" : theme.colors.lightGrey}
              strokeWidth={2}
            />
            <Text
              style={[styles.tabText, activeTab === "activity" && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              Swap History ({combinedActivities.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═══ Tab 1: Tokens ═══ */}
        {activeTab === "tokens" && (
          <View style={styles.listCard}>
            {isLoadingInitial ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading wallet balances...</Text>
              </View>
            ) : holdings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Tokens Found</Text>
                <Text style={styles.emptySubtitle}>
                  No token balances detected for this address on {selectedChainState.name}.
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionButton}
                  onPress={handleNavigateSwap}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyActionText}>Get Tokens via Swap</Text>
                </TouchableOpacity>
              </View>
            ) : (
              holdings.map((token, idx) => {
                const isPositive = token.change24hPercent >= 0;
                return (
                  <View
                    key={token.id || token.symbol}
                    style={[
                      styles.tokenRow,
                      idx < holdings.length - 1 && styles.rowDivider,
                    ]}
                  >
                    <View style={styles.tokenLeft}>
                      <BlockchainIcon symbol={token.symbol} size={36} logoUrl={token.logoUrl} />
                      <View style={styles.tokenInfoCol}>
                        <View style={styles.symbolRow}>
                          <Text style={styles.tokenSymbolText} numberOfLines={1} ellipsizeMode="tail">
                            {token.symbol}
                          </Text>
                          <View style={styles.chainPill}>
                            <Text style={styles.chainPillText}>{token.allocationPercent}%</Text>
                          </View>
                        </View>
                        <Text style={styles.tokenBalanceText} numberOfLines={1} ellipsizeMode="tail">
                          {token.balance}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.tokenMiddle}>
                      <Text
                        style={styles.tokenValueText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {token.valueUsd !== null && token.valueUsd !== undefined
                          ? `$${token.valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.tokenPriceText,
                          { color: isPositive ? theme.colors.success : theme.colors.error },
                        ]}
                      >
                        {token.priceUsd > 0
                          ? `$${token.priceUsd < 0.01 ? token.priceUsd.toPrecision(3) : token.priceUsd.toFixed(2)} (${isPositive ? "+" : ""}${token.change24hPercent.toFixed(2)}%)`
                          : '—'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.tokenSwapBtn}
                      onPress={() => handleNavigateSwap(token)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.tokenSwapGradient}
                      >
                        <Text style={styles.tokenSwapBtnText}>Swap</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ═══ Tab 2: DeFi Positions ═══ */}
        {activeTab === "defi" && (
          <View style={styles.listCard}>
            {defiPositions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>🚀 DeFi Tracking — Coming Soon</Text>
                <Text style={styles.emptySubtitle}>
                  We're building real-time DeFi position tracking for lending, staking, and liquidity pools on {selectedChainState.name}. Stay tuned!
                </Text>
                <View style={styles.defiSuggestions}>
                  <Text style={styles.defiSuggestionsTitle}>
                    POPULAR PROTOCOLS ON {selectedChainState.name.toUpperCase()}
                  </Text>
                  <View style={styles.defiTagsRow}>
                    {(selectedChainState.id === "56"
                      ? ["PancakeSwap", "Venus", "Alpaca", "Biswap"]
                      : selectedChainState.id === "137"
                      ? ["QuickSwap", "Aave V3", "Uniswap V3", "Balancer"]
                      : selectedChainState.id === "42161"
                      ? ["GMX", "Camelot", "Aave V3", "Radiant"]
                      : selectedChainState.id === "8453"
                      ? ["Aerodrome", "Moonwell", "Uniswap V3"]
                      : ["Lido", "Aave V3", "Uniswap V3", "Curve", "Maker / Sky"]
                    ).map((proto) => (
                      <View key={proto} style={styles.defiTag}>
                        <Text style={styles.defiTagText}>{proto}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.emptyActionButton}
                  onPress={handleNavigateSwap}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyActionText}>Get Yield Tokens via Swap</Text>
                </TouchableOpacity>
              </View>
            ) : (
              defiPositions.map((pos, idx) => (
                <View
                  key={`${pos.protocol}-${pos.pool}-${idx}`}
                  style={[
                    styles.tokenRow,
                    idx < defiPositions.length - 1 && styles.rowDivider,
                  ]}
                >
                  <View style={styles.tokenLeft}>
                    <BlockchainIcon symbol={pos.protocol} size={36} logoUrl={pos.icon} />
                    <View style={styles.tokenInfoCol}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.tokenSymbolText} numberOfLines={1}>{pos.protocol}</Text>
                        <View style={styles.chainPill}>
                          <Text style={styles.chainPillText}>{pos.type}</Text>
                        </View>
                      </View>
                      <Text style={styles.defiPoolText} numberOfLines={1}>{pos.pool}</Text>
                      <Text style={styles.defiEarningsText} numberOfLines={1}>{pos.earnings}</Text>
                    </View>
                  </View>

                  <View style={styles.tokenRight}>
                    <Text
                      style={styles.tokenValueText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {pos.deposited}
                    </Text>
                    <View style={styles.apyBadge}>
                      <Text style={styles.apyText} numberOfLines={1}>APY {pos.apy}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ═══ Tab 3: Swap Activity History ═══ */}
        {activeTab === "activity" && (
          <View style={styles.listCard}>
            {combinedActivities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Recent Activity</Text>
                <Text style={styles.emptySubtitle}>
                  Swaps and wallet transactions executed on {selectedChainState.name} will appear here.
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionButton}
                  onPress={handleNavigateSwap}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyActionText}>Start Swapping</Text>
                </TouchableOpacity>
              </View>
            ) : (
              combinedActivities.map((act, idx) => (
                <TouchableOpacity
                  key={act.id}
                  style={[
                    styles.tokenRow,
                    idx < combinedActivities.length - 1 && styles.rowDivider,
                  ]}
                  onPress={() => handleOpenExplorer(act.explorerUrl)}
                  activeOpacity={act.explorerUrl ? 0.7 : 1}
                >
                  <View style={styles.tokenLeft}>
                    <View style={styles.activityIconBox}>
                      <SwapIcon size={16} color={theme.colors.primaryLight} strokeWidth={2.2} />
                    </View>
                    <View style={styles.tokenInfoCol}>
                      <Text style={styles.tokenSymbolText} numberOfLines={1}>
                        {act.title}
                      </Text>
                      <Text style={styles.activityDexText} numberOfLines={1}>{act.subtitle}</Text>
                      <Text style={styles.activityTimeText} numberOfLines={1}>{act.time} · {act.hash}</Text>
                    </View>
                  </View>

                  <View style={styles.tokenRight}>
                    <View style={styles.completedBadge}>
                      <View style={styles.greenDot} />
                      <Text style={styles.completedText}>{act.status}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <ChainSelectorModal
        visible={chainModalVisible}
        target="from"
        onClose={() => setChainModalVisible(false)}
        onSelect={handleSelectChain}
      />
    </SafeAreaContainer>
  );
}

function createStyles(theme: ThemeType, insets: EdgeInsets) {
  return StyleSheet.create({
    scrollContent: {
      padding: 16,
      gap: 14,
    },
    errorBanner: {
      backgroundColor: `${theme.colors.error}15`,
      borderWidth: 1,
      borderColor: `${theme.colors.error}40`,
      borderRadius: 14,
      padding: 14,
      gap: 4,
    },
    errorBannerTitle: {
      color: theme.colors.error,
      fontSize: 14,
      fontWeight: "700",
    },
    errorBannerText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      lineHeight: 17,
    },
    connectPromptCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 18,
      gap: 10,
    },
    connectPromptTitle: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: "700",
    },
    connectPromptSubtitle: {
      color: theme.colors.grey,
      fontSize: 13,
      lineHeight: 18,
    },
    connectButton: {
      marginTop: 4,
      borderRadius: 12,
      overflow: "hidden",
    },
    connectGradient: {
      paddingVertical: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    connectButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },
    heroCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 12,
    },
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroBalanceContainer: {
      flex: 1,
      marginRight: 10,
      minWidth: 0,
    },
    heroLabel: {
      color: theme.colors.grey,
      fontSize: 12,
      fontWeight: "500",
    },
    heroBalance: {
      color: theme.colors.white,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.5,
      marginTop: 2,
    },
    pnlBadge: {
      backgroundColor: `${theme.colors.success}22`,
      borderWidth: 1,
      borderColor: `${theme.colors.success}35`,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      flexShrink: 0,
      maxWidth: "46%",
    },
    pnlText: {
      color: theme.colors.success,
      fontSize: 12,
      fontWeight: "700",
    },
    timeframeRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 3,
      justifyContent: "space-between",
    },
    tfPill: {
      flex: 1,
      paddingVertical: 6,
      alignItems: "center",
      borderRadius: 9,
    },
    tfText: {
      color: theme.colors.lightGrey,
      fontSize: 11,
      fontWeight: "600",
    },
    mainSwapBtn: {
      marginTop: 6,
      borderRadius: 14,
      overflow: "hidden",
    },
    mainSwapGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 13,
      gap: 8,
    },
    mainSwapBtnText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
    tabContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 3,
      alignItems: "center",
    },
    tabButton: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 6,
      alignItems: "center",
      borderRadius: 10,
      flexDirection: "row",
      justifyContent: "center",
      gap: 5,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 5,
      elevation: 3,
    },
    tabText: {
      color: theme.colors.lightGrey,
      fontSize: 11.5,
      fontWeight: "600",
      letterSpacing: -0.2,
      flexShrink: 1,
    },
    tabTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    listCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      minHeight: 120,
    },
    loadingContainer: {
      paddingVertical: 32,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    loadingText: {
      color: theme.colors.grey,
      fontSize: 13,
    },
    emptyContainer: {
      paddingVertical: 32,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    emptyTitle: {
      color: theme.colors.white,
      fontSize: 15,
      fontWeight: "700",
    },
    emptySubtitle: {
      color: theme.colors.lightGrey,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 19,
    },
    emptyActionButton: {
      marginTop: 8,
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    emptyActionText: {
      color: theme.colors.primaryLight,
      fontSize: 12,
      fontWeight: "700",
    },
    defiSuggestions: {
      marginTop: 10,
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      borderRadius: 10,
      width: "100%",
      alignItems: "center",
      gap: 6,
    },
    defiSuggestionsTitle: {
      color: theme.colors.lightGrey,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    defiTagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
      marginTop: 4,
    },
    defiTag: {
      backgroundColor: "rgba(124, 58, 237, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(124, 58, 237, 0.25)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    defiTagText: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontWeight: "700",
    },
    tokenRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      gap: 6,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tokenLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1.3,
      minWidth: 0,
    },
    tokenInfoCol: {
      flex: 1,
      minWidth: 0,
    },
    symbolRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    tokenSymbolText: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: "700",
      flexShrink: 1,
    },
    chainPill: {
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      flexShrink: 0,
    },
    chainPillText: {
      color: theme.colors.lightGrey,
      fontSize: 9,
      fontWeight: "600",
    },
    tokenBalanceText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    tokenMiddle: {
      alignItems: "flex-end",
      gap: 2,
      flex: 1.2,
      minWidth: 0,
      paddingHorizontal: 2,
    },
    tokenSwapBtn: {
      width: 54,
      borderRadius: 9,
      overflow: "hidden",
      flexShrink: 0,
    },
    tokenSwapGradient: {
      paddingVertical: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    tokenSwapBtnText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
    },
    defiPoolText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    defiEarningsText: {
      color: theme.colors.success,
      fontSize: 11,
      fontWeight: "600",
      marginTop: 2,
    },
    tokenRight: {
      alignItems: "flex-end",
      gap: 2,
    },
    tokenValueText: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: "700",
    },
    tokenPriceText: {
      fontSize: 11,
      fontWeight: "600",
    },
    apyBadge: {
      backgroundColor: "rgba(124, 58, 237, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(124, 58, 237, 0.25)",
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    apyText: {
      color: theme.colors.primaryLight,
      fontSize: 10,
      fontWeight: "700",
    },
    activityIconBox: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    activityDexText: {
      color: theme.colors.white,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 2,
    },
    activityTimeText: {
      color: theme.colors.lightGrey,
      fontSize: 10,
      fontWeight: "500",
      marginTop: 2,
    },
    completedBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.colors.success}18`,
      borderWidth: 1,
      borderColor: `${theme.colors.success}30`,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      gap: 4,
    },
    greenDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.colors.success,
    },
    completedText: {
      color: theme.colors.success,
      fontSize: 10,
      fontWeight: "700",
    },
  });
}
