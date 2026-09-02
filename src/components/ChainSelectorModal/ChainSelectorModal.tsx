import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";
import { BlockchainIcon } from "../BlockchainIcon/BlockchainIcon";
import CloseIcon from "../../assets/svg/close.svg";
import { CHAINS, type Chain } from "../../constants/tokenRegistry";

// ═══════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════

interface ChainSelectorModalProps {
  visible: boolean;
  target: "from" | "to";
  onClose: () => void;
  onSelect: (chain: Chain) => void;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export function ChainSelectorModal({
  visible,
  target,
  onClose,
  onSelect,
}: ChainSelectorModalProps) {
  const theme = useTheme() as ThemeType;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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
              Select Chain - {target === "from" ? "From" : "To"}
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

          {/* Chain Grid */}
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.chainGrid}>
              {CHAINS.map((chain) => (
                <TouchableOpacity
                  key={chain.id}
                  style={styles.chainCard}
                  onPress={() => onSelect(chain)}
                  activeOpacity={0.7}
                >
                  <BlockchainIcon
                    symbol={chain.symbol}
                    size={36}
                    chainId={Number(chain.id) || undefined}
                    chainName={chain.name}
                    logoUrl={chain.icon}
                  />
                  <View style={styles.chainTextGroup}>
                    <Text style={styles.chainName} numberOfLines={1}>
                      {chain.name}
                    </Text>
                    <Text style={styles.chainSymbol}>{chain.symbol}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
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
    chainGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
    },
    chainCard: {
      width: "48%",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    chainTextGroup: {
      flex: 1,
      marginLeft: 10,
    },
    chainName: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 13,
      marginBottom: 1,
    },
    chainSymbol: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 11,
    },
  });
}
