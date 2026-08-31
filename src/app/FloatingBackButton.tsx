import React from "react";
import { Pressable, StyleSheet, Platform, View, Text } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useTheme } from "styled-components/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LeftIcon from "../assets/svg/left-arrow.svg";

const DISABLED_ROUTES = [
  "index",
  "wallet-setup",
  "wallet-created-successfully",
  "unlock",
  "[id]",
  "dapp-browser",
  "camera",
  "(app)",
];

const getHeaderTitle = (lastSegment: string): string => {
  switch (lastSegment) {
    case "settings-modal":
      return "Settings";
    case "accounts":
      return "Manage Wallets";
    case "import-private-key":
      return "Import Account";
    case "account-modal":
      return "Account Information";
    default:
      return "";
  }
};

export default function FloatingBackButton(props?: any) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const routeName = props?.route?.name;

  // 1. If we are in the outer stack and the active route is inside the (app) folder, return null
  // to prevent double headers on all screens within (app)
  if (routeName && (routeName === "(app)" || routeName.startsWith("(app)/"))) {
    return null;
  }

  // 2. Dynamic token details route check using segments (screen renders its own back button)
  if (segments && segments[1] === "token" && segments.length === 3) {
    return null;
  }

  const lastSegment = routeName
    ? routeName.split("/").pop()
    : (segments && segments.length > 0 ? segments[segments.length - 1] : "");

  // If it's an empty route or listed in DISABLED_ROUTES, do not show
  if (!lastSegment || DISABLED_ROUTES.includes(lastSegment)) return null;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/wallet-setup");
  };

  const title = getHeaderTitle(lastSegment);

  if (!title) {
    return (
      <Pressable
        onPress={goBack}
        hitSlop={12}
        style={[
          styles.container,
          { top: insets.top + (Platform.OS === "android" ? 8 : 12) }
        ]}
      >
        <LeftIcon width={32} height={32} fill={theme.colors.white} />
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.headerContainer,
        { top: insets.top + (Platform.OS === "android" ? 6 : 10) }
      ]}
    >
      <Pressable
        onPress={goBack}
        hitSlop={12}
        style={styles.backButton}
      >
        <LeftIcon width={32} height={32} fill={theme.colors.white} />
      </Pressable>
      <Text
        numberOfLines={1}
        style={[
          styles.headerTitle,
          {
            color: theme.colors.white,
            fontFamily: theme.fonts.families.openBold,
          }
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    zIndex: 999,
  },
  headerContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 999,
    gap: 12,
  },
  backButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
  },
});
