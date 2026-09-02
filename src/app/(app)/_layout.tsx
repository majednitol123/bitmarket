import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useCallback, useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { useSelector } from "react-redux";
import styled, { useTheme } from "styled-components/native";
import Toast from "react-native-toast-message";

import { LinearGradient } from "expo-linear-gradient";
import type { RootState } from "../../store";
import FloatingBackButton from "../FloatingBackButton";
import { clearPersistedState, store } from "../../store";
import { toastConfig } from "../../config/toast";
import Header from "../../components/Header/Header";
import SplashScreenOverlay from "../../components/AnimatedSplashScreen/AnimatedSplashScreen";
import { ThemeType } from "../../styles/theme";
import { ROUTES } from "../../constants/routes";
import { Alert, Platform, View } from "react-native";
import { AppKit } from "@reown/appkit-react-native";

const IconTouchContainer = styled.TouchableOpacity`
  padding: 10px;
`;

export const LinearGradientBackground = styled(LinearGradient) <{
  theme: ThemeType;
}>`
  flex: 1;
`;

export default function AppLayout() {

  const theme = useTheme();


  const activeIndex = useSelector(
    (state: RootState) =>
      state.ethereum.activeIndex ?? 0
  );

  const [appReady, setAppReady] = useState<boolean>(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Check if wallet is locked — root _layout handles all lock/unlock state.
        // We only redirect here if the wallet is currently locked.
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
  // When auto-lock fires (timeout or background return), Redux sets unlocked=false.
  // This effect watches that state and navigates to the unlock screen.
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
      }, 500); // 0.5s fallback

      return () => clearTimeout(fallback);
    }
  }, [appReady]);
  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient} onLayout={onLayoutRootView}>
      <SplashScreenOverlay
        appReady={appReady}
      >
        <Stack
          screenOptions={{
            headerShown: true,
            headerTransparent: true,
            header: (props) => <FloatingBackButton {...props} />,
            gestureEnabled: true,
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="camera/index"
            options={{
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="settings/settings-modal"
            options={{
              gestureEnabled: true,
            }}
          />
         </Stack>
        <Toast position="top" topOffset={75} config={toastConfig} />
        <View style={{ position: 'absolute', height: '100%', width: '100%' }}>
          <AppKit />
        </View>
      </SplashScreenOverlay>
    </LinearGradientBackground>
  );
}
