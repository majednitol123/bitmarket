import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import Header from "../../components/Header/Header";
import { BlockchainIcon } from "../../components/BlockchainIcon/BlockchainIcon";
import { ChainSelectorModal } from "../../components/ChainSelectorModal/ChainSelectorModal";
import { CHAINS, DEFAULT_TOKENS, type Chain } from "../../constants/tokenRegistry";
import {
  SearchIcon,
  SwapIcon,
  MarketsIcon,
} from "../../components/Icons/AppIcons";

interface MarketItem {
  symbol: string;
  name: string;
  category: "Layer 1" | "DeFi" | "Layer 2" | "Stablecoin";
  price: string;
  priceNum: number;
  change24h: number;
  volume24h: string;
  marketCap: string;
  icon?: string;
  chain: string;
}

const ALL_MARKET_TOKENS: MarketItem[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    category: "Layer 1",
    price: "$2,642.50",
    priceNum: 2642.50,
    change24h: 3.42,
    volume24h: "$18.4B",
    marketCap: "$318.2B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "BTC",
    name: "Wrapped Bitcoin",
    category: "Layer 1",
    price: "$63,120.00",
    priceNum: 63120.00,
    change24h: 2.15,
    volume24h: "$24.1B",
    marketCap: "$1.24T",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "SOL",
    name: "Solana",
    category: "Layer 1",
    price: "$138.45",
    priceNum: 138.45,
    change24h: 6.84,
    volume24h: "$4.8B",
    marketCap: "$64.5B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
    chain: "Solana",
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    category: "DeFi",
    price: "$7.85",
    priceNum: 7.85,
    change24h: -1.24,
    volume24h: "$340M",
    marketCap: "$4.7B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    category: "Layer 2",
    price: "$0.58",
    priceNum: 0.58,
    change24h: 4.12,
    volume24h: "$290M",
    marketCap: "$2.05B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
    chain: "Arbitrum",
  },
  {
    symbol: "OP",
    name: "Optimism",
    category: "Layer 2",
    price: "$1.45",
    priceNum: 1.45,
    change24h: 5.62,
    volume24h: "$180M",
    marketCap: "$1.72B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
    chain: "Optimism",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    category: "DeFi",
    price: "$11.35",
    priceNum: 11.35,
    change24h: 5.21,
    volume24h: "$410M",
    marketCap: "$6.8B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771af9ca656af840dff83e8264ecf986ca/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "AAVE",
    name: "Aave",
    category: "DeFi",
    price: "$142.20",
    priceNum: 142.20,
    change24h: 8.95,
    volume24h: "$215M",
    marketCap: "$2.12B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "MATIC",
    name: "Polygon (POL)",
    category: "Layer 2",
    price: "$0.38",
    priceNum: 0.38,
    change24h: -0.85,
    volume24h: "$120M",
    marketCap: "$2.9B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
    chain: "Polygon",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    category: "Stablecoin",
    price: "$1.00",
    priceNum: 1.00,
    change24h: 0.01,
    volume24h: "$5.2B",
    marketCap: "$35.4B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    category: "Stablecoin",
    price: "$1.00",
    priceNum: 1.00,
    change24h: -0.02,
    volume24h: "$38.5B",
    marketCap: "$118.9B",
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdac17f958d2ee523a2206206994597c13d831ec7/logo.png",
    chain: "Ethereum",
  },
];

const CATEGORIES = ["All", "Top Gainers", "Layer 1", "DeFi", "Layer 2"];

