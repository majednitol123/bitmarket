import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "styled-components/native";
import type { ThemeType } from "../../styles/theme";
import { BlockchainIcon } from "../BlockchainIcon/BlockchainIcon";
import type { Token } from "../../constants/tokenRegistry";

export interface MarketToken {
  symbol: string;
  name: string;
  price: string;
  change24h: number;
  icon?: string;
  chain: string;
}

export const TRENDING_TOKENS: MarketToken[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    price: "$2,642.50",
    change24h: 3.42,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "BTC",
    name: "Bitcoin (WBTC)",
    price: "$63,120.00",
    change24h: 2.15,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: "$138.45",
    change24h: 6.84,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
    chain: "Solana",
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    price: "$7.85",
    change24h: -1.24,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984/logo.png",
    chain: "Ethereum",
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    price: "$0.58",
    change24h: 4.12,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
    chain: "Arbitrum",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    price: "$11.35",
    change24h: 5.21,
    icon: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771af9ca656af840dff83e8264ecf986ca/logo.png",
    chain: "Ethereum",
  },
];

interface MarketMoversProps {
  onSelectToken?: (symbol: string) => void;
}

export const MarketMovers: React.FC<MarketMoversProps> = ({ onSelectToken }) => {
  const theme = useTheme() as ThemeType;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.fireEmoji}>🔥</Text>
          <Text style={[styles.sectionTitle, { color: theme.colors.white }]}>
            Trending Markets
          </Text>
        </View>
        <Text style={[styles.sectionSubtext, { color: theme.colors.grey }]}>
          24h Movers
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TRENDING_TOKENS.map((token) => {
          const isPositive = token.change24h >= 0;
          return (
            <TouchableOpacity
              key={token.symbol}
              activeOpacity={0.75}
              style={[
                styles.tokenCard,
                {
                  backgroundColor: theme.colors.cardBackground,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => onSelectToken && onSelectToken(token.symbol)}
            >
              <View style={styles.cardTop}>
                <BlockchainIcon
                  symbol={token.symbol}
                  size={28}
                  logoUrl={token.icon}
                />
                <View
                  style={[
                    styles.changeBadge,
                    {
                      backgroundColor: isPositive
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.changeText,
                      { color: isPositive ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {isPositive ? "+" : ""}
                    {token.change24h}%
                  </Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <Text style={[styles.tokenSymbol, { color: theme.colors.white }]}>
                  {token.symbol}
                </Text>
                <Text style={[styles.tokenPrice, { color: theme.colors.lightGrey }]}>
                  {token.price}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <View
                  style={[
                    styles.tradePill,
                    {
                      backgroundColor: "rgba(124, 58, 237, 0.12)",
                      borderColor: "rgba(124, 58, 237, 0.25)",
                    },
                  ]}
                >
                  <Text style={[styles.tradePillText, { color: theme.colors.primaryLight }]}>
                    Trade ↗
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fireEmoji: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtext: {
    fontSize: 12,
    fontWeight: "500",
  },
  scrollContent: {
    gap: 12,
    paddingRight: 8,
  },
  tokenCard: {
    width: 140,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  changeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardBottom: {
    marginBottom: 8,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  tokenPrice: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionRow: {
    marginTop: 2,
  },
  tradePill: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tradePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
