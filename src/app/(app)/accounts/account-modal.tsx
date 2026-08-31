import { router } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { useSelector, useDispatch } from "react-redux";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as SecureStore from "expo-secure-store";
import Toast from "react-native-toast-message";
import { useState } from "react";
import { Alert, View, Modal, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, TouchableOpacity, ActivityIndicator } from "react-native";
import { ROUTES } from "../../../constants/routes";
import type { ThemeType } from "../../../styles/theme";
import type { RootState, AppDispatch } from "../../../store";
import type { AddressState, SAddressState } from "../../../store/types";
import EditIcon from "../../../assets/svg/edit.svg";
import { BlockchainIcon } from "../../../components/BlockchainIcon/BlockchainIcon";
import CopyIcon from "../../../assets/svg/copy.svg";
import { SafeAreaContainer } from "../../../components/Styles/Layout.styles";
import { authenticateBiometric } from "../../../store/biometricsSlice";
import { deriveEthPrivateKey, deriveSolPrivateKey } from "../../../utils/privateKeyUtils";
import { getImportedEvmKey, getImportedSolKey } from "../../../utils/importedKeyStorage";
import { updateAccountName } from "../../../store/ethereumSlice";
import { updateSolanaAccountName } from "../../../store/solanaSlice";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import BlockieAvatar from "../../../components/BlockieAvatar/BlockieAvatar";

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-start;
  padding: ${(props) => props.theme.spacing.medium};
  padding-top: 60px;
`;
const SectionTitle = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.fonts.colors.primary};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.header};
  margin-bottom: ${(props) => props.theme.spacing.large};
  margin-top: ${(props) => props.theme.spacing.medium};
  margin-left: ${(props) => props.theme.spacing.medium};
`;

const AccountDetailsText = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.fonts.colors.primary};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  margin-left: ${(props) => props.theme.spacing.medium};
`;

const AccountSettingsContainer = styled.View<{ theme: ThemeType }>`
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const AccountSection = styled.View<{
  theme: ThemeType;
  isBottom?: boolean;
  isTop?: boolean;
}>`
  background-color: ${({ theme }) => theme.colors.cardBackground};
  padding: 16px 20px;
  border-bottom-left-radius: ${({ theme, isBottom }) =>
    isBottom ? "16px" : "0px"};
  border-bottom-right-radius: ${({ theme, isBottom }) =>
    isBottom ? "16px" : "0px"};
  border-top-left-radius: ${({ theme, isTop }) =>
    isTop ? "16px" : "0px"};
  border-top-right-radius: ${({ theme, isTop }) =>
    isTop ? "16px" : "0px"};
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const CryptoSection = styled.View<{
  theme: ThemeType;
  isBottom?: boolean;
  isTop?: boolean;
}>`
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  padding: 16px 20px;
  border-bottom-left-radius: ${({ theme, isBottom }) =>
    isBottom ? "16px" : "0px"};
  border-bottom-right-radius: ${({ theme, isBottom }) =>
    isBottom ? "16px" : "0px"};
  border-top-left-radius: ${({ theme, isTop }) =>
    isTop ? "16px" : "0px"};
  border-top-right-radius: ${({ theme, isTop }) =>
    isTop ? "16px" : "0px"};
  border: 1px solid ${(props) => props.theme.colors.border};
`;

const CryptoName = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.colors.white};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  margin-left: ${(props) => props.theme.spacing.small};
`;

const SectionCaption = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.colors.lightGrey};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  margin-left: ${(props) => props.theme.spacing.medium};
  margin-bottom: ${(props) => props.theme.spacing.small};
`;

const IconContainer = styled.View<{ theme: ThemeType }>`
  margin-left: ${(props) => props.theme.spacing.medium};
`;

const Row = styled.View`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const Col = styled.View`
  display: flex;
  flex-direction: column;
`;

const IconOnPressView = styled.TouchableOpacity`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 50px;
`;

const RevealButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 8px;
  padding: 8px 16px;
  margin-left: 12px;
