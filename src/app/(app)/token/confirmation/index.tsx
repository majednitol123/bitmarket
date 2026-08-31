import React, { useEffect } from "react";
import { SafeAreaView } from "react-native";
import styled, { useTheme } from "styled-components/native";
import { useSelector } from "react-redux";
import { View } from "moti";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { ThemeType } from "../../../../styles/theme";
import { LinearGradientBackground } from "../../../../components/Styles/Gradient";
import Loader from "../../../../components/Loader/CleanArcSpinner";
import { confirmEvmTransaction } from "../../../../store/ethereumSlice";
import { confirmSolanaTransaction } from "../../../../store/solanaSlice";
import { ConfirmationState } from "../../../../store/types";
import { RootState } from "../../../../store";
import { Chains } from "../../../../types";
import Button from "../../../../components/Button/Button";
import { Linking, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import { truncateWalletAddress } from "../../../../utils/truncateWalletAddress";
import NETWORKS from "../../../../services/defaultNetwork";

const SafeAreaContainer = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-end;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const TextContainer = styled.View<{ theme: ThemeType }>`
  padding: ${(props) => props.theme.spacing.large};
  justify-content: center;
  align-items: center;
`;

const Title = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.title};
  color: ${(props) => props.theme.fonts.colors.primary};
  margin-bottom: ${(props) => props.theme.spacing.small};
  text-align: center;
`;

const Subtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  color: ${(props) => props.theme.fonts.colors.primary};
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  padding-left: ${(props) => props.theme.spacing.large};
  padding-right: ${(props) => props.theme.spacing.large};
  padding-bottom: ${(props) => props.theme.spacing.large};
  padding-top: ${(props) => props.theme.spacing.small};
`;

const LoaderContainer = styled.View<{ theme: ThemeType }>`
  margin-top: ${(props) => props.theme.spacing.large};
`;

const IconContainer = styled.View<{ theme: ThemeType }>`
  background-color: #1a1a1a;
  width: 120px;
  height: 120px;
  border-radius: 60px;
  justify-content: center;
  align-items: center;
  margin-bottom: ${(props) => props.theme.spacing.large};
`;

const SuccessSubtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  margin-top: ${(props) => props.theme.spacing.small};
  line-height: 24px;
`;

const ViewTransactionLink = styled.TouchableOpacity<{ theme: ThemeType }>`
  margin-top: ${(props) => props.theme.spacing.medium};
`;

const ViewTransactionText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: #a8a8ff;
  text-decoration: underline;
`;

const Circle = styled.View<{ bgColor?: string }>`
  background-color: ${(props) => props.bgColor || "#22c55e"};
  width: 80px;
  height: 80px;
  border-radius: 40px;
  justify-content: center;
  align-items: center;
`;

