import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { FlashList } from "@shopify/flash-list";
import { fetchNfts } from "../../../store/tokenSlice";
import NftCard from "../../../components/NftCard";
import { fetchSolNfts } from "../../../store/solTokenSlice";
import { useTheme } from "styled-components/native";

export default function Nfts({ wallet, chainId, isEvm }: { wallet: string; chainId: number; isEvm: boolean }) {
  if (__DEV__) console.log("nft wallet", wallet, chainId, isEvm);
  const dispatch = useDispatch();
  const allNfts = useSelector((state: any) => state.erc20.allNfts);
  const solNfts = useSelector((state: any) => state.solToken.allNfts);

  const theme = useTheme() as any;
  const isDark = theme.colors.white === "#FFFFFF";

  useEffect(() => {
    if (isEvm) {
      dispatch(fetchNfts({ chainId, wallet }));
    } else {
      dispatch(fetchSolNfts({ wallet }));
    }
  }, [wallet, chainId, isEvm]);

  // Bifurcate Empty State Check and Views
  if (isEvm) {
    if (!allNfts?.length) {
      return (
        <View style={evmStyles.empty}>
          <View style={[evmStyles.emptyIconCircle, { backgroundColor: isDark ? "rgba(240, 185, 11, 0.1)" : "rgba(240, 185, 11, 0.15)" }]}>
            <Text style={evmStyles.emptyIcon}>🖼️</Text>
          </View>
          <Text style={[evmStyles.emptyTitle, { color: theme.colors.white }]}>No NFTs Yet</Text>
          <Text style={[evmStyles.emptySub, { color: theme.colors.lightGrey }]}>Your NFT collection will appear here</Text>
        </View>
      );
    }

    return (
      <FlashList
        scrollEnabled={false}
        data={allNfts || []}
        keyExtractor={(item: any, index) => `${item.chainId}-${item.tokenId}-${index}`}
        numColumns={2}
        estimatedItemSize={180}
        renderItem={({ item }) => <NftCard nft={item} isEvm={true} />}
        contentContainerStyle={evmStyles.list}
      />
    );
  }

  // Solana rendering logic
  if (!solNfts?.length) {
    return (
      <View style={solStyles.empty}>
        <View style={[solStyles.emptyIconCircle, { backgroundColor: isDark ? "rgba(240, 185, 11, 0.1)" : "rgba(240, 185, 11, 0.15)" }]}>
          <Text style={solStyles.emptyIcon}>🖼️</Text>
        </View>
        <Text style={[solStyles.emptyTitle, { color: theme.colors.white }]}>No NFTs Yet</Text>
        <Text style={[solStyles.emptySub, { color: theme.colors.lightGrey }]}>Your NFT collection will appear here</Text>
      </View>
    );
  }

  return (
    <FlashList
      scrollEnabled={false}
      data={solNfts || []}
      keyExtractor={(item: any, index) => `${item.mint || index}`}
      numColumns={2}
      estimatedItemSize={180}
      renderItem={({ item }: { item: any }) => <NftCard nft={item} isEvm={false} />}
      contentContainerStyle={solStyles.list}
    />
  );
}

// Exact committed stylesheet for EVM
const evmStyles = StyleSheet.create({
  list: {
    padding: 12,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(240, 185, 11, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySub: {
    color: "#888",
    fontSize: 14,
  },
});

// Themed/Optimized stylesheet for Solana
const solStyles = StyleSheet.create({
  list: {
    padding: 12,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
  },
});
