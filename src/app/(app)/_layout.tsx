import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useSelector } from "react-redux";
import styled, { useTheme } from "styled-components/native";
import Toast from "react-native-toast-message";

import { LinearGradient } from "expo-linear-gradient";
import type { RootState } from "../../store";
import { store } from "../../store";
import { toastConfig } from "../../config/toast";
import SplashScreenOverlay from "../../components/AnimatedSplashScreen/AnimatedSplashScreen";
import { CustomDrawerContent } from "../../components/ExpoDrawer/CustomDrawerContent";
import { ThemeType } from "../../styles/theme";
import { ROUTES } from "../../constants/routes";
import { Alert, Dimensions, View } from "react-native";
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
        await SplashScreen.hideAsync();
      }
    };

    SystemUI.setBackgroundColorAsync(theme.colors.background);
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

  const screenWidth = Dimensions.get("window").width;
  const drawerWidth = Math.min(screenWidth * 0.82, 340);

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient} onLayout={onLayoutRootView}>
      <SplashScreenOverlay appReady={appReady}>
        <Drawer
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerType: "front",
            drawerStyle: {
              width: drawerWidth,
              backgroundColor: "transparent",
            },
            overlayColor: "rgba(0, 0, 0, 0.65)",
            swipeEdgeWidth: 80,
          }}
        >
          <Drawer.Screen
            name="index"
            options={{
              drawerLabel: "Exchange",
              headerShown: false,
            }}
          />
          <Drawer.Screen
            name="portfolio/index"
            options={{
              drawerLabel: "Portfolio",
              headerShown: false,
            }}
          />
          <Drawer.Screen
            name="markets/index"
            options={{
              drawerLabel: "Markets",
              headerShown: false,
            }}
          />
          <Drawer.Screen
            name="gas-tracker/index"
            options={{
              drawerLabel: "Gas Tracker",
              headerShown: false,
            }}
          />
          <Drawer.Screen
            name="camera/index"
            options={{
              drawerLabel: "Camera",
              headerShown: false,
            }}
          />
          <Drawer.Screen
            name="settings/settings-modal"
            options={{
              drawerLabel: "Settings",
              headerShown: false,
            }}
          />
        </Drawer>
        <Toast position="top" topOffset={75} config={toastConfig} />
        <View style={{ position: "absolute", height: "100%", width: "100%", pointerEvents: "box-none" }}>
          <AppKit />
        </View>
      </SplashScreenOverlay>
    </LinearGradientBackground>
  );
}