export default function Confirmation() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const router = useRouter();
  const ChainId = useSelector(
    (state: RootState) => state.ethereum.activeChainId
  );
  const networks = useSelector(
    (state: RootState) => state.ethereum.networks
  );
  const selectedSolanaNetwork = useSelector((state: RootState) => state.solana.selectedNetwork ?? "devnet");
  const { txHash, blockchain, amount, symbol, recipientAddress } = useLocalSearchParams();
  if (__DEV__) console.log("txHash", txHash, blockchain, amount, symbol, recipientAddress);
  const chain = blockchain as string;
  let currentChain = "";
  chain == Chains.Solana ? (currentChain = "solana") : (currentChain = "ethereum");
  const activeIndex = useSelector(
    (state: RootState) => state[chain]?.activeIndex ?? 0
  );

  const importedEvmAddress = useSelector((state: RootState) => state.importedAccounts?.activeEvmAddress);
  const importedSolAddress = useSelector((state: RootState) => state.importedAccounts?.activeSolAddress);

  const transactionConfirmation = useSelector((state: RootState) => {
  // ---------- SOLANA ----------
  if (currentChain === Chains.Solana) {
    const solanaState = state[chain];
    const account = importedSolAddress
      ? solanaState?.addresses?.find(a => a.address === importedSolAddress)
      : solanaState?.addresses?.[activeIndex];

    if (!account?.transactionConfirmations) return undefined;

    return account.transactionConfirmations.find(
      (tx) => tx.txHash === txHash
    );
  }

  // ---------- EVM ----------
  if (currentChain === Chains.EVM) {
    const ethereum = state.ethereum;
    const account = importedEvmAddress
      ? ethereum.globalAddresses?.find(a => a.address?.toLowerCase() === importedEvmAddress.toLowerCase())
      : ethereum.globalAddresses?.[ethereum.activeIndex ?? 0];
    if (!account?.transactionConfirmations) return undefined;

    return account.transactionConfirmations.find(
      (tx) => tx.txHash === txHash
    );
  }

  return undefined;
});



  // Get sender addresses for confirmations
  const solSenderAddress = useSelector((state: RootState) => {
    if (importedSolAddress) return importedSolAddress;
    const idx = state.solana.activeIndex ?? 0;
    return state.solana.addresses?.[idx]?.address || "";
  });

  useEffect(() => {
    if (txHash && blockchain) {
      if (currentChain === Chains.EVM) {
        dispatch(
          confirmEvmTransaction({
            chainId:  ChainId,
            txHash: txHash as string,
            fromAddress: importedEvmAddress || undefined,
          })
        );
      }

      if (blockchain === Chains.Solana) {
        dispatch(
          confirmSolanaTransaction({
            txHash: txHash as string,
            fromAddress: solSenderAddress,
          })
        );
      }
    }
  }, [txHash, blockchain, dispatch]);

  const getExplorerUrl = () => {
    if (!txHash) return null;
    if (chain === Chains.EVM) {
      const network = networks[ChainId] || NETWORKS.find((n) => n.chainId === ChainId);
      if (network?.explorerUrl) {
        return `${network.explorerUrl}/tx/${txHash}`;
      }
    } else if (chain === Chains.Solana) {
      return selectedSolanaNetwork === "devnet"
        ? `https://explorer.solana.com/tx/${txHash}?cluster=devnet`
        : `https://explorer.solana.com/tx/${txHash}`;
    }
    return null;
  };

  const getStatusContent = (status: ConfirmationState) => {
    switch (status) {
      case ConfirmationState.Pending:
        return (
          <>
            <Loader size={60} color={theme.colors.white} />
            <LoaderContainer>
               <Title style={{ marginTop: 20 }}>Waiting for Confirmation</Title>
               <SuccessSubtitle>
                 Please wait while we confirm your transaction on the blockchain.
               </SuccessSubtitle>
            </LoaderContainer>
          </>
        );
      case ConfirmationState.Confirmed:
        return (
          <>
            <IconContainer>
               <Circle bgColor="#22c55e">
                 <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                   <Path d="m6 12 4 4 8-8" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                 </Svg>
               </Circle>
            </IconContainer>
            <Title>Sent!</Title>
            <SuccessSubtitle>
              {amount} {symbol} was successfully sent to{"\n"}
              {truncateWalletAddress(recipientAddress as string)}
            </SuccessSubtitle>
            <ViewTransactionLink onPress={() => {
              const url = getExplorerUrl();
              if (url) Linking.openURL(url);
            }}>
               <ViewTransactionText>View transaction</ViewTransactionText>
            </ViewTransactionLink>
          </>
        );
      case ConfirmationState.Failed:
        return (
          <>
            <IconContainer>
               <Circle bgColor="#ef4444">
                 <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                   <Path d="M18 6L6 18M6 6l12 12" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                 </Svg>
               </Circle>
            </IconContainer>
            <Title>Failed</Title>
            <SuccessSubtitle>
              Transaction could not be completed.{"\n"}
              Please check your balance and try again.
            </SuccessSubtitle>
          </>
        );
      default:
        return (
          <>
            <Loader size={60} color={theme.colors.white} />
            <LoaderContainer>
               <Title style={{ marginTop: 20 }}>Initializing...</Title>
               <SuccessSubtitle>
                 Please wait while we initiate your transaction confirmation.
               </SuccessSubtitle>
            </LoaderContainer>
          </>
        );
    }
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        <ContentContainer>
          <TextContainer>
            { getStatusContent(transactionConfirmation?.status ?? "PENDING")
}
          </TextContainer>
        </ContentContainer>
        <ButtonContainer>
          <Button
            backgroundColor={theme.colors.primary}
            color={theme.colors.realWhite}
            onPress={() => router.replace("/")}
            title="Close"
          />
        </ButtonContainer>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}
