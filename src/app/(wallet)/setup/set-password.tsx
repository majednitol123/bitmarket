import { useState } from "react";
import { Alert, View, TextInput, Keyboard, StyleSheet } from "react-native";
import styled, { useTheme } from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDispatch } from "react-redux";
import { router } from "expo-router";
import { ThemeType } from "../../../styles/theme";
import { setWalletPassword } from "../../../store/biometricsSlice";
import { ROUTES } from "../../../constants/routes";
import { LinearGradientBackground } from "../../(app)/_layout";
import Button from "../../../components/Button/Button";
import { MotiView } from "moti";

/* ---------------- STYLES ---------------- */

const Container = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
  padding: ${(p) => p.theme.spacing.large};
`;

const Card = styled.View<{ theme: ThemeType }>`
  background-color: ${(p) => p.theme.colors.cardBackground};
  border-radius: 24px;
  padding: 32px 24px;
  border: 1px solid ${(p) => p.theme.colors.border};
  width: 100%;
`;

const IconCircle = styled.View<{ theme: ThemeType }>`
  width: 64px;
  height: 64px;
  border-radius: 32px;
  background-color: rgba(139, 92, 246, 0.12);
  border: 1px solid rgba(139, 92, 246, 0.25);
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  align-self: center;
`;

const LockIcon = styled.Text`
  font-size: 28px;
`;

const Title = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openBold};
  font-size: 24px;
  color: ${(p) => p.theme.colors.white};
  text-align: center;
  margin-bottom: 8px;
`;

const Subtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openRegular};
  font-size: ${(p) => p.theme.fonts.sizes.normal};
  color: ${(p) => p.theme.colors.lightGrey};
  text-align: center;
  margin-bottom: 28px;
`;

const InputWrapper = styled.View<{ theme: ThemeType }>`
  background-color: ${(p) => p.theme.colors.dark};
  border-radius: 14px;
  border: 1px solid ${(p) => p.theme.colors.border};
  padding: 0 16px;
  margin-bottom: 16px;
  flex-direction: row;
  align-items: center;
  height: 54px;
`;

const Input = styled.TextInput<{ theme: ThemeType }>`
  flex: 1;
  color: ${(p) => p.theme.colors.white};
  font-family: ${(p) => p.theme.fonts.families.openRegular};
  font-size: ${(p) => p.theme.fonts.sizes.normal};
  height: 54px;
`;

const InputIcon = styled.Text`
  font-size: 18px;
  margin-right: 10px;
`;

const StrengthContainer = styled.View`
  flex-direction: row;
  margin-bottom: 16px;
  gap: 6px;
`;

const StrengthBar = styled.View<{ active: boolean; theme: ThemeType }>`
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background-color: ${({ active, theme }) =>
    active ? theme.colors.primary : theme.colors.grey};
`;

const StrengthText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(p) => p.theme.fonts.families.openRegular};
  font-size: ${(p) => p.theme.fonts.sizes.small};
  color: ${(p) => p.theme.colors.lightGrey};
  margin-bottom: 16px;
  text-align: right;
`;

const ButtonWrapper = styled.View<{ theme: ThemeType }>`
  margin-top: 8px;
  width: 100%;
`;

/* ---------------- SCREEN ---------------- */

export default function SetPasswordScreen() {
  const theme = useTheme();
  const dispatch = useDispatch();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFocused1, setFocused1] = useState(false);
  const [isFocused2, setFocused2] = useState(false);

  const getStrength = (pass: string) => {
    if (pass.length === 0) return 0;
    if (pass.length < 6) return 1;
    if (pass.length < 10) return 2;
    return 3;
  };

  const strength = getStrength(password);
  const strengthLabel = ["", "Weak", "Medium", "Strong"][strength];

  const handleSetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match");
      return;
    }

    try {
      await dispatch(setWalletPassword(password));
      router.replace(ROUTES.biometrics);
    } catch (e: any) {
      Alert.alert("Error", e);
    }
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <Container>
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={60}
        >
          <Card>
            <MotiView
              from={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 12, delay: 200 }}
            >
              <IconCircle>
                <LockIcon>🔐</LockIcon>
              </IconCircle>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 400 }}
            >
              <Title>Protect BitMarket</Title>
              <Subtitle>
                Create a passcode to secure BitMarket and protect your trading sessions. You’ll use this passcode to unlock the app.
              </Subtitle>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 600 }}
            >
              <MotiView
                animate={{
                  borderColor: isFocused1 ? "rgba(139, 92, 246, 0.85)" : "rgba(139, 92, 246, 0.25)",
                  backgroundColor: theme.colors.dark,
                }}
                transition={{ type: "timing", duration: 200 }}
                style={localStyles.inputWrapper}
              >
                <InputIcon>🔑</InputIcon>
                <TextInput
                  style={[localStyles.input, { color: theme.colors.white }]}
                  secureTextEntry
                  placeholder="Enter passcode"
                  placeholderTextColor={theme.colors.lightGrey}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocused1(true)}
                  onBlur={() => setFocused1(false)}
                />
              </MotiView>

              {password.length > 0 && (
                <MotiView
                  from={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginBottom: 16 }}
                >
                  <StrengthContainer>
                    <StrengthBar active={strength >= 1} theme={theme} />
                    <StrengthBar active={strength >= 2} theme={theme} />
                    <StrengthBar active={strength >= 3} theme={theme} />
                  </StrengthContainer>
                  <StrengthText>{strengthLabel}</StrengthText>
                </MotiView>
              )}

              <MotiView
                animate={{
                  borderColor: isFocused2 ? "rgba(139, 92, 246, 0.85)" : "rgba(139, 92, 246, 0.25)",
                  backgroundColor: theme.colors.dark,
                }}
                transition={{ type: "timing", duration: 200 }}
                style={localStyles.inputWrapper}
              >
                <InputIcon>🔑</InputIcon>
                <TextInput
                  style={[localStyles.input, { color: theme.colors.white }]}
                  secureTextEntry
                  placeholder="Confirm passcode"
                  placeholderTextColor={theme.colors.lightGrey}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocused2(true)}
                  onBlur={() => setFocused2(false)}
                />
              </MotiView>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 800 }}
            >
              <ButtonWrapper>
                <Button
                  title="Set Passcode"
                  backgroundColor={theme.colors.primary}
                  color={theme.colors.realWhite}
                  onPress={handleSetPassword}
                />
              </ButtonWrapper>
            </MotiView>
          </Card>
        </KeyboardAwareScrollView>
      </Container>
    </LinearGradientBackground>
  );
}

const localStyles = StyleSheet.create({
  inputWrapper: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    height: 54,
  },
  input: {
    flex: 1,
    fontFamily: "OpenSans-Regular",
    fontSize: 16,
    height: 54,
  }
});
