import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import {
  RefreshControl,
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { useTheme } from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import type { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import Header from "../../components/Header/Header";
import { useAppKit, useAccount } from "@reown/appkit-react-native";
import SettingsIcon from "../../assets/svg/settings.svg";
import CloseIcon from "../../assets/svg/close.svg";

// ═══════════════════════════════════════════════════════════
// CHAIN & TOKEN DATA
// ═══════════════════════════════════════════════════════════

interface Chain {
  id: string;
  name: string;
  symbol: string;
  color: string;
  icon: string;
}

interface Token {
  symbol: string;
  name: string;
  color: string;
  icon: string;
}

const CHAINS: Chain[] = [
  { id: "1", name: "Ethereum", symbol: "ETH", color: "#627EEA", icon: "◆" },
  { id: "137", name: "Polygon", symbol: "MATIC", color: "#8247E5", icon: "⬡" },
  { id: "56", name: "BNB Smart ...", symbol: "BNB", color: "#F3BA2F", icon: "◉" },
  { id: "42161", name: "Arbitrum", symbol: "ETH", color: "#28A0F0", icon: "◈" },
  { id: "10", name: "Optimism", symbol: "ETH", color: "#FF0420", icon: "⊕" },
  { id: "43114", name: "Avalanche", symbol: "AVAX", color: "#E84142", icon: "▲" },
  { id: "8453", name: "Base", symbol: "ETH", color: "#0052FF", icon: "■" },
  { id: "sol", name: "Solana", symbol: "SOL", color: "#00DCFA", icon: "◎" },
];

const TOKENS_BY_CHAIN: Record<string, Token[]> = {
  "1": [
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", icon: "₮" },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", icon: "◈" },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", icon: "₿" },
    { symbol: "UNI", name: "Uniswap", color: "#FF007A", icon: "🦄" },
    { symbol: "LINK", name: "Chainlink", color: "#2A5ADA", icon: "⬡" },
    { symbol: "AAVE", name: "Aave Token", color: "#B6509E", icon: "👻" },
    { symbol: "MKR", name: "Maker", color: "#1AAB9B", icon: "Ⓜ" },
  ],
  "137": [
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", icon: "$" },
    { symbol: "WMATIC", name: "Wrapped MATIC", color: "#8247E5", icon: "⬡" },
    { symbol: "AAVE", name: "Aave Token", color: "#B6509E", icon: "👻" },
  ],
  "56": [
    { symbol: "BUSD", name: "Binance USD", color: "#F0B90B", icon: "$" },
    { symbol: "CAKE", name: "PancakeSwap", color: "#D1884F", icon: "🥞" },
    { symbol: "WBNB", name: "Wrapped BNB", color: "#F3BA2F", icon: "◉" },
  ],
  "42161": [
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", icon: "$" },
    { symbol: "ARB", name: "Arbitrum", color: "#28A0F0", icon: "◈" },
    { symbol: "GMX", name: "GMX", color: "#2D42FC", icon: "G" },
  ],
  "10": [
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", icon: "$" },
    { symbol: "OP", name: "Optimism", color: "#FF0420", icon: "⊕" },
    { symbol: "SNX", name: "Synthetix", color: "#00D1FF", icon: "S" },
  ],
  "43114": [
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", icon: "$" },
    { symbol: "WAVAX", name: "Wrapped AVAX", color: "#E84142", icon: "▲" },
    { symbol: "JOE", name: "Trader Joe", color: "#E84142", icon: "J" },
  ],
  "8453": [
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", icon: "$" },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", icon: "◆" },
  ],
  "sol": [
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", icon: "$" },
    { symbol: "RAY", name: "Raydium", color: "#8C52FF", icon: "R" },
    { symbol: "SRM", name: "Serum", color: "#3FC0E0", icon: "S" },
  ],
};

