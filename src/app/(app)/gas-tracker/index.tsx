import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { ThemeType } from "../../../styles/theme";
import { SafeAreaContainer } from "../../../components/Styles/Layout.styles";
import Header from "../../../components/Header/Header";
import { BlockchainIcon } from "../../../components/BlockchainIcon/BlockchainIcon";
import { ChainSelectorModal } from "../../../components/ChainSelectorModal/ChainSelectorModal";
import { CHAINS, type Chain } from "../../../constants/tokenRegistry";
import {
  GasIcon,
  LightningIcon,
  SpeedometerIcon,
  SwapIcon,
  DollarIcon,
  YieldIcon,
  GlobeIcon,
} from "../../../components/Icons/AppIcons";

interface ChainGasInfo {
  name: string;
  symbol: string;
  standardGwei: string;
  usdCost: string;
  speed: string;
  congestion: "Low" | "Medium" | "High";
  icon?: string;
}

const MULTI_CHAIN_GAS_DATA: ChainGasInfo[] = [
  {
    name: "Ethereum",
    symbol: "ETH",
    standardGwei: "14 Gwei",
    usdCost: "$1.42",
    speed: "~15 sec",
    congestion: "Low",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  },
  {
    name: "Arbitrum One",
    symbol: "ARB",
    standardGwei: "0.1 Gwei",
    usdCost: "$0.02",
    speed: "~1 sec",
    congestion: "Low",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  },
  {
    name: "Optimism",
    symbol: "OP",
    standardGwei: "0.1 Gwei",
    usdCost: "$0.03",
    speed: "~2 sec",
    congestion: "Low",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  },
  {
    name: "Base",
    symbol: "BASE",
    standardGwei: "0.08 Gwei",
    usdCost: "$0.01",
    speed: "~1 sec",
    congestion: "Low",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
  },
  {
    name: "Polygon",
    symbol: "POL",
    standardGwei: "32 Gwei",
    usdCost: "$0.01",
    speed: "~2 sec",
    congestion: "Low",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  },
  {
    name: "BNB Smart Chain",
    symbol: "BNB",
    standardGwei: "3 Gwei",
    usdCost: "$0.08",
    speed: "~3 sec",
    congestion: "Low",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png",
  },
  {
    name: "Solana",
    symbol: "SOL",
    standardGwei: "0.000005 SOL",
    usdCost: "< $0.001",
    speed: "~400 ms",
    congestion: "Low",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  },
];

const ESTIMATED_ACTIONS = [
  { id: "transfer", name: "Token Transfer", type: "transfer", eth: "21,000 Gas", usd: "$0.42", time: "~12 sec" },
  { id: "swap", name: "DEX Token Swap", type: "swap", eth: "145,000 Gas", usd: "$1.40", time: "~15 sec" },
  { id: "contract", name: "Contract Interaction", type: "contract", eth: "185,000 Gas", usd: "$2.15", time: "~15 sec" },
  { id: "bridge", name: "Cross-Chain Bridge", type: "bridge", eth: "260,000 Gas", usd: "$3.80", time: "~30 sec" },
];

