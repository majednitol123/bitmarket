import { Share, Alert, Platform, Dimensions, ScrollView } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useLayoutEffect, useState, useMemo } from "react";
import styled, { useTheme } from "styled-components/native";
import QRCode from "react-native-qrcode-svg";
import { useSelector } from "react-redux";
import { ThemeType } from "../../../../styles/theme";
import type { RootState } from "../../../../store";
import { capitalizeFirstLetter } from "../../../../utils/capitalizeFirstLetter";
import { truncateWalletAddress } from "../../../../utils/truncateWalletAddress";
import Button from "../../../../components/Button/Button";
import { SafeAreaContainer } from "../../../../components/Styles/Layout.styles";
import { BlockchainIcon } from "../../../../components/BlockchainIcon/BlockchainIcon";

const qrSize = Dimensions.get("window").width * 0.65;

const ScrollContainer = styled.ScrollView`
  flex: 1;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  width: 100%;
  align-items: center;
  padding: ${(props) => props.theme.spacing.large};
  margin-top: ${(props) =>
    Platform.OS === "android" ? props.theme.spacing.huge : "0px"};
`;

const HeaderSection = styled.View`
  align-items: center;
  margin-bottom: 24px;
`;

const ChainIconCircle = styled.View<{ theme: ThemeType }>`
  width: 56px;
  height: 56px;
  border-radius: 20px;
  background-color: rgba(240, 185, 11, 0.12);
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
`;

const HeaderTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 24px;
  color: ${(props) => props.theme.colors.white};
  text-align: center;
`;

const QRCodeCard = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 24px;
  border: 1px solid ${(props) => props.theme.colors.border};
  padding: 24px;
  align-items: center;
  margin-bottom: 24px;
`;

const QRCodeContainer = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.white};
  border-radius: 20px;
  padding: 16px;
  justify-content: center;
  align-items: center;
`;

const QRCodeLabel = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.small};
  color: ${(props) => props.theme.colors.lightGrey};
  margin-top: 12px;
  text-align: center;
`;

const AddressCard = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 16px;
  border: 1px solid ${(props) => props.theme.colors.border};
  padding: 0 4px 0 16px;
  flex-direction: row;
  align-items: center;
  width: 100%;
  height: 56px;
  margin-bottom: 16px;
`;

const AddressText = styled.Text<{ theme: ThemeType }>`
  flex: 1;
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
`;

const CopyButton = styled.TouchableOpacity<{ copied: boolean; theme: ThemeType }>`
  background-color: ${({ copied, theme }) =>
    copied ? theme.colors.primary : theme.colors.primary};
  padding: 10px 18px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
`;

const CopyButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.dark};
`;

const InfoText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  margin-bottom: 24px;
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  padding-left: ${(props) => props.theme.spacing.large};
  padding-right: ${(props) => props.theme.spacing.large};
  padding-bottom: ${(props) => props.theme.spacing.large};
  width: 100%;
`;

export default function ReceivePage() {
  const theme = useTheme();
  const { receive } = useLocalSearchParams();
  const chainName = receive as string;
  const navigation = useNavigation();

  const tokenAddress = useSelector((state: RootState) => {
    let blockchainVersion = chainName
      ? chainName === "solana"
        ? "solana"
        : "ethereum"
      : "";

    if (blockchainVersion === "ethereum") {
      const importedEvm = state.importedAccounts?.activeEvmAddress;
      if (importedEvm) return importedEvm;
      const index = state.ethereum.activeIndex ?? 0;
      return state.ethereum.globalAddresses?.[index]?.address;
    }

    if (blockchainVersion === "solana") {
      const importedSol = state.importedAccounts?.activeSolAddress;
      if (importedSol) return importedSol;
      const index = state.solana.activeIndex ?? 0;
      return state.solana.addresses?.[index]?.address;
    }

    return undefined;
  });

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(tokenAddress);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 4000);
  };

  const onShare = async () => {
    try {
      await Share.share({
        message: tokenAddress,
      });
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `Receive ${capitalizeFirstLetter(chainName)}`,
    });
  }, [navigation]);

  const networks = useSelector((state: RootState) => state.ethereum.networks);
  const activeNetwork = useMemo(() => {
    return Object.values(networks).find(
      (n) => n.chainName.toLowerCase() === chainName.toLowerCase()
    );
  }, [networks, chainName]);

  const chainSymbol = activeNetwork?.symbol || (chainName === "solana" ? "sol" : "eth");
  const chainId = activeNetwork?.chainId || (chainName === "solana" ? 101 : 1);
  const resolvedChainName = activeNetwork?.chainName || (chainName === "solana" ? "Solana" : "Ethereum");

  return (
    <SafeAreaContainer style={{ flex: 1 }}>
      <ScrollContainer contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <ContentContainer>
          <HeaderSection>
            <ChainIconCircle>
              <BlockchainIcon 
                symbol={chainSymbol} 
                chainId={chainId} 
                chainName={resolvedChainName} 
                size={28} 
              />
            </ChainIconCircle>
            <HeaderTitle>Receive {capitalizeFirstLetter(chainName)}</HeaderTitle>
          </HeaderSection>

          <QRCodeCard>
            <QRCodeContainer>
              <QRCode value={tokenAddress} size={qrSize} />
            </QRCodeContainer>
            <QRCodeLabel>Scan to receive</QRCodeLabel>
          </QRCodeCard>

          <AddressCard>
            <AddressText>{truncateWalletAddress(tokenAddress, 10, 10)}</AddressText>
            <CopyButton onPress={handleCopy} copied={copied}>
              <CopyButtonText>{copied ? "Copied!" : "Copy"}</CopyButtonText>
            </CopyButton>
          </AddressCard>

          <InfoText>
            Share this address to receive {capitalizeFirstLetter(chainName)}
          </InfoText>
        </ContentContainer>
      </ScrollContainer>

      <ButtonContainer>
        <Button
          backgroundColor={theme.colors.primary}
          color={theme.colors.realWhite}
          onPress={onShare}
          title="Share Address"
        />
      </ButtonContainer>
    </SafeAreaContainer>
  );
}
