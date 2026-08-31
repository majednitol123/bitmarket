import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { useSelector } from "react-redux";
import { useRouter } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { ThemeType } from "../../../../styles/theme";
import type { RootState } from "../../../../store";
import { formatDollar } from "../../../../utils/formatDollars";
import CryptoInfoCard from "../../../../components/CryptoInfoCard/CryptoInfoCard";
import { BlockchainIcon } from "../../../../components/BlockchainIcon/BlockchainIcon";
import { getChainIconSymbol } from "../../../../utils/getChainIconSymbol";
import { SafeAreaContainer } from "../../../../components/Styles/Layout.styles";

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-start;
  padding: ${(props) => props.theme.spacing.medium};
  margin-top: ${Platform.OS === "android" ? "75px" : "0"};
`;

const CardView = styled.View<{ theme: ThemeType }>`
  margin-bottom: ${(props) => props.theme.spacing.medium};
  width: 100%;
`;

export default function SendOptions() {
  const theme = useTheme();
  const router = useRouter();
   const ethereum = useSelector((s: RootState) => s.ethereum);
 const activeChainId = useSelector(
  (state: RootState) => state.ethereum.activeChainId
);

const activeEthIndex = useSelector(
  (state: RootState) =>
    state.ethereum.activeIndex?? 0
);

const importedEvmAddress = useSelector(
  (state: RootState) => state.importedAccounts?.activeEvmAddress
);
const importedSolAddress = useSelector(
  (state: RootState) => state.importedAccounts?.activeSolAddress
);

const ethAccounts = useSelector(
  (state: RootState) => state.ethereum.globalAddresses ?? []
);
  const networks = useSelector(
  (state: RootState) => state.ethereum.networks
);
  const priceData = useSelector((state: RootState) => state.price.data);
  const [ethCBalance, setEthCBalance] = useState(0);
  
  
const ethereumAssets = useMemo(() => {
  const list: any[] = [];

  Object.values(networks).forEach((network) => {
    const chainId = network.chainId;
    if (__DEV__) console.log("chainId",chainId)
    const index = ethereum.activeIndex ?? 0;
    const account = importedEvmAddress
      ? ethereum.globalAddresses?.find(a => a.address?.toLowerCase() === importedEvmAddress.toLowerCase())
      : ethereum.globalAddresses?.[index];
// console.log("account", account);
    if (!account) return;

    const tokenPrice =
      priceData?.[network.symbol.toLowerCase()]?.usd ?? 0;
    setEthCBalance(account.balanceByChain[chainId]);
    list.push({
      key: `evm-${chainId}`,
      chainId,
      name: network.chainName,
      symbol: network.symbol,
      balance: account.balanceByChain[chainId] ?? 0,
      
      usdValue: account.balanceByChain[chainId] * tokenPrice,
      address: account.address,
      transactions: account.transactionMetadataByChain[chainId]?.transactions,
      status: account.statusByChain[chainId],
      icon: <BlockchainIcon 
              symbol={getChainIconSymbol(network.chainName, network.symbol, network.chainId)} 
              chainId={network.chainId}
              chainName={network.chainName}
              size={35} 
            />,
    });
  });

  return list;
}, [ethereum, networks, priceData]);
if (__DEV__) console.log("ethereumAssets",ethereumAssets)

const activeEthAccount = importedEvmAddress
  ? ethAccounts.find(a => a.address?.toLowerCase() === importedEvmAddress.toLowerCase())
  : ethAccounts[activeEthIndex];

const ethBalance = activeEthAccount?.activeBalance ?? 0;

  const activeSolIndex = useSelector(
    (state: RootState) => state.solana.activeIndex
  );
 
  const solBalance = useSelector((state: RootState) => {
    if (importedSolAddress) {
      const account = state.solana.addresses?.find(a => a.address === importedSolAddress);
      return account?.balance ?? 0;
    }
    return state.solana.addresses[activeSolIndex]?.balance ?? 0;
  });
  const price = useSelector((state: RootState) => state.price.data);
  const solPrice = price[101]?.usd ?? 0;
  const ethPrice = price[activeChainId]?.usd ?? 0;

  const [solUsd, setSolUsd] = useState(0);
  const [ethUsd, setEthUsd] = useState(0);

  useEffect(() => {
    const fetchPrices = async () => {
      const ethUsd = ethPrice * ethBalance;
      const solUsd = solPrice * solBalance;

      setEthUsd(ethUsd);
      setSolUsd(solUsd);
    };
    fetchPrices();
  }, [ethBalance, solBalance]);

  const selectedSolanaNetwork = useSelector(
    (state: RootState) => state.solana.selectedNetwork ?? "devnet"
  );
  const solChainName = selectedSolanaNetwork === "mainnet" ? "Solana Mainnet" : "Solana devnet";

  return (
    <SafeAreaContainer>
      <ContentContainer>
        {/* <CardView>
          <CryptoInfoCard
            onPress={() => router.push("/token/send/ethereum")}
            title="Ethereum"
            caption={`${ethBalance} ETH`}
            details={formatDollar(ethUsd)}
            icon={
              <EthereumIcon width={35} height={35} fill={theme.colors.white} />
            }
          />
        </CardView> */}
       {ethereumAssets.map((asset) => (
          <CardView key={asset.key}>
            <CryptoInfoCard
              onPress={() =>
                router.push({
          pathname: `/token/${asset.name.toLowerCase()}`,
          params: {
            asset: JSON.stringify({
              symbol: asset.symbol.toUpperCase(),
              numberOfTokens: asset.balance,
              chainId: asset.chainId,
              address: asset.address,
              price: asset.usdValue,
            }),
          },
                })
                //few changes
              }
              title={asset.name}
              caption={`${ethCBalance} ${asset.symbol}`}
              details={formatDollar(asset.usdValue)}
              icon={asset.icon}
              hideBackground
            />
          </CardView>
        ))}
        <CardView>
          <CryptoInfoCard
            onPress={() => router.push("/token/send/solana")}
            title={solChainName}
            caption={`${solBalance} SOL`}
            details={formatDollar(solUsd)}
            icon={<BlockchainIcon symbol="sol" size={25} />}
          />
        </CardView>
      </ContentContainer>
    </SafeAreaContainer>
  );
}