export default function GasTrackerScreen() {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const [selectedChain, setSelectedChain] = useState<Chain>(CHAINS[0]);
  const [chainModalVisible, setChainModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header
        title="Gas Tracker"
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
        {/* ═══ Active Chain Hero Speed Card ═══ */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTitleRow}>
              <View style={styles.heroIconBox}>
                <GasIcon size={22} color={theme.colors.primaryLight} strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.heroTitle}>{selectedChain.name} Gas Rates</Text>
                <Text style={styles.heroSub}>EIP-1559 Real-time Fee Market</Text>
              </View>
            </View>
            <View style={styles.congestionBadge}>
              <View style={styles.greenDot} />
              <Text style={styles.congestionText}>Low Congestion</Text>
            </View>
          </View>

          {/* Speed Tiers */}
          <View style={styles.tiersContainer}>
            {/* Slow */}
            <View style={styles.tierBox}>
              <Text style={styles.tierLabel}>Slow</Text>
              <Text style={styles.tierGwei}>11 Gwei</Text>
              <Text style={styles.tierTime}>~1 min</Text>
              <Text style={styles.tierUsd}>$0.35</Text>
            </View>

            {/* Standard (Active Highlight) */}
            <LinearGradient
              colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tierGradientActive}
            >
              <View style={styles.tierActiveInner}>
                <Text style={styles.tierLabelActive}>Standard</Text>
                <Text style={styles.tierGweiActive}>14 Gwei</Text>
                <Text style={styles.tierTimeActive}>~15 sec</Text>
                <Text style={styles.tierUsdActive}>$0.42</Text>
              </View>
            </LinearGradient>

            {/* Fast */}
            <View style={styles.tierBox}>
              <Text style={styles.tierLabel}>Fast</Text>
              <Text style={styles.tierGwei}>18 Gwei</Text>
              <Text style={styles.tierTime}>~5 sec</Text>
              <Text style={styles.tierUsd}>$0.55</Text>
            </View>
          </View>

          {/* Base Fee & Priority Fee Breakdown */}
          <View style={styles.feeBreakdownRow}>
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Base Fee</Text>
              <Text style={styles.feeValue}>12.45 Gwei</Text>
            </View>
            <View style={styles.feeDivider} />
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Priority (Tip)</Text>
              <Text style={styles.feeValue}>1.55 Gwei</Text>
            </View>
            <View style={styles.feeDivider} />
            <View style={styles.feeItem}>
              <Text style={styles.feeLabel}>Block Utilization</Text>
              <Text style={styles.feeValue}>48.2%</Text>
            </View>
          </View>
        </View>

        {/* ═══ Action Cost Estimator ═══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaction Cost Estimator</Text>
          <Text style={styles.sectionSub}>Estimated on {selectedChain.name}</Text>
        </View>

        <View style={styles.actionsCard}>
          {ESTIMATED_ACTIONS.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.actionRow,
                idx < ESTIMATED_ACTIONS.length - 1 && styles.actionBorder,
              ]}
            >
              <View style={styles.actionLeft}>
                <View style={styles.actionIconBox}>
                  {item.type === "transfer" && <DollarIcon size={16} color={theme.colors.primaryLight} strokeWidth={2.2} />}
                  {item.type === "swap" && <SwapIcon size={16} color={theme.colors.primaryLight} strokeWidth={2.2} />}
                  {item.type === "contract" && <YieldIcon size={16} color={theme.colors.primaryLight} strokeWidth={2.2} />}
                  {item.type === "bridge" && <GlobeIcon size={16} color={theme.colors.primaryLight} strokeWidth={2.2} />}
                </View>
                <View>
                  <Text style={styles.actionName}>{item.name}</Text>
                  <Text style={styles.actionGas}>{item.eth} · {item.time}</Text>
                </View>
              </View>
              <View style={styles.actionRight}>
                <Text style={styles.actionUsd}>{item.usd}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ═══ Multi-Chain Gas Comparison ═══ */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cross-Chain Gas Comparison</Text>
          <Text style={styles.sectionSub}>Live across 7+ networks</Text>
        </View>

        <View style={styles.chainCompareCard}>
          {MULTI_CHAIN_GAS_DATA.map((chain, idx) => (
            <View
              key={chain.name}
              style={[
                styles.chainRow,
                idx < MULTI_CHAIN_GAS_DATA.length - 1 && styles.actionBorder,
              ]}
            >
              <View style={styles.chainLeft}>
                <BlockchainIcon
                  symbol={chain.symbol}
                  size={26}
                  logoUrl={chain.icon}
                />
                <View>
                  <Text style={styles.chainNameText}>{chain.name}</Text>
                  <Text style={styles.chainSpeedText}>{chain.speed}</Text>
                </View>
              </View>

              <View style={styles.chainRight}>
                <Text style={styles.chainGweiText}>{chain.standardGwei}</Text>
                <Text style={styles.chainUsdText}>{chain.usdCost}</Text>
              </View>
            </View>
          ))}
        </View>
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
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 14,
    },
    heroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    heroIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(124, 58, 237, 0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    heroTitle: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: "800",
    },
    heroSub: {
      color: theme.colors.grey,
      fontSize: 11,
      marginTop: 2,
    },
    congestionBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 5,
    },
    greenDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#10B981",
    },
    congestionText: {
      color: "#10B981",
      fontSize: 11,
      fontWeight: "700",
    },
    tiersContainer: {
      flexDirection: "row",
      gap: 10,
    },
    tierBox: {
      flex: 1,
      backgroundColor: theme.colors.dark,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: "center",
      gap: 2,
    },
    tierLabel: {
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "600",
    },
    tierGwei: {
      color: theme.colors.white,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 2,
    },
    tierTime: {
      color: theme.colors.lightGrey,
      fontSize: 10,
    },
    tierUsd: {
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "600",
      marginTop: 4,
    },
    tierGradientActive: {
      flex: 1,
      borderRadius: 14,
      padding: 1.5,
    },
    tierActiveInner: {
      flex: 1,
      backgroundColor: theme.colors.dark,
      borderRadius: 12.5,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: "center",
      gap: 2,
    },
    tierLabelActive: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontWeight: "700",
    },
    tierGweiActive: {
      color: theme.colors.white,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 2,
    },
    tierTimeActive: {
      color: theme.colors.primaryLight,
      fontSize: 10,
      fontWeight: "600",
    },
    tierUsdActive: {
      color: "#10B981",
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
    feeBreakdownRow: {
      flexDirection: "row",
      backgroundColor: theme.colors.dark,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 10,
      paddingHorizontal: 8,
      justifyContent: "space-between",
    },
    feeItem: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    feeLabel: {
      color: theme.colors.grey,
      fontSize: 10,
      fontWeight: "500",
    },
    feeValue: {
      color: theme.colors.white,
      fontSize: 12,
      fontWeight: "700",
    },
    feeDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
    },
    sectionHeader: {
      marginTop: 4,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      color: theme.colors.white,
      fontSize: 15,
      fontWeight: "700",
    },
    sectionSub: {
      color: theme.colors.grey,
      fontSize: 11,
      marginTop: 2,
    },
    actionsCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
    },
    actionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
    },
    actionBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    actionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    actionIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: "rgba(124, 58, 237, 0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    actionName: {
      color: theme.colors.white,
      fontSize: 13,
      fontWeight: "600",
    },
    actionGas: {
      color: theme.colors.grey,
      fontSize: 11,
    },
    actionRight: {
      alignItems: "flex-end",
    },
    actionUsd: {
      color: theme.colors.white,
      fontSize: 13,
      fontWeight: "700",
    },
    chainCompareCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
    },
    chainRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
    },
    chainLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    chainNameText: {
      color: theme.colors.white,
      fontSize: 13,
      fontWeight: "600",
    },
    chainSpeedText: {
      color: theme.colors.grey,
      fontSize: 10,
    },
    chainRight: {
      alignItems: "flex-end",
      gap: 1,
    },
    chainGweiText: {
      color: theme.colors.white,
      fontSize: 12,
      fontWeight: "700",
    },
    chainUsdText: {
      color: "#10B981",
      fontSize: 11,
      fontWeight: "600",
    },
  });
}
