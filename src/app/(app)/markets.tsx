import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet,
  AppState,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";

import type { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import Header from "../../components/Header/Header";
import { BlockchainIcon } from "../../components/BlockchainIcon/BlockchainIcon";
import { ChainSelectorModal } from "../../components/ChainSelectorModal/ChainSelectorModal";
import { CHAINS, type Chain } from "../../constants/tokenRegistry";
import {
  SearchIcon,
  SwapIcon,
} from "../../components/Icons/AppIcons";
import { AppDispatch } from "../../store";
import {
  fetchMarketOverview,
  fetchMarketTokens,
  searchMarketTokens,
  refreshMarketData,
  setSelectedCategory,
  setSearchQuery,
  selectMarketOverview,
  selectMarketTokens,
  selectMarketTokensStatus,
  selectSelectedCategory,
  selectSearchQuery,
  selectSearchResults,
  selectSearchStatus,
  selectIsRefreshing,
  selectHasMoreTokens,
  selectIsLoadingMore,
  selectCurrentPage,
} from "../../store/marketSlice";
import { GeneralStatus } from "../../store/types";
import { MarketToken } from "../../api/marketApi";
import { formatCompactNumber, formatPrice, formatPercent } from "../../utils/formatters";
import { updateTokenPrices } from "../../utils/tokenPricing";

const CATEGORIES = ["All", "Top Gainers", "Layer 1", "DeFi", "Layer 2"];

export default function MarketsScreen() {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const dispatch = useDispatch<AppDispatch>();

  const [selectedChain, setSelectedChain] = useState<Chain>(CHAINS[0]);
  const [chainModalVisible, setChainModalVisible] = useState(false);

  // Redux state selectors
  const overview = useSelector(selectMarketOverview);
  const tokens = useSelector(selectMarketTokens);
  const tokensStatus = useSelector(selectMarketTokensStatus);
  const selectedCategory = useSelector(selectSelectedCategory);
  const reduxSearchQuery = useSelector(selectSearchQuery);
  const searchResults = useSelector(selectSearchResults);
  const searchStatus = useSelector(selectSearchStatus);
  const isRefreshing = useSelector(selectIsRefreshing);
  const hasMore = useSelector(selectHasMoreTokens);
  const isLoadingMore = useSelector(selectIsLoadingMore);
  const currentPage = useSelector(selectCurrentPage);

  // Local state for immediate typing responsiveness
  const [localSearchInput, setLocalSearchInput] = useState(reduxSearchQuery);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Initial fetch and app foreground refresh
  useEffect(() => {
    dispatch(fetchMarketOverview());
    dispatch(fetchMarketTokens({ category: selectedCategory, page: 1, append: false }));

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        dispatch(fetchMarketOverview());
        dispatch(fetchMarketTokens({ category: selectedCategory, page: 1, append: false }));
      }
    });

    return () => {
      subscription.remove();
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [dispatch, selectedCategory]);

  // Sync token prices to swap bridge whenever tokens change
  useEffect(() => {
    if (tokens && tokens.length > 0) {
      updateTokenPrices(tokens);
    }
  }, [tokens]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    dispatch(refreshMarketData());
  }, [dispatch]);

  // Handle Category selection
  const handleCategoryPress = (cat: string) => {
    if (cat === selectedCategory) return;
    dispatch(setSelectedCategory(cat));
    dispatch(fetchMarketTokens({ category: cat, page: 1, append: false }));
  };

  // Handle Search Input with 300ms debounce
  const handleSearchChange = (text: string) => {
    setLocalSearchInput(text);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      dispatch(setSearchQuery(text));
      if (text.trim().length > 0) {
        dispatch(searchMarketTokens(text.trim()));
      }
    }, 300);
  };

  const handleClearSearch = () => {
    setLocalSearchInput("");
    dispatch(setSearchQuery(""));
  };

  // Infinite scroll pagination handler
  const handleEndReached = () => {
    if (
      hasMore &&
      !isLoadingMore &&
      tokensStatus !== GeneralStatus.Loading &&
      !localSearchInput.trim()
    ) {
      dispatch(
        fetchMarketTokens({
          category: selectedCategory,
          page: currentPage + 1,
          append: true,
        })
      );
    }
  };

  // Determine displayed tokens
  const displayedTokens: MarketToken[] = useMemo(() => {
    if (localSearchInput.trim().length > 0) {
      return searchResults;
    }
    return tokens;
  }, [localSearchInput, searchResults, tokens]);

  // Route to Token Detail screen
  const handleTokenPress = (token: MarketToken) => {
    router.push({
      pathname: "/(app)/token-detail",
      params: {
        coinId: token.id,
        symbol: token.symbol,
        name: token.name,
        icon: token.logoUrl,
        price: formatPrice(token.priceUsd),
        change24h: String(token.change24hPercent),
      },
    });
  };

  // Swap action
  const handleTrade = (token: MarketToken) => {
    router.replace("/(app)");
  };

  const isMarketCapPositive = (overview?.marketCapChange24hPercent ?? 0) >= 0;

  // Render Header Component inside FlatList
  const renderListHeader = () => (
    <View style={styles.headerStack}>
      {/* ═══ Market Overview Summary Banner ═══ */}
      <View style={styles.statsBanner}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Market Cap</Text>
          <Text style={styles.statValue}>
            {overview?.marketCapUsd ? formatCompactNumber(overview.marketCapUsd) : "--"}
          </Text>
          <Text
            style={
              isMarketCapPositive
                ? styles.statChangePositive
                : styles.statChangeNegative
            }
          >
            {overview?.marketCapChange24hPercent !== undefined
              ? formatPercent(overview.marketCapChange24hPercent)
              : "--"}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>24h Volume</Text>
          <Text style={styles.statValue}>
            {overview?.volume24hUsd ? formatCompactNumber(overview.volume24hUsd) : "--"}
          </Text>
          <Text style={[styles.statSub, overview?.volumeChange24hPercent !== undefined && overview.volumeChange24hPercent >= 0 ? styles.statChangePositive : styles.statChangeNegative]}>
            {overview?.volumeChange24hPercent !== undefined
              ? formatPercent(overview.volumeChange24hPercent)
              : "--"}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Dominance</Text>
          <Text style={styles.statValue}>
            BTC {overview?.btcDominancePercent ? overview.btcDominancePercent.toFixed(1) + "%" : "--"}
          </Text>
          <Text style={[styles.statSub, overview?.btcDominanceChangePercent !== undefined && overview.btcDominanceChangePercent >= 0 ? styles.statChangePositive : styles.statChangeNegative]}>
            {overview?.btcDominanceChangePercent !== undefined
              ? formatPercent(overview.btcDominanceChangePercent)
              : "--"}
          </Text>
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
            value={localSearchInput}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {localSearchInput.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Search result count feedback */}
      {localSearchInput.trim().length > 0 && (
        <View style={styles.searchCountRow}>
          <Text style={styles.searchCountText}>
            {searchStatus === GeneralStatus.Loading
              ? "Searching assets..."
              : `Found ${displayedTokens.length} matching token${displayedTokens.length === 1 ? "" : "s"}`}
          </Text>
          <TouchableOpacity onPress={handleClearSearch}>
            <Text style={styles.searchResetText}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ Categories Scroll (Text Only) ═══ */}
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
              onPress={() => handleCategoryPress(cat)}
              style={[
                styles.categoryPill,
                isActive && {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                },
              ]}
              activeOpacity={0.8}
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

      {/* ═══ Token List Header Row ═══ */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderCol1}>Asset</Text>
        <Text style={styles.listHeaderCol2}>Price / 24h</Text>
        <Text style={styles.listHeaderCol3}>Action</Text>
      </View>
    </View>
  );

  // Render individual Token Card
  const renderTokenCard = ({ item: token }: { item: MarketToken }) => {
    const isPositive = token.change24hPercent >= 0;

    return (
      <TouchableOpacity
        key={token.id || token.symbol}
        style={styles.tokenCard}
        activeOpacity={0.7}
        onPress={() => handleTokenPress(token)}
      >
        {/* Asset Column with Rank Badge */}
        <View style={styles.assetCol}>
          <BlockchainIcon
            symbol={token.symbol}
            size={34}
            logoUrl={token.logoUrl}
          />
          <View style={styles.assetInfo}>
            <View style={styles.symbolRankRow}>
              <Text style={styles.assetSymbol}>{token.symbol}</Text>
              {token.rank && token.rank < 1000 ? (
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>#{token.rank}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.assetName} numberOfLines={1}>
              {token.name}
            </Text>
          </View>
        </View>

        {/* Price & Change Column */}
        <View style={styles.priceCol}>
          <Text style={styles.priceText}>{formatPrice(token.priceUsd)}</Text>
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
              {formatPercent(token.change24hPercent)}
            </Text>
          </View>
        </View>

        {/* Trade Action Column */}
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
      </TouchableOpacity>
    );
  };

  // Render Footer with Load More Spinner or End of List Indicator
  const renderListFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadMoreText}>Loading more assets...</Text>
        </View>
      );
    }

    if (!hasMore && displayedTokens.length > 0 && !localSearchInput.trim()) {
      return (
        <View style={styles.endOfListContainer}>
          <View style={styles.endOfListDivider} />
          <Text style={styles.endOfListText}>
            All {displayedTokens.length} assets loaded
          </Text>
          <View style={styles.endOfListDivider} />
        </View>
      );
    }

    return null;
  };

  // Render Empty state or initial Skeleton cards
  const renderListEmpty = () => {
    if (tokensStatus === GeneralStatus.Loading || searchStatus === GeneralStatus.Loading) {
      return (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <View key={k} style={styles.skeletonCard}>
              <View style={styles.skeletonIcon} />
              <View style={styles.skeletonTextGroup}>
                <View style={styles.skeletonLineLong} />
                <View style={styles.skeletonLineShort} />
              </View>
              <View style={[styles.skeletonTextGroup, { alignItems: "flex-end" }]}>
                <View style={styles.skeletonLineLong} />
                <View style={styles.skeletonLineShort} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <SearchIcon size={40} color={theme.colors.grey} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No tokens found</Text>
        <Text style={styles.emptySub}>
          Try searching with another symbol or category.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header title="Markets" rightAction="connect" />

      <FlatList
        data={displayedTokens}
        keyExtractor={(item) => item.id || item.symbol}
        renderItem={renderTokenCard}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderListEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
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
      />

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
    },
    headerStack: {
      gap: 14,
      marginBottom: 10,
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
    statChangeNegative: {
      color: "#EF4444",
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
    searchCountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 4,
      marginTop: -4,
    },
    searchCountText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontWeight: "500",
    },
    searchResetText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "600",
    },
    categoryScroll: {
      gap: 8,
      paddingVertical: 2,
    },
    categoryPill: {
      paddingHorizontal: 16,
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
      marginBottom: 10,
      gap: 8,
    },
    assetCol: {
      flex: 1.5,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    symbolRankRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    rankBadge: {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      paddingHorizontal: 5,
      paddingVertical: 1.5,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.08)",
    },
    rankBadgeText: {
      color: theme.colors.lightGrey,
      fontSize: 10,
      fontWeight: "700",
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
    loadMoreContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 18,
      gap: 10,
    },
    loadMoreText: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontWeight: "500",
    },
    endOfListContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 24,
      gap: 12,
    },
    endOfListDivider: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    endOfListText: {
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    skeletonContainer: {
      gap: 10,
      paddingVertical: 4,
    },
    skeletonCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 10,
      opacity: 0.6,
    },
    skeletonIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    skeletonTextGroup: {
      flex: 1,
      gap: 6,
    },
    skeletonLineLong: {
      width: 70,
      height: 12,
      borderRadius: 6,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    skeletonLineShort: {
      width: 45,
      height: 10,
      borderRadius: 5,
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 40,
      gap: 8,
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
