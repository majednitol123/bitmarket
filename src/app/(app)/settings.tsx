import styled, { useTheme } from "styled-components/native";
import { AppDispatch, RootState } from "../../store";
import { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { authenticateBiometric, saveBiometricPreference, checkBiometricAvailability } from "../../store/biometricsSlice";
import { Switch, Alert, View, TextInput, TouchableOpacity, Text, StyleSheet, Clipboard, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradientBackground } from "../../components/Styles/Gradient";
import { setThemeMode, ThemeMode, setNotificationsEnabled, setDebugOverrideAddress, setDataUpdateInterval } from "../../store/settingsSlice";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { notifyNotificationsToggled, getOrCreateDeviceIdAsync } from "../../services/notificationService";
import { notificationApi } from "../../api/notificationApi";
import { alertApi, PriceAlert } from "../../api/alertApi";
import { marketApi } from "../../api/marketApi";
import { realtimeService } from "../../services/realtimeService";
import { useAccount } from "@reown/appkit-react-native";
import { useFocusEffect } from "expo-router";
import {
  BellIcon,
  ShieldCheckIcon,
  MoonIcon,
  SunIcon,
  SystemIcon,
  GlobeIcon,
  DollarIcon,
  HelpCircleIcon,
  InfoIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  RefreshCwIcon,
} from "../../components/Icons/AppIcons";
import Header from "../../components/Header/Header";

const ScrollContainer = styled.ScrollView`
  flex: 1;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  padding: ${(props) => props.theme.spacing.medium};
`;

const SettingsGroup = styled.View<{ theme: ThemeType }>`
  margin-bottom: 24px;
`;

const GroupTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
  margin-left: 4px;
`;

const IconCircle = styled.View<{ theme: ThemeType }>`
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: rgba(124, 58, 237, 0.15);
  margin-right: 14px;
`;

const OptionText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openBold};
  font-size: ${(p) => p.theme.fonts.sizes.normal};
  color: ${(p) => p.theme.colors.white};
  padding-right: 4px;
`;

const OptionSubtext = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openRegular};
  font-size: ${(p) => p.theme.fonts.sizes.small};
  color: ${(p) => p.theme.colors.lightGrey};
  margin-top: 2px;
`;

const InstructionText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  margin-top: 8px;
  margin-left: 4px;
  line-height: 18px;
`;

const SettingOptionCard = styled.TouchableOpacity<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  padding: 16px;
  border-radius: 14px;
  margin-bottom: 8px;
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const OptionRow = styled.View`
  flex-direction: row;
  align-items: center;
  width: 100%;
`;

const OptionLeft = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
`;

const CardDivider = styled.View<{ theme: ThemeType }>`
  height: 1px;
  background-color: ${(props) => props.theme.colors.border};
  margin-top: 12px;
  margin-bottom: 12px;
`;

const ThemeSelectorContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 14px;
  padding: 4px;
  margin-bottom: 8px;
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const ThemeOptionButton = styled.TouchableOpacity<{ theme: ThemeType; active: boolean }>`
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  border-radius: 10px;
  background-color: ${({ theme, active }) =>
    active ? theme.colors.primary : "transparent"};
`;

const ThemeOptionText = styled.Text<{ theme: ThemeType; active: boolean }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme, active }) =>
    active ? theme.colors.darkText : theme.colors.white};
  margin-left: 8px;
`;

// Well-known whale wallets for quick testing
const TEST_WALLETS = [
  {
    label: "Vitalik.eth",
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    desc: "ETH + many ERC20s",
  },
  {
    label: "Justin Sun",
    address: "0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296",
    desc: "Large ETH + DeFi tokens",
  },
  {
    label: "Binance 7",
    address: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
    desc: "Massive ETH + SHIB etc.",
  },
];

const REFRESH_INTERVALS = [
  { value: 5, label: "5s", badge: "Turbo", desc: "⚡ Ultra-fast 5s updates. Real-time ticker responsiveness." },
  { value: 10, label: "10s", badge: "Fast", desc: "🚀 Fast 10s updates. Great for active market monitoring." },
  { value: 15, label: "15s", badge: "Optimal", desc: "⭐ 15s updates. Best balance of live freshness & battery (Recommended)." },
  { value: 30, label: "30s", badge: "Relaxed", desc: "🔋 Relaxed 30s updates. Smooth & battery-efficient." },
  { value: 60, label: "60s", badge: "Saver", desc: "🌱 Low network mode. Updates once per minute." },
];