// Default tokens for all chains
const DEFAULT_TOKENS: Token[] = TOKENS_BY_CHAIN["1"];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function Index() {
  const insets = useSafeAreaInsets();
  const theme = useTheme() as ThemeType;
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Reown AppKit hooks ───
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

  // ─── Exchange state ───
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [selectedChainFrom, setSelectedChainFrom] = useState<Chain>(CHAINS[0]);
  const [selectedChainTo, setSelectedChainTo] = useState<Chain>(CHAINS[0]);
  const [selectedTokenFrom, setSelectedTokenFrom] = useState<Token | null>(null);
  const [selectedTokenTo, setSelectedTokenTo] = useState<Token | null>(null);

  // ─── Modal state ───
  const [chainModalVisible, setChainModalVisible] = useState(false);
  const [chainModalTarget, setChainModalTarget] = useState<"from" | "to">("from");
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenModalTarget, setTokenModalTarget] = useState<"from" | "to">("from");
  const [tokenSearch, setTokenSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  // ─── Animation ───
  const swapRotation = useRef(new Animated.Value(0)).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // ─── Handlers ───
  const openChainModal = (target: "from" | "to") => {
    setChainModalTarget(target);
    setChainModalVisible(true);
  };

  const selectChain = (chain: Chain) => {
    if (chainModalTarget === "from") {
      setSelectedChainFrom(chain);
      setSelectedTokenFrom(null);
    } else {
      setSelectedChainTo(chain);
      setSelectedTokenTo(null);
    }
    setChainModalVisible(false);
  };

  const openTokenModal = (target: "from" | "to") => {
    setTokenModalTarget(target);
    setTokenSearch("");
    setTokenModalVisible(true);
  };

  const selectToken = (token: Token) => {
    if (tokenModalTarget === "from") {
      setSelectedTokenFrom(token);
    } else {
      setSelectedTokenTo(token);
    }
    setTokenModalVisible(false);
  };

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const handleSwap = () => {
    Animated.timing(swapRotation, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      swapRotation.setValue(0);
    });

    // Swap chains, tokens, and amounts
    const tempChain = selectedChainFrom;
    const tempToken = selectedTokenFrom;
    const tempAmount = fromAmount;
    setSelectedChainFrom(selectedChainTo);
    setSelectedTokenFrom(selectedTokenTo);
    setFromAmount(toAmount);
    setSelectedChainTo(tempChain);
    setSelectedTokenTo(tempToken);
    setToAmount(tempAmount);
  };

  const rotateInterpolate = swapRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  // Token list for the active chain in the modal
  const activeChainForModal =
    tokenModalTarget === "from" ? selectedChainFrom : selectedChainTo;
  const tokensForModal = TOKENS_BY_CHAIN[activeChainForModal.id] || DEFAULT_TOKENS;
  const filteredTokens = tokensForModal.filter(
    (t) =>
      t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      t.name.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  // Display chain label — network badge
  const displayChain = selectedChainFrom;

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
            refreshing={refreshing}
            onRefresh={onRefresh}
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
                  onPress={() => openChainModal("from")}
                >
                  <Text style={styles.networkBadgeText}>
                    {displayChain.name}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.settingsButton}>
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
              value={fromAmount}
              onChangeText={setFromAmount}
              placeholder="0.0"
              placeholderTextColor={theme.colors.grey}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => openTokenModal("from")}
            >
              {selectedTokenFrom ? (
                <View style={styles.tokenSelectorInner}>
                  <View
                    style={[
                      styles.tokenIconSmall,
                      { backgroundColor: selectedTokenFrom.color },
                    ]}
                  >
                    <Text style={styles.tokenIconText}>
                      {selectedTokenFrom.icon}
                    </Text>
                  </View>
                  <Text style={styles.tokenSelectorText}>
                    {selectedTokenFrom.symbol}
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
              onPress={handleSwap}
              activeOpacity={0.7}
            >
              <Animated.Text
                style={[
                  styles.swapIcon,
                  { transform: [{ rotate: rotateInterpolate }] },
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
              value={toAmount}
              onChangeText={setToAmount}
              placeholder="0.0"
              placeholderTextColor={theme.colors.grey}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => openTokenModal("to")}
            >
              {selectedTokenTo ? (
                <View style={styles.tokenSelectorInner}>
                  <View
                    style={[
                      styles.tokenIconSmall,
                      { backgroundColor: selectedTokenTo.color },
                    ]}
                  >
                    <Text style={styles.tokenIconText}>
                      {selectedTokenTo.icon}
                    </Text>
                  </View>
                  <Text style={styles.tokenSelectorText}>
                    {selectedTokenTo.symbol}
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

        {/* ═══════════════════════════════════════════════════ */}
        {/* CHAIN SELECTION MODAL                              */}
        {/* ═══════════════════════════════════════════════════ */}
        <Modal
          visible={chainModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setChainModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Select Chain - {chainModalTarget === "from" ? "From" : "To"}
                </Text>
                <TouchableOpacity
                  onPress={() => setChainModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <CloseIcon
                    width={18}
                    height={18}
                    fill={theme.colors.lightGrey}
                  />
                </TouchableOpacity>
              </View>

              {/* Chain Grid */}
              <View style={styles.chainGrid}>
                {CHAINS.map((chain) => (
                  <TouchableOpacity
                    key={chain.id}
                    style={styles.chainCard}
                    onPress={() => selectChain(chain)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.chainIcon,
                        { backgroundColor: chain.color + "22" },
                      ]}
                    >
                      <Text
                        style={[styles.chainIconText, { color: chain.color }]}
                      >
                        {chain.icon}
                      </Text>
                    </View>
                    <Text style={styles.chainName} numberOfLines={1}>
                      {chain.name}
                    </Text>
                    <Text style={styles.chainSymbol}>{chain.symbol}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════ */}
        {/* TOKEN SELECTION MODAL                              */}
        {/* ═══════════════════════════════════════════════════ */}
        <Modal
          visible={tokenModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTokenModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Select Token - {activeChainForModal.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setTokenModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <CloseIcon
                    width={18}
                    height={18}
                    fill={theme.colors.lightGrey}
                  />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  value={tokenSearch}
                  onChangeText={setTokenSearch}
                  placeholder={`Search name, symbol, or paste ${activeChainForModal.name} address`}
                  placeholderTextColor={theme.colors.grey}
                />
              </View>

              {/* Change Chain Link */}
              <TouchableOpacity
                style={styles.changeChainLink}
                onPress={() => {
                  setTokenModalVisible(false);
                  setTimeout(() => openChainModal(tokenModalTarget), 300);
                }}
              >
                <Text style={styles.changeChainText}>← Change chain</Text>
              </TouchableOpacity>

              {/* Section Header */}
              <Text style={styles.sectionHeader}>TOKENS</Text>

              {/* Token List */}
              <FlatList
                data={filteredTokens}
                keyExtractor={(item) => item.symbol}
                style={styles.tokenList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.tokenRow}
                    onPress={() => selectToken(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tokenRowLeft}>
                      <View
                        style={[
                          styles.tokenIcon,
                          { backgroundColor: item.color + "22" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tokenIconLargeText,
                            { color: item.color },
                          ]}
                        >
                          {item.icon}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.tokenSymbol}>{item.symbol}</Text>
                        <Text style={styles.tokenName}>{item.name}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(item.symbol)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text
                        style={[
                          styles.favoriteIcon,
                          favorites.includes(item.symbol) &&
                            styles.favoriteIconActive,
                        ]}
                      >
                        ☆
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
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
  const { width } = Dimensions.get("window");
  const cardPadding = 20;
  const chainCardWidth = (width - sp(theme.spacing.medium) * 2 - cardPadding * 2 - 12) / 2;

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
      padding: cardPadding,
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
    tokenIconSmall: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    tokenIconText: {
      fontSize: 12,
      color: "#fff",
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

    // ═══════════════════════════════════════════════════
    // MODAL COMMON
    // ═══════════════════════════════════════════════════
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 20,
      padding: 20,
      width: "100%",
      maxWidth: 400,
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    modalTitle: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 17,
    },

    // ═══ Chain Modal ═══
    chainGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
    },
    chainCard: {
      width: chainCardWidth,
      backgroundColor: theme.colors.dark,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      alignItems: "center",
    },
    chainIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    chainIconText: {
      fontSize: 18,
    },
    chainName: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 13,
      textAlign: "center",
      marginBottom: 2,
    },
    chainSymbol: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 11,
      textAlign: "center",
    },

    // ═══ Token Modal ═══
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: "#3772FF",
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
    },
    searchIcon: {
      fontSize: 14,
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 13,
    },
    changeChainLink: {
      marginBottom: 16,
    },
    changeChainText: {
      color: "#5B8DFF",
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 13,
    },
    sectionHeader: {
      color: theme.colors.grey,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 11,
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    tokenList: {
      flexGrow: 0,
    },
    tokenRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    tokenRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    tokenIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    tokenIconLargeText: {
      fontSize: 18,
    },
    tokenSymbol: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 15,
    },
    tokenName: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 12,
      marginTop: 2,
    },
    favoriteIcon: {
      fontSize: 22,
      color: theme.colors.grey,
    },
    favoriteIconActive: {
      color: theme.colors.primary,
    },
  });
}
