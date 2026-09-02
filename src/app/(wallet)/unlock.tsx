import { useState, useEffect, useCallback } from "react";
import { Alert, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, InteractionManager } from "react-native";
import { useTheme } from "styled-components/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDispatch, useSelector } from "react-redux";
import { router } from "expo-router";
import { ThemeType } from "../../styles/theme";
import { AppDispatch, RootState } from "../../store";
import {
  authenticateBiometric,
  verifyWalletPassword,
  clearAuthError,
} from "../../store/biometricsSlice";
import { LinearGradient } from "expo-linear-gradient";
import { LinearGradientBackground } from "../(app)/_layout";
import Button from "../../components/Button/Button";
import { ROUTES } from "../../constants/routes";
import { MotiView, AnimatePresence } from "moti";
import LockIcon from "../../assets/svg/lock.svg";
import KeyIcon from "../../assets/svg/key.svg";
import FingerprintIcon from "../../assets/svg/fingerprint.svg";

export default function UnlockScreen() {
  const theme = useTheme() as ThemeType;
  const dispatch = useDispatch<AppDispatch>();
  const styles = createStyles(theme);

  const { biometricPreference, biometricAvailable, unlocked, errorMessage, status } =
    useSelector((state: RootState) => state.biometrics);

  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  // Auto-trigger biometric prompt if user opted in AND device supports it
  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout | null = null;

    const runAuth = () => {
      // Wait for any active navigation transitions to finish first
      const task = InteractionManager.runAfterInteractions(() => {
        if (!active) return;
        // On Android, adding a tiny extra delay after animations complete 
        // ensures the window focus has settled, preventing native thread locking.
        timer = setTimeout(() => {
          if (active && biometricPreference && biometricAvailable && !unlocked) {
            dispatch(authenticateBiometric());
          } else if (active && (!biometricPreference || !biometricAvailable)) {
            setShowPasswordInput(true);
          }
        }, 150);
      });

      return () => {
        task.cancel();
      };
    };

    const cleanup = runAuth();

    return () => {
      active = false;
      cleanup();
      if (timer) clearTimeout(timer);
    };
  }, [biometricPreference, biometricAvailable, unlocked, dispatch]);

  // Navigate to home ONLY after confirmed unlock
  useEffect(() => {
    if (unlocked) {
      router.replace(ROUTES.home);
    }
  }, [unlocked]);

  const handlePasswordUnlock = useCallback(() => {
    if (!password.trim()) {
      Alert.alert("Error", "Please enter your passcode");
      return;
    }
    dispatch(clearAuthError());
    dispatch(verifyWalletPassword(password));
  }, [password, dispatch]);

  const handleBiometricRetry = useCallback(() => {
    dispatch(clearAuthError());
    dispatch(authenticateBiometric());
  }, [dispatch]);

  const handleShowPassword = useCallback(() => {
    dispatch(clearAuthError());
    setShowPasswordInput(true);
  }, [dispatch]);

  const [isFocused, setIsFocused] = useState(false);

  const isBioLoading = status === "loading";
  const showBiometricUI = biometricPreference && biometricAvailable;

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaView style={styles.container}>
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={60}
        >
          <View style={styles.card}>
            {/* Group 1 — Header block */}
            <MotiView
              from={{ opacity: 0, translateY: -16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400 }}
              style={{ alignItems: "center" }}
            >
              <View style={styles.iconCircle}>
                <LockIcon color={theme.colors.primary} width={32} height={32} />
              </View>
              <Text style={styles.title}>Unlock BitMarket</Text>
              <Text style={styles.subtitle}>
                {showBiometricUI && !showPasswordInput
                  ? "Use biometrics to access BitMarket quickly. "
                  : "Enter your passcode to access BitMarket. "}
              </Text>
            </MotiView>

            {/* Group 2 — Form/Buttons block */}
            <MotiView
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400, delay: 150 }}
              style={{ width: "100%" }}
            >
              {/* Biometric loading state */}
              {isBioLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={theme.colors.primary} size="large" />
                  <Text style={styles.loadingText}>Waiting for biometric...</Text>
                </View>
              )}

              {/* Error message */}
              {errorMessage && !isBioLoading ? (
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

              {/* Password input */}
              {showPasswordInput && (
                <View>
                  <MotiView
                    animate={{
                      borderColor: isFocused ? "rgba(139, 92, 246, 0.85)" : "rgba(139, 92, 246, 0.25)",
                      backgroundColor: theme.colors.dark,
                    }}
                    transition={{ type: "timing", duration: 200 }}
                    style={styles.inputWrapper}
                  >
                    <KeyIcon 
                      color={isFocused ? theme.colors.primaryLight : theme.colors.lightGrey} 
                      width={20} 
                      height={20} 
                      style={{ marginRight: 12 }} 
                    />
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      placeholder="Enter passcode"
                      placeholderTextColor={theme.colors.lightGrey}
                      value={password}
                      onChangeText={setPassword}
                      autoFocus={!showBiometricUI}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      onSubmitEditing={handlePasswordUnlock}
                      returnKeyType="done"
                    />
                  </MotiView>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handlePasswordUnlock}
                    disabled={status === "loading"}
                    style={styles.connectButtonWrapper}
                  >
                    <LinearGradient
                      colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.connectGradient}
                    >
                      {status === "loading" ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.connectButtonText}>Unlock</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Biometric button */}
              {showBiometricUI && !isBioLoading && (
                <TouchableOpacity
                  style={styles.bioButton}
                  onPress={handleBiometricRetry}
                >
                  <FingerprintIcon color={theme.colors.primary} width={24} height={24} />
                  <Text style={styles.bioText}>Use FaceID / TouchID </Text>
                </TouchableOpacity>
              )}

              {/* Fallback button */}
              {showBiometricUI && !showPasswordInput && !isBioLoading && (
                <TouchableOpacity
                  style={styles.fallbackButton}
                  onPress={handleShowPassword}
                >
                  <Text style={styles.fallbackText}>Use password instead </Text>
                </TouchableOpacity>
              )}

              {/* Forgot Password link */}
              {(showPasswordInput || (!showBiometricUI && !isBioLoading)) && (
                <TouchableOpacity
                  style={styles.forgotButton}
                  onPress={() => router.push(ROUTES.forgotPassword)}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
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
      paddingTop: 60,
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
    lockIcon: {
      fontSize: 28,
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
    },
    loadingContainer: {
      alignItems: "center",
      marginBottom: 20,
      gap: 12,
    },
    loadingText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.lightGrey,
    },
    inputWrapper: {
      backgroundColor: theme.colors.dark,
      borderRadius: 16,
      borderWidth: 1.5,
      paddingHorizontal: 16,
      marginBottom: 8,
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
    inputIcon: {
      fontSize: 18,
      marginRight: 10,
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
    connectButtonWrapper: {
      marginTop: 12,
      borderRadius: 14,
      overflow: "hidden",
    },
    connectGradient: {
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    connectButtonText: {
      color: "#FFFFFF",
      fontFamily: theme.fonts.families.openBold,
      fontSize: 16,
      letterSpacing: 0.5,
    },
    bioButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 16,
      padding: 12,
    },
    bioEmoji: {
      fontSize: 18,
    },
    bioText: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      color: theme.colors.primary,
      marginLeft: 8,
      paddingRight: 4,
    },
    fallbackButton: {
      alignItems: "center",
      marginTop: 12,
      padding: 8,
    },
    fallbackText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.lightGrey,
      textDecorationLine: "underline",
      paddingRight: 4,
    },
    forgotButton: {
      alignItems: "center",
      marginTop: 16,
      padding: 8,
    },
    forgotText: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.small as string),
      color: theme.colors.primary,
      textDecorationLine: "underline",
    },
  });
}
