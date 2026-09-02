import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useSelector } from "react-redux";
import styled, { useTheme } from "styled-components/native";
import Toast from "react-native-toast-message";

import { LinearGradient } from "expo-linear-gradient";
import type { RootState } from "../../store";
import { store } from "../../store";
import { toastConfig } from "../../config/toast";
import SplashScreenOverlay from "../../components/AnimatedSplashScreen/AnimatedSplashScreen";
import { ThemeType } from "../../styles/theme";
import { ROUTES } from "../../constants/routes";
import { Alert, View } from "react-native";
import { AppKit } from "@reown/appkit-react-native";

export const LinearGradientBackground = styled(LinearGradient)<{
  theme: ThemeType;
}>`
  flex: 1;
`;

export default function AppLayout() {
  const theme = useTheme();
  const [appReady, setAppReady] = useState<boolean>(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        const { passwordSet, unlocked } = store.getState().biometrics;
        if (passwordSet && !unlocked) {
          router.replace(ROUTES.unlock);
        }
      } catch (err) {
        console.error("Error in app prepare:", err);
        Alert.alert("Error", `Something went wrong: ${err instanceof Error ? err.message : err}`);
      } finally {
        setAppReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      }
    };

    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
    prepare();
  }, []);

  // ─── REACTIVE LOCK NAVIGATION ───
  const isUnlocked = useSelector((state: RootState) => state.biometrics.unlocked);
  const passwordSet = useSelector((state: RootState) => state.biometrics.passwordSet);

  useEffect(() => {
    if (appReady && passwordSet && !isUnlocked) {
      router.replace(ROUTES.unlock);
    }
  }, [isUnlocked, appReady, passwordSet]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn("SplashScreen hide failed:", e);
      }
    }
  }, [appReady]);

  useEffect(() => {
    if (appReady) {
      const fallback = setTimeout(() => {
        SplashScreen.hideAsync().catch(console.warn);
      }, 500);

      return () => clearTimeout(fallback);
    }
  }, [appReady]);

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient} onLayout={onLayoutRootView}>
      <SplashScreenOverlay appReady={appReady}>
        <NativeTabs
          backgroundColor={theme.colors.cardBackground || theme.colors.background}
          tintColor={theme.colors.primaryLight || "#A855F7"}
          iconColor={{
            default: theme.colors.grey || "#64748B",
            selected: theme.colors.primaryLight || "#A855F7",
          }}
          labelStyle={{
            default: { color: theme.colors.grey || "#64748B", fontSize: 11, fontWeight: "600" },
            selected: { color: theme.colors.primaryLight || "#A855F7", fontSize: 11, fontWeight: "700" },
          }}
          labelVisibilityMode="labeled"
          indicatorColor="rgba(168, 85, 247, 0.22)"
          rippleColor="rgba(168, 85, 247, 0.15)"
          tabBarRespectsIMEInsets={true}
          disableTransparentOnScrollEdge={true}
          shadowColor="rgba(0, 0, 0, 0.2)"
        >
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Label>Exchange</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "arrow.left.arrow.right", selected: "arrow.left.arrow.right.circle.fill" }}
              md={{ default: "swap_horiz", selected: "swap_horiz" }}
            />
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="markets">
            <NativeTabs.Trigger.Label>Market</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis.circle.fill" }}
              md={{ default: "trending_up", selected: "trending_up" }}
            />
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="portfolio">
            <NativeTabs.Trigger.Label>Portfolio</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "creditcard", selected: "creditcard.fill" }}
              md={{ default: "account_balance_wallet", selected: "account_balance_wallet" }}
            />
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="settings">
            <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: "gearshape", selected: "gearshape.fill" }}
              md={{ default: "settings", selected: "settings" }}
            />
          </NativeTabs.Trigger>
        </NativeTabs>

        <Toast position="top" topOffset={75} config={toastConfig} />
        <View style={{ position: "absolute", height: "100%", width: "100%", pointerEvents: "box-none" }}>
          <AppKit />
        </View>
      </SplashScreenOverlay>
    </LinearGradientBackground>
  );
}
