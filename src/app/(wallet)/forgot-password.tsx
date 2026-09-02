import { useState, useEffect, useCallback } from "react";
import { Alert, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useTheme } from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";
import { router } from "expo-router";
import { ThemeType } from "../../styles/theme";
import { AppDispatch, RootState } from "../../store";
import {
  resetWalletPassword,
  clearResetState,
} from "../../store/biometricsSlice";
import { LinearGradientBackground } from "../(app)/_layout";
import Button from "../../components/Button/Button";
import { ROUTES } from "../../constants/routes";
import { MotiView } from "moti";
import LockIcon from "../../assets/svg/lock.svg";
import KeyIcon from "../../assets/svg/key.svg";
import { ChevronLeftIcon } from "../../components/Icons/AppIcons";

export default function ForgotPasswordScreen() {
  const theme = useTheme() as ThemeType;
  const dispatch = useDispatch<AppDispatch>();
  const styles = createStyles(theme);

  const { unlocked, errorMessage, status, resetAttempts, resetLockedUntil } =
    useSelector((state: RootState) => state.biometrics);

  const [seedPhrase, setSeedPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"phrase" | "password">("phrase");
  const [lockdownSeconds, setLockdownSeconds] = useState(0);

  // Focus state for inputs
  const [isFocusedPhrase, setFocusedPhrase] = useState(false);
  const [isFocusedPw1, setFocusedPw1] = useState(false);
  const [isFocusedPw2, setFocusedPw2] = useState(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      dispatch(clearResetState());
    };
  }, [dispatch]);

  // Navigate to home after successful reset
  useEffect(() => {
    if (unlocked) {
      router.replace(ROUTES.home);
    }
  }, [unlocked]);

  // Lockout countdown timer
  useEffect(() => {
    if (!resetLockedUntil) {
      setLockdownSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resetLockedUntil - Date.now()) / 1000));
      setLockdownSeconds(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [resetLockedUntil]);

  // Password strength calculator
  const getStrength = (pass: string) => {
    if (pass.length === 0) return 0;
    if (pass.length < 6) return 1;
    if (pass.length < 10) return 2;
    return 3;
  };

  const strength = getStrength(newPassword);
  const strengthLabel = ["", "Weak", "Medium", "Strong"][strength];
  const strengthColors = ["transparent", "#ff5252", "#ffb74d", "#66bb6a"];

  const isLocked = lockdownSeconds > 0;
  const isLoading = status === "loading";

  const handleResetPassword = useCallback(() => {
    if (isLocked) return;

    // Step 1: Validate seed phrase input
    if (step === "phrase") {
      const trimmed = seedPhrase.trim();
      if (!trimmed) {
        Alert.alert("Error", "Please enter your recovery phrase.");
        return;
      }
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount !== 12 && wordCount !== 24) {
        Alert.alert("Invalid Phrase", `Recovery phrase must be 12 or 24 words. You entered ${wordCount} words.`);
        return;
      }
      // Move to password step
      setStep("password");
      return;
    }

    // Step 2: Validate new password
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in both password fields.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    // Dispatch reset
    dispatch(resetWalletPassword({ seedPhrase: seedPhrase.trim(), newPassword }));
  }, [seedPhrase, newPassword, confirmPassword, step, isLocked, dispatch]);

  const handleBackToPhrase = useCallback(() => {
    setStep("phrase");
    setNewPassword("");
    setConfirmPassword("");
    dispatch(clearResetState());
  }, [dispatch]);

  const formatLockdownTime = (seconds: number) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${seconds}s`;
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaView style={styles.container}>
        {/* Back Button */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(ROUTES.unlock);
              }
            }}
            hitSlop={12}
          >
            <ChevronLeftIcon size={20} color={theme.colors.white} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={60}
        >
          <View style={styles.card}>
            {/* Header */}
            <MotiView
              from={{ opacity: 0, translateY: -16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400 }}
              style={{ alignItems: "center" }}
            >
              <View style={styles.iconCircle}>
                <KeyIcon color={theme.colors.primary} width={32} height={32} />
              </View>
              <Text style={styles.title}>Reset Passcode</Text>
              <Text style={styles.subtitle}>
                {step === "phrase"
                  ? "Enter your 12 or 24-word recovery phrase to verify authorization."
                  : "Create a new passcode to protect BitMarket."}
              </Text>
            </MotiView>

            {/* Form */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400, delay: 150 }}
              style={{ width: "100%" }}
            >
              {/* Lockout warning */}
              {isLocked && (
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: "timing", duration: 300 }}
                  style={styles.lockoutContainer}
                >
                  <Text style={styles.lockoutIcon}>⏳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockoutTitle}>Too many attempts</Text>
                    <Text style={styles.lockoutText}>
                      Try again in {formatLockdownTime(lockdownSeconds)}
                    </Text>
                  </View>
                </MotiView>
              )}

              {/* Error message */}
              {errorMessage && !isLoading && !isLocked ? (
                <MotiView
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: "timing", duration: 300 }}
                  style={styles.errorContainer}
                >
                  <View style={styles.errorDot} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </MotiView>
              ) : null}

              {step === "phrase" ? (
                /* ─── Step 1: Seed Phrase Input ─── */
                <View>
                  <MotiView
                    animate={{
                      borderColor: isFocusedPhrase ? "rgba(139, 92, 246, 0.85)" : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={styles.phraseInputWrapper}
                  >
                    <TextInput
                      style={styles.phraseInput}
                      multiline
                      placeholder="Enter your recovery phrase (12 or 24 words separated by spaces)"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={seedPhrase}
                      onChangeText={setSeedPhrase}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocusedPhrase(true)}
                      onBlur={() => setFocusedPhrase(false)}
                      editable={!isLocked}
                    />
                  </MotiView>

                  {seedPhrase.trim().length > 0 && (
                    <Text style={styles.wordCount}>
                      {seedPhrase.trim().split(/\s+/).length} words entered
                    </Text>
                  )}

                  {/* Security notice */}
                  <View style={styles.warningContainer}>
                    <LockIcon color={theme.colors.primary} width={16} height={16} />
                    <Text style={styles.warningText}>
                      Your phrase is verified locally and never leaves this device.
                    </Text>
                  </View>

                  <View style={styles.buttonWrapper}>
                    <Button
                      title="Continue"
                      color={theme.colors.realWhite}
                      onPress={handleResetPassword}
                      disabled={isLocked}
                    />
                  </View>
                </View>
              ) : (
                /* ─── Step 2: New Password ─── */
                <View>
                  <MotiView
                    animate={{
                      borderColor: isFocusedPw1 ? "rgba(139, 92, 246, 0.85)" : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={styles.inputWrapper}
                  >
                    <KeyIcon
                      color={isFocusedPw1 ? theme.colors.primaryLight : theme.colors.lightGrey}
                      width={20}
                      height={20}
                      style={{ marginRight: 12 }}
                    />
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      placeholder="New password"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoFocus
                      onFocus={() => setFocusedPw1(true)}
                      onBlur={() => setFocusedPw1(false)}
                    />
                  </MotiView>

                  {newPassword.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                      <View style={styles.strengthContainer}>
                        {[1, 2, 3].map((level) => (
                          <View
                            key={level}
                            style={[
                              styles.strengthBar,
                              {
                                backgroundColor:
                                  strength >= level
                                    ? strengthColors[strength]
                                    : theme.colors.grey,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthText, { color: strengthColors[strength] }]}>
                        {strengthLabel}
                      </Text>
                    </View>
                  )}

                  <MotiView
                    animate={{
                      borderColor: isFocusedPw2 ? "rgba(139, 92, 246, 0.85)" : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={styles.inputWrapper}
                  >
                    <KeyIcon
                      color={isFocusedPw2 ? theme.colors.primaryLight : theme.colors.lightGrey}
                      width={20}
                      height={20}
                      style={{ marginRight: 12 }}
                    />
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      placeholder="Confirm new password"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedPw2(true)}
                      onBlur={() => setFocusedPw2(false)}
                      onSubmitEditing={handleResetPassword}
                      returnKeyType="done"
                    />
                  </MotiView>

                  <View style={styles.buttonWrapper}>
                    <Button
                      title="Reset Password"
                      backgroundColor={theme.colors.primary}
                      color={theme.colors.realWhite}
                      onPress={handleResetPassword}
                      loading={isLoading}
                      disabled={isLocked}
                    />
                  </View>

                  {/* Back to phrase step */}
                  <TouchableOpacity
                    style={styles.backLink}
                    onPress={handleBackToPhrase}
                  >
                    <Text style={styles.backLinkText}>← Edit recovery phrase</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Attempt counter (shown after failures) */}
              {resetAttempts > 0 && !isLocked && (
                <Text style={styles.attemptText}>
                  {resetAttempts} failed attempt{resetAttempts > 1 ? "s" : ""}
                </Text>
              )}
            </MotiView>
          </View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </LinearGradientBackground>
  );
}

function createStyles(theme: ThemeType) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: parseFloat(theme.spacing.large as string),
      paddingTop: 12,
    },
    headerRow: {
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.colors.cardBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 24,
      padding: 28,
      paddingHorizontal: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: "100%",
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(139, 92, 246, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(139, 92, 246, 0.25)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
      alignSelf: "center",
    },
    title: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: 24,
      color: theme.colors.white,
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      color: theme.colors.lightGrey,
      textAlign: "center",
      marginBottom: 28,
      lineHeight: 22,
    },
    phraseInputWrapper: {
      backgroundColor: theme.colors.dark,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: "rgba(139, 92, 246, 0.25)",
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
      minHeight: 120,
    },
    phraseInput: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      lineHeight: 24,
      textAlignVertical: "top",
    },
    wordCount: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.lightGrey,
      textAlign: "right",
      marginBottom: 12,
    },
    warningContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(139, 92, 246, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(139, 92, 246, 0.2)",
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 20,
      gap: 10,
    },
    warningText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.primaryLight,
      flex: 1,
      lineHeight: 18,
    },
    inputWrapper: {
      backgroundColor: theme.colors.dark,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      height: 54,
    },
    input: {
      flex: 1,
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      height: 54,
    },
    strengthContainer: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 4,
    },
    strengthBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    strengthText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      textAlign: "right",
    },
    buttonWrapper: {
      marginTop: 8,
    },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 82, 82, 0.15)",
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    errorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#ff5252",
      marginRight: 8,
    },
    errorText: {
      color: "#ff5252",
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      flex: 1,
    },
    lockoutContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 152, 0, 0.12)",
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
      gap: 12,
    },
    lockoutIcon: {
      fontSize: 24,
    },
    lockoutTitle: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      color: "#ffb74d",
      marginBottom: 2,
    },
    lockoutText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: "#ffb74d",
    },
    backLink: {
      alignItems: "center",
      marginTop: 16,
      padding: 8,
    },
    backLinkText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.lightGrey,
      textDecorationLine: "underline",
    },
    attemptText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.lightGrey,
      textAlign: "center",
      marginTop: 12,
    },
  });
}
