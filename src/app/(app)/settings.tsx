import styled, { useTheme } from "styled-components/native";
import { AppDispatch, RootState } from "../../store";
import { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { authenticateBiometric, saveBiometricPreference, checkBiometricAvailability } from "../../store/biometricsSlice";
import { Switch, Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradientBackground } from "../../components/Styles/Gradient";
import { setThemeMode, ThemeMode, setNotificationsEnabled } from "../../store/settingsSlice";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { notifyNotificationsToggled } from "../../services/notificationService";
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

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer edges={["bottom", "left", "right"]}>
        <Header title="Settings" rightAction="connect" />
        <ScrollContainer showsVerticalScrollIndicator={false}>
          <ContentContainer style={{ paddingTop: 8, paddingBottom: insets.bottom + 40 }}>
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
              </SettingOptionCard>
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
          </ContentContainer>
        </ScrollContainer>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
};

export default SettingsIndex;
