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
import { SearchIcon } from "../Icons/AppIcons";
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
interface TokenRowItemProps {
  item: Token;
  isFavorite: boolean;
  styles: ReturnType<typeof createStyles>;
  onSelect: (item: Token) => void;
  onToggleFavorite: (symbol: string) => void;
}

const TokenRowItem = React.memo<TokenRowItemProps>(
  function TokenRowItem({ item, isFavorite, styles, onSelect, onToggleFavorite }) {
    return (
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
          </View>
        </View>
        <TouchableOpacity
          onPress={() => onToggleFavorite(item.symbol)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text
            style={[
              styles.favoriteIcon,
              isFavorite && styles.favoriteIconActive,
            ]}
          >
            ☆
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.item.address === next.item.address &&
    prev.item.symbol === next.item.symbol &&
    prev.isFavorite === next.isFavorite &&
    prev.styles === next.styles &&
    prev.onSelect === next.onSelect &&
    prev.onToggleFavorite === next.onToggleFavorite
);

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
      <TokenRowItem
        item={item}
        isFavorite={favorites.includes(item.symbol)}
        styles={styles}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
      />
    ),
    [styles, favorites, onSelect, onToggleFavorite]
  );

  const getItemLayout = React.useCallback(
    (_: any, index: number) => ({ length: 65, offset: 65 * index, index }),
    []
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
              <SearchIcon size={16} color={theme.colors.lightGrey} strokeWidth={2} />
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
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={5}
            getItemLayout={getItemLayout}
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
