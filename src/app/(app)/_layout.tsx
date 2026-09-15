import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Tabs } from "expo-router";
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
import { ThemeController } from "@reown/appkit-core-react-native";
import FloatingTabBar from "../../components/FloatingTabBar/FloatingTabBar";
import { useRealtimeSubscription } from "../../hooks/useRealtimeSubscription";

export const LinearGradientBackground = styled(LinearGradient)<{
  theme: ThemeType;
}>`
  flex: 1;
`;

export default function AppLayout() {
  const theme = useTheme();
  const [appReady, setAppReady] = useState<boolean>(false);

  // Maintain continuous real-time WebSocket connection across tabs
  useRealtimeSubscription();

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

  // Sync AppKit theme with current theme
  useEffect(() => {
    try {
      const isDark = (theme as any)?.colors?.cardBackground !== "#FFFFFF";
      ThemeController.setDefaultThemeMode(isDark ? "dark" : "light");
      ThemeController.setThemeVariables({
        accent: (theme as any)?.colors?.primary,
      });
    } catch (e) {
      console.warn("Failed to sync AppKit theme in (app)", e);
    }
  }, [theme]);

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
        <Tabs
          tabBar={(props) => <FloatingTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: "none" },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Exchange" }} />
          <Tabs.Screen name="markets" options={{ title: "Market" }} />
          <Tabs.Screen name="portfolio" options={{ title: "Portfolio" }} />
          <Tabs.Screen name="settings" options={{ title: "Settings" }} />
          <Tabs.Screen name="camera" options={{ href: null }} />
          <Tabs.Screen name="token-detail" options={{ href: null }} />
        </Tabs>

        <Toast position="top" topOffset={75} config={toastConfig} />
        <View style={{ position: "absolute", height: "100%", width: "100%", pointerEvents: "box-none" }}>
          <AppKit />
        </View>
      </SplashScreenOverlay>
    </LinearGradientBackground>
  );
}
