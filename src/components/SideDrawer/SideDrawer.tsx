import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
} from "react-native";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAppKit, useAccount } from "@reown/appkit-react-native";
import type { ThemeType } from "../../styles/theme";
import { ROUTES } from "../../constants/routes";
import Svg, { Path, Circle, Rect } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

export interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  activeRoute?: "exchange" | "market" | "gas" | "activity";
  onSelectSection?: (section: "exchange" | "market" | "gas" | "activity") => void;
  currentChainName?: string;
  onOpenChainModal?: () => void;
}

// ─── Icons ───
const SwapIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 10h14l-4-4" />
    <Path d="M17 14H3l4 4" />
  </Svg>
);

const MarketIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 3v18h18" />
    <Path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
  </Svg>
);

const GasIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 22v-8a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v8" />
    <Path d="M15 10V6a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v6" />
    <Path d="M19 12h2a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-1" />
    <Path d="M7 10V6a2 2 0 0 1 2-2h1" />
  </Svg>
);

const SettingsNavIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

const WalletNavIcon = ({ color }: { color: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="4" width="20" height="16" rx="3" />
    <Path d="M16 12h4" />
    <Circle cx="18" cy="12" r="1" fill={color} />
  </Svg>
);

export const SideDrawer: React.FC<SideDrawerProps> = ({
  visible,
  onClose,
  activeRoute = "exchange",
  onSelectSection,
  currentChainName = "Ethereum",
  onOpenChainModal,
}) => {
  const theme = useTheme() as ThemeType;
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Wallet connection
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleNav = (target: "exchange" | "market" | "gas" | "activity") => {
    onClose();
    if (onSelectSection) {
      onSelectSection(target);
    }
  };

  const handleOpenSettings = () => {
    onClose();
    router.push(ROUTES.settings);
  };

  const handleConnectWallet = () => {
    onClose();
    open();
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: opacityAnim,
                backgroundColor: "rgba(0, 0, 0, 0.65)",
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Drawer Container */}
        <Animated.View
          style={[
            styles.drawerContent,
            {
              width: DRAWER_WIDTH,
              backgroundColor: theme.colors.cardBackground,
              borderColor: theme.colors.border,
              transform: [{ translateX: slideAnim }],
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
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}
              hitSlop={8}
            >
              <Text style={[styles.closeIconText, { color: theme.colors.lightGrey }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ═══ Network Status Pill ═══ */}
          <TouchableOpacity
            style={[styles.networkStatusCard, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}
            activeOpacity={0.7}
            onPress={() => {
              onClose();
              if (onOpenChainModal) onOpenChainModal();
            }}
          >
            <View style={styles.statusDot} />
            <Text style={[styles.networkName, { color: theme.colors.white }]}>
              {currentChainName}
            </Text>
            <Text style={[styles.networkSwitchHint, { color: theme.colors.primaryLight }]}>
              Switch ›
            </Text>
          </TouchableOpacity>

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
                activeRoute === "exchange" && [
                  styles.menuItemActive,
                  { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
                ],
              ]}
              onPress={() => handleNav("exchange")}
            >
              <View
                style={[
                  styles.menuIconBox,
                  {
                    backgroundColor:
                      activeRoute === "exchange"
                        ? theme.colors.primary
                        : theme.colors.dark,
                  },
                ]}
              >
                <SwapIcon
                  color={
                    activeRoute === "exchange"
                      ? "#FFFFFF"
                      : theme.colors.lightGrey
                  }
                />
              </View>
              <View style={styles.menuTextCol}>
                <Text
                  style={[
                    styles.menuTitle,
                    {
                      color:
                        activeRoute === "exchange"
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

            {/* Markets & Trending */}
            <TouchableOpacity
              style={[
                styles.menuItem,
                activeRoute === "market" && [
                  styles.menuItemActive,
                  { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
                ],
              ]}
              onPress={() => handleNav("market")}
            >
              <View
                style={[
                  styles.menuIconBox,
                  {
                    backgroundColor:
                      activeRoute === "market"
                        ? theme.colors.primary
                        : theme.colors.dark,
                  },
                ]}
              >
                <MarketIcon
                  color={
                    activeRoute === "market"
                      ? "#FFFFFF"
                      : theme.colors.lightGrey
                  }
                />
              </View>
              <View style={styles.menuTextCol}>
                <Text
                  style={[
                    styles.menuTitle,
                    {
                      color:
                        activeRoute === "market"
                          ? theme.colors.primaryLight
                          : theme.colors.white,
                    },
                  ]}
                >
                  Markets
                </Text>
                <Text style={[styles.menuSubtitle, { color: theme.colors.grey }]}>
                  Top gainers & live tokens
                </Text>
              </View>
            </TouchableOpacity>

            {/* Live Gas Tracker */}
            <TouchableOpacity
              style={[
                styles.menuItem,
                activeRoute === "gas" && [
                  styles.menuItemActive,
                  { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.3)" },
                ],
              ]}
              onPress={() => handleNav("gas")}
            >
              <View
                style={[
                  styles.menuIconBox,
                  {
                    backgroundColor:
                      activeRoute === "gas"
                        ? theme.colors.primary
                        : theme.colors.dark,
                  },
                ]}
              >
                <GasIcon
                  color={
                    activeRoute === "gas"
                      ? "#FFFFFF"
                      : theme.colors.lightGrey
                  }
                />
              </View>
              <View style={styles.menuTextCol}>
                <Text
                  style={[
                    styles.menuTitle,
                    {
                      color:
                        activeRoute === "gas"
                          ? theme.colors.primaryLight
                          : theme.colors.white,
                    },
                  ]}
                >
                  Gas Tracker
                </Text>
                <Text style={[styles.menuSubtitle, { color: theme.colors.grey }]}>
                  Live Gwei & network speed
                </Text>
              </View>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleOpenSettings}
            >
              <View style={[styles.menuIconBox, { backgroundColor: theme.colors.dark }]}>
                <SettingsNavIcon color={theme.colors.lightGrey} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={[styles.menuTitle, { color: theme.colors.white }]}>
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
                      onClose();
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
                  <WalletNavIcon color="#FFFFFF" />
                  <Text style={styles.connectBtnText}>Connect Wallet</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <Text style={[styles.footerVersionText, { color: theme.colors.grey }]}>
              BitMarket DEX v1.0.0
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerContent: {
    height: "100%",
    borderRightWidth: 1,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
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
  networkSwitchHint: {
    fontSize: 12,
    fontWeight: "600",
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
