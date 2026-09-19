import React, { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface BlockchainIconProps {
  symbol: string;
  size?: number;
  chainId?: number | string;
  chainName?: string;
  logoUrl?: string;
  style?: ViewStyle;
}

// Generates a nice deterministic gradient color based on the symbol string
const getGradientColors = (text: string): [string, string] => {
  const code = (text || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients: [string, string][] = [
    ['#FF5733', '#FF8D1A'], // Orange
    ['#33FF57', '#1AFF8D'], // Green
    ['#3357FF', '#1A8DFF'], // Blue
    ['#F333FF', '#D81AFF'], // Purple
    ['#FF338D', '#FF1A57'], // Pink
    ['#33FFF0', '#1AFFD8'], // Teal
    ['#FFD133', '#FFA81A'], // Yellow
    ['#8B5CF6', '#6366F1'], // Indigo-Purple
    ['#EC4899', '#F43F5E'], // Rose
  ];
  return gradients[code % gradients.length];
};

export const BlockchainIcon: React.FC<BlockchainIconProps> = ({ 
  symbol, 
  size = 32, 
  chainId, 
  chainName,
  logoUrl,
  style,
}) => {
  // Stages: 0 = primary (logoUrl if available), 1 = TrustWallet / Chain icon, 2 = SpotHQ, 3 = Gradient monogram
  const initialStage = logoUrl && logoUrl.trim() !== '' ? 0 : 1;
  const [stage, setStage] = useState<number>(initialStage);

  useEffect(() => {
    setStage(logoUrl && logoUrl.trim() !== '' ? 0 : 1);
  }, [logoUrl, symbol]);

  const name = (chainName || '').toLowerCase();
  const lowerSymbol = (symbol || '').toLowerCase();
  const id = Number(chainId);

  // 1. Check custom local override for SecureChain
  if (name.includes('securechain') || lowerSymbol === 'scai' || id === 34 || id === 3434) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image
          source={require('../../assets/svg/securechain.jpeg')}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="contain"
          transition={150}
        />
      </View>
    );
  }

  // Stage 0: Explicit logoUrl (e.g. CoinMarketCap 128x128 CDN)
  if (stage === 0 && logoUrl) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={200}
          onError={() => setStage(1)}
        />
      </View>
    );
  }

  // Identify Trust Wallet identifier key
  let trustWalletKey = '';
  if (name.includes('base') || id === 8453 || id === 84532) trustWalletKey = 'base';
  else if (name.includes('scroll') || id === 534352 || id === 534351) trustWalletKey = 'scroll';
  else if (name.includes('blast') || id === 81457 || id === 168587773) trustWalletKey = 'blast';
  else if (name.includes('linea') || id === 59144 || id === 59141) trustWalletKey = 'linea';
  else if (name.includes('celo') || lowerSymbol === 'celo' || id === 42220 || id === 44787 || id === 11142220) trustWalletKey = 'celo';
  else if (name.includes('zksync') || id === 324 || id === 300) trustWalletKey = 'zksync';
  else if (name.includes('optimism') || name.includes('op mainnet') || lowerSymbol === 'op' || id === 10 || id === 11155420) trustWalletKey = 'optimism';
  else if (name.includes('arbitrum') || lowerSymbol === 'arb' || id === 42161 || id === 421614) trustWalletKey = 'arbitrum';
  else if (name.includes('polygon') || name.includes('zkevm') || lowerSymbol === 'matic' || lowerSymbol === 'pol' || id === 137 || id === 80002 || id === 1101) trustWalletKey = 'polygon';
  else if (name.includes('binance') || name.includes('bsc') || lowerSymbol === 'bnb' || id === 56 || id === 97) trustWalletKey = 'binance';
  else if (name.includes('ethereum') || lowerSymbol === 'eth' || id === 1 || id === 11155111) trustWalletKey = 'ethereum';
  else if (lowerSymbol === 'sol' || lowerSymbol === 'solana') trustWalletKey = 'solana';
  else if (lowerSymbol === 'btc' || lowerSymbol === 'bitcoin') trustWalletKey = 'bitcoin';

  // Stage 1: TrustWallet CDN
  if (stage <= 1 && trustWalletKey) {
    const twUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustWalletKey}/info/logo.png`;
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image
          source={{ uri: twUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={200}
          onError={() => setStage(2)}
        />
      </View>
    );
  }

  // Stage 2: SpotHQ crypto icon repository
  if (stage <= 2 && lowerSymbol) {
    const spotHqUrl = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${lowerSymbol}.png`;
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <Image
          source={{ uri: spotHqUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={200}
          onError={() => setStage(3)}
        />
      </View>
    );
  }

  // Stage 3: Premium linear gradient fallback with uppercase initials
  const gradientColors = getGradientColors(lowerSymbol || symbol);
  const initials = (symbol || '?').substring(0, 2).toUpperCase();

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text 
          style={{ 
            color: '#FFFFFF', 
            fontWeight: '700', 
            fontSize: size * 0.42,
            letterSpacing: -0.5
          }}
        >
          {initials}
        </Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
