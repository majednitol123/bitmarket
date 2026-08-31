import * as Clipboard from "expo-clipboard";
import { Platform, ScrollView } from "react-native";
import { useSelector } from "react-redux";
import styled, { useTheme } from "styled-components/native";
import { useRouter } from "expo-router";
import { ThemeType } from "../../../../styles/theme";
import type { RootState } from "../../../../store";
import { BlockchainIcon } from "../../../../components/BlockchainIcon/BlockchainIcon";
import { getChainIconSymbol } from "../../../../utils/getChainIconSymbol";
import CopyIcon from "../../../../assets/svg/copy.svg";
import QRCodeIcon from "../../../../assets/svg/qr-code.svg";
import { SafeAreaContainer } from "../../../../components/Styles/Layout.styles";

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-start;
  padding: ${(props) => props.theme.spacing.medium};
  padding-top: 50px;
  padding-bottom: 32px;
`;

const ScrollContainer = styled(ScrollView)`
  flex: 1;
`;

const ReceiveCardsContainer = styled.View<{ theme: ThemeType }>`
  min-height: 80px;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: ${(props) => props.theme.colors.cardBackground};
  margin-bottom: ${(props) => props.theme.spacing.medium};
  border-radius: 16px;
  padding: 14px 16px;
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const ReceiveText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
  flex-shrink: 1;
`;

const TextContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  align-items: center;
  flex: 1;
  margin-right: 12px;
`;

const IconContainer = styled.View<{ theme: ThemeType }>`
  justify-content: center;
  align-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background-color: rgba(240, 185, 11, 0.12);
  margin-right: 14px;
`;

const IconView = styled.TouchableOpacity<{ theme: ThemeType }>`
  justify-content: center;
  align-items: center;
  background-color: ${(props) => props.theme.colors.primary};
  border-radius: 12px;
  height: 40px;
  width: 40px;
  margin-left: 8px;
`;

const ActionContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  align-items: center;
`;

interface ReceiveCardsProps {
  chainName: string;
  address: string;
  icon: React.ReactNode;
}

const ReceiveCard: React.FC<ReceiveCardsProps> = ({
  chainName,
  address,
  icon,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const handleCopy = async () => {
    await Clipboard.setStringAsync(address);
  };

  return (
    <ReceiveCardsContainer>
      <TextContainer>
        <IconContainer>{icon}</IconContainer>
        <ReceiveText numberOfLines={1} ellipsizeMode="tail">{chainName}</ReceiveText>
      </TextContainer>
      <ActionContainer>
        <IconView onPress={handleCopy}>
          <CopyIcon width={20} height={20} fill={theme.colors.realWhite} />
        </IconView>
      </ActionContainer>
    </ReceiveCardsContainer>
  );
};

export default function ReceiveOptionsPage() {
  const ethereum = useSelector((state: RootState) => state.ethereum);
  const networks = useSelector((state: RootState) => state.ethereum.networks);

  const importedEvmAddress = useSelector(
    (state: RootState) => state.importedAccounts?.activeEvmAddress
  );

  /* ---------- SOLANA (keep same) ---------- */
  const importedSolAddress = useSelector(
    (state: RootState) => state.importedAccounts?.activeSolAddress
  );
  const activeSolIndex = useSelector(
    (state: RootState) => state.solana.activeIndex
  );

  const solAddress = importedSolAddress || useSelector(
    (state: RootState) =>
      state.solana.addresses?.[activeSolIndex]?.address
  );

  const selectedSolanaNetwork = useSelector(
    (state: RootState) => state.solana.selectedNetwork ?? "devnet"
  );
  const solChainName = selectedSolanaNetwork === "mainnet" ? "Solana Mainnet" : "Solana devnet";

  return (
    <SafeAreaContainer>
      <ScrollContainer showsVerticalScrollIndicator={false}>
        <ContentContainer>

          {/* 🔹 Dynamic EVM receive cards */}
          {Object.values(networks).map((network) => {
            const chainId = network.chainId;
            const activeIndex =
              ethereum.activeIndex ?? 0;

            const address =
              importedEvmAddress || ethereum.globalAddresses?.[activeIndex]?.address;

            if (!address) return null;

            return (
              <ReceiveCard
                key={`evm-receive-${chainId}`}
                chainName={network.chainName}
                address={address}
                icon={<BlockchainIcon 
                  symbol={getChainIconSymbol(network.chainName, network.symbol, network.chainId)} 
                  chainId={network.chainId}
                  chainName={network.chainName}
                  size={35} 
                />}
              />
            );
          })}

          {/* 🔹 Solana */}
          {solAddress && (
            <ReceiveCard
              chainName={solChainName}
              address={solAddress}
              icon={<BlockchainIcon symbol="sol" size={25} />}
            />
          )}

        </ContentContainer>
      </ScrollContainer>
    </SafeAreaContainer>
  );
}
