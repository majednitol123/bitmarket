import React, { useState } from 'react';
import { Image } from 'expo-image';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface BlockchainIconProps {
  symbol: string;
  size?: number;
  chainId?: number | string;
  chainName?: string;
  logoUrl?: string;
}

// Map modern L2s to Trust Wallet asset IDs
const TRUST_WALLET_ASSETS: Record<string, string> = {
  'base': 'base',
  'scroll': 'scroll',
  'blast': 'blast',
  'linea': 'linea',
  'celo': 'celo',
  'zksync': 'zksync',
  'taiko': 'taiko',
  'optimism': 'optimism',
  'arbitrum': 'arbitrum',
  'polygon': 'polygon',
  'binance': 'binance',
  'ethereum': 'ethereum',
  'solana': 'solana',
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'eth': 'ethereum',
  'sol': 'solana',
};

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
  ];
  return gradients[code % gradients.length];
};

export const BlockchainIcon: React.FC<BlockchainIconProps> = ({ 
  symbol, 
  size = 32, 
  chainId, 
  chainName,
  logoUrl
}) => {
  const [error, setError] = useState(false);

  React.useEffect(() => {
    setError(false);
  }, [logoUrl, symbol]);

  const name = (chainName || '').toLowerCase();
  const lowerSymbol = (symbol || '').toLowerCase();
  const id = Number(chainId);

  // 0. Check custom logoUrl if provided
  if (logoUrl && !error) {
    return (
      <Image
        source={logoUrl}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="contain"
        cachePolicy="disk"
        onError={() => setError(true)}
      />
    );
  }

  // 1. Check custom override for SecureChain
  if (name.includes('securechain') || lowerSymbol === 'scai' || id === 34 || id === 3434) {
    return (
      <Image
        source={require('../../assets/svg/securechain.jpeg')}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="contain"
      />
    );
  }

  // 2. Identify Trust Wallet identifier key
  let trustWalletKey = '';
  if (name.includes('base') || id === 8453 || id === 84532) trustWalletKey = 'base';
  else if (name.includes('scroll') || id === 534352 || id === 534351) trustWalletKey = 'scroll';
  else if (name.includes('blast') || id === 81457 || id === 168587773) trustWalletKey = 'blast';
  else if (name.includes('linea') || id === 59144 || id === 59141) trustWalletKey = 'linea';
  else if (name.includes('celo') || lowerSymbol === 'celo' || id === 42220 || id === 44787 || id === 11142220) trustWalletKey = 'celo';
  else if (name.includes('zksync') || id === 324 || id === 300) trustWalletKey = 'zksync';
  else if (name.includes('optimism') || name.includes('op mainnet') || lowerSymbol === 'op' || id === 10 || id === 11155420) trustWalletKey = 'optimism';
  else if (name.includes('arbitrum') || lowerSymbol === 'arb' || id === 42161 || id === 421614) trustWalletKey = 'arbitrum';
  else if (name.includes('polygon') || name.includes('zkevm') || lowerSymbol === 'matic' || lowerSymbol === 'pol' || id === 137 || id === 80002 || id === 1101 || id === 2442) trustWalletKey = 'polygon';
  else if (name.includes('binance') || name.includes('bsc') || lowerSymbol === 'bnb' || id === 56 || id === 97) trustWalletKey = 'binance';
  else if (name.includes('ethereum') || lowerSymbol === 'eth' || id === 1 || id === 11155111) trustWalletKey = 'ethereum';
  else if (lowerSymbol === 'sol' || lowerSymbol === 'solana') trustWalletKey = 'solana';
  else if (lowerSymbol === 'btc' || lowerSymbol === 'bitcoin') trustWalletKey = 'bitcoin';

  // 3. Fallback to dynamic github hosted icon URL or gradient fallback if error occurs
  const dynamicIconUrl = trustWalletKey 
    ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustWalletKey}/info/logo.png`
    : `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${lowerSymbol}.png`;

  if (!error && dynamicIconUrl) {
    return (
      <Image
        source={dynamicIconUrl}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="contain"
        cachePolicy="disk"
        onError={() => setError(true)}
      />
    );
  }

  // Premium linear gradient fallback showing uppercase first character
  const gradientColors = getGradientColors(lowerSymbol);
  const initials = (symbol || '?').substring(0, 2).toUpperCase();

  return (
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
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1.5,
      }}
    >
      <Text 
        style={{ 
          color: '#FFFFFF', 
          fontWeight: 'bold', 
          fontSize: size * 0.42,
          letterSpacing: -0.5
        }}
      >
        {initials}
      </Text>
    </LinearGradient>
  );
};
