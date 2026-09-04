import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Platform,
} from "react-native";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAccount, useAppKit } from "@reown/appkit-react-native";
import type { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import Header from "../../components/Header/Header";
import { BlockchainIcon } from "../../components/BlockchainIcon/BlockchainIcon";
import { ChainSelectorModal } from "../../components/ChainSelectorModal/ChainSelectorModal";
import { CHAINS, type Chain } from "../../constants/tokenRegistry";

import { PortfolioChart, Timeframe, TIMEFRAME_DATA } from "../../components/PortfolioChart/PortfolioChart";
import {
  SwapIcon,
  CoinsIcon,
  YieldIcon,
  HistoryIcon,
} from "../../components/Icons/AppIcons";

type TabType = "tokens" | "defi" | "activity";

interface TokenHolding {
  symbol: string;
  name: string;
  chain: string;
  balance: string;
  price: string;
  valueUsd: string;
  change24h: number;
  icon?: string;
}

interface DeFiPosition {
  protocol: string;
  pool: string;
  type: string;
  deposited: string;
  apy: string;
  earnings: string;
  chain: string;
  icon?: string;
}

interface SwapActivityItem {
  id: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  timestamp: string;
  status: "Completed" | "Pending";
  dex: string;
  hash: string;
}

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "1Y", "ALL"];

const HOLDINGS: TokenHolding[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    chain: "Ethereum",
    balance: "2.45 ETH",
    price: "$2,642.50",
    valueUsd: "$6,474.12",
    change24h: 3.42,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "Ethereum",
    balance: "4,250.00 USDC",
    price: "$1.00",
    valueUsd: "$4,250.00",
    change24h: 0.01,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48/logo.png",
  },
  {
    symbol: "SOL",
    name: "Solana",
    chain: "Solana",
    balance: "12.80 SOL",
    price: "$138.45",
    valueUsd: "$1,772.16",
    change24h: 6.84,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    chain: "Arbitrum",
    balance: "1,850.00 ARB",
    price: "$0.58",
    valueUsd: "$1,073.00",
    change24h: 4.12,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  },
  {
    symbol: "OP",
    name: "Optimism",
    chain: "Optimism",
    balance: "680.00 OP",
    price: "$1.45",
    valueUsd: "$986.00",
    change24h: 5.62,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    chain: "Ethereum",
    balance: "36.50 UNI",
    price: "$7.85",
    valueUsd: "$286.52",
    change24h: -1.24,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984/logo.png",
  },
];

const DEFI_POSITIONS: DeFiPosition[] = [
  {
    protocol: "Uniswap v3",
    pool: "ETH / USDC (0.05%)",
    type: "Liquidity Pool",
    deposited: "$4,210.00",
    apy: "18.4% APY",
    earnings: "+$38.40 Unclaimed",
    chain: "Ethereum",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984/logo.png",
  },
  {
    protocol: "Aave v3",
    pool: "USDC Supply",
    type: "Lending Market",
    deposited: "$3,500.00",
    apy: "5.2% APY",
    earnings: "+$14.20 Earned",
    chain: "Arbitrum",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9/logo.png",
  },
  {
    protocol: "Lido",
    pool: "Staked ETH (stETH)",
    type: "Liquid Staking",
    deposited: "$2,642.50",
    apy: "3.4% APY",
    earnings: "+0.012 stETH",
    chain: "Ethereum",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  },
];

const SWAP_ACTIVITIES: SwapActivityItem[] = [
  {
    id: "tx-1",
    fromToken: "ETH",
    toToken: "USDC",
    fromAmount: "1.00 ETH",
    toAmount: "2,642.50 USDC",
    timestamp: "12 mins ago",
    status: "Completed",
    dex: "Uniswap v3 (Aggregated)",
    hash: "0x8f3c...4a12",
  },
  {
    id: "tx-2",
    fromToken: "ARB",
    toToken: "USDT",
    fromAmount: "1,500 ARB",
    toAmount: "870.00 USDT",
    timestamp: "3 hours ago",
    status: "Completed",
    dex: "1inch Router",
    hash: "0x3e11...9b77",
  },
  {
    id: "tx-3",
    fromToken: "OP",
    toToken: "ETH",
    fromAmount: "450 OP",
    toAmount: "0.247 ETH",
    timestamp: "1 day ago",
    status: "Completed",
    dex: "KyberSwap",
    hash: "0x7a22...3c44",
  },
  {
    id: "tx-4",
    fromToken: "SOL",
    toToken: "USDC",
    fromAmount: "8.50 SOL",
    toAmount: "1,176.82 USDC",
    timestamp: "3 days ago",
    status: "Completed",
    dex: "Jupiter DEX",
    hash: "0x11bb...88ee",
  },
];

