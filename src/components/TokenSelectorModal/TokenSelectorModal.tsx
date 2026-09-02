import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";
import { BlockchainIcon } from "../BlockchainIcon/BlockchainIcon";
import CloseIcon from "../../assets/svg/close.svg";
import type { Chain, Token } from "../../constants/tokenRegistry";

// ═══════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════

interface TokenSelectorModalProps {
  visible: boolean;
  activeChain: Chain;
  tokenSearch: string;
  setTokenSearch: (val: string) => void;
  filteredTokens: Token[];
  favorites: string[];
  onClose: () => void;
  onSelect: (token: Token) => void;
  onToggleFavorite: (symbol: string) => void;
  onChangeChain: () => void;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export function TokenSelectorModal({
  visible,
  activeChain,
  tokenSearch,
  setTokenSearch,
  filteredTokens,
  favorites,
  onClose,
  onSelect,
  onToggleFavorite,
  onChangeChain,
}: TokenSelectorModalProps) {
  const theme = useTheme() as ThemeType;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const renderToken = React.useCallback(
    ({ item }: { item: Token }) => (
      <TouchableOpacity
        style={styles.tokenRow}
        onPress={() => onSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.tokenRowLeft}>
          <BlockchainIcon
            symbol={item.symbol}
            size={40}
            logoUrl={item.icon}
          />
          <View>
            <Text style={styles.tokenSymbol}>{item.symbol}</Text>
            <Text style={styles.tokenName}>{item.name}</Text>
            {item.address !== "native" && (
              <Text style={styles.tokenAddress}>
                {item.address.slice(0, 6)}...{item.address.slice(-4)}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onToggleFavorite(item.symbol)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[
              styles.favoriteIcon,
              favorites.includes(item.symbol) && styles.favoriteIconActive,
            ]}
          >
            ☆
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [styles, favorites, onSelect, onToggleFavorite]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Select Token - {activeChain.name}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <CloseIcon
                width={18}
                height={18}
                fill={theme.colors.lightGrey}
              />
            </TouchableOpacity>
          </View>

          {/* Search Bar with Gradient Border */}
          <LinearGradient
            colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.searchBarGradient}
          >
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={tokenSearch}
                onChangeText={setTokenSearch}
                placeholder={`Search name, symbol, or paste ${activeChain.name} address`}
                placeholderTextColor={theme.colors.grey}
              />
            </View>
          </LinearGradient>

          {/* Change Chain Link */}
          <TouchableOpacity
            style={styles.changeChainLink}
            onPress={onChangeChain}
          >
            <Text style={styles.changeChainText}>← Change chain</Text>
          </TouchableOpacity>

          {/* Section Header */}
          <Text style={styles.sectionHeader}>TOKENS</Text>

          {/* Token List */}
          <FlatList
            data={filteredTokens}
            keyExtractor={(item) => item.address}
            style={styles.tokenList}
            renderItem={renderToken}
          />
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

function createStyles(theme: ThemeType) {
  return StyleSheet.create({
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
    searchBarGradient: {
      borderRadius: 14,
      padding: 1.5,
      marginBottom: 12,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderRadius: 12.5,
      paddingHorizontal: 14,
      paddingVertical: 10,
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
      color: theme.colors.primaryLight,
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
    tokenAddress: {
      color: theme.colors.grey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 10,
      marginTop: 1,
      opacity: 0.7,
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
