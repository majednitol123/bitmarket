import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";

interface GasTrackerProps {
  chainName?: string;
}

export const GasTracker: React.FC<GasTrackerProps> = ({ chainName = "Ethereum" }) => {
  const theme = useTheme() as ThemeType;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.cardBackground,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.gasEmoji}>⛽</Text>
          <Text style={[styles.title, { color: theme.colors.white }]}>
            {chainName} Gas & Routing
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.greenDot} />
          <Text style={styles.statusText}>Low Fee</Text>
        </View>
      </View>

      {/* Gas Speed Tiers */}
      <View style={styles.tiersRow}>
        <View style={[styles.tierItem, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}>
          <Text style={[styles.tierLabel, { color: theme.colors.grey }]}>Slow</Text>
          <Text style={[styles.tierGwei, { color: theme.colors.white }]}>11 Gwei</Text>
          <Text style={[styles.tierTime, { color: theme.colors.lightGrey }]}>~1 min</Text>
        </View>

        <View style={[styles.tierItem, styles.tierItemActive, { backgroundColor: "rgba(124, 58, 237, 0.12)", borderColor: "rgba(124, 58, 237, 0.35)" }]}>
          <Text style={[styles.tierLabel, { color: theme.colors.primaryLight }]}>Standard</Text>
          <Text style={[styles.tierGwei, { color: theme.colors.white }]}>14 Gwei</Text>
          <Text style={[styles.tierTime, { color: theme.colors.primaryLight }]}>~15 sec</Text>
        </View>

        <View style={[styles.tierItem, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}>
          <Text style={[styles.tierLabel, { color: theme.colors.grey }]}>Fast</Text>
          <Text style={[styles.tierGwei, { color: theme.colors.white }]}>18 Gwei</Text>
          <Text style={[styles.tierTime, { color: theme.colors.lightGrey }]}>~5 sec</Text>
        </View>
      </View>

      {/* Aggregator Route Info */}
      <View style={[styles.routeBox, { backgroundColor: theme.colors.dark, borderColor: theme.colors.border }]}>
        <View style={styles.routeRow}>
          <Text style={[styles.routeLabel, { color: theme.colors.lightGrey }]}>
            🛡️ MEV Protection:
          </Text>
          <Text style={styles.routeActive}>Enabled</Text>
        </View>
        <View style={styles.routeRow}>
          <Text style={[styles.routeLabel, { color: theme.colors.lightGrey }]}>
            ⚡ Aggregated Liquidity:
          </Text>
          <Text style={[styles.routeValue, { color: theme.colors.white }]}>
            Uniswap v3, Curve & 1inch
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gasEmoji: {
    fontSize: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "700",
  },
  tiersRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tierItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tierItemActive: {
    borderWidth: 1.5,
  },
  tierLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  tierGwei: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  tierTime: {
    fontSize: 10,
    fontWeight: "500",
  },
  routeBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  routeActive: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "700",
  },
  routeValue: {
    fontSize: 11,
    fontWeight: "600",
  },
});
