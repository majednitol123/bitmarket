import { useState } from "react";
import { router } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  View,
  TextInput,
  Alert,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  InteractionManager,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { ThemeType } from "../../../styles/theme";
import { SafeAreaContainer } from "../../../components/Styles/Layout.styles";
import Button from "../../../components/Button/Button";
import { AppDispatch, RootState, store } from "../../../store";
import {
  addImportedEvmAccount,
  addImportedSolAccount,
  setActiveImportedAccount,
} from "../../../store/importedAccountSlice";
import {
  addAddress,
  fetchEvmBalance,
  fetchEvmTransactions,
} from "../../../store/ethereumSlice";
import {
  updateSolanaAddresses,
  fetchSolanaBalance,
  fetchSolanaTransactions,
} from "../../../store/solanaSlice";
import { GeneralStatus } from "../../../store/types";
import {
  getEvmAddressFromPrivateKey,
  getSolAddressFromPrivateKey,
  storeImportedEvmKey,
  storeImportedSolKey,
} from "../../../utils/importedKeyStorage";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";

const ScrollContainer = styled(KeyboardAwareScrollView)`
  flex: 1;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.medium};
`;

const HeaderTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${({ theme }) => theme.fonts.families.openBold};
  font-size: ${({ theme }) => theme.fonts.sizes.title};
  color: ${({ theme }) => theme.colors.white};
  margin-bottom: 24px;
`;

const Label = styled.Text<{ theme: ThemeType }>`
  font-family: ${({ theme }) => theme.fonts.families.openBold};
  font-size: ${({ theme }) => theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.lightGrey};
  margin-bottom: 8px;
  margin-top: 16px;
`;

const ChainSelector = styled.View`
  flex-direction: row;
  margin-bottom: 16px;
  gap: 12px;
`;

const ChainButton = styled.TouchableOpacity<{
  theme: ThemeType;
  isActive: boolean;
}>`
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  background-color: ${({ theme, isActive }) =>
    isActive ? theme.colors.primary : theme.colors.cardBackground};
  border: 1px solid
    ${({ theme, isActive }) =>
      isActive ? theme.colors.primary : theme.colors.border};
  align-items: center;
`;

const ChainButtonText = styled.Text<{ theme: ThemeType; isActive: boolean }>`
  font-family: ${({ theme }) => theme.fonts.families.openBold};
  font-size: ${({ theme }) => theme.fonts.sizes.normal};
  color: ${({ theme, isActive }) =>
    isActive ? theme.colors.realWhite : theme.colors.white};
`;

const Input = styled.TextInput<{ theme: ThemeType }>`
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border-radius: 12px;
  padding: 16px;
  color: ${({ theme }) => theme.colors.white};
  font-family: ${({ theme }) => theme.fonts.families.openRegular};
  font-size: ${({ theme }) => theme.fonts.sizes.normal};
  border: 1px solid ${({ theme }) => theme.colors.border};
  min-height: 100px;
  text-align-vertical: top;
`;

const WarningBox = styled.View<{ theme: ThemeType }>`
  background-color: rgba(255, 185, 0, 0.1);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 185, 0, 0.3);
`;

const WarningText = styled.Text<{ theme: ThemeType }>`
  font-family: ${({ theme }) => theme.fonts.families.openRegular};
  font-size: ${({ theme }) => theme.fonts.sizes.small};
  color: ${({ theme }) => theme.colors.primary};
  line-height: 20px;
`;

const BottomContainer = styled.View<{ theme: ThemeType }>`
  padding: ${({ theme }) => theme.spacing.medium};
  padding-bottom: 32px;
