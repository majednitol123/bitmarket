import { useEffect, useState, ChangeEvent, useRef } from "react";
import { Platform, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useSelector } from "react-redux";
import { router, useLocalSearchParams } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { Formik, FormikProps } from "formik";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ThemeType } from "../../../../styles/theme";
import { TICKERS } from "../../../../constants/tickers";
import { ROUTES } from "../../../../constants/routes";
import type { RootState } from "../../../../store";
import { store } from "../../../../store";
import { Chains } from "../../../../types";
import { BlockchainIcon } from "../../../../components/BlockchainIcon/BlockchainIcon";
import { getChainIconSymbol } from "../../../../utils/getChainIconSymbol";
import NETWORKS from "../../../../services/defaultNetwork";
import { capitalizeFirstLetter } from "../../../../utils/capitalizeFirstLetter";
import { formatDollar } from "../../../../utils/formatDollars";
import solanaService from "../../../../services/SolanaService";
import Button from "../../../../components/Button/Button";
import { SafeAreaContainer } from "../../../../components/Styles/Layout.styles";
import { EVMService, evmServices } from "../../../../services/EthereumService";
import { getPhrase } from "../../../../hooks/useStorageState";
import { getImportedEvmKey } from "../../../../utils/importedKeyStorage";
import QRCodeIcon from "../../../../assets/svg/qr-code.svg";
import { TouchableOpacity } from "react-native";

type FormikChangeHandler = {
  (e: ChangeEvent<any>): void;
  <T = string | ChangeEvent<any>>(field: T): T extends ChangeEvent<any>
    ? void
    : (e: string | ChangeEvent<any>) => void;
};

interface TextInputProps {
  isAddressInputFocused?: boolean;
  isAmountInputFocused?: boolean;
  theme: ThemeType;
}

const ContentContainer = styled(KeyboardAwareScrollView)<{ theme: ThemeType }>`
  flex: 1;
  padding: ${(props) => props.theme.spacing.medium};
  margin-top: ${(props) =>
    Platform.OS === "android" ? props.theme.spacing.huge : "0px"};
`;

const IconView = styled.View<{ theme: ThemeType }>`
  justify-content: center;
  align-items: center;
  margin-bottom: ${(props) => props.theme.spacing.medium};
  width: 100%;
`;

const IconBackground = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 28px;
  width: 80px;
  height: 80px;
  justify-content: center;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const AddressInputContainer = styled.View<TextInputProps>`
  height: 60px;
  flex-direction: row;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border: 1px solid
    ${({ theme, isAddressInputFocused }) =>
      isAddressInputFocused ? theme.colors.primary : theme.colors.border};
  border-radius: 16px;
  padding-right: ${({ theme }) => theme.spacing.medium};
`;

const AddressTextInput = styled.TextInput<TextInputProps>`
  flex: 1;
  height: 60px;
  padding-horizontal: ${({ theme }) => theme.spacing.medium};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  font-family: ${(props) => props.theme.fonts.families.openRegular};
`;

const AmountTextInput = styled.TextInput<TextInputProps>`
  flex: 1;
  color: ${({ theme }) => theme.colors.white};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  padding-horizontal: ${({ theme }) => theme.spacing.medium};
`;

const AmountTextInputContainer = styled.View<TextInputProps>`

  height: 60px;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border: 1px solid
    ${({ theme, isAmountInputFocused }) =>
      isAmountInputFocused ? theme.colors.primary : theme.colors.border};
  border-radius: 16px;
`;

const TextView = styled.View<{ theme: ThemeType }>`
  margin-bottom: ${({ theme }) => theme.spacing.medium};
`;

const TextContainer = styled.View<{ theme: ThemeType }>`
  margin-top: ${(props) => props.theme.spacing.large};
`;

const TransactionDetailsContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  margin-top: 8px;
`;

const TransactionDetailsText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.lightGrey};
`;

const ErrorText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.error};
  margin-bottom: ${(props) => props.theme.spacing.small};
