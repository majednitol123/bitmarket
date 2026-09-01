import { useEffect, useCallback, useState, useMemo } from "react";
import { RefreshControl, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";
import { SafeAreaContainer } from "../../components/Styles/Layout.styles";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import Header from "../../components/Header/Header";

export default function Index() {
  const insets = useSafeAreaInsets();
  const theme = useTheme() as ThemeType;

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  useEffect(() => {
    const initDidcomm = async () => {
      try {
        const DidcommModule = (await import("../../../native-modules/didcomm")).default;
        await DidcommModule.helloWorld();
      } catch (err) {
        console.error("Didcomm error:", err);
      }
    };
    initDidcomm();
  }, []);

  return (
    <SafeAreaContainer edges={["bottom", "left", "right"]}>
      <Header />
      <ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl
            tintColor={theme.colors.primary}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      />
    </SafeAreaContainer>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES — computed once per theme, cached by useMemo
// ═══════════════════════════════════════════════════════════

function createStyles(theme: ThemeType, insets: EdgeInsets) {
  const sp = (val: string | number) => (typeof val === "number" ? val : parseFloat(val));

  return StyleSheet.create({
    contentContainer: {
      flexGrow: 1,
      justifyContent: "flex-start",
      padding: sp(theme.spacing.medium),
    },
  });
}
