import { useState, useMemo, useCallback } from "react";
import {
  RefreshControl,
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
} from "react-native";
import { useTheme } from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import type { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import Header from "../../components/Header/Header";
import { useAppKit, useAccount } from "@reown/appkit-react-native";
import { useWalletNotifications } from "../../hooks/useWalletNotifications";
import { useSwapState } from "../../hooks/useSwapState";
import { BlockchainIcon } from "../../components/BlockchainIcon/BlockchainIcon";
import { SwapSettingsBottomSheet } from "../../components/SwapSettingsBottomSheet/SwapSettingsBottomSheet";
import { ChainSelectorModal } from "../../components/ChainSelectorModal/ChainSelectorModal";
import { TokenSelectorModal } from "../../components/TokenSelectorModal/TokenSelectorModal";
import { SwapReviewModal } from "../../components/SwapReviewModal/SwapReviewModal";
import {
  SwapIcon,
  ChevronRightIcon,
  SettingsIcon,
  LightningIcon,
  GasIcon,
} from "../../components/Icons/AppIcons";

import { getExchangeRate, calculateToAmount } from "../../utils/tokenPricing";

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════

const PERCENTAGE_PRESETS = ["25%", "50%", "75%", "MAX"];

export default function Index() {
  const insets = useSafeAreaInsets();
  const theme = useTheme() as ThemeType;
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // ─── Wallet ───
  const { open } = useAppKit();
  const { isConnected } = useAccount();
  useWalletNotifications();

  // ─── Swap logic ───
  const swap = useSwapState();

  // Handle Quick Market Mover selection
  const handleSelectMarketToken = useCallback(
    (symbol: string) => {
      const match = swap.filteredTokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
      if (match) {
        swap.setSelectedTokenTo(match);
      }
    },
    [swap]
  );

  // Handle Percentage Preset Click
  const handlePercentageSelect = (preset: string) => {
    let amt = "1.0";
    if (preset === "MAX") {
      amt = "1.0";
    } else if (preset === "75%") {
      amt = "0.75";
    } else if (preset === "50%") {
      amt = "0.50";
    } else if (preset === "25%") {
      amt = "0.25";
    }
    swap.handleFromAmountChange(amt);
  };

  const handleMainAction = () => {
    if (!isConnected) {
      open();
    } else {
      if (!swap.fromAmount || Number(swap.fromAmount) <= 0) {
        swap.handleFromAmountChange("1.0");
      }
      swap.setReviewModalVisible(true);
    }
  };

  const fromSymbol = swap.selectedTokenFrom?.symbol || "ETH";
  const toSymbol = swap.selectedTokenTo?.symbol || "USDC";

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header rightAction="connect" />

      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={swap.refreshing}
            onRefresh={swap.onRefresh}
          />
        }
      >
        {/* ═══ Exchange Card ═══ */}
        <View style={styles.exchangeCard}>
          {/* Header Row */}
          <View style={styles.exchangeHeader}>
            <View>
              <Text style={styles.exchangeTitle}>Exchange</Text>
              <Text style={styles.exchangeSub}>Best decentralized exchange rates</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => swap.setSettingsOpen(true)}
              hitSlop={6}
            >
              <SettingsIcon
                size={18}
                color={theme.colors.lightGrey}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>

          {/* ─── From Field & Percentages ─── */}
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>You Pay</Text>
            <View style={styles.percentageRow}>
              {PERCENTAGE_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={styles.percentagePill}
                  onPress={() => handlePercentageSelect(p)}
                >
                  <Text style={styles.percentageText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LinearGradient
            colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.inputGradientBorder}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.amountInput}
                value={swap.fromAmount}
                onChangeText={swap.handleFromAmountChange}
                placeholder="0.0"
                placeholderTextColor={theme.colors.grey}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => swap.openTokenModal("from")}
              >
                {swap.selectedTokenFrom ? (
                  <View style={styles.tokenSelectorInner}>
                    <BlockchainIcon
                      symbol={swap.selectedTokenFrom.symbol}
                      size={24}
                      logoUrl={swap.selectedTokenFrom.icon}
                    />
                    <Text style={styles.tokenSelectorText}>
                      {swap.selectedTokenFrom.symbol}
                    </Text>
                    <ChevronRightIcon size={14} color={theme.colors.lightGrey} strokeWidth={2.5} />
                  </View>
                ) : (
                  <View style={styles.tokenSelectorInner}>
                    <View style={styles.plusCircle}>
                      <Text style={styles.plusText}>+</Text>
                    </View>
                    <View>
                      <Text style={styles.selectTokenText}>Select</Text>
                      <Text style={styles.selectTokenText}>token</Text>
                    </View>
                    <ChevronRightIcon size={14} color={theme.colors.lightGrey} strokeWidth={2.5} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* ─── Swap Direction Button ─── */}
          <View style={styles.swapButtonRow}>
            <TouchableOpacity
              style={styles.swapButton}
              onPress={swap.handleSwap}
              activeOpacity={0.7}
            >
              <Animated.View
                style={{
                  transform: [{ rotate: swap.rotateInterpolate }],
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <SwapIcon size={18} color={theme.colors.white} strokeWidth={2.5} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* ─── To Field ─── */}
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>You Receive</Text>
            <Text style={styles.estLabel}>{swap.isQuoting ? "Quoting..." : "Estimated"}</Text>
          </View>

          <LinearGradient
            colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.inputGradientBorder}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.amountInput}
                value={swap.toAmount}
                onChangeText={swap.setToAmount}
                placeholder="0.0"
                placeholderTextColor={theme.colors.grey}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => swap.openTokenModal("to")}
              >
                {swap.selectedTokenTo ? (
                  <View style={styles.tokenSelectorInner}>
                    <BlockchainIcon
                      symbol={swap.selectedTokenTo.symbol}
                      size={24}
                      logoUrl={swap.selectedTokenTo.icon}
                    />
                    <Text style={styles.tokenSelectorText}>
                      {swap.selectedTokenTo.symbol}
                    </Text>
                    <ChevronRightIcon size={14} color={theme.colors.lightGrey} strokeWidth={2.5} />
                  </View>
                ) : (
                  <View style={styles.tokenSelectorInner}>
                    <View style={styles.plusCircle}>
                      <Text style={styles.plusText}>+</Text>
                    </View>
                    <View>
                      <Text style={styles.selectTokenText}>Select</Text>
                      <Text style={styles.selectTokenText}>token</Text>
                    </View>
                    <ChevronRightIcon size={14} color={theme.colors.lightGrey} strokeWidth={2.5} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* ─── Rate & Routing Summary Box ─── */}
          <View style={styles.routeSummaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Rate</Text>
              <Text style={styles.summaryValue}>
                {(() => {
                  if (swap.isQuoting) return "Fetching live rate...";
                  if (swap.quoteData?.exchangeRate) {
                    return `1 ${fromSymbol} ≈ ${swap.quoteData.exchangeRate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${toSymbol}`;
                  }
                  const rate = getExchangeRate(fromSymbol, toSymbol);
                  if (rate === null) return "Rate unavailable";
                  return `1 ${fromSymbol} ≈ ${rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${toSymbol}`;
                })()}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Route</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <LightningIcon size={12} color="#10B981" strokeWidth={2.5} />
                <Text style={styles.summaryHighlight}>
                  {swap.quoteData?.provider || (swap.routeType === "bridge" ? "Multi-Chain Bridge" : "Uniswap v3 & 1inch Split")}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <TouchableOpacity
                style={styles.slippageRow}
                onPress={() => swap.setSettingsOpen(true)}
              >
                <Text style={styles.summaryLabel}>Max Slippage</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={styles.slippageValue}>{swap.slippage}%</Text>
                  <SettingsIcon size={11} color={theme.colors.lightGrey} strokeWidth={2} />
                </View>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <GasIcon size={12} color={theme.colors.grey} strokeWidth={2} />
                <Text style={styles.gasEstimate}>
                  {swap.quoteData?.estimatedGasUsd ? `Est. ~$${swap.quoteData.estimatedGasUsd.toFixed(2)}` : "Est. ~$1.40"}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── Main Action Button ─── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleMainAction}
            style={styles.connectButtonWrapper}
          >
            <LinearGradient
              colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              <Text style={styles.connectButtonText}>
                {isConnected ? (swap.routeType === "bridge" ? "Review Bridge" : "Review Swap") : "Connect Wallet"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ═══ Modals ═══ */}
        <SwapReviewModal
          visible={swap.reviewModalVisible}
          onClose={() => swap.setReviewModalVisible(false)}
          fromAmount={swap.fromAmount || ""}
          toAmount={
            swap.toAmount ||
            (swap.fromAmount
              ? calculateToAmount(swap.fromAmount, fromSymbol, toSymbol)
              : "")
          }
          fromToken={swap.selectedTokenFrom}
          toToken={swap.selectedTokenTo}
          chain={swap.selectedChainFrom}
          toChain={swap.selectedChainTo}
          slippage={swap.slippage}
          quoteData={swap.quoteData}
          routeType={swap.routeType}
        />

        <SwapSettingsBottomSheet
          isPresented={swap.settingsOpen}
          onDismiss={() => swap.setSettingsOpen(false)}
          chainName={swap.displayChain.name}
        />

        <ChainSelectorModal
          visible={swap.chainModalVisible}
          target={swap.chainModalTarget}
          onClose={() => swap.setChainModalVisible(false)}
          onSelect={swap.selectChain}
        />

        <TokenSelectorModal
          visible={swap.tokenModalVisible}
          activeChain={swap.activeChainForModal}
          tokenSearch={swap.tokenSearch}
          setTokenSearch={swap.setTokenSearch}
          filteredTokens={swap.filteredTokens}
          favorites={swap.favorites}
          onClose={() => swap.setTokenModalVisible(false)}
          onSelect={swap.selectToken}
          onToggleFavorite={swap.toggleFavorite}
          onChangeChain={() => {
            swap.setTokenModalVisible(false);
            setTimeout(
              () => swap.openChainModal(swap.tokenModalTarget),
              300
            );
          }}
        />
      </ScrollView>
    </SafeAreaContainer>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

function createStyles(theme: ThemeType, insets: EdgeInsets) {
  const sp = (val: string | number) =>
    typeof val === "number" ? val : parseFloat(val);

  return StyleSheet.create({
    contentContainer: {
      flexGrow: 1,
      justifyContent: "flex-start",
      padding: sp(theme.spacing.medium),
    },

    // ═══ Exchange Card ═══
    exchangeCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 6,
    },
    exchangeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    exchangeTitle: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 22,
      fontWeight: "800",
    },
    exchangeSub: {
      color: theme.colors.grey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 12,
      marginTop: 2,
    },
    settingsButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },

    // ─── Input Fields ───
    fieldHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
      marginLeft: 2,
    },
    fieldLabel: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 13,
    },
    estLabel: {
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "500",
    },
    percentageRow: {
      flexDirection: "row",
      gap: 6,
    },
    percentagePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: "rgba(124, 58, 237, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(124, 58, 237, 0.25)",
    },
    percentageText: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontWeight: "700",
    },
    inputGradientBorder: {
      borderRadius: 16,
      padding: 1.5,
      marginBottom: 4,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderRadius: 14.5,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    amountInput: {
      flex: 1,
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 24,
      paddingVertical: 4,
    },
    tokenSelector: {
      marginLeft: 12,
    },
    tokenSelectorInner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
    },
    tokenSelectorText: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 13,
    },
    plusCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    plusText: {
      color: theme.colors.lightGrey,
      fontSize: 16,
      fontWeight: "600",
      marginTop: -1,
    },
    selectTokenText: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 11,
      lineHeight: 14,
    },
    chevron: {
      color: theme.colors.lightGrey,
      fontSize: 18,
      marginLeft: 2,
    },

    // ─── Swap Button ───
    swapButtonRow: {
      alignItems: "center",
      marginVertical: 4,
      zIndex: 2,
    },
    swapButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    swapIcon: {
      color: theme.colors.lightGrey,
      fontSize: 20,
    },

    // ─── Route Summary Card ───
    routeSummaryCard: {
      backgroundColor: theme.colors.dark,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      marginTop: 14,
      gap: 8,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      color: theme.colors.lightGrey,
      fontSize: 12,
      fontWeight: "500",
    },
    summaryValue: {
      color: theme.colors.white,
      fontSize: 12,
      fontWeight: "600",
    },
    summaryHighlight: {
      color: "#10B981",
      fontSize: 12,
      fontWeight: "700",
    },
    slippageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    slippageValue: {
      color: theme.colors.primaryLight,
      fontSize: 12,
      fontWeight: "700",
    },
    gasEstimate: {
      color: theme.colors.grey,
      fontSize: 11,
      fontWeight: "500",
    },

    // ─── Connect Button ───
    connectButtonWrapper: {
      marginTop: 16,
      borderRadius: 14,
      overflow: "hidden",
    },
    connectGradient: {
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    connectButtonText: {
      color: "#FFFFFF",
      fontFamily: theme.fonts.families.openBold,
      fontSize: 16,
      letterSpacing: 0.5,
    },
  });
}