`;

const MaxButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.primary};
  padding: 8px 14px;
  border-radius: 10px;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
`;

const TickerText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  margin-right: ${(props) => props.theme.spacing.medium};
`;

const MaxText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
  text-align: center;
`;

const AmountDetailsView = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  align-items: center;
`;

const FormWrapper = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: space-between;
`;

const FooterContainer = styled.View`
  margin-top: auto;
  padding-top: 24px;
  flex-direction: row;
  gap: 12px;
  align-items: center;
`;

const CancelButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  flex: 1;
  height: 60px;
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 16px;
  align-items: center;
  justify-content: center;
`;


const CancelText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: #ef4444;
`;




interface FormValues {
  address: string;
  amount: string;
}

export default function SendPage() {
  const {
    send,
    toAddress,
    token,
    selectedTokenAddress,
    balance,
    symbol: tokenSymbol,
    Erc20TokenName,
    erc20tokenAddress,
    solAddess,
    chainId,
    nativeTokenSymbol,
    mint,
    decimals,
    isNative,
    logo,
  } = useLocalSearchParams();

  const theme = useTheme();
  const formRef = useRef<FormikProps<FormValues>>(null);
  const params = useLocalSearchParams();

  const tokenParam = (Array.isArray(selectedTokenAddress) ? selectedTokenAddress[0] : selectedTokenAddress) || (Array.isArray(token) ? token[0] : token);
  const tokenSymbolParam = Array.isArray(tokenSymbol)
    ? tokenSymbol[0]
    : tokenSymbol;

  useEffect(() => {
    if (toAddress && formRef.current) {
      formRef.current.setFieldValue("address", toAddress as string);
    }
  }, [toAddress]);

  const activeChainIdRaw = useSelector(
    (state: RootState) => state.ethereum.activeChainId
  );
  const activeChainId = activeChainIdRaw || 1;
  const networks = useSelector(
    (state: RootState) => state.ethereum.networks
  );

  const chainName = send as string;
  let currentChainName = "";
  if (chainName === Chains.Solana) {
    currentChainName = "solana";
  } else {
    currentChainName = "ethereum";
  }

  const toWalletAddress = toAddress as string;
  
  // Robust token detection
  const isNativeParam = isNative === "true";
  const detectedTokenRaw = tokenParam || mint || erc20tokenAddress;
  const detectedToken = Array.isArray(detectedTokenRaw) ? detectedTokenRaw[0] : detectedTokenRaw;
  const isTokenSend = isNative === "false" || (!!detectedToken && !isNativeParam);

  const effectiveChainId = chainId ? Number(chainId) : activeChainId;
  const evmNetwork = networks[effectiveChainId] || NETWORKS.find((n) => n.chainId === effectiveChainId);

  let ticker = TICKERS[currentChainName];
  if (currentChainName === "solana") {
    ticker = isTokenSend ? ((tokenSymbolParam as string) || "SPL") : "SOL";
  } else if (currentChainName === "ethereum") {
    if (isTokenSend) {
      ticker = (tokenSymbolParam as string) || "TOKEN";
    } else {
      ticker = (tokenSymbolParam as string) || (nativeTokenSymbol as string) || evmNetwork?.symbol || "ETH";
    }
  }




  const importedEvmAddress = useSelector(
    (state: RootState) => state.importedAccounts?.activeEvmAddress
  );
  const activeEthIndex = useSelector(
    (state: RootState) => state.ethereum.activeIndex ?? 0
  );

  const service = evmServices[effectiveChainId];
  if (currentChainName === Chains.EVM && !service) {
    console.warn(`EVM service not initialized for chain ${effectiveChainId}`);
  }

  const importedSolAddress = useSelector(
    (state: RootState) => state.importedAccounts?.activeSolAddress
  );
  const activeSolIndex = useSelector(
    (state: RootState) => state.solana.activeIndex
  );

  const tokenBalance = useSelector((state: RootState) => {
    if (currentChainName == "ethereum") {
      if (isTokenSend) {
        // Fallback to balance from params if available for immediate UI response
        const paramBalance = Array.isArray(balance) ? balance[0] : balance;
        if (paramBalance !== undefined && paramBalance !== null && paramBalance !== "") {
          return paramBalance;
        }
        if (detectedToken) {
          const key = `${effectiveChainId}:${(detectedToken as string).toLowerCase()}`;
          return state.erc20.balances[key]?.balance ?? 0;
        }
        return 0;
      }
      // For imported wallets, find by address
      if (importedEvmAddress) {
        const account = state.ethereum.globalAddresses?.find(
          a => a.address?.toLowerCase() === importedEvmAddress.toLowerCase()
        );
        return account?.balanceByChain?.[effectiveChainId] ?? 0;
      }
      const activeEthIndex = state.ethereum.activeIndex ?? 0;
      return state.ethereum.globalAddresses?.[activeEthIndex].balanceByChain[effectiveChainId] ?? 0;
    } else if (currentChainName === "solana") {
      if (isTokenSend) {
        // Fallback to balance from params if available for immediate UI response
        const paramBalance = Array.isArray(balance) ? balance[0] : balance;
        if (paramBalance !== undefined && paramBalance !== null && paramBalance !== "") {
          return paramBalance;
        }

        return state.solToken.balances[detectedToken as string]?.amount ?? 0;
      }
      // For imported wallets, find by address
      if (importedSolAddress) {
        const account = state.solana.addresses?.find(
          a => a.address === importedSolAddress
        );
        return account?.balance ?? 0;
      }
      const activeSolIndex = state.solana.activeIndex ?? 0;
      return state.solana.addresses[activeSolIndex]?.balance ?? 0;
    }
    return undefined;
  });

  const address = useSelector((state: RootState) => {
    if (importedSolAddress) return importedSolAddress;
    return state["solana"]?.addresses[activeSolIndex]?.address;
  });
  const prices = useSelector((state: RootState) => state.price.data);
  const solPrice = prices[101]?.usd ?? 0;
  const ethPrice = prices[activeChainId]?.usd ?? 0;

  const [isAddressInputFocused, setIsAddressInputFocused] = useState(false);
  const [isAmountInputFocused, setIsAmountInputFocused] = useState(false);

  const evmChainName = evmNetwork?.chainName || "Ethereum";

  const renderIcons = () => {
    switch (currentChainName) {
      case Chains.Solana:
        return (
          <BlockchainIcon
            symbol={isTokenSend ? (tokenSymbolParam as string || "spl") : "sol"}
            size={56}
            logoUrl={isTokenSend ? (logo as string) : undefined}
          />
        );
      case Chains.EVM:
        const iconSymbol = tokenSymbolParam
          ? (tokenSymbolParam as string)
          : getChainIconSymbol(
              evmChainName,
              (nativeTokenSymbol as string) || evmNetwork?.symbol || "eth",
              effectiveChainId
            );
        return (
          <BlockchainIcon
            symbol={iconSymbol}
            size={56}
            chainId={isTokenSend ? undefined : effectiveChainId}
            chainName={isTokenSend ? undefined : evmChainName}
            logoUrl={isTokenSend ? (logo as string) : undefined}
          />
        );
      default:
        return null;
    }
  };

  const renderDollarAmount = (amountValue: string) => {
    if (isTokenSend) return "--";
    if (amountValue === "") return formatDollar(0);
    const chainPrice =
      currentChainName === "solana"
        ? solPrice
        : ethPrice;
    const USDAmount = chainPrice * parseFloat(amountValue);
    return formatDollar(USDAmount);
  };

  const handleNumericChange =
    (handleChange: FormikChangeHandler) => (field: string) => {
      return (value: string | ChangeEvent<any>) => {
        const finalValue =
          typeof value === "object" && value.target
            ? value.target.value
            : value;
        const numericValue = finalValue
          .replace(/[^0-9.]/g, "")
          .replace(/(\..*)\./g, "$1");
        handleChange(field)(numericValue);
      };
    };

  const validateFields = async (values: FormValues) => {
    const errors: Record<string, string> = {};
    if (!values.address) errors.address = "This field is required";
    if (!values.amount) errors.amount = "This field is required";
    const isAddressValid = await validateAddress(values.address);
    if (!isAddressValid) errors.address = "Recipient address is invalid";
    if (values.amount && parseFloat(values.amount) > 0) {
      await validateFunds(values, errors);
    }
    return errors;
  };

  const validateAddress = async (address: string): Promise<boolean> => {
    return currentChainName === Chains.EVM
      ? EVMService.validateAddress(address)
      : await solanaService.validateAddress(address);
  };

  const rawBalance = Array.isArray(balance) ? balance[0] : balance;

  const validateFunds = async (
    values: FormValues,
    errors: Record<string, string>
  ) => {
    const amount = parseFloat(values.amount);
    const nativeBalance =
      typeof tokenBalance === "string"
        ? parseFloat(tokenBalance)
        : tokenBalance;
    const erc20Balance = Array.isArray(balance) ? balance[0] : balance;

    if (!isTokenSend) {
      if (amount > Number(nativeBalance)) {
        errors.amount = "Insufficient funds";
      } else {
        await calculateCostsAndValidate(amount, values.address, errors);
      }
    } else {
      if (amount > Number(erc20Balance)) {
        errors.amount = "Insufficient funds";
      } else {
        await calculateCostsAndValidate(amount, values.address, errors);
      }
    }
  };

  const calculateCostsAndValidate = async (
    amount: number,
    toAddress: string,
    errors: Record<string, string>
  ) => {
    if (currentChainName === Chains.EVM) {
      if (!service) {
        errors.amount = "EVM service not initialized";
        return;
      }
      try {
        const globalAddresses = store.getState().ethereum.globalAddresses;
        const fromAddress = importedEvmAddress || globalAddresses?.[activeEthIndex]?.address;

        if (!fromAddress) {
          errors.amount = "Sender wallet address not found";
          return;
        }

        if (isTokenSend) {
          const nativeBalance =
            typeof tokenBalance === "string"
              ? parseFloat(tokenBalance)
              : tokenBalance;

          const gasResult = await service.calculateGasAndAmountsForERC20Transfer(
            fromAddress,
            erc20tokenAddress as string,
            toAddress,
            amount.toString()
          );
          if (!gasResult) {
            errors.amount = "Failed to estimate gas";
            return;
          }
          const gasCostEth = Number(gasResult.gasCostEth);
          if (nativeBalance === undefined) {
            errors.amount = "Unable to load wallet balance";
            return;
          }
          if (gasCostEth > nativeBalance) {
            errors.amount = "Insufficient native balance for gas fees";
            return;
          }
          return;
        }

        const { totalCost } = await service.calculateGasAndAmounts(
          toAddress,
          amount.toString(),
          fromAddress
        );
        const balanceNumber =
          typeof tokenBalance === "string"
            ? parseFloat(tokenBalance)
            : tokenBalance;
            
        if (parseFloat(totalCost) > balanceNumber!) {
          errors.amount = "Insufficient funds for amount plus gas costs";
        }
      } catch (error) {
        console.error("EVM cost validation failed:", error);
        errors.amount = "Failed to validate transaction costs";
      }
    } else if (currentChainName === Chains.Solana) {
      if (isTokenSend) {
        const transactionFeeLamports =
          await solanaService.calculateTransactionFee(address, toAddress, amount);
        const nativeSolBalanceLamports = Math.round(Number(store.getState().solana.addresses[activeSolIndex]?.balance ?? 0) * LAMPORTS_PER_SOL);
        const limits = await solanaService.getSolanaSendLimits(address, transactionFeeLamports, nativeSolBalanceLamports);

        if (limits.isRentLocked) {
          errors.amount = `This account's entire SOL balance is reserved for rent (Nonce Account). Add more SOL to cover fees, or close the account from another wallet.`;
        } else {
          const remainingNativeLamports = nativeSolBalanceLamports - transactionFeeLamports;
          if (remainingNativeLamports > 0 && remainingNativeLamports < limits.rentExemptMinimum) {
            errors.amount = `Insufficient native SOL to cover transaction fee and maintain rent exemption.`;
          }
        }
      } else {
        const transactionFeeLamports =
          await solanaService.calculateTransactionFee(address, toAddress, amount);
        const balanceLamports = Math.round(Number(tokenBalance) * LAMPORTS_PER_SOL);
        const amountLamports = Math.round(amount * LAMPORTS_PER_SOL);
        const limits = await solanaService.getSolanaSendLimits(address, transactionFeeLamports, balanceLamports);

        if (limits.isRentLocked) {
          errors.amount = `This account's entire balance (${(balanceLamports / LAMPORTS_PER_SOL).toFixed(8)} SOL) is reserved for rent. No SOL can be sent. Add more SOL or close this Nonce Account from another wallet.`;
        } else {
          const remainingLamports = balanceLamports - amountLamports - transactionFeeLamports;
          if (amountLamports + transactionFeeLamports > balanceLamports) {
            errors.amount = "Insufficient funds for amount plus transaction fees";
          } else if (remainingLamports > 0 && remainingLamports < limits.rentExemptMinimum) {
            errors.amount = `Amount would leave ${(remainingLamports / LAMPORTS_PER_SOL).toFixed(8)} SOL which is below rent exemption. Send less or press Max to send all.`;
          }
        }
      }
    }
  };

  const calculateMaxAmount = async (
    setFieldValue: (field: string, value: any) => void,
    tokenBalance: string,
    recipientAddress: string  // The TO address (values.address from the form)
  ) => {
    const toAddress = formRef.current?.values?.address || "";
    const isAddressValid =
      currentChainName === Chains.EVM
        ? EVMService.validateAddress(toAddress)
        : await solanaService.validateAddress(toAddress);
    if (!isAddressValid) {
      formRef.current?.setFieldError(
        "address",
        "A valid address is required to calculate max amount"
      );
      return;
    }
    try {
      if (currentChainName === Chains.EVM && service) {
        if (!isTokenSend) {
          const globalAddresses = store.getState().ethereum.globalAddresses;
          const fromAddress = importedEvmAddress || globalAddresses?.[activeEthIndex]?.address;

          const { totalCostMinusGas } = await service.calculateGasAndAmounts(
            recipientAddress as string, // This is just for estimation, toAddress doesn't matter much for gas but amount does
            tokenBalance,
            fromAddress
          );
          setFieldValue("amount", totalCostMinusGas);
        } else {
          setFieldValue("amount", tokenBalance);
        }
      } else if (currentChainName === Chains.Solana) {
        if (isTokenSend) {
          setFieldValue("amount", tokenBalance);
          return;
        }
        // IMPORTANT: Use outer-scope `address` (the SENDER from Redux store),
        // NOT `recipientAddress` (the TO address from the form).
        // The old code was shadowing the outer `address` with the parameter,
        // causing getSolanaSendLimits to query the DESTINATION account instead of the SENDER.
        const fromAddress = address; // Redux sender address: e.g. B9hBF4...
        const balanceLamports = Number(tokenBalance) * LAMPORTS_PER_SOL;
        const feeLamports = await solanaService.calculateTransactionFee(
          fromAddress,   // FROM: sender
          toAddress,     // TO: recipient
          Number(tokenBalance)
        );
        const limits = await solanaService.getSolanaSendLimits(fromAddress, feeLamports, balanceLamports);
        setFieldValue(
          "amount",
          Math.max(limits.maxSendable / LAMPORTS_PER_SOL, 0).toString()
        );
      }
    } catch (error) {
      console.error("Failed to calculate max amount:", error);
      setFieldValue("amount", "0");
    }
  };

  const handleSubmit = async (values: {
    address: string;
    amount: string;
  }) => {
    router.push({
      pathname: ROUTES.sendConfirmation,
      params: {
        address: values.address,
        amount: values.amount,
        chainName: currentChainName,
        Erc20TokenName: Erc20TokenName,
        token: detectedToken,
        tokenSymbol: ticker,
        erc20tokenAddress: erc20tokenAddress || (currentChainName === "ethereum" ? detectedToken : undefined),
        solAddess: address,
        mint: mint || (currentChainName === "solana" ? detectedToken : undefined),
        decimals: decimals,
        balance: tokenBalance,
        isNative: isNativeParam ? "true" : "false",
      },
    });
  };

  const initialValues = { address: toWalletAddress, amount: "" };

  return (
    <SafeAreaContainer style={{ flex: 1 }}>
      <ContentContainer
        contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={60}
      >
        <IconView>
          <IconBackground>{renderIcons()}</IconBackground>
        </IconView>
        <Formik
          innerRef={formRef}
          initialValues={initialValues}
          validate={validateFields}
          onSubmit={handleSubmit}
          enableReinitialize={true}
        >
          {({
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            setFieldValue,
          }) => (
            <FormWrapper>
              <TextContainer>
                <TextView>
                  <AddressInputContainer isAddressInputFocused={isAddressInputFocused}>
                    <AddressTextInput
                      isAddressInputFocused={isAddressInputFocused}
                      placeholder={`Recipient's ${capitalizeFirstLetter(
                        currentChainName
                      )} address`}
                      value={values.address}
                      onChangeText={handleChange("address")}
                      onFocus={() => setIsAddressInputFocused(true)}
                      onBlur={handleBlur("email")}
                      onEndEditing={() => setIsAddressInputFocused(false)}
                      placeholderTextColor={theme.colors.lightGrey}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                           pathname: ROUTES.camera,
                           params: { ...params, chain: currentChainName },
                        })
                      }
                    >
                      <QRCodeIcon
                        width={24}
                        height={24}
                        fill={theme.colors.lightGrey}
                      />
                    </TouchableOpacity>
                  </AddressInputContainer>
                </TextView>
                {errors.address && <ErrorText>{errors.address}</ErrorText>}
                <TextView>
                  <AmountTextInputContainer>
                    <AmountTextInput
                      returnKeyType="done"
                      isAmountInputFocused={isAmountInputFocused}
                      placeholder="Amount"
                      value={values.amount}
                      onChangeText={handleNumericChange(handleChange)("amount")}
                      onFocus={() => setIsAmountInputFocused(true)}
                      onBlur={handleBlur("email")}
                      onEndEditing={() => setIsAmountInputFocused(false)}
                      placeholderTextColor={theme.colors.lightGrey}
                      keyboardType="numeric"
                    />
                    <AmountDetailsView>
                      <TickerText>
                        {ticker}
                      </TickerText>
                      <MaxButton
                        onPress={() =>
                          calculateMaxAmount(
                            setFieldValue,
                            tokenBalance!.toString(),
                            values.address
                          )
                        }
                      >
                        <MaxText>Max</MaxText>
                      </MaxButton>
                    </AmountDetailsView>
                  </AmountTextInputContainer>
                </TextView>
                {errors.amount && <ErrorText>{errors.amount}</ErrorText>}
                <TransactionDetailsContainer>
                  <TransactionDetailsText>
                    {renderDollarAmount(values.amount)}
                  </TransactionDetailsText>
                  <TransactionDetailsText>
                    Available {tokenBalance} {ticker}
                  </TransactionDetailsText>
                </TransactionDetailsContainer>
              </TextContainer>
              <FooterContainer>
                <CancelButton onPress={() => router.back()}>
                  <CancelText>Cancel</CancelText>
                </CancelButton>
                <View style={{ flex: 1 }}>
                  <Button
                    backgroundColor={theme.colors.primary}
                    color={theme.colors.realWhite}
                    onPress={() => handleSubmit()}
                    title="Next"
                  />
                </View>
              </FooterContainer>
            </FormWrapper>
          )}
        </Formik>
      </ContentContainer>
    </SafeAreaContainer>
  );
}
