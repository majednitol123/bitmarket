import styled, { useTheme } from "styled-components/native";
import { AppDispatch, RootState } from "../../../store";
import { ThemeType } from "../../../styles/theme";
import { SafeAreaContainer } from "../../../components/Styles/Layout.styles";
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { authenticateBiometric, saveBiometricPreference, checkBiometricAvailability } from "../../../store/biometricsSlice";
import { Switch, Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { setThemeMode, ThemeMode } from "../../../store/settingsSlice";
import * as LocalAuthentication from "expo-local-authentication";
import FingerprintIcon from "../../../assets/svg/edit.svg";

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
  background-color: rgba(55, 114, 255, 0.12);
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

const BiometricOptionCard = styled.TouchableOpacity<{ theme: ThemeType }>`
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

const SunIcon = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="5" />
    <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </Svg>
);

const MoonIcon = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </Svg>
);

const SystemIcon = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2Z" stroke={color} strokeWidth={2} />
    <Path d="M12 2A10 10 0 0 1 12 22Z" fill={color} />
  </Svg>
);

const SettingsIndex = () => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { biometricPreference } = useSelector(
    (state: RootState) => state.biometrics
  );

  const [bioEnabled, setBioEnabled] = useState(biometricPreference);
  const themeMode = useSelector((state: RootState) => state.settings?.themeMode ?? "system");

  useEffect(() => {
    dispatch(checkBiometricAvailability());
  }, [dispatch]);

  useEffect(() => {
    setBioEnabled(biometricPreference);
  }, [biometricPreference]);

  const handleSelectTheme = (mode: ThemeMode) => {
    dispatch(setThemeMode(mode));
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
        <ScrollContainer showsVerticalScrollIndicator={false}>
          <ContentContainer style={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }}>
            {/* Security Group */}
            <SettingsGroup>
              <GroupTitle>Security</GroupTitle>
              <BiometricOptionCard
                activeOpacity={0.7}
                onPress={() => handleToggleBiometrics(!bioEnabled)}
              >
                <OptionRow>
                  <OptionLeft>
                    <IconCircle>
                      <FingerprintIcon width={20} height={20} fill={theme.colors.primary} />
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
              </BiometricOptionCard>
            </SettingsGroup>

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
