import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAppKit, useAccount } from "@reown/appkit-react-native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import type { ThemeType } from "../../styles/theme";
import { ROUTES } from "../../constants/routes";
import {
  SwapIcon,
  PortfolioIcon,
  MarketsIcon,
  GasIcon,
  SettingsIcon,
  PortfolioIcon as PortfolioNavIcon,
} from "../Icons/AppIcons";

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const { navigation, state } = props;
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();

  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

  const currentRoute = state?.routes[state.index]?.name || "index";
  const isExchangeActive = currentRoute === "index";
  const isPortfolioActive = currentRoute === "portfolio/index" || currentRoute.includes("portfolio");
  const isMarketsActive = currentRoute === "markets/index" || currentRoute === "markets";
  const isGasActive = currentRoute === "gas-tracker/index" || currentRoute === "gas-tracker";
  const isSettingsActive = currentRoute === "settings/settings-modal" || currentRoute.includes("settings");

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const handleNavigateExchange = () => {
    navigation.closeDrawer();
    router.replace("/(app)");
  };

  const handleNavigatePortfolio = () => {
    navigation.closeDrawer();
    router.push("/(app)/portfolio");
  };

  const handleNavigateMarkets = () => {
    navigation.closeDrawer();
    router.push("/(app)/markets");
  };

  const handleNavigateGas = () => {
    navigation.closeDrawer();
    router.push("/(app)/gas-tracker");
  };

  const handleOpenSettings = () => {
    navigation.closeDrawer();
    router.push(ROUTES.settings);
  };

  const handleConnectWallet = () => {
    navigation.closeDrawer();
    open();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.cardBackground,
          borderColor: theme.colors.border,
          paddingTop: insets.top + (Platform.OS === "android" ? 16 : 10),
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      {/* ═══ Header ═══ */}
      <View style={styles.drawerHeader}>
        <View style={styles.brandRow}>
          <LinearGradient
            colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadge}
          >
            <Text style={styles.logoBadgeText}>B</Text>
          </LinearGradient>
          <View>
            <Text style={[styles.brandTitle, { color: theme.colors.white }]}>
              BitMarket
            </Text>
            <Text style={[styles.brandSubtitle, { color: theme.colors.lightGrey }]}>
              DEX Aggregator
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.closeDrawer()}
          style={[styles.closeButton, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}
          hitSlop={8}
        >
          <Text style={[styles.closeIconText, { color: theme.colors.lightGrey }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Network Status Pill ═══ */}
      <View
        style={[styles.networkStatusCard, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}
      >
        <View style={styles.statusDot} />
        <Text style={[styles.networkName, { color: theme.colors.white }]}>
          Ethereum Mainnet
        </Text>
        <Text style={[styles.networkBadge, { color: theme.colors.primaryLight }]}>
          Live 🟢
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      {/* ═══ Navigation Menu Items ═══ */}
      <ScrollView
        style={styles.menuScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.menuContainer}
      >
        {/* Exchange */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            isExchangeActive && [
              styles.menuItemActive,
              { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
            ],
          ]}
          onPress={handleNavigateExchange}
        >
          <View
            style={[
              styles.menuIconBox,
              {
                backgroundColor: isExchangeActive
                  ? theme.colors.primary
                  : theme.colors.dark,
              },
            ]}
          >
            <SwapIcon
              color={isExchangeActive ? "#FFFFFF" : theme.colors.lightGrey}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text
              style={[
                styles.menuTitle,
                {
                  color: isExchangeActive
                    ? theme.colors.primaryLight
                    : theme.colors.white,
                },
              ]}
            >
              Exchange
            </Text>
            <Text style={[styles.menuSubtitle, { color: theme.colors.grey }]}>
              Swap tokens across 20+ chains
            </Text>
          </View>
        </TouchableOpacity>

        {/* Portfolio */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            isPortfolioActive && [
              styles.menuItemActive,
              { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
            ],
          ]}
          onPress={handleNavigatePortfolio}
        >
          <View
            style={[
              styles.menuIconBox,
              {
                backgroundColor: isPortfolioActive
                  ? theme.colors.primary
                  : theme.colors.dark,
              },
            ]}
          >
            <PortfolioNavIcon
              color={isPortfolioActive ? "#FFFFFF" : theme.colors.lightGrey}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text
              style={[
                styles.menuTitle,
                {
                  color: isPortfolioActive
                    ? theme.colors.primaryLight
                    : theme.colors.white,
                },
              ]}
            >
              Portfolio
            </Text>
            <Text style={[styles.menuSubtitle, { color: theme.colors.grey }]}>
              Net worth, tokens & DeFi yield
            </Text>
          </View>
        </TouchableOpacity>

        {/* Markets */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            isMarketsActive && [
              styles.menuItemActive,
              { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
            ],
          ]}
          onPress={handleNavigateMarkets}
        >
          <View
            style={[
              styles.menuIconBox,
              {
                backgroundColor: isMarketsActive
                  ? theme.colors.primary
                  : theme.colors.dark,
              },
            ]}
          >
            <MarketsIcon
              color={isMarketsActive ? "#FFFFFF" : theme.colors.lightGrey}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text
              style={[
                styles.menuTitle,
                {
                  color: isMarketsActive
                    ? theme.colors.primaryLight
                    : theme.colors.white,
                },
              ]}
            >
              Markets
            </Text>
            <Text style={[styles.menuSubtitle, { color: theme.colors.grey }]}>
              Live token rankings & gainers
            </Text>
          </View>
        </TouchableOpacity>

        {/* Gas Tracker */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            isGasActive && [
              styles.menuItemActive,
              { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
            ],
          ]}
          onPress={handleNavigateGas}
        >
          <View
            style={[
              styles.menuIconBox,
              {
                backgroundColor: isGasActive
                  ? theme.colors.primary
                  : theme.colors.dark,
              },
            ]}
          >
            <GasIcon
              color={isGasActive ? "#FFFFFF" : theme.colors.lightGrey}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text
              style={[
                styles.menuTitle,
                {
                  color: isGasActive
                    ? theme.colors.primaryLight
                    : theme.colors.white,
                },
              ]}
            >
              Gas Tracker
            </Text>
            <Text style={[styles.menuSubtitle, { color: theme.colors.grey }]}>
              Live multi-chain Gwei & speed
            </Text>
          </View>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity
          style={[
            styles.menuItem,
            isSettingsActive && [
              styles.menuItemActive,
              { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
            ],
          ]}
          onPress={handleOpenSettings}
        >
          <View
            style={[
              styles.menuIconBox,
              {
                backgroundColor: isSettingsActive
                  ? theme.colors.primary
                  : theme.colors.dark,
              },
            ]}
          >
            <SettingsIcon
              color={isSettingsActive ? "#FFFFFF" : theme.colors.lightGrey}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text
              style={[
                styles.menuTitle,
                {
                  color: isSettingsActive
                    ? theme.colors.primaryLight
                    : theme.colors.white,
                },
              ]}
            >
              Settings
            </Text>
            <Text style={[styles.menuSubtitle, { color: theme.colors.grey }]}>
              Themes, alerts & security
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* ═══ Footer Wallet Section ═══ */}
      <View style={styles.drawerFooter}>
        {isConnected ? (
          <View style={[styles.connectedCard, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}>
            <View style={styles.connectedRow}>
              <View style={styles.connectedDot} />
              <Text style={[styles.connectedText, { color: theme.colors.white }]}>
                {shortAddress}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  navigation.closeDrawer();
                  open({ view: "Account" });
                }}
                style={styles.disconnectBadge}
                hitSlop={6}
              >
                <Text style={styles.disconnectText}>Manage</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleConnectWallet}
            style={styles.connectButton}
          >
            <LinearGradient
              colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectGradient}
            >
              <PortfolioIcon color="#FFFFFF" />
              <Text style={styles.connectBtnText}>Connect Wallet</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <Text style={[styles.footerVersionText, { color: theme.colors.grey }]}>
          BitMarket DEX v1.0.0
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    borderRightWidth: 1,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIconText: {
    fontSize: 13,
    fontWeight: "700",
  },
  networkStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  networkName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  networkBadge: {
    fontSize: 11,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginBottom: 14,
  },
  menuScroll: {
    flex: 1,
  },
  menuContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 12,
  },
  menuItemActive: {
    borderWidth: 1,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 11,
    fontWeight: "400",
  },
  drawerFooter: {
    marginTop: "auto",
    paddingTop: 14,
    gap: 10,
  },
  connectedCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  connectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  connectedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  disconnectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  disconnectText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "700",
  },
  connectButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  connectGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    gap: 8,
  },
  connectBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  footerVersionText: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 4,
  },
});