`;

export default function ImportPrivateKeyScreen() {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const importedAccounts = useSelector(
    (state: RootState) => state.importedAccounts?.accounts ?? []
  );
  const ethAccounts = useSelector(
    (state: RootState) => state.ethereum.globalAddresses ?? []
  );
  const solAccounts = useSelector(
    (state: RootState) => state.solana.addresses ?? []
  );
  const importedAccountsCount = importedAccounts.length;
  const nextId = useSelector(
    (state: RootState) => state.importedAccounts?.nextId ?? importedAccountsCount + 1
  );
  const [selectedChain, setSelectedChain] = useState<"evm" | "sol">("evm");
  const [privateKey, setPrivateKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Determine the correct account name for the import.
   * If an existing imported account is missing this chain type,
   * the reducer will merge into it — so reuse its name.
   * Otherwise generate a new name.
   */
  const getAccountName = (chainType: "evm" | "sol"): string => {
    const mergeable = importedAccounts.find((acc) =>
      chainType === "evm" ? !acc.evmAddress : !acc.solAddress
    );
    return mergeable
      ? mergeable.accountName
      : `Imported Account ${nextId}`;
  };

  const handleImport = async () => {
    if (!privateKey.trim()) {
      Alert.alert("Error", "Please enter a private key");
      return;
    }

    setIsLoading(true);
    try {
      if (selectedChain === "evm") {
        const address = getEvmAddressFromPrivateKey(privateKey.trim());

        const freshImported = store.getState().importedAccounts?.accounts ?? [];
        // ─── Duplicate check: seed-derived + imported EVM addresses ───
        const allEvmAddresses = [
          ...ethAccounts.map((a) => a.address.toLowerCase()),
          ...freshImported
            .filter((a) => a.evmAddress)
            .map((a) => a.evmAddress!.toLowerCase()),
        ];
        if (allEvmAddresses.includes(address.toLowerCase())) {
          Alert.alert(
            "Duplicate Key",
            "This EVM address is already in your wallet."
          );
          setIsLoading(false);
          return;
        }

        const mergeable = freshImported.find((acc) => !acc.evmAddress);
        const solAddress = mergeable?.solAddress;
        const accountName = mergeable ? mergeable.accountName : `Imported Account ${nextId}`;

        await storeImportedEvmKey(address, privateKey.trim());
        dispatch(addImportedEvmAccount({ address }));
        dispatch(addAddress({
          accountName,
          derivationPath: "",
          address,
          publicKey: address,
          balanceByChain: {},
          statusByChain: {},
          failedNetworkRequestByChain: {},
          transactionMetadataByChain: {},
          transactionConfirmations: [],
        }));
        dispatch(setActiveImportedAccount({ evmAddress: address, solAddress }));

        // Auto-fetch balances & transactions for the newly imported address
        InteractionManager.runAfterInteractions(() => {
          const s = store.getState();
          const evmChainIds = Object.keys(s.ethereum.networks).map(Number);
          const activeChainId = s.ethereum.activeChainId;
          const BATCH = 4;
          (async () => {
            // Fetch active chain balance first
            await dispatch(fetchEvmBalance({ chainId: activeChainId, address })).catch(() => {});
            dispatch(fetchEvmTransactions({ chainId: activeChainId, address })).catch(() => {});
            // Then fetch remaining chains in batches
            const others = evmChainIds.filter(id => id !== activeChainId);
            for (let i = 0; i < others.length; i += BATCH) {
              await Promise.all(
                others.slice(i, i + BATCH).map(chainId =>
                  dispatch(fetchEvmBalance({ chainId, address })).catch(() => {})
                )
              );
            }
          })();
        });

        Alert.alert("Success", `EVM account imported\nAddress: ${address}`, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        const address = getSolAddressFromPrivateKey(privateKey.trim());

        const freshImported = store.getState().importedAccounts?.accounts ?? [];
        // ─── Duplicate check: seed-derived + imported Solana addresses ───
        const allSolAddresses = [
          ...solAccounts.map((a) => a.address),
          ...freshImported
            .filter((a) => a.solAddress)
            .map((a) => a.solAddress!),
        ];
        if (allSolAddresses.includes(address)) {
          Alert.alert(
            "Duplicate Key",
            "This Solana address is already in your wallet."
          );
          setIsLoading(false);
          return;
        }

        const mergeable = freshImported.find((acc) => !acc.solAddress);
        const evmAddress = mergeable?.evmAddress;
        const accountName = mergeable ? mergeable.accountName : `Imported Account ${nextId}`;

        await storeImportedSolKey(address, privateKey.trim());
        dispatch(addImportedSolAccount({ address }));
        dispatch(updateSolanaAddresses({
          accountName,
          derivationPath: "",
          address,
          publicKey: address,
          balance: 0,
          status: GeneralStatus.Idle,
          failedNetworkRequest: false,
          transactionMetadata: { paginationKey: undefined, transactions: [] },
          transactionConfirmations: [],
        }));
        dispatch(setActiveImportedAccount({ evmAddress, solAddress: address }));

        // Auto-fetch balance & transactions for the newly imported Solana address
        InteractionManager.runAfterInteractions(() => {
          dispatch(fetchSolanaBalance(address)).catch(() => {});
          dispatch(fetchSolanaTransactions(address)).catch(() => {});
        });

        Alert.alert("Success", `Solana account imported\nAddress: ${address}`, [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
      setPrivateKey("");
    } catch (error: any) {
      Alert.alert("Import Failed", error.message || "Invalid private key");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer edges={["bottom", "left", "right"]} style={{ flex: 1, width: "100%" }}>
        <ScrollContainer
          contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={60}
        >
          <ContentContainer style={{ paddingTop: insets.top + 60 }}>

            <WarningBox theme={theme}>
              <WarningText theme={theme}>
                ⚠️ Warning: Importing a private key gives this wallet full
                control over that account. Never share your private keys with
                anyone.
              </WarningText>
            </WarningBox>

            <Label theme={theme}>Select Chain</Label>
            <ChainSelector>
              <ChainButton
                theme={theme}
                isActive={selectedChain === "evm"}
                onPress={() => setSelectedChain("evm")}
              >
                <ChainButtonText theme={theme} isActive={selectedChain === "evm"}>
                  Ethereum / EVM
                </ChainButtonText>
              </ChainButton>
              <ChainButton
                theme={theme}
                isActive={selectedChain === "sol"}
                onPress={() => setSelectedChain("sol")}
              >
                <ChainButtonText theme={theme} isActive={selectedChain === "sol"}>
                  Solana
                </ChainButtonText>
              </ChainButton>
            </ChainSelector>

            <Label theme={theme}>
              Private Key ({selectedChain === "evm" ? "0x..." : "hex or base58"})
            </Label>
            <Input
              theme={theme}
              multiline
              placeholder="Paste your private key here..."
              placeholderTextColor={theme.colors.lightGrey}
              value={privateKey}
              onChangeText={setPrivateKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </ContentContainer>

          <BottomContainer theme={theme}>
            <Button
              title="Continue"
              onPress={handleImport}
              loading={isLoading}
              backgroundColor={theme.colors.primary}
              color={theme.colors.realWhite}
            />
          </BottomContainer>
        </ScrollContainer>
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
}