const SettingsIndex = () => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { biometricPreference } = useSelector(
    (state: RootState) => state.biometrics
  );

  const [bioEnabled, setBioEnabled] = useState(biometricPreference);
  const themeMode = useSelector((state: RootState) => state.settings?.themeMode ?? "system");
  const notificationsEnabled = useSelector(
    (state: RootState) => state.settings?.notificationsEnabled ?? true
  );
  const debugOverrideAddress = useSelector(
    (state: RootState) => state.settings?.debugOverrideAddress ?? ""
  );
  const dataUpdateInterval = useSelector(
    (state: RootState) => state.settings?.dataUpdateInterval ?? 15
  );

  const [localTestAddress, setLocalTestAddress] = useState(debugOverrideAddress);

  useFocusEffect(
    useCallback(() => {
      // Proactively unsubscribe from market topics whenever Settings screen is focused
      realtimeService.unsubscribe(['market:tokens', 'market:overview']);
    }, [])
  );

  useEffect(() => {
    setLocalTestAddress(debugOverrideAddress);
  }, [debugOverrideAddress]);

  useEffect(() => {
    dispatch(checkBiometricAvailability());
  }, [dispatch]);

  useEffect(() => {
    setBioEnabled(biometricPreference);
  }, [biometricPreference]);

  const handleSelectTheme = (mode: ThemeMode) => {
    dispatch(setThemeMode(mode));
  };

  const handleToggleNotifications = async (val: boolean) => {
    if (val) {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              allowProvisional: true,
            },
          });
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          Alert.alert(
            "Notifications Disabled",
            "Notification permissions are not enabled for BitMarket in your device settings. Please enable notifications in system settings to receive activity alerts."
          );
          return;
        }

        dispatch(setNotificationsEnabled(true));
        notifyNotificationsToggled(true);
      } catch (err) {
        dispatch(setNotificationsEnabled(true));
      }
    } else {
      dispatch(setNotificationsEnabled(false));
    }
  };

  const { address } = useAccount();
  const [registeredDeviceId, setRegisteredDeviceId] = useState<string>("");
  const [isTestingPush, setIsTestingPush] = useState<boolean>(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateDeviceIdAsync().then(setRegisteredDeviceId);
  }, []);

  // ─── Price Alerts State & Handlers ───
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(false);
  const [actionAlertId, setActionAlertId] = useState<number | null>(null);

  const activeWallet = address || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const list = await alertApi.getAlerts(activeWallet);
      setAlerts(list);
    } catch (err) {
      console.warn("[Settings] Error loading alerts:", err);
    } finally {
      setLoadingAlerts(false);
    }
  }, [activeWallet]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRearmAlert = async (id: number) => {
    setActionAlertId(id);
    try {
      await alertApi.rearmAlert(id, activeWallet);
      await fetchAlerts();
      Alert.alert("Alert Armed", "Price alert re-armed and actively monitoring.");
    } catch (err: any) {
      Alert.alert("Error", "Could not re-arm alert");
    } finally {
      setActionAlertId(null);
    }
  };

  const handleDeleteAlert = async (id: number) => {
    setActionAlertId(id);
    try {
      await alertApi.deleteAlert(id, activeWallet);
      await fetchAlerts();
    } catch (err: any) {
      Alert.alert("Error", "Could not delete alert");
    } finally {
      setActionAlertId(null);
    }
  };

  const handleSendTestPush = async () => {
    setIsTestingPush(true);
    setTestPushStatus(null);
    try {
      const targetAddress = address || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      const res = await notificationApi.sendTestNotification({
        walletAddress: targetAddress,
        title: "🔔 BitMarket Push Alert",
        body: "Test notification dispatched through backend worker delivery engine!",
      });
      setTestPushStatus(`Queued (${res.deliveriesEnqueued} delivery)`);
      setTimeout(() => setTestPushStatus(null), 4000);
    } catch (err: any) {
      setTestPushStatus("Failed to queue");
      setTimeout(() => setTestPushStatus(null), 4000);
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleToggleBiometrics = async (val: boolean) => {
    if (val) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert(
          "Biometrics Not Supported",
          "Your device does not support biometric authentication (Face ID or Touch ID/Fingerprint)."
        );
        setBioEnabled(false);
        return;
      }

      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
      const isBiometricEnrolled =
        enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG ||
        enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;

      if (!isBiometricEnrolled) {
        Alert.alert(
          "Biometrics Not Set Up",
          "No enrolled face or fingerprint templates found.\n\nPlease configure Face ID or Touch ID/Fingerprint passcode in your device settings to enable this feature."
        );
        setBioEnabled(false);
        return;
      }

      // Require biometric auth before enabling
      try {
        await dispatch(authenticateBiometric()).unwrap();
        await dispatch(saveBiometricPreference(true));
        setBioEnabled(true);
      } catch (err: any) {
        setBioEnabled(false);
        if (err !== "Authentication cancelled.") {
          Alert.alert(
            "Biometric Authentication Failed",
            err || "Failed to authenticate biometrics. Please try again."
          );
        }
      }
    } else {
      await dispatch(saveBiometricPreference(false));
      setBioEnabled(false);
    }
  };

  const handleApplyTestAddress = () => {
    const trimmed = localTestAddress.trim();
    dispatch(setDebugOverrideAddress(trimmed));
    if (trimmed) {
      Alert.alert(
        "Test Address Applied",
        `Portfolio will now load data for:\n${trimmed.slice(0, 10)}...${trimmed.slice(-8)}\n\nGo to the Portfolio tab to see results.`
      );
    } else {
      Alert.alert("Override Cleared", "Portfolio will use your connected wallet address.");
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.trim().length > 0) {
        setLocalTestAddress(text.trim());
      }
    } catch {
      // Clipboard not available
    }
  };

  const handleClearTestAddress = () => {
    setLocalTestAddress("");
    dispatch(setDebugOverrideAddress(""));
  };

  const debugStyles = StyleSheet.create({
    card: {
      backgroundColor: theme.colors.cardBackground,
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    devBadge: {
      backgroundColor: "rgba(245, 158, 11, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(245, 158, 11, 0.3)",
    },
    devBadgeText: {
      color: "#F59E0B",
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: theme.colors.dark,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.white,
      fontSize: 12,
      fontFamily: "monospace",
    },
    pasteBtn: {
      backgroundColor: "rgba(168, 85, 247, 0.15)",
      borderWidth: 1,
      borderColor: "rgba(168, 85, 247, 0.3)",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    pasteBtnText: {
      color: "#A855F7",
      fontSize: 11,
      fontWeight: "700",
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
    },
    applyBtn: {
      flex: 1,
      backgroundColor: "#7C3AED",
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    applyBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    clearBtn: {
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.25)",
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    clearBtnText: {
      color: "#EF4444",
      fontSize: 13,
      fontWeight: "700",
    },
    whaleSection: {
      gap: 6,
    },
    whaleSectionTitle: {
      color: theme.colors.lightGrey,
      fontSize: 10,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    whaleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.dark,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    whaleBtnActive: {
      borderColor: "rgba(124, 58, 237, 0.5)",
      backgroundColor: "rgba(124, 58, 237, 0.08)",
    },
    whaleLabel: {
      color: theme.colors.white,
      fontSize: 13,
      fontWeight: "700",
    },
    whaleAddr: {
      color: theme.colors.lightGrey,
      fontSize: 10,
      fontFamily: "monospace",
      marginTop: 1,
    },
    whaleDesc: {
      color: theme.colors.grey,
      fontSize: 10,
    },
    whaleRight: {
      alignItems: "flex-end",
    },
    activeIndicator: {
      color: "#10B981",
      fontSize: 10,
      fontWeight: "700",
    },
    activeTag: {
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      marginTop: 3,
    },
    activeTagText: {
      color: "#10B981",
      fontSize: 9,
      fontWeight: "700",
    },
    helpText: {
      color: theme.colors.grey,
      fontSize: 10,
      lineHeight: 15,
    },
    refreshSegmentContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.dark,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
      marginTop: 4,
    },
    refreshSegmentBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      position: "relative",
    },
    refreshSegmentBtnActive: {
      backgroundColor: theme.colors.primary,
    },
    refreshSegmentText: {
      color: theme.colors.lightGrey,
      fontSize: 13,
      fontWeight: "600",
    },
    refreshSegmentTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    recommendedDot: {
      position: "absolute",
      top: 3,
      right: 5,
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: "#10B981",
    },
    refreshInfoBox: {
      marginTop: 10,
      backgroundColor: "rgba(124, 58, 237, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(124, 58, 237, 0.2)",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    refreshInfoText: {
      color: theme.colors.lightGrey,
      fontSize: 11,
      lineHeight: 16,
    },
  });

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer edges={["bottom", "left", "right"]}>
        <Header title="Settings" rightAction="connect" />
        <ScrollContainer showsVerticalScrollIndicator={false}>
          <ContentContainer style={{ paddingTop: 8, paddingBottom: insets.bottom + 120 }}>
            {/* Notifications Group */}
            <SettingsGroup>
              <GroupTitle>Notifications</GroupTitle>
              <SettingOptionCard
                activeOpacity={0.7}
                onPress={() => handleToggleNotifications(!notificationsEnabled)}
              >
                <OptionRow>
                  <OptionLeft>
                    <IconCircle>
                      <BellIcon color={theme.colors.primary} />
                    </IconCircle>
                    <View style={{ flex: 1 }}>
                      <OptionText>Activity Notifications</OptionText>
                      <OptionSubtext>
                        {notificationsEnabled
                          ? "Trade events & swap activity alerts enabled"
                          : "Activity notifications are turned off"}
                      </OptionSubtext>
                    </View>
                  </OptionLeft>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleToggleNotifications}
                    thumbColor={notificationsEnabled ? theme.colors.primary : theme.colors.lightGrey}
                    trackColor={{ false: theme.colors.grey, true: theme.colors.primaryLight }}
                  />
                </OptionRow>

                {notificationsEnabled && (
                  <>
                    <CardDivider />
                    <View style={{ marginTop: 2, gap: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                          <Text style={{ color: theme.colors.white, fontSize: 12, fontWeight: "600" }}>
                            Push Delivery Engine
                          </Text>
                        </View>
                        <View style={{
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                        }}>
                          <Text style={{ color: "#10B981", fontSize: 10, fontWeight: "700" }}>
                            Active
                          </Text>
                        </View>
                      </View>

                      {registeredDeviceId ? (
                        <Text style={{ color: theme.colors.lightGrey, fontSize: 11, fontFamily: "monospace" }}>
                          Device ID: {registeredDeviceId.slice(0, 8)}...{registeredDeviceId.slice(-4)}
                        </Text>
                      ) : null}

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleSendTestPush}
                        disabled={isTestingPush}
                        style={{
                          backgroundColor: "rgba(124, 58, 237, 0.15)",
                          borderWidth: 1,
                          borderColor: "rgba(124, 58, 237, 0.35)",
                          borderRadius: 10,
                          paddingVertical: 9,
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "700" }}>
                          {isTestingPush
                            ? "Routing via Worker..."
                            : testPushStatus
                            ? testPushStatus
                            : "⚡ Send Test Push Alert"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </SettingOptionCard>
            </SettingsGroup>

            {/* Price Alerts Group */}
            <SettingsGroup>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  marginHorizontal: 4,
                }}
              >
                <GroupTitle style={{ marginBottom: 0, marginLeft: 0 }}>
                  Price Alerts ({alerts.length})
                </GroupTitle>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={fetchAlerts}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: "rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.lightGrey,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    {loadingAlerts ? "Refreshing..." : "Refresh"}
                  </Text>
                </TouchableOpacity>
              </View>

              {alerts.length === 0 ? (
                <SettingOptionCard activeOpacity={1}>
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 12,
                    }}
                  >
                    <BellIcon size={24} color="#64748B" />
                    <Text
                      style={{
                        color: theme.colors.white,
                        fontSize: 14,
                        fontWeight: "700",
                        marginTop: 8,
                      }}
                    >
                      No Active Price Alerts
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.lightGrey,
                        fontSize: 12,
                        textAlign: "center",
                        marginTop: 4,
                        paddingHorizontal: 16,
                        lineHeight: 17,
                      }}
                    >
                      Open any token in the Markets tab and tap "Set Alert" to monitor price rises and drops.
                    </Text>
                  </View>
                </SettingOptionCard>
              ) : (
                alerts.map((alert) => {
                  const isArmed = alert.enabled && !alert.triggeredAt;
                  const isCooldown = alert.enabled && alert.triggeredAt !== null;
                  const isTriggeredOnce = !alert.enabled && alert.triggeredAt !== null;

                  return (
                    <SettingOptionCard
                      key={alert.id}
                      activeOpacity={1}
                      style={{ marginBottom: 8 }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            flex: 1,
                          }}
                        >
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              backgroundColor:
                                alert.condition === "above"
                                  ? "rgba(16, 185, 129, 0.12)"
                                  : "rgba(244, 63, 94, 0.12)",
                              borderWidth: 1,
                              borderColor:
                                alert.condition === "above"
                                  ? "rgba(16, 185, 129, 0.25)"
                                  : "rgba(244, 63, 94, 0.25)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {alert.condition === "above" ? (
                              <ArrowUpIcon size={16} color="#10B981" />
                            ) : (
                              <ArrowDownIcon size={16} color="#F43F5E" />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: theme.colors.white,
                                  fontSize: 15,
                                  fontWeight: "700",
                                }}
                              >
                                {alert.tokenSymbol}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "700",
                                  color:
                                    alert.condition === "above"
                                      ? "#10B981"
                                      : "#F43F5E",
                                }}
                              >
                                {alert.condition === "above" ? "≥" : "≤"} $
                                {alert.targetPrice >= 1
                                  ? alert.targetPrice.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })
                                  : alert.targetPrice.toFixed(6)}
                              </Text>
                            </View>
                            <Text
                              style={{
                                color: theme.colors.lightGrey,
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              {alert.cooldownMinutes > 0
                                ? `${alert.cooldownMinutes / 60}h cooldown`
                                : "One-shot"}{" "}
                              • Triggered {alert.triggerCount}x
                            </Text>
                          </View>
                        </View>

                        {/* Status & Action Buttons */}
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {isTriggeredOnce && (
                            <TouchableOpacity
                              style={{
                                backgroundColor: "rgba(56, 189, 248, 0.15)",
                                borderWidth: 1,
                                borderColor: "rgba(56, 189, 248, 0.3)",
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 8,
                              }}
                              activeOpacity={0.7}
                              onPress={() => handleRearmAlert(alert.id)}
                              disabled={actionAlertId === alert.id}
                            >
                              {actionAlertId === alert.id ? (
                                <ActivityIndicator size="small" color="#38BDF8" />
                              ) : (
                                <Text
                                  style={{
                                    color: "#38BDF8",
                                    fontSize: 11,
                                    fontWeight: "700",
                                  }}
                                >
                                  Re-arm
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}

                          {isCooldown && (
                            <View
                              style={{
                                backgroundColor: "rgba(245, 158, 11, 0.15)",
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: "#F59E0B",
                                  fontSize: 10,
                                  fontWeight: "700",
                                }}
                              >
                                Cooldown
                              </Text>
                            </View>
                          )}

                          {isArmed && (
                            <View
                              style={{
                                backgroundColor: "rgba(16, 185, 129, 0.15)",
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                              }}
                            >
                              <Text
                                style={{
                                  color: "#10B981",
                                  fontSize: 10,
                                  fontWeight: "700",
                                }}
                              >
                                Active
                              </Text>
                            </View>
                          )}

                          <TouchableOpacity
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            activeOpacity={0.7}
                            onPress={() => handleDeleteAlert(alert.id)}
                            disabled={actionAlertId === alert.id}
                          >
                            <TrashIcon size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </SettingOptionCard>
                  );
                })
              )}
            </SettingsGroup>

            {/* Security Group */}
            <SettingsGroup>
              <GroupTitle>Security</GroupTitle>
              <SettingOptionCard
                activeOpacity={0.7}
                onPress={() => handleToggleBiometrics(!bioEnabled)}
              >
                <OptionRow>
                  <OptionLeft>
                    <IconCircle>
                      <ShieldCheckIcon size={20} color={theme.colors.primary} strokeWidth={2.2} />
                    </IconCircle>
                    <View style={{ flex: 1 }}>
                      <OptionText>Enable FaceID / TouchID </OptionText>
                      <OptionSubtext>
                        {bioEnabled ? "Biometric authentication is on" : "Use biometrics to unlock"}
                      </OptionSubtext>
                    </View>
                  </OptionLeft>
                  <Switch
                    value={bioEnabled}
                    onValueChange={handleToggleBiometrics}
                    thumbColor={bioEnabled ? theme.colors.primary : theme.colors.lightGrey}
                    trackColor={{ false: theme.colors.grey, true: theme.colors.primaryLight }}
                  />
                </OptionRow>
                {!bioEnabled && (
                  <>
                    <CardDivider />
                    <InstructionText style={{ marginTop: 0, marginLeft: 0 }}>
                      Note: To use biometrics, please first enable Face ID, Touch ID, or fingerprint passcode in your device settings.
                    </InstructionText>
                  </>
                )}
              </SettingOptionCard>
            </SettingsGroup>

            {/* Appearance Group */}
            <SettingsGroup>
              <GroupTitle>Appearance</GroupTitle>
              <ThemeSelectorContainer>
                <ThemeOptionButton
                  active={themeMode === "light"}
                  onPress={() => handleSelectTheme("light")}
                >
                  <SunIcon color={themeMode === "light" ? theme.colors.darkText : theme.colors.white} />
                  <ThemeOptionText active={themeMode === "light"}>Light</ThemeOptionText>
                </ThemeOptionButton>

                <ThemeOptionButton
                  active={themeMode === "dark"}
                  onPress={() => handleSelectTheme("dark")}
                >
                  <MoonIcon color={themeMode === "dark" ? theme.colors.darkText : theme.colors.white} />
                  <ThemeOptionText active={themeMode === "dark"}>Dark</ThemeOptionText>
                </ThemeOptionButton>

                <ThemeOptionButton
                  active={themeMode === "system"}
                  onPress={() => handleSelectTheme("system")}
                >
                  <SystemIcon color={themeMode === "system" ? theme.colors.darkText : theme.colors.white} />
                  <ThemeOptionText active={themeMode === "system"}>System</ThemeOptionText>
                </ThemeOptionButton>
              </ThemeSelectorContainer>
            </SettingsGroup>

            {/* Data Refresh Rate Group */}
            <SettingsGroup>
              <GroupTitle>Data Refresh Rate</GroupTitle>
              <SettingOptionCard activeOpacity={1}>
                <OptionRow>
                  <OptionLeft>
                    <IconCircle>
                      <RefreshCwIcon size={18} color={theme.colors.primary} />
                    </IconCircle>
                    <View style={{ flex: 1 }}>
                      <OptionText>Live Data Update Interval</OptionText>
                      <OptionSubtext>
                        Frequency for refreshing live market prices & portfolio balances
                      </OptionSubtext>
                    </View>
                  </OptionLeft>
                </OptionRow>

                <CardDivider />

                {/* Segmented Button Row */}
                <View style={debugStyles.refreshSegmentContainer}>
                  {REFRESH_INTERVALS.map((item) => {
                    const isActive = dataUpdateInterval === item.value;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          debugStyles.refreshSegmentBtn,
                          isActive && debugStyles.refreshSegmentBtnActive,
                        ]}
                        onPress={() => {
                          dispatch(setDataUpdateInterval(item.value));
                          realtimeService.setUpdateInterval(item.value);
                          marketApi.setUpdateInterval(item.value).catch(() => {});
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            debugStyles.refreshSegmentText,
                            isActive && debugStyles.refreshSegmentTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.value === 15 && (
                          <View style={debugStyles.recommendedDot} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Explanatory description card */}
                <View style={debugStyles.refreshInfoBox}>
                  <Text style={debugStyles.refreshInfoText}>
                    {REFRESH_INTERVALS.find((i) => i.value === dataUpdateInterval)?.desc ||
                      `Refreshes live data every ${dataUpdateInterval}s.`}
                  </Text>
                </View>
              </SettingOptionCard>
            </SettingsGroup>

            {/* ═══ Developer / Testing: Portfolio Address Override ═══ */}
            <SettingsGroup>
              <GroupTitle>Developer Tools</GroupTitle>
              <View style={debugStyles.card}>
                <View style={debugStyles.headerRow}>
                  <IconCircle>
                    <GlobeIcon size={18} color={theme.colors.primary} strokeWidth={2} />
                  </IconCircle>
                  <View style={{ flex: 1 }}>
                    <OptionText>Test Portfolio Address</OptionText>
                    <OptionSubtext>Override wallet for portfolio testing</OptionSubtext>
                  </View>
                  <View style={debugStyles.devBadge}>
                    <Text style={debugStyles.devBadgeText}>DEV</Text>
                  </View>
                </View>

                {/* Input + Paste row */}
                <View style={debugStyles.inputRow}>
                  <TextInput
                    style={debugStyles.input}
                    placeholder="Paste EVM public key (0x...)"
                    placeholderTextColor={theme.colors.grey}
                    value={localTestAddress}
                    onChangeText={setLocalTestAddress}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={debugStyles.pasteBtn}
                    onPress={handlePasteFromClipboard}
                    activeOpacity={0.7}
                  >
                    <Text style={debugStyles.pasteBtnText}>Paste</Text>
                  </TouchableOpacity>
                </View>

                {/* Apply / Clear buttons */}
                <View style={debugStyles.actionRow}>
                  <TouchableOpacity
                    style={debugStyles.applyBtn}
                    onPress={handleApplyTestAddress}
                    activeOpacity={0.85}
                  >
                    <Text style={debugStyles.applyBtnText}>
                      {localTestAddress.trim() ? "Apply Override" : "Use Default Wallet"}
                    </Text>
                  </TouchableOpacity>
                  {debugOverrideAddress.length > 0 && (
                    <TouchableOpacity
                      style={debugStyles.clearBtn}
                      onPress={handleClearTestAddress}
                      activeOpacity={0.7}
                    >
                      <Text style={debugStyles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Active override indicator */}
                {debugOverrideAddress.length > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" }} />
                    <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "600" }}>
                      Override active: {debugOverrideAddress.slice(0, 8)}...{debugOverrideAddress.slice(-6)}
                    </Text>
                  </View>
                )}

                {/* Quick-fill whale wallets */}
                <View style={debugStyles.whaleSection}>
                  <Text style={debugStyles.whaleSectionTitle}>Quick-fill Whale Wallets</Text>
                  {TEST_WALLETS.map((wallet) => {
                    const isActive = debugOverrideAddress.toLowerCase() === wallet.address.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={wallet.address}
                        style={[debugStyles.whaleBtn, isActive && debugStyles.whaleBtnActive]}
                        onPress={() => {
                          setLocalTestAddress(wallet.address);
                          dispatch(setDebugOverrideAddress(wallet.address));
                        }}
                        activeOpacity={0.7}
                      >
                        <View>
                          <Text style={debugStyles.whaleLabel}>{wallet.label}</Text>
                          <Text style={debugStyles.whaleAddr}>
                            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                          </Text>
                        </View>
                        <View style={debugStyles.whaleRight}>
                          <Text style={debugStyles.whaleDesc}>{wallet.desc}</Text>
                          {isActive && (
                            <View style={debugStyles.activeTag}>
                              <Text style={debugStyles.activeTagText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={debugStyles.helpText}>
                  This overrides the wallet address used by the Portfolio tab. Clear the field and apply to revert to your connected wallet.
                </Text>
              </View>
            </SettingsGroup>
          </ContentContainer>
        </ScrollContainer>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
};

export default SettingsIndex;