`;

const RevealButtonText = styled.Text<{ theme: ThemeType }>`
  color: ${({ theme }) => theme.colors.realWhite};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 12px;
`;

const AccountsModalIndex = () => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const { ethAddress, solAddress, balance } = useLocalSearchParams();
  const chainId = useSelector(
    (state: RootState) => state.ethereum.activeChainId
  );
  if (__DEV__) console.log("acc-model8686", chainId);

  const ethereumAccount = useSelector((state: RootState) => {
    return state.ethereum.globalAddresses.find(
      (item: AddressState) => item.address === ethAddress
    );
  });

  const solanaAccount = useSelector((state: RootState) =>
    state.solana.addresses.find(
      (item: SAddressState) => item.address === solAddress
    )
  );

  const importedAccount = useSelector((state: RootState) =>
    state.importedAccounts?.accounts?.find(
      (acc) =>
        (ethAddress && typeof ethAddress === "string" && acc.evmAddress?.toLowerCase() === ethAddress.toLowerCase()) ||
        (solAddress && typeof solAddress === "string" && acc.solAddress === solAddress)
    )
  );

  const isImported = !!importedAccount;

  // Get account indices for private key derivation (seed-based only)
  const ethIndex = useSelector((state: RootState) =>
    state.ethereum.globalAddresses.findIndex(
      (item: AddressState) => item.address === ethAddress
    )
  );

  // Biometric availability from store
  const { biometricAvailable } = useSelector((state: RootState) => state.biometrics);

  // Private key reveal state
  const [ethKeyRevealed, setEthKeyRevealed] = useState(false);
  const [solKeyRevealed, setSolKeyRevealed] = useState(false);
  const [ethPrivateKey, setEthPrivateKey] = useState("");
  const [solPrivateKey, setSolPrivateKey] = useState("");
  const [isEthLoading, setIsEthLoading] = useState(false);
  const [isSolLoading, setIsSolLoading] = useState(false);
  // Password verification modal state
  const [pendingType, setPendingType] = useState<"eth" | "sol" | null>(null);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);

  };

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [accountNameInput, setAccountNameInput] = useState("");
  const [editError, setEditError] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleSaveName = () => {
    Keyboard.dismiss();
    setEditError("");

    const trimmedName = accountNameInput.trim();

    if (!trimmedName) {
      setEditError("Account name cannot be empty");
      return;
    }

    if (trimmedName.length >= 27) {
      setEditError("Account name is too long");
      return;
    }

    if (solanaAccount) {
      dispatch(
        updateSolanaAccountName({
          accountName: trimmedName,
          solAddress: solanaAccount.address,
        })
      );
    }
    if (ethereumAccount) {
      dispatch(
        updateAccountName({
          accountName: trimmedName,
          address: ethereumAccount.address,
        })
      );
    }

    setIsEditModalVisible(false);
  };

  const revealKey = async (type: "eth" | "sol") => {
    if (type === "eth") {
      setIsEthLoading(true);
      try {
        if (isImported && ethAddress) {
          const key = await getImportedEvmKey(ethAddress as string);
          if (key) {
            setEthPrivateKey(key);
            setEthKeyRevealed(true);
          } else {
            Alert.alert("Error", "Failed to retrieve imported private key");
          }
        } else {
          const key = await deriveEthPrivateKey(ethIndex);
          if (key) {
            setEthPrivateKey(key);
            setEthKeyRevealed(true);
          } else {
            Alert.alert("Error", "Failed to derive private key");
          }
        }
      } finally {
        setIsEthLoading(false);
      }
    } else {
      setIsSolLoading(true);
      try {
        if (isImported && solAddress) {
          const key = await getImportedSolKey(solAddress as string);
          if (key) {
            setSolPrivateKey(key);
            setSolKeyRevealed(true);
          } else {
            Alert.alert("Error", "Failed to retrieve imported private key");
          }
        } else {
          const key = await deriveSolPrivateKey(solanaAccount?.derivationPath ?? "");
          if (key) {
            setSolPrivateKey(key);
            setSolKeyRevealed(true);
          } else {
            Alert.alert("Error", "Failed to derive private key");
          }
        }
      } finally {
        setIsSolLoading(false);
      }
    }
  };

  const handleVerifyPassword = async () => {
    Keyboard.dismiss();
    setPasswordError("");

    if (!enteredPassword) {
      setPasswordError("Password cannot be empty");
      return;
    }

    try {
      const savedPassword = await SecureStore.getItemAsync("WALLET_PASSWORD");
      if (savedPassword === enteredPassword) {
        setIsPasswordModalVisible(false);
        if (pendingType) {
          await revealKey(pendingType);
        }
        setPendingType(null);
        setEnteredPassword("");
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (e) {
      setPasswordError("Failed to verify password.");
    }
  };

  const authenticateAndReveal = async (type: "eth" | "sol") => {
    setPendingType(type);
    setPasswordError("");
    setEnteredPassword("");

    if (biometricAvailable) {
      try {
        const result = await dispatch(authenticateBiometric()).unwrap();
        if (result) {
          await revealKey(type);
          setPendingType(null);
        }
      } catch (error) {
        // Fallback to password authentication if biometric fails / cancelled
        setIsPasswordModalVisible(true);
      }
    } else {
      // If biometric sensor does not exist / not available, directly show password modal
      setIsPasswordModalVisible(true);
    }
  };

  // Build display objects for imported accounts
  const displayEthAccount = ethereumAccount || (ethAddress ? {
    accountName: importedAccount?.accountName || "Imported Account",
    address: ethAddress,
  } as AddressState : undefined);

  const displaySolAccount = solanaAccount || (solAddress ? {
    accountName: importedAccount?.accountName || "Imported Account",
    address: solAddress,
  } as SAddressState : undefined);

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer>
        <ContentContainer>

          <AccountSettingsContainer>
            <AccountSection isTop>
              <Row>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <BlockieAvatar
                    address={(ethAddress as string) || (solAddress as string) || ""}
                    size={44}
                    borderWidth={2}
                    borderColor={theme.colors.border}
                  />
                  <Col style={{ marginLeft: 12, flex: 1 }}>
                    <SectionCaption>Account Name</SectionCaption>
                    <AccountDetailsText>
                      {displayEthAccount?.accountName || displaySolAccount?.accountName || "Account"}
                    </AccountDetailsText>
                  </Col>
                </View>
                {!isImported && (
                  <IconOnPressView
                    onPress={() => {
                      const currentName = displayEthAccount?.accountName || displaySolAccount?.accountName || "";
                      setAccountNameInput(currentName);
                      setEditError("");
                      setIsEditModalVisible(true);
                    }}
                  >
                    <EditIcon width={24} height={24} fill={theme.colors.white} />
                  </IconOnPressView>
                )}
              </Row>
            </AccountSection>
            <AccountSection isBottom>
              <SectionCaption>Total Balance</SectionCaption>
              <AccountDetailsText>{balance}</AccountDetailsText>
            </AccountSection>
          </AccountSettingsContainer>

          <SectionTitle>Account Private Key</SectionTitle>

          {ethAddress && (
              <AccountSettingsContainer>
                <CryptoSection isTop>
                  <IconContainer>
                    <BlockchainIcon symbol="eth" size={24} />
                  </IconContainer>
                  <CryptoName>Ethereum</CryptoName>
                </CryptoSection>
                <AccountSection isBottom>
                  <Row>
                    <Col style={{ flex: 1 }}>
                      <SectionCaption>Private Key {isImported ? "(Imported)" : ""}</SectionCaption>
                      <AccountDetailsText
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {ethKeyRevealed
                          ? ethPrivateKey
                          : "••••••••••••••••••••••••••••••••"}
                      </AccountDetailsText>
                    </Col>
                    <Row>
                      {ethKeyRevealed ? (
                        <>
                          <IconOnPressView
                            onPress={() => setEthKeyRevealed(false)}
                          >
                            <AccountDetailsText style={{ fontSize: 12, color: theme.colors.lightGrey }}>
                              HIDE
                            </AccountDetailsText>
                          </IconOnPressView>
                          <IconOnPressView
                            onPress={() => handleCopy(ethPrivateKey)}
                          >
                            <CopyIcon
                              width={20}
                              height={20}
                              fill={theme.colors.white}
                            />
                          </IconOnPressView>
                        </>
                      ) : isEthLoading ? (
                        <View style={{ marginLeft: 12, paddingHorizontal: 12 }}>
                          <ActivityIndicator color={theme.colors.primary} size="small" />
                        </View>
                      ) : (
                        <RevealButton
                          theme={theme}
                          onPress={() => authenticateAndReveal("eth")}
                        >
                          <RevealButtonText theme={theme}>REVEAL</RevealButtonText>
                        </RevealButton>
                      )}
                    </Row>
                  </Row>
                </AccountSection>
              </AccountSettingsContainer>
          )}

          {solAddress && (
              <AccountSettingsContainer>
                <CryptoSection isTop>
                  <IconContainer>
                    <BlockchainIcon symbol="sol" size={24} />
                  </IconContainer>
                  <CryptoName>Solana</CryptoName>
                </CryptoSection>
                <AccountSection isBottom>
                  <Row>
                    <Col style={{ flex: 1 }}>
                      <SectionCaption>Private Key {isImported ? "(Imported)" : ""}</SectionCaption>
                      <AccountDetailsText
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {solKeyRevealed
                          ? solPrivateKey
                          : "••••••••••••••••••••••••••••••••"}
                      </AccountDetailsText>
                    </Col>
                    <Row>
                      {solKeyRevealed ? (
                        <>
                          <IconOnPressView
                            onPress={() => setSolKeyRevealed(false)}
                          >
                            <AccountDetailsText style={{ fontSize: 12, color: theme.colors.lightGrey }}>
                              HIDE
                            </AccountDetailsText>
                          </IconOnPressView>
                          <IconOnPressView
                            onPress={() => handleCopy(solPrivateKey)}
                          >
                            <CopyIcon
                              width={20}
                              height={20}
                              fill={theme.colors.white}
                            />
                          </IconOnPressView>
                        </>
                      ) : isSolLoading ? (
                        <View style={{ marginLeft: 12, paddingHorizontal: 12 }}>
                          <ActivityIndicator color={theme.colors.primary} size="small" />
                        </View>
                      ) : (
                        <RevealButton
                          theme={theme}
                          onPress={() => authenticateAndReveal("sol")}
                        >
                          <RevealButtonText theme={theme}>REVEAL</RevealButtonText>
                        </RevealButton>
                      )}
                    </Row>
                  </Row>
                </AccountSection>
              </AccountSettingsContainer>
          )}
          {isEditModalVisible && (
            <Modal
              visible={isEditModalVisible}
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={() => setIsEditModalVisible(false)}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.75)",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={{ width: "100%", alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: "90%",
                        maxWidth: 420,
                        backgroundColor: theme.colors.lightDark,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        padding: 20,
                      }}
                    >
                      <SectionTitle style={{ marginLeft: 0, marginTop: 0, marginBottom: 16 }}>
                        Edit Account Name
                      </SectionTitle>

                      <TextInput
                        placeholder="Enter account name"
                        placeholderTextColor={theme.colors.grey}
                        value={accountNameInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={(text) => {
                          setAccountNameInput(text);
                          if (editError) setEditError("");
                        }}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        style={{
                          height: 50,
                          borderWidth: 1,
                          borderColor: editError
                            ? theme.colors.error
                            : isInputFocused
                            ? theme.colors.primary
                            : theme.colors.border,
                          paddingHorizontal: 14,
                          borderRadius: 8,
                          color: theme.fonts.colors.primary,
                          backgroundColor: theme.colors.dark,
                          fontSize: 16,
                          fontFamily: theme.fonts.families.openRegular,
                          marginBottom: editError ? 8 : 16,
                        }}
                      />

                      {editError ? (
                        <View style={{ marginBottom: 12 }}>
                          <SectionCaption style={{ color: theme.colors.error, marginLeft: 0, marginBottom: 0, fontSize: 13 }}>
                            {editError}
                          </SectionCaption>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <TouchableOpacity
                          onPress={() => setIsEditModalVisible(false)}
                          style={{
                            flex: 1,
                            height: 50,
                            backgroundColor: theme.colors.cardBackground,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                            borderRadius: 8,
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 10,
                          }}
                        >
                          <AccountDetailsText style={{ fontSize: 14, marginLeft: 0, color: theme.colors.lightGrey }}>
                            Cancel
                          </AccountDetailsText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={handleSaveName}
                          style={{
                            flex: 1,
                            height: 50,
                            backgroundColor: theme.colors.primary,
                            borderRadius: 8,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <AccountDetailsText style={{ fontSize: 14, marginLeft: 0, color: theme.colors.realWhite }}>
                            Save
                          </AccountDetailsText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </KeyboardAvoidingView>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
          {isPasswordModalVisible && (
            <Modal
              visible={isPasswordModalVisible}
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={() => {
                setIsPasswordModalVisible(false);
                setPendingType(null);
              }}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.75)",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={{ width: "100%", alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: "90%",
                        maxWidth: 420,
                        backgroundColor: theme.colors.lightDark,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        padding: 20,
                      }}
                    >
                      <SectionTitle style={{ marginLeft: 0, marginTop: 0, marginBottom: 8 }}>
                        Confirm Password
                      </SectionTitle>

                      <SectionCaption style={{ marginLeft: 0, marginBottom: 16, color: theme.colors.lightGrey }}>
                        Enter your wallet password to reveal the private key.
                      </SectionCaption>

                      <TextInput
                        placeholder="Enter password"
                        placeholderTextColor={theme.colors.grey}
                        value={enteredPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={(text) => {
                          setEnteredPassword(text);
                          if (passwordError) setPasswordError("");
                        }}
                        onFocus={() => setIsPasswordInputFocused(true)}
                        onBlur={() => setIsPasswordInputFocused(false)}
                        style={{
                          height: 50,
                          borderWidth: 1,
                          borderColor: passwordError
                            ? theme.colors.error
                            : isPasswordInputFocused
                            ? theme.colors.primary
                            : theme.colors.border,
                          paddingHorizontal: 14,
                          borderRadius: 8,
                          color: theme.fonts.colors.primary,
                          backgroundColor: theme.colors.dark,
                          fontSize: 16,
                          fontFamily: theme.fonts.families.openRegular,
                          marginBottom: passwordError ? 8 : 16,
                        }}
                      />

                      {passwordError ? (
                        <View style={{ marginBottom: 12 }}>
                          <SectionCaption style={{ color: theme.colors.error, marginLeft: 0, marginBottom: 0, fontSize: 13 }}>
                            {passwordError}
                          </SectionCaption>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <TouchableOpacity
                          onPress={() => {
                            setIsPasswordModalVisible(false);
                            setPendingType(null);
                          }}
                          style={{
                            flex: 1,
                            height: 50,
                            backgroundColor: theme.colors.cardBackground,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                            borderRadius: 8,
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 10,
                          }}
                        >
                          <AccountDetailsText style={{ fontSize: 14, marginLeft: 0, color: theme.colors.lightGrey }}>
                            Cancel
                          </AccountDetailsText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={handleVerifyPassword}
                          style={{
                            flex: 1,
                            height: 50,
                            backgroundColor: theme.colors.primary,
                            borderRadius: 8,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <AccountDetailsText style={{ fontSize: 14, marginLeft: 0, color: theme.colors.realWhite }}>
                            Confirm
                          </AccountDetailsText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </KeyboardAvoidingView>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
        </ContentContainer>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
};

export default AccountsModalIndex;
