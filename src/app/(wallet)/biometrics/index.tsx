import { useState, useCallback } from "react";
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useTheme } from "styled-components/native";
import { useDispatch, useSelector } from "react-redux";
import {
  authenticateBiometric,
  saveBiometricPreference,
  unlockWallet,
} from "../../../store/biometricsSlice";
import { type AppDispatch, type RootState } from "../../../store";
import Button from "../../../components/Button/Button";
import { ROUTES } from "../../../constants/routes";
import { ThemeType } from "../../../styles/theme";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import { MotiView } from "moti";
import FingerprintIcon from "../../../assets/svg/fingerprint.svg";
import LeftArrow from "../../../assets/svg/left-arrow.svg";

export default function BiometricsSetup() {
  const theme = useTheme() as ThemeType;
  const dispatch = useDispatch<AppDispatch>();
  const styles = createStyles(theme);

  const { biometricAvailable, status } = useSelector(
    (state: RootState) => state.biometrics
  );

  const [error, setError] = useState("");

  const handleEnableBiometrics = useCallback(async () => {
    setError("");
    try {
      const result = await dispatch(authenticateBiometric()).unwrap();
      if (result) {
        // Auth succeeded — save the user's preference
        await dispatch(saveBiometricPreference(true));
        dispatch(unlockWallet());
        router.dismissAll();
        router.replace(ROUTES.home);
      }
    } catch (e: any) {
      setError(
        typeof e === "string"
          ? e
          : "Biometric authentication failed. Please try again."
      );
    }
  }, [dispatch]);

  const handleSkip = useCallback(() => {
    // User opts out of biometrics — go straight to home
    dispatch(unlockWallet());
    router.dismissAll();
    router.replace(ROUTES.home);
  }, [dispatch]);

  const isLoading = status === "loading";

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <LeftArrow color={theme.colors.white} width={24} height={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.iconHaloContainer}>
            {/* Outer pulsing halo */}
            <MotiView
              from={{ scale: 1, opacity: 0.3 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{
                type: "timing",
                duration: 2500,
                loop: true,
                repeatReverse: false,
              }}
              style={styles.haloOuter}
            />
            <MotiView
              from={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.25, opacity: 0 }}
              transition={{
                type: "timing",
                duration: 2500,
                loop: true,
                repeatReverse: false,
                delay: 600,
              }}
              style={styles.haloInner}
            />
            <View style={styles.iconCircle}>
              <FingerprintIcon color={theme.colors.white} width={64} height={64} />
            </View>
          </View>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 800, delay: 300 }}
            style={styles.textContainer}
          >
            <Text style={styles.title}>Secure With Biometrics</Text>
            <Text style={styles.subtitle}>
              {biometricAvailable
                ? "Use FaceID or TouchID for quick and secure access to your wallet. You can always change this in Settings."
                : "Biometric authentication is not available on this device. You can use your password to unlock."}
            </Text>
          </MotiView>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 800, delay: 600 }}
          style={styles.buttonContainer}
        >
          {/* Error display */}
          {error ? (
            <View style={styles.errorView}>
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </View>
          ) : null}

          {/* Loading state */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.white} size="small" />
            </View>
          )}

          {biometricAvailable ? (
            <>
              <Button
                backgroundColor={theme.colors.primary}
                color={theme.colors.realWhite}
                loading={isLoading}
                onPress={handleEnableBiometrics}
                title="Enable Biometrics"
              />
              <View style={{ marginTop: 12, width: "100%" }}>
                <Button
                  onPress={handleSkip}
                  title="Skip for Now"
                  backgroundColor={theme.colors.dark}
                  color={theme.colors.lightGrey}
                />
              </View>
            </>
          ) : (
            <Button
              backgroundColor={theme.colors.primary}
              color={theme.colors.realWhite}
              onPress={handleSkip}
              title="Continue"
            />
          )}
        </MotiView>
      </SafeAreaView>
    </LinearGradientBackground>
  );
}

function createStyles(theme: ThemeType) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    header: {
      paddingHorizontal: parseFloat(theme.spacing.large as string),
      paddingTop: 10,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    contentContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: parseFloat(theme.spacing.large as string),
    },
    iconHaloContainer: {
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 60,
    },
    haloOuter: {
      position: "absolute",
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: theme.colors.primary,
    },
    haloInner: {
      position: "absolute",
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: theme.colors.primary,
    },
    iconCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: "rgba(55, 114, 255, 0.12)",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: theme.colors.primary,
      zIndex: 2,
    },
    textContainer: {
      alignItems: "center",
    },
    title: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: 32,
      color: theme.colors.white,
      textAlign: "center",
      marginBottom: parseFloat(theme.spacing.small as string),
    },
    subtitle: {
      fontFamily: theme.fonts.families.openRegular,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      color: theme.colors.lightGrey,
      textAlign: "center",
      lineHeight: 24,
    },
    buttonContainer: {
      paddingHorizontal: parseFloat(theme.spacing.large as string),
      paddingBottom: parseFloat(theme.spacing.large as string),
    },
    errorView: {
      marginBottom: parseFloat(theme.spacing.medium as string),
    },
    errorCard: {
      backgroundColor: "rgba(255, 82, 82, 0.15)",
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: "rgba(255, 82, 82, 0.3)",
    },
    errorText: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: parseFloat(theme.fonts.sizes.normal as string),
      color: theme.colors.white,
    },
    loadingContainer: {
      alignItems: "center",
      marginBottom: 12,
    },
  });
}
