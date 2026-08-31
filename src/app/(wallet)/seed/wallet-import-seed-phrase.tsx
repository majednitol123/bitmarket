import React, { useState } from "react";
import { Dimensions, Keyboard, Platform, StyleSheet, View, Text, TextInput, TouchableOpacity } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components/native";
import { useTheme } from "styled-components/native";
import solanaService from "../../../services/SolanaService";
import { ThemeType } from "../../../styles/theme";
import {
  saveSolanaAddresses,
  fetchSolanaBalance,
  fetchSolanaTransactions,
} from "../../../store/solanaSlice";
import {
  saveAddresses,
  fetchEvmBalance,
  fetchEvmTransactions,
} from "../../../store/ethereumSlice";
import { GeneralStatus } from "../../../store/types";
import type { AddressState, SAddressState } from "../../../store/types";
import type { AppDispatch, RootState } from "../../../store";
import Button from "../../../components/Button/Button";
import { ROUTES } from "../../../constants/routes";
import { savePhrase } from "../../../hooks/useStorageState";
import { Title, Subtitle } from "../../../components/Styles/Text.styles";
import {
  ErrorTextCenter,
  ErrorTextContainer,
} from "../../../components/Styles/Errors.styles";
import { evmServices } from "../../../services/EthereumService";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import { MotiView } from "moti";

interface SeedTextInputProps {
  theme: ThemeType;
  isInputFocused: boolean;
}

const isAndroid = Platform.OS === "android";

const SafeAreaContainer = styled(SafeAreaView)<{ theme: ThemeType }>`
  flex: 1;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: ${(props) => props.theme.spacing.medium};
  margin-top: ${(props) => isAndroid ? props.theme.spacing.huge : '0px'};
`;

const TextContainer = styled.View<{ theme: ThemeType }>`
  margin-bottom: ${(props) => props.theme.spacing.huge};
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  padding-left: ${(props) => props.theme.spacing.large};
  padding-right: ${(props) => props.theme.spacing.large};
  padding-bottom: ${(props) => props.theme.spacing.large};
  padding-top: ${(props) => props.theme.spacing.small};
  width: 100%;
`;

const SeedTextInput = styled.TextInput<SeedTextInputProps>`
  justify-content: flex-start;
  padding: ${(props) => props.theme.spacing.large};
  margin: ${(props) => props.theme.spacing.large};
  background-color: ${(props) => props.theme.colors.dark};
  border-radius: ${(props) => props.theme.borderRadius.extraLarge};
  width: ${(Dimensions.get("window").width - 80).toFixed(0)}px;
  color: ${(props) => props.theme.colors.white};
  font-size: ${(props) => props.theme.fonts.sizes.large};\
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  border: 1px solid
    ${({ theme, isInputFocused }) =>
      isInputFocused ? theme.colors.primary : theme.colors.grey};
`;

const InfoContainer = styled.View<{ theme: ThemeType }>`
  justify-content: center;
  flex-direction: column;
  align-items: center;
  background-color: rgba(240, 185, 11, 0.1);
  border: 1px solid rgba(240, 185, 11, 0.3);
  border-radius: ${(props) => props.theme.borderRadius.large};
  padding: ${(props) => props.theme.spacing.large};
  margin-bottom: ${(props) => props.theme.spacing.large};
`;

const InfoTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  color: ${(props) => props.theme.colors.primary};
  margin-bottom: 5px;
`;

const InfoText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
`;

const captionsArr: string[] = [
  "We're fetching your wallet details...",
  "Importing wallet securely...",
  "Syncing with the blockchain...",
];

const titleArr: string[] = [
  "Hang tight!",
  "This might take a minute.",
  "Almost there!",
];

