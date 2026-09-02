import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useTheme } from "styled-components/native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import Button from "../../../components/Button/Button";
import { ThemeType } from "../../../styles/theme";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import { MotiView } from "moti";
import CameraIcon from "../../../assets/svg/camera.svg";
import QRCodeCamera from "../../../assets/svg/qr-code-camera.svg";
import CloseIcon from "../../../assets/svg/close.svg";
import LeftArrow from "../../../assets/svg/left-arrow.svg";
import { ROUTES } from "../../../constants/routes";

export default function Camera() {
  const theme = useTheme() as ThemeType;
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useFocusEffect(() => {
    setLoading(false);
  });

  if (!permission) {
    return <View style={styles.emptyContainer}></View>;
  }

  const onBarcodeScanned = (data: BarcodeScanningResult) => {
    setLoading(true);
    if (!data || !data.data) {
      return;
    }
    router.back();
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(ROUTES.home as any);
    }
  };

  const renderPermissionScreen = (title: string, subtitle: string, buttonTitle: string, isDenied = false) => (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={12}>
            <LeftArrow color={theme.colors.white} width={22} height={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.iconHaloContainer}>
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
              <CameraIcon color={theme.colors.white} width={64} height={64} />
            </View>
          </View>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 800, delay: 300 }}
            style={styles.textContainer}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </MotiView>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 800, delay: 600 }}
          style={styles.buttonContainer}
        >
          <Button
            loading={loading}
            onPress={requestPermission}
            title={buttonTitle}
            backgroundColor={theme.colors.primary}
            color={theme.colors.realWhite}
          />
          {!isDenied && (
            <TouchableOpacity onPress={() => router.back()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
          )}
        </MotiView>
      </SafeAreaView>
    </LinearGradientBackground>
  );

  if (permission.status === "denied") {
    return renderPermissionScreen(
      "Camera Access Denied",
      "To enable camera access, go to your device settings and allow camera access to scan QR codes for easy token transactions.",
      "Try Again",
      true
    );
  }

  if (!permission.granted) {
    return renderPermissionScreen(
      "Allow Camera Access",
      "Allow camera access to quickly scan QR codes for easy token transactions.",
      "Enable Camera"
    );
  }

  return (
    <CameraView
      style={styles.cameraContainer}
      barcodeScannerSettings={{
        barcodeTypes: ["qr"],
      }}
      onBarcodeScanned={(data: BarcodeScanningResult) =>
        loading ? onBarcodeScanned(null as any) : onBarcodeScanned(data)
      }
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.closeIconContainer, { top: insets.top + (Platform.OS === "android" ? 10 : 0) }]}
        hitSlop={15}
      >
        <CloseIcon width={28} height={28} fill={theme.colors.white} />
      </TouchableOpacity>

      <QRCodeCamera width={250} height={250} fill={theme.colors.white} />
    </CameraView>
  );
}

function createStyles(theme: ThemeType) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    emptyContainer: {
      flex: 1,
      backgroundColor: theme.colors.black,
    },
    header: {
      paddingHorizontal: parseFloat(theme.spacing.large as string),
      paddingTop: 10,
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
    secondaryButton: {
      height: 60,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 12,
    },
    secondaryButtonText: {
      fontFamily: theme.fonts.families.openBold,
      fontSize: parseFloat(theme.fonts.sizes.header as string),
      color: theme.colors.primary,
    },
    cameraContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    closeIconContainer: {
      position: "absolute",
      top: 50,
      left: 20,
      padding: 10,
    },
  });
}