export default function MarketsScreen() {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const [selectedChain, setSelectedChain] = useState<Chain>(CHAINS[0]);
  const [chainModalVisible, setChainModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const filteredTokens = useMemo(() => {
    return ALL_MARKET_TOKENS.filter((item) => {
      // Search match
      const matchSearch =
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      // Category filter
      if (selectedCategory === "All") return true;
      if (selectedCategory === "Top Gainers") return item.change24h > 2.0;
      return item.category === selectedCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleTrade = (item: MarketItem) => {
    router.replace("/(app)");
  };

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header
        title="Markets"
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
        {/* ═══ Market Overview Summary Banner ═══ */}
        <View style={styles.statsBanner}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Market Cap</Text>
            <Text style={styles.statValue}>$2.38T</Text>
            <Text style={styles.statChangePositive}>+2.8%</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>24h Volume</Text>
            <Text style={styles.statValue}>$68.2B</Text>
            <Text style={styles.statSub}>Across DEXs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Dominance</Text>
            <Text style={styles.statValue}>BTC 56.4%</Text>
            <Text style={styles.statSub}>ETH 14.8%</Text>
          </View>
        </View>

        {/* ═══ Search Bar ═══ */}
        <LinearGradient
          colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.searchGradientBorder}
        >
          <View style={styles.searchRow}>
            <SearchIcon size={18} color={theme.colors.lightGrey} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by token or symbol..."
              placeholderTextColor={theme.colors.grey}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* ═══ Categories Scroll ═══ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryPill,
                  isActive && {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive && { color: "#FFFFFF", fontWeight: "700" },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ═══ Token List Header ═══ */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderCol1}>Asset</Text>
          <Text style={styles.listHeaderCol2}>Price / 24h</Text>
          <Text style={styles.listHeaderCol3}>Action</Text>
        </View>

        {/* ═══ Token Cards ═══ */}
        {filteredTokens.map((token) => {
          const isPositive = token.change24h >= 0;
          return (
            <View key={token.symbol} style={styles.tokenCard}>
              {/* Asset Col */}
              <View style={styles.assetCol}>
                <BlockchainIcon
                  symbol={token.symbol}
                  size={32}
                  logoUrl={token.icon}
                />
                <View style={styles.assetInfo}>
                  <Text style={styles.assetSymbol}>{token.symbol}</Text>
                  <Text style={styles.assetName} numberOfLines={1}>
                    {token.name}
                  </Text>
                </View>
              </View>

              {/* Price & Change Col */}
              <View style={styles.priceCol}>
                <Text style={styles.priceText}>{token.price}</Text>
                <View
                  style={[
                    styles.changeBadge,
                    {
                      backgroundColor: isPositive
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.changeText,
                      { color: isPositive ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {isPositive ? "+" : ""}
                    {token.change24h}%
                  </Text>
                </View>
              </View>

              {/* Trade Action Col */}
              <TouchableOpacity
                style={styles.tradeButton}
                activeOpacity={0.8}
                onPress={() => handleTrade(token)}
              >
                <LinearGradient
                  colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tradeGradient}
                >
                  <SwapIcon size={12} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.tradeButtonText}>Swap</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          );
        })}

        {filteredTokens.length === 0 && (
          <View style={styles.emptyContainer}>
            <SearchIcon size={40} color={theme.colors.grey} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No tokens found</Text>
            <Text style={styles.emptySub}>
              Try searching with another symbol or category.
            </Text>
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
    statsBanner: {
      flexDirection: "row",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 14,
      paddingHorizontal: 8,
      justifyContent: "space-between",
    },
    statBox: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    statLabel: {
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "500",
    },
    statValue: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: "700",
    },
    statChangePositive: {
      color: "#10B981",
      fontSize: 11,
      fontWeight: "700",
    },
    statSub: {
      color: theme.colors.lightGrey,
      fontSize: 10,
    },
    statDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
    },
    searchGradientBorder: {
      borderRadius: 14,
      padding: 1.5,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderRadius: 12.5,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    searchIcon: {
      fontSize: 15,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.white,
      fontSize: 14,
      paddingVertical: 0,
    },
    clearIcon: {
      color: theme.colors.lightGrey,
      fontSize: 14,
      paddingHorizontal: 4,
    },
    categoryScroll: {
      gap: 8,
      paddingVertical: 2,
    },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontWeight: "600",
    },
    listHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 8,
      marginTop: 6,
    },
    listHeaderCol1: {
      flex: 1.5,
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    listHeaderCol2: {
      flex: 1.2,
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "600",
      textAlign: "right",
      textTransform: "uppercase",
    },
    listHeaderCol3: {
      width: 75,
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "600",
      textAlign: "right",
      textTransform: "uppercase",
    },
    tokenCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 8,
    },
    assetCol: {
      flex: 1.5,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    assetInfo: {
      flex: 1,
    },
    assetSymbol: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: "700",
    },
    assetName: {
      color: theme.colors.grey,
      fontSize: 11,
    },
    priceCol: {
      flex: 1.2,
      alignItems: "flex-end",
      gap: 3,
    },
    priceText: {
      color: theme.colors.white,
      fontSize: 13,
      fontWeight: "700",
    },
    changeBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    changeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    tradeButton: {
      width: 65,
      borderRadius: 10,
      overflow: "hidden",
    },
    tradeGradient: {
      paddingVertical: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    tradeButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 8,
    },
    emptyEmoji: {
      fontSize: 36,
    },
    emptyTitle: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: "700",
    },
    emptySub: {
      color: theme.colors.grey,
      fontSize: 13,
    },
  });
}
