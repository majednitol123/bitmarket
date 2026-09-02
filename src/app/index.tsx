import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import * as SecureStore from "expo-secure-store";
import { RootState, AppDispatch } from "../store";
import { ROUTES } from "../constants/routes";
import { checkPasswordSet } from "../store/biometricsSlice";

export default function Index() {
  const isUnlocked = useSelector((state: RootState) => state.biometrics.unlocked);
  const passwordSet = useSelector((state: RootState) => state.biometrics.passwordSet);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    let isMounted = true;

    async function evaluateNavigation() {
      let isSet = passwordSet;
      if (!isSet) {
        try {
          const saved = await SecureStore.getItemAsync("WALLET_PASSWORD");
          if (saved && saved.length > 0) {
            isSet = true;
            dispatch(checkPasswordSet());
          }
        } catch {}
      }

      if (!isMounted) return;

      if (!isSet) {
        router.replace(ROUTES.setPassword as any);
      } else if (!isUnlocked) {
        router.replace(ROUTES.unlock as any);
      } else {
        router.replace(ROUTES.home as any);
      }
    }

    evaluateNavigation();

    return () => {
      isMounted = false;
    };
  }, [passwordSet, isUnlocked, dispatch]);

  return <View style={{ flex: 1, backgroundColor: "#0B0E17" }} />;
}
