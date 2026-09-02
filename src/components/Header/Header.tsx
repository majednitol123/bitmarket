import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "styled-components/native";
import { ThemeType } from "../../styles/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, router } from "expo-router";
import { MenuIcon, ChevronDownIcon, ChevronLeftIcon } from "../Icons/AppIcons";
import { ROUTES } from "../../constants/routes";

export interface HeaderProps {
  title?: string;
  onOpenDrawer?: () => void;
  currentChainName?: string;
  onOpenChainModal?: () => void;
  showBack?: boolean;
  onBack?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title,
  onOpenDrawer,
  currentChainName = "Ethereum",
  onOpenChainModal,
  showBack,
  onBack,
}) => {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
        {/* Left: Drawer Toggle / Back Button & Brand */}
        <View style={styles.leftGroup}>
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
            {showBack ? (
              <ChevronLeftIcon size={20} color={theme.colors.white} strokeWidth={2.2} />
            ) : (
              <MenuIcon size={20} color={theme.colors.white} strokeWidth={2.2} />
            )}
          </TouchableOpacity>

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

        {/* Right: Network Selector */}
        <View style={styles.rightGroup}>
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
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    width: "100%",
    zIndex: 10,
    paddingBottom: 10,
  },
  contentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  drawerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
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
    justifyContent: "center",
    alignItems: "center",
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontSize: 16,
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
});

export default Header;
