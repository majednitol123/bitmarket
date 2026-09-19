import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme } from "styled-components/native";
import { ThemeType } from "../../styles/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, router } from "expo-router";
import { MenuIcon, ChevronDownIcon, ChevronLeftIcon, PortfolioIcon, RefreshCwIcon } from "../Icons/AppIcons";
import { ROUTES } from "../../constants/routes";
import { useAppKit, useAccount } from "@reown/appkit-react-native";

export interface HeaderProps {
  title?: string;
  onOpenDrawer?: () => void;
  currentChainName?: string;
  onOpenChainModal?: () => void;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: "network" | "connect" | "none";
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  onOpenDrawer,
  currentChainName = "Ethereum",
  onOpenChainModal,
  showBack,
  onBack,
  rightAction = "connect",
  onRefresh,
  isRefreshing = false,
}) => {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { open } = useAppKit();
  const { isConnected, address } = useAccount();

  const formatAddress = (addr?: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleOpenDrawer = () => {
    if (onOpenDrawer) {
      onOpenDrawer();
      return;
    }
    const nav = navigation as any;
    if (typeof nav.toggleDrawer === "function") {
      nav.toggleDrawer();
    } else if (typeof nav.openDrawer === "function") {
      nav.openDrawer();
    } else if (nav.dispatch) {
      nav.dispatch({ type: "TOGGLE_DRAWER" });
    } else {
      const parent = nav.getParent?.();
      if (typeof parent?.toggleDrawer === "function") {
        parent.toggleDrawer();
      } else if (parent?.dispatch) {
        parent.dispatch({ type: "TOGGLE_DRAWER" });
      }
    }
  };

  const handleLeftAction = () => {
    if (showBack) {
      if (onBack) {
        onBack();
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(ROUTES.home as any);
      }
      return;
    }
    handleOpenDrawer();
  };

  return (
    <LinearGradient
      colors={theme.colors.headerGradient}
      locations={[0, 1]}
      style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.contentRow}>
        {/* Left: Back Button or Brand Logo */}
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.drawerButton,
                {
                  backgroundColor: theme.colors.cardBackground,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={handleLeftAction}
            >
              <ChevronLeftIcon size={20} color={theme.colors.white} strokeWidth={2.2} />
            </TouchableOpacity>
          )}

          {title ? (
            <View style={styles.brandContainer}>
              <Text style={[styles.brandTitle, { color: theme.colors.white }]}>
                {title}
              </Text>
            </View>
          ) : (
            <View style={styles.brandContainer}>
              <LinearGradient
                colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoBadge}
              >
                <Text style={styles.logoBadgeText}>B</Text>
              </LinearGradient>
              <Text style={[styles.brandTitle, { color: theme.colors.white }]}>
                BitMarket
              </Text>
            </View>
          )}
        </View>

        {/* Right Action */}
        <View style={styles.rightGroup}>
          {rightAction === "network" ? (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[
                styles.networkPill,
                {
                  backgroundColor: theme.colors.cardBackground,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={onOpenChainModal}
            >
              <View style={styles.networkDot} />
              <Text
                style={[styles.networkPillText, { color: theme.colors.white }]}
                numberOfLines={1}
              >
                {currentChainName}
              </Text>
              <ChevronDownIcon size={12} color={theme.colors.lightGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : rightAction === "connect" ? (
            isConnected && address ? (
              <TouchableOpacity
                activeOpacity={0.75}
                style={[
                  styles.networkPill,
                  {
                    backgroundColor: theme.colors.cardBackground,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => open()}
              >
                <View style={styles.networkDot} />
                <Text
                  style={[styles.networkPillText, { color: theme.colors.white }]}
                  numberOfLines={1}
                >
                  {formatAddress(address)}
                </Text>
                <ChevronDownIcon size={12} color={theme.colors.lightGrey} strokeWidth={2.5} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.connectButton}
                onPress={() => open()}
              >
                <LinearGradient
                  colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.connectButtonGradient}
                >
                  <PortfolioIcon size={14} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.connectButtonText}>Connect</Text>
                </LinearGradient>
              </TouchableOpacity>
            )
          ) : null}

          {onRefresh && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onRefresh}
              disabled={isRefreshing}
              style={[
                styles.refreshBtn,
                {
                  backgroundColor: theme.colors.cardBackground,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <RefreshCwIcon size={15} color={theme.colors.white} strokeWidth={2.2} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  drawerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  networkPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  networkPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  connectButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  connectButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 6,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

export default Header;
