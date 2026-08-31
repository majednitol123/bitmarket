import { useState } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { router } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import solanaService from "../../../services/SolanaService";
import Button from "../../../components/Button/Button";
import { ThemeType } from "../../../styles/theme";
import { saveAddresses } from "../../../store/ethereumSlice"
import { saveSolanaAddresses } from "../../../store/solanaSlice";
import type { AddressState, SAddressState } from "../../../store/types";
import { GeneralStatus } from "../../../store/types";
import { ROUTES } from "../../../constants/routes";
import WalletIcon from "../../../assets/svg/wallet.svg";
import ShieldIcon from "../../../assets/svg/shield.svg";
import CoinsIcon from "../../../assets/svg/coins.svg";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import { EVMService } from "../../../services/EthereumService";
import { RootState } from "../../../store";
import { useIsFocused } from "expo-router/react-navigation";
import { MotiView } from "moti";


const SafeAreaContainer = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-end;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding-horizontal: ${(props) => props.theme.spacing.large};
`;

const HeroSection = styled.View`
  align-items: center;
  margin-bottom: 32px;
`;

const IconGrid = styled.View`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
`;

const IconCircle = styled.View<{ theme: ThemeType }>`
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background-color: rgba(240, 185, 11, 0.15);
  justify-content: center;
  align-items: center;
  margin-horizontal: 8px;
`;

const IconCircleSecondary = styled.View<{ theme: ThemeType }>`
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background-color: rgba(240, 185, 11, 0.08);
  justify-content: center;
  align-items: center;
  margin-horizontal: 8px;
`;

const Emoji = styled.Text`
  font-size: 24px;
`;

const EmojiLarge = styled.Text`
  font-size: 28px;
`;

const Title = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 32px;
  color: ${(props) => props.theme.colors.white};
  text-align: center;
  margin-bottom: 12px;
`;

const Subtitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  padding-left: ${(props) => props.theme.spacing.large};
  padding-right: ${(props) => props.theme.spacing.large};
  padding-bottom: ${(props) => props.theme.spacing.large};
  padding-top: ${(props) => props.theme.spacing.small};
`;

const SecondaryButtonContainer = styled.TouchableOpacity<{ theme: ThemeType }>`
  padding: 14px 20px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 12px;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const SecondaryButtonText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.primary};
`;

export default function WalletSetup() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(false);
  const chainId = useSelector(
    (state: RootState) => state.ethereum.activeChainId
  );
  const walletSetup = async () => {
    setLoading(true);
    try {
      const ethWallet = await EVMService.createWallet();
      const masterMnemonicPhrase = ethWallet.mnemonic.phrase;
      const solWallet = await solanaService.restoreWalletFromPhrase(
        masterMnemonicPhrase
      );

      const activeChainId = chainId ?? 1;

      const ethereumAccount: AddressState = {
        accountName: "Account 1",
        derivationPath: `m/44'/60'/0'/0/0`,
        address: ethWallet.address,
        publicKey: ethWallet.publicKey,
        balanceByChain: {
          [activeChainId]: 0,
        },
        statusByChain: {
          [activeChainId]: GeneralStatus.Idle,
        },
        failedNetworkRequestByChain: {
          [activeChainId]: false,
        },
        transactionMetadataByChain: {
          [activeChainId]: {
            paginationKey: undefined,
            transactions: [],
          },
        },
        activeBalance: 0,
        transactionConfirmations: [],
      };

      const solanaAccount: SAddressState = {
        accountName: "Account 1",
        derivationPath: `m/44'/501'/0'/0'`,
        address: solWallet.publicKey.toBase58(),
        publicKey: solWallet.publicKey.toBase58(),
        balance: 0,
        transactionMetadata: {
          paginationKey: undefined,
          transactions: [],
        },
        failedNetworkRequest: false,
        status: GeneralStatus.Idle,
        transactionConfirmations: [],
      };

      dispatch(
        saveAddresses({
          addresses: [ethereumAccount],
        })
      );

      dispatch(saveSolanaAddresses([solanaAccount]));

      router.push({
        pathname: ROUTES.seedPhrase,
        params: { phrase: masterMnemonicPhrase },
      });
    } catch (err) {
      console.error("Failed to create wallet", err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        <ContentContainer>
          <HeroSection>
            <MotiView
              from={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 12, delay: 200 }}
            >
              <IconGrid>
                <MotiView
                  from={{ opacity: 0, translateX: -20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: "timing", duration: 600, delay: 400 }}
                >
                  <IconCircleSecondary>
                    <ShieldIcon color={theme.colors.primary} width={24} height={24} />
                  </IconCircleSecondary>
                </MotiView>

                <View style={{ position: "relative", justifyContent: "center", alignItems: "center" }}>
                  <MotiView
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={isFocused ? { opacity: [0.15, 0.3, 0.15], scale: [1, 1.4, 1] } : { opacity: 0.15, scale: 1 }}
                    transition={{
                      type: "timing",
                      duration: 2000,
                      loop: isFocused,
                      repeatReverse: true,
                    }}

                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: theme.colors.primary,
                        borderRadius: 32,
                        marginHorizontal: 8,
                      },
                    ]}
                  />
                  <IconCircle>
                    <WalletIcon 
                      color={theme.colors.primary} 
                      width={32} 
                      height={32} 
                      fill="transparent" 
                      stroke={theme.colors.primary} 
                      strokeWidth={2} 
                    />
                  </IconCircle>
                </View>

                <MotiView
                  from={{ opacity: 0, translateX: 20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: "timing", duration: 600, delay: 400 }}
                >
                  <IconCircleSecondary>
                    <CoinsIcon color={theme.colors.primary} width={24} height={24} />
                  </IconCircleSecondary>
                </MotiView>
              </IconGrid>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 800, delay: 600 }}
            >
              <Title>Own Your Digital Future</Title>
              <Subtitle>
                Take absolute control of your assets with a secure,
                non-custodial gateway. Your keys, your crypto.
              </Subtitle>
            </MotiView>
          </HeroSection>
        </ContentContainer>

        <MotiView
          from={{ opacity: 0, translateY: 40 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 800, delay: 800 }}
        >
          <ButtonContainer>
            <Button
              backgroundColor={theme.colors.primary}
              color={theme.colors.realWhite}
              loading={loading}
              disabled={loading}
              onPress={walletSetup}
              title="Create Wallet"
              icon={
                <WalletIcon width={25} height={25} fill={theme.colors.realWhite} />
              }
            />
            <SecondaryButtonContainer
              onPress={() => router.push(ROUTES.walletImportOptions)}
            >
              <SecondaryButtonText>
                Already have a wallet? Restore it
              </SecondaryButtonText>
            </SecondaryButtonContainer>
          </ButtonContainer>
        </MotiView>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}

const styles = StyleSheet.create({}); // For absoluteFill usage if needed, though styled covers most
import { StyleSheet } from "react-native";
