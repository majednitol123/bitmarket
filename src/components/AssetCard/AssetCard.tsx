/**
 * MemoizedAssetCard — wraps CryptoInfoCard with stable props so React.memo
 * can skip re-renders when the asset data hasn't changed.
 *
 * The key insight: passing `onPress={() => fn(asset)}` inline defeats memo
 * because it creates a new function on every parent render. This component
 * receives primitive/stable props and builds the onPress internally.
 */
import React, { memo, useCallback } from "react";
import { router } from "expo-router";
import CryptoInfoCard from "../CryptoInfoCard/CryptoInfoCard";
import { BlockchainIcon } from "../BlockchainIcon/BlockchainIcon";
import { getChainIconSymbol } from "../../utils/getChainIconSymbol";
import { formatDollar } from "../../utils/formatDollars";

interface AssetCardProps {
  chainId: number;
  name: string;
  symbol: string;
  balance: number;
  usdValue: number;
  address: string;
  price: number;
  onSelectChain: (chainId: number, address: string) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({
  chainId,
  name,
  symbol,
  balance,
  usdValue,
  address,
  price,
  onSelectChain,
}) => {
  const handlePress = useCallback(() => {
    onSelectChain(chainId, address);
    router.push({
      pathname: `/token/${name.toLowerCase()}`,
      params: {
        asset: JSON.stringify({
          symbol: symbol.toUpperCase(),
          numberOfTokens: balance,
          chainId,
          address,
          price,
        }),
      },
    });
  }, [chainId, name, symbol, balance, address, price, onSelectChain]);

  return (
    <CryptoInfoCard
      onPress={handlePress}
      title={name}
      caption={`${balance} ${symbol}`}
      details={formatDollar(usdValue)}
      icon={
        <BlockchainIcon
          symbol={getChainIconSymbol(name, symbol, chainId)}
          chainId={chainId}
          chainName={name}
          size={35}
        />
      }
      hideBackground
    />
  );
};

export default memo(AssetCard, (prev, next) => {
  return (
    prev.chainId === next.chainId &&
    prev.name === next.name &&
    prev.symbol === next.symbol &&
    prev.balance === next.balance &&
    prev.usdValue === next.usdValue &&
    prev.address === next.address &&
    prev.price === next.price
  );
});