export default function Page() {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const [textValue, setTextValue] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [captions, setCaptions] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [isInputFocused, setInputFocused] = useState(false);
const activeChainId = useSelector(
  (state: RootState) => state.ethereum.activeChainId
);
  const service = evmServices[activeChainId];
  if (!service) {
  throw new Error(`EVM service not initialized for chain ${activeChainId}`);
}
  const setCaptionsInterval = () => {
    setTitle(titleArr[0]);
    setCaptions(captionsArr[0]);
    let interval: NodeJS.Timeout = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * captionsArr.length);
      setTitle(titleArr[randomIndex]);
      setCaptions(captionsArr[randomIndex]);
    }, 8000);
    return () => {
      clearInterval(interval);
      setTitle("");
      setCaptions("");
    };
  };

  const handleVerifySeedPhrase = async () => {
    Keyboard.dismiss();
    setLoading(true);
    setError("");

    const errorText =
      "Looks like the seed phrase is incorrect. Please try again.";
    const phraseTextValue = textValue.trimEnd();
    if (phraseTextValue.split(" ").length !== 12) {
      setError(errorText);
      setLoading(false);
      return;
    }

    // Schedule the heavy wallet import / key derivation process in a setTimeout
    // macro-task. This lets the JS event loop yield back to React, ensuring the UI
    // immediately renders the button in loading/disabled state before thread blocking starts.
    setTimeout(async () => {
      const captionsInterval = setCaptionsInterval();
      try {
        // Logic is needed to find the crypto currency with the highest amount of accounts created
        // and using that index to create the same amount of addresses via hd wallets
        let highestIndex = 0;
        const unusedEthIndex = await service.findNextUnusedWalletIndex(
          phraseTextValue
        );

        const unusedSolIndex = await solanaService.findNextUnusedWalletIndex(
          phraseTextValue
        );

        highestIndex = Math.max(unusedEthIndex, unusedSolIndex);
        const importedEthWallets = await service.importAllActiveAddresses(
          phraseTextValue,
          highestIndex
        );

        const importedSolWallets = await solanaService.importAllActiveAddresses(
          phraseTextValue,
          highestIndex
        );

        const transformedActiveEthAddresses: AddressState[] =
          importedEthWallets.map((info, index) => ({
            accountName: `Account ${index + 1}`,
            derivationPath: info.derivationPath,
            address: info.address,
            publicKey: info.publicKey,

            balanceByChain: {},
            statusByChain: {},
            failedNetworkRequestByChain: {},
            transactionMetadataByChain: {},

            activeBalance: 0,
            transactionConfirmations: [],
          }));

        const transformedActiveSolAddresses: SAddressState[] =
          importedSolWallets.map((info, index) => {
            return {
              accountName: `Account ${index + 1}`,
              derivationPath: info.derivationPath,
              address: info.publicKey,
              publicKey: info.publicKey,
              balance: 0,
              transactionMetadata: {
                paginationKey: undefined,
                transactions: [],
              },
              failedNetworkRequest: false,
              status: GeneralStatus.Idle,
              transactionConfirmations: [],
            };
          });
        await savePhrase(JSON.stringify(phraseTextValue));

        dispatch(saveAddresses({ addresses: transformedActiveEthAddresses }));
        dispatch(fetchEvmBalance({ chainId: activeChainId, address: transformedActiveEthAddresses[0].address }));
        dispatch(
          fetchEvmTransactions({
            chainId: activeChainId,
            address: transformedActiveEthAddresses[0].address,
          })
        );

        dispatch(saveSolanaAddresses(transformedActiveSolAddresses));
        dispatch(fetchSolanaBalance(transformedActiveSolAddresses[0].address));
        dispatch(
          fetchSolanaTransactions(transformedActiveSolAddresses[0].address)
        );

        router.push({
          pathname: ROUTES.walletCreatedSuccessfully,
          params: { successState: "IMPORTED_WALLET" },
        });
      } catch (err) {
        setError("Failed to import wallet");
        console.error("Failed to import wallet", err);
        setLoading(false);
      } finally {
        captionsInterval();
      }
    }, 200);
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        <KeyboardAwareScrollView
          style={{ width: "100%", flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 50, width: "100%", alignItems: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={60}
        >
          <ContentContainer style={{ width: "100%" }}>
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 200 }}
              style={{ width: "100%" }}
            >
              <TextContainer>
                <Title>Enter Recovery Phrase</Title>
                <Subtitle>
                  Provide your secret 12 or 24-word recovery phrase in the correct
                  order to access your wallet.
                </Subtitle>
              </TextContainer>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 600, delay: 400 }}
              style={{ width: "100%" }}
            >
              <MotiView
                animate={{
                  borderColor: isInputFocused ? theme.colors.primary : theme.colors.border,
                  borderWidth: isInputFocused ? 2 : 1,
                  backgroundColor: isInputFocused ? "rgba(240, 185, 11, 0.05)" : theme.colors.dark,
                  opacity: loading ? 0.6 : 1,
                }}
                transition={{ type: "timing", duration: 200 }}
                style={localStyles.inputWrapper}
              >
                <TextInput
                  style={[localStyles.input, { color: theme.colors.white }]}
                  autoCapitalize="none"
                  multiline
                  returnKeyType="done"
                  value={textValue}
                  onChangeText={setTextValue}
                  placeholder="Type or paste recovery phrase"
                  placeholderTextColor={theme.colors.grey}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  blurOnSubmit
                  onSubmitEditing={() => Keyboard.dismiss()}
                  editable={!loading}
                />
              </MotiView>
            </MotiView>
          </ContentContainer>

          {error && (
            <MotiView
              from={{ opacity: 0, translateY: -10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 250 }}
              style={{ width: "100%" }}
            >
              <ErrorTextContainer>
                <ErrorTextCenter>{error}</ErrorTextCenter>
              </ErrorTextContainer>
            </MotiView>
          )}

          <MotiView
            from={{ opacity: 0, translateY: 40 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 600, delay: 600 }}
            style={{ width: "100%" }}
          >
            <ButtonContainer>
              {title !== "" && captions !== "" && (
                <InfoContainer>
                  <InfoTitle>{title}</InfoTitle>
                  <InfoText>{captions}</InfoText>
                </InfoContainer>
              )}
              <Button
                backgroundColor={theme.colors.primary}
                color={theme.colors.realWhite}
                loading={loading}
                disabled={loading}
                onPress={handleVerifySeedPhrase}
                title="Restore Wallet"
              />
            </ButtonContainer>
          </MotiView>
        </KeyboardAwareScrollView>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}

const localStyles = StyleSheet.create({
  inputWrapper: {
    borderRadius: 24,
    padding: 20,
    width: "100%",
    minHeight: 150,
    justifyContent: "flex-start",
  },
  input: {
    flex: 1,
    fontFamily: "OpenSans-Regular",
    fontSize: 18,
    textAlignVertical: "top",
  }
});
