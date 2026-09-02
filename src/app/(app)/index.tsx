import { useMemo } from "react";
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
import SettingsIcon from "../../assets/svg/settings.svg";

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════

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

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header />
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 40 },
        ]}
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
              <View style={styles.networkRow}>
                <Text style={styles.networkLabel}>Network:</Text>
                <TouchableOpacity
                  style={styles.networkBadge}
                  onPress={() => swap.openChainModal("from")}
                >
                  <Text style={styles.networkBadgeText}>
                    {swap.displayChain.name}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => swap.setSettingsOpen(true)}
            >
              <SettingsIcon
                width={18}
                height={18}
                fill={theme.colors.lightGrey}
              />
            </TouchableOpacity>
          </View>

          {/* ─── From Field ─── */}
          <Text style={styles.fieldLabel}>From</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.amountInput}
              value={swap.fromAmount}
              onChangeText={swap.setFromAmount}
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
                  <Text style={styles.chevron}>›</Text>
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
                  <Text style={styles.chevron}>›</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Swap Button ─── */}
          <View style={styles.swapButtonRow}>
            <TouchableOpacity
              style={styles.swapButton}
              onPress={swap.handleSwap}
              activeOpacity={0.7}
            >
              <Animated.Text
                style={[
                  styles.swapIcon,
                  { transform: [{ rotate: swap.rotateInterpolate }] },
                ]}
              >
                ⇅
              </Animated.Text>
            </TouchableOpacity>
          </View>

          {/* ─── To Field ─── */}
          <Text style={styles.fieldLabel}>To</Text>
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
                  <Text style={styles.chevron}>›</Text>
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
                  <Text style={styles.chevron}>›</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Connect Wallet Button ─── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => open()}
            style={styles.connectButtonWrapper}
          >
            <LinearGradient
              colors={["#3772FF", "#9B59B6"] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              <Text style={styles.connectButtonText}>
                {isConnected ? "Connected" : "Connect Wallet"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ═══ Modals ═══ */}
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
// STYLES (only exchange card layout — modals/settings own theirs)
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
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    exchangeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 20,
    },
    exchangeTitle: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 22,
      marginBottom: 6,
    },
    networkRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    networkLabel: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 12,
      marginRight: 6,
    },
    networkBadge: {
      backgroundColor: "rgba(55, 114, 255, 0.15)",
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
    },
    networkBadgeText: {
      color: "#5B8DFF",
      fontFamily: theme.fonts.families.openBold,
      fontSize: 11,
    },
    settingsButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.dark,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },

    // ─── Input Fields ───
    fieldLabel: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 12,
      marginBottom: 8,
      marginLeft: 2,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 4,
    },
    amountInput: {
      flex: 1,
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 26,
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

    // ─── Connect Button ───
    connectButtonWrapper: {
      marginTop: 20,
      borderRadius: 14,
      overflow: "hidden",
    },
    connectGradient: {
      paddingVertical: 16,
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