export default function PortfolioScreen() {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const [selectedChain, setSelectedChain] = useState<Chain>(CHAINS[0]);
  const [chainModalVisible, setChainModalVisible] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1D");
  const [scrubPoint, setScrubPoint] = useState<{ time: string; value: number } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("tokens");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const activeTimeframeInfo = TIMEFRAME_DATA[selectedTimeframe];

  const handleNavigateSwap = () => {
    router.replace("/(app)");
  };

  const displayBalance = scrubPoint
    ? `$${scrubPoint.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$14,842.60";

  const displayLabel = scrubPoint
    ? `Portfolio at ${scrubPoint.time}`
    : "Total Net Worth";

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header
        title="Portfolio"
        rightAction="network"
        currentChainName={selectedChain.name}
        onOpenChainModal={() => setChainModalVisible(true)}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* ═══ Hero Net Worth Card ═══ */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroLabel}>{displayLabel}</Text>
              <Text style={styles.heroBalance}>{displayBalance}</Text>
            </View>
            <View style={styles.pnlBadge}>
              <Text style={styles.pnlText}>
                {activeTimeframeInfo.pnl} ({activeTimeframeInfo.pnlPercent})
              </Text>
            </View>
          </View>

          {/* High Precision Interactive Smooth Chart */}
          <PortfolioChart
            timeframe={selectedTimeframe}
            onScrubChange={setScrubPoint}
          />

          {/* Timeframe Selector */}
          <View style={styles.timeframeRow}>
            {TIMEFRAMES.map((tf) => {
              const isSelected = selectedTimeframe === tf;
              return (
                <TouchableOpacity
                  key={tf}
                  onPress={() => {
                    setSelectedTimeframe(tf);
                    setScrubPoint(null);
                  }}
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
          >
            <CoinsIcon
              size={14}
              color={activeTab === "tokens" ? theme.colors.primaryLight : theme.colors.grey}
              strokeWidth={2}
            />
            <Text style={[styles.tabText, activeTab === "tokens" && styles.tabTextActive]}>
              Holdings ({HOLDINGS.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "defi" && styles.tabButtonActive]}
            onPress={() => setActiveTab("defi")}
          >
            <YieldIcon
              size={14}
              color={activeTab === "defi" ? theme.colors.primaryLight : theme.colors.grey}
              strokeWidth={2}
            />
            <Text style={[styles.tabText, activeTab === "defi" && styles.tabTextActive]}>
              DeFi Yield ({DEFI_POSITIONS.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === "activity" && styles.tabButtonActive]}
            onPress={() => setActiveTab("activity")}
          >
            <HistoryIcon
              size={14}
              color={activeTab === "activity" ? theme.colors.primaryLight : theme.colors.grey}
              strokeWidth={2}
            />
            <Text style={[styles.tabText, activeTab === "activity" && styles.tabTextActive]}>
              Swap History
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═══ Tab 1: Tokens ═══ */}
        {activeTab === "tokens" && (
          <View style={styles.listCard}>
            {HOLDINGS.map((token, idx) => {
              const isPositive = token.change24h >= 0;
              return (
                <View
                  key={token.symbol}
                  style={[
                    styles.tokenRow,
                    idx < HOLDINGS.length - 1 && styles.rowDivider,
                  ]}
                >
                  <View style={styles.tokenLeft}>
                    <BlockchainIcon symbol={token.symbol} size={36} logoUrl={token.icon} />
                    <View>
                      <View style={styles.symbolRow}>
                        <Text style={styles.tokenSymbolText}>{token.symbol}</Text>
                        <View style={styles.chainPill}>
                          <Text style={styles.chainPillText}>{token.chain}</Text>
                        </View>
                      </View>
                      <Text style={styles.tokenBalanceText}>{token.balance}</Text>
                    </View>
                  </View>

                  <View style={styles.tokenMiddle}>
                    <Text style={styles.tokenValueText}>{token.valueUsd}</Text>
                    <Text
                      style={[
                        styles.tokenPriceText,
                        { color: isPositive ? "#10B981" : "#EF4444" },
                      ]}
                    >
                      {token.price} ({isPositive ? "+" : ""}
                      {token.change24h}%)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.tokenSwapBtn}
                    onPress={handleNavigateSwap}
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
            })}
          </View>
        )}

        {/* ═══ Tab 2: DeFi Positions ═══ */}
        {activeTab === "defi" && (
          <View style={styles.listCard}>
            {DEFI_POSITIONS.map((pos, idx) => (
              <View
                key={pos.pool}
                style={[
                  styles.tokenRow,
                  idx < DEFI_POSITIONS.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={styles.tokenLeft}>
                  <BlockchainIcon symbol={pos.protocol} size={36} logoUrl={pos.icon} />
                  <View>
                    <Text style={styles.tokenSymbolText}>{pos.protocol}</Text>
                    <Text style={styles.defiPoolText}>{pos.pool}</Text>
                    <Text style={styles.defiEarningsText}>{pos.earnings}</Text>
                  </View>
                </View>

                <View style={styles.tokenRight}>
                  <Text style={styles.tokenValueText}>{pos.deposited}</Text>
                  <View style={styles.apyBadge}>
                    <Text style={styles.apyText}>{pos.apy}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══ Tab 3: Swap Activity History ═══ */}
        {activeTab === "activity" && (
          <View style={styles.listCard}>
            {SWAP_ACTIVITIES.map((act, idx) => (
              <View
                key={act.id}
                style={[
                  styles.tokenRow,
                  idx < SWAP_ACTIVITIES.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={styles.tokenLeft}>
                  <View style={styles.activityIconBox}>
                    <SwapIcon size={16} color={theme.colors.primaryLight} strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={styles.tokenSymbolText}>
                      {act.fromAmount} ➔ {act.toAmount}
                    </Text>
                    <Text style={styles.activityDexText}>{act.dex}</Text>
                    <Text style={styles.activityTimeText}>{act.timestamp} · {act.hash}</Text>
                  </View>
                </View>

                <View style={styles.tokenRight}>
                  <View style={styles.completedBadge}>
                    <View style={styles.greenDot} />
                    <Text style={styles.completedText}>{act.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ChainSelectorModal
        visible={chainModalVisible}
        target="from"
        onClose={() => setChainModalVisible(false)}
        onSelect={(chain) => {
          setSelectedChain(chain);
          setChainModalVisible(false);
        }}
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
      alignItems: "flex-start",
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
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    pnlText: {
      color: "#10B981",
      fontSize: 12,
      fontWeight: "700",
    },
    chartContainer: {
      height: 80,
      justifyContent: "center",
      marginVertical: 4,
    },
    timeframeRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.dark,
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
      color: theme.colors.grey,
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
    mainSwapEmoji: {
      fontSize: 18,
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
      padding: 4,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 9,
      alignItems: "center",
      borderRadius: 10,
    },
    tabButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    tabText: {
      color: theme.colors.grey,
      fontSize: 12,
      fontWeight: "600",
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
    },
    tokenRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      gap: 8,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tokenLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1.4,
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
    },
    chainPill: {
      backgroundColor: theme.colors.dark,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
    },
    chainPillText: {
      color: theme.colors.grey,
      fontSize: 9,
      fontWeight: "600",
    },
    tokenBalanceText: {
      color: theme.colors.lightGrey,
      fontSize: 11,
      marginTop: 2,
    },
    tokenMiddle: {
      alignItems: "flex-end",
      gap: 2,
      flex: 1.1,
    },
    tokenSwapBtn: {
      width: 58,
      borderRadius: 9,
      overflow: "hidden",
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
      color: theme.colors.grey,
      fontSize: 11,
      marginTop: 1,
    },
    defiEarningsText: {
      color: "#10B981",
      fontSize: 10,
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
      backgroundColor: "rgba(124, 58, 237, 0.15)",
      paddingHorizontal: 6,
      paddingVertical: 2,
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
      justifyContent: "center",
      alignItems: "center",
    },
    activityEmoji: {
      fontSize: 16,
    },
    activityDexText: {
      color: theme.colors.primaryLight,
      fontSize: 10,
      fontWeight: "600",
      marginTop: 1,
    },
    activityTimeText: {
      color: theme.colors.grey,
      fontSize: 10,
      marginTop: 2,
    },
    completedBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(16, 185, 129, 0.12)",
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      gap: 4,
    },
    greenDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: "#10B981",
    },
    completedText: {
      color: "#10B981",
      fontSize: 10,
      fontWeight: "700",
    },
  });
}
