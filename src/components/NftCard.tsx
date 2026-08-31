import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { INFT } from "../services/helper";
import { useTheme } from "styled-components/native";

interface Props {
  nft: any;
  onPress?: () => void;
  isEvm?: boolean;
}

// =========================================================================
// EVM NFT CARD (Reverted layout and logic, updated to be theme-aware)
// =========================================================================

const EvmNftCard: React.FC<{ nft: any; onPress?: () => void }> = ({ nft, onPress }) => {
  const theme = useTheme() as any;
  const isDark = theme.colors.white === "#FFFFFF";

  const cardStyle = [
    evmStyles.card,
    {
      backgroundColor: theme.colors.lightDark,
      borderColor: theme.colors.border,
      borderWidth: 1,
    }
  ];

  const imageStyle = [
    evmStyles.image,
    {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)",
    }
  ];

  const infoStyle = [
    evmStyles.info,
    {
      backgroundColor: theme.colors.lightDark,
    }
  ];

  const nameStyle = [
    evmStyles.name,
    {
      color: theme.colors.white,
    }
  ];

  const tokenIdStyle = [
    evmStyles.tokenId,
    {
      color: theme.colors.lightGrey,
    }
  ];

  return (
    <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.85}>
      <Image
        source={{
          uri: nft.uri || nft.imageUrl,
          headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
          }
        }}
        style={imageStyle}
        resizeMode="cover"
      />
      <View style={infoStyle}>
        <Text style={nameStyle} numberOfLines={1}>
          {nft.name || "Unnamed NFT"}
        </Text>
        <Text style={tokenIdStyle} numberOfLines={1}>
          #{nft.tokenId || nft.mint}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const evmStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
    marginHorizontal: 6,
    flex: 1,
    elevation: 3,
  },
  image: {
    width: "100%",
    height: 140,
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
  },
  tokenId: {
    fontSize: 12,
    marginTop: 4,
  },
});

// =========================================================================
// SOLANA NFT CARD (Retaining the optimized metadata resolver, badge and theme styles)
// =========================================================================

const resolveIpfsUrl = (url?: string): string => {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
  }
  return url;
};

const SolanaNftCard: React.FC<{ nft: any; onPress?: () => void }> = ({ nft, onPress }) => {
  const theme = useTheme() as any;

  const [resolvedImage, setResolvedImage] = useState<string | null>(null);
  const [resolvedSymbol, setResolvedSymbol] = useState<string | null>(null);

  useEffect(() => {
    const directImage = nft.imageUrl || nft.image;
    if (directImage) {
      setResolvedImage(resolveIpfsUrl(directImage));
    } else {
      setResolvedImage(null);
    }

    if (nft.symbol) {
      setResolvedSymbol(nft.symbol);
    } else {
      setResolvedSymbol(null);
    }

    if ((!directImage || !nft.symbol) && nft.uri && nft.uri.startsWith("http")) {
      let isMounted = true;
      let uriToFetch = resolveIpfsUrl(nft.uri);

      fetch(uriToFetch, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
          "Accept": "application/json",
        }
      })
        .then((res) => {
          if (!res.ok) return null;
          const contentType = res.headers.get("content-type");
          if (contentType && !contentType.includes("application/json")) {
            return null;
          }
          return res.json().catch(() => null);
        })
        .then((data) => {
          if (!data || !isMounted) return;
          if (data.image && !directImage) {
            setResolvedImage(resolveIpfsUrl(data.image));
          }
          if (data.symbol && !nft.symbol) {
            setResolvedSymbol(data.symbol);
          }
        })
        .catch(() => {
          // Gracefully suppress all network/parsing errors to keep developer console clean
        });

      return () => {
        isMounted = false;
      };
    }
  }, [nft.imageUrl, nft.image, nft.symbol, nft.uri]);

  const displayName = nft.name || "Unnamed NFT";
  const displaySymbol = resolvedSymbol || nft.symbol || "NFT";
  const displayImage = resolvedImage || resolveIpfsUrl(nft.imageUrl || nft.image);
  const displayIdFormatted = nft.tokenId || (nft.mint ? `${nft.mint.slice(0, 5)}...${nft.mint.slice(-5)}` : "Mint");

  const cardContainerStyle = [
    solStyles.card,
    {
      backgroundColor: theme.colors.lightDark,
      borderColor: theme.colors.border,
    }
  ];

  const infoSectionStyle = [
    solStyles.info,
    {
      backgroundColor: theme.colors.lightDark,
    }
  ];

  const nameTextStyle = [
    solStyles.name,
    {
      color: theme.colors.white,
    }
  ];

  const tokenIdTextStyle = [
    solStyles.tokenId,
    {
      color: theme.colors.lightGrey,
    }
  ];

  return (
    <TouchableOpacity style={cardContainerStyle} onPress={onPress} activeOpacity={0.85}>
      <View style={solStyles.imageContainer}>
        {displayImage ? (
          <Image
            source={{
              uri: displayImage,
              headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
              }
            }}
            style={solStyles.image}
            contentFit="cover"
            cachePolicy="disk"
            // transition={250}
          />
        ) : (
          <View style={[solStyles.image, solStyles.placeholderContainer]}>
            <Text style={[solStyles.placeholderText, { color: theme.colors.lightGrey }]}>No Asset Image</Text>
          </View>
        )}
        
        <View style={solStyles.badge}>
          <Text style={solStyles.badgeText}>{displaySymbol.toUpperCase()}</Text>
        </View>
      </View>

      <View style={infoSectionStyle}>
        <Text style={nameTextStyle} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={tokenIdTextStyle} numberOfLines={1}>
          #{displayIdFormatted}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const solStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    marginHorizontal: 8,
    flex: 1,
    borderWidth: 1,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 140,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: "600",
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(240, 185, 11, 0.9)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#f0b90b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: "#000",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  tokenId: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 4,
  },
});

// =========================================================================
// MAIN ENTRY POINT
// =========================================================================

const NftCard: React.FC<Props> = ({ nft, onPress, isEvm }) => {
  if (isEvm) {
    return <EvmNftCard nft={nft} onPress={onPress} />;
  }
  return <SolanaNftCard nft={nft} onPress={onPress} />;
};

export default NftCard;
