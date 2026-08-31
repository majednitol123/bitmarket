import React, { useState, useEffect, useRef, useCallback } from "react";
import { Platform, View } from "react-native";
import styled, { useTheme } from "styled-components/native";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { StackActions } from "expo-router/react-navigation";
import { useDispatch, useSelector } from "react-redux";
import { LAMPORTS_PER_SOL, Keypair, PublicKey } from "@solana/web3.js";
import { Chains } from "../../../../types";
import type { ThemeType } from "../../../../styles/theme";
import ConfirmSend from "../../../../assets/svg/confirm-send.svg";
import { formatDollar } from "../../../../utils/formatDollars";
import { TICKERS } from "../../../../constants/tickers";
import { truncateWalletAddress } from "../../../../utils/truncateWalletAddress";
import SendConfCard from "../../../../components/SendConfCard/SendConfCard";
import { capitalizeFirstLetter } from "../../../../utils/capitalizeFirstLetter";
import Button from "../../../../components/Button/Button";
// import ethService from "../../../../services/EthereumService";
import solanaService from "../../../../services/SolanaService";
import { getPhrase } from "../../../../hooks/useStorageState";
import type { RootState, AppDispatch } from "../../../../store";
import {
  sendEvmTransaction,
  fetchEvmBalance,
  fetchEvmTransactions,
} from "../../../../store/ethereumSlice";
import {
  sendSolanaTransaction,
  fetchSolanaBalance,
  fetchSolanaTransactions,
} from "../../../../store/solanaSlice";
import { sendSolToken } from "../../../../store/solTokenSlice";
import { calculateSplTokenTransactionFee as calculateSolSplFee } from "../../../../services/solTokenService";
import { BalanceContainer } from "../../../../components/Styles/Layout.styles";
import { SafeAreaContainer } from "../../../../components/Styles/Layout.styles";
import { ROUTES } from "../../../../constants/routes";
import { EVMService, evmServices } from "../../../../services/EthereumService";
import { sendErc20 } from "../../../../store/tokenSlice";
import { getImportedEvmKey, getImportedSolKey } from "../../../../utils/importedKeyStorage";
import NETWORKS from "../../../../services/defaultNetwork";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58ToBytes(base58Str: string): Uint8Array {
  const alphabetMap = new Map<string, number>();
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    alphabetMap.set(BASE58_ALPHABET[i], i);
  }
  let leadingZeros = 0;
  for (const char of base58Str) {
    if (char === "1") leadingZeros++;
    else break;
  }
  const base = BigInt(58);
  let num = BigInt(0);
  for (const char of base58Str) {
    const val = alphabetMap.get(char);
    if (val === undefined) throw new Error(`Invalid base58 character: ${char}`);
    num = num * base + BigInt(val);
  }
  const hex = num.toString(16);
  const hexPadded = hex.length % 2 === 1 ? "0" + hex : hex;
  const bytes: number[] = [];
  for (let i = 0; i < hexPadded.length; i += 2) {
    bytes.push(parseInt(hexPadded.slice(i, i + 2), 16));
  }
  const result = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[leadingZeros + i] = bytes[i];
  }
  return result;
}

function solKeyStringToUint8Array(keyStr: string): Uint8Array {
  const hex = keyStr.startsWith("0x") ? keyStr.slice(2) : keyStr;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length >= 64) {
    return new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  }
  return base58ToBytes(keyStr);
}

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-start;
  padding: ${(props) => props.theme.spacing.medium};
  margin-top: ${(props) =>
    Platform.OS === "android" ? props.theme.spacing.huge : '0px'};
`;

const IconBackground = styled.View<{ theme: ThemeType }>`
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: 32px;
  width: 80px;
  height: 80px;
  justify-content: center;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.colors.border};
  
`;

const IconView = styled.View<{ theme: ThemeType }>`
  justify-content: center;
  align-items: center;
  margin-bottom: ${(props) => props.theme.spacing.medium};
  width: 100%;
`;

const CryptoBalanceText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.huge};
  color: ${(props) => props.theme.fonts.colors.primary};
  text-align: center;
`;

const UsdBalanceText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.title};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
`;

const CryptoInfoCardContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: ${(props) => props.theme.spacing.medium};
`;

const ButtonContainer = styled.View<{ theme: ThemeType }>`
  margin-bottom: ${(props) => props.theme.spacing.small};
`;

const ErrorView = styled.View<{ theme: ThemeType }>`
  margin-top: ${(props) => props.theme.spacing.medium};
`;

const ErrorText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.error};
  text-align: center;
`;

const ButtonView = styled.View<{ theme: ThemeType }>`
  width: 100%;
  padding-horizontal: ${(props) => props.theme.spacing.medium};
`;



export default function SendConfirmationPage() {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();
  const {
    address: toAddress,
    amount: tokenAmount,
    chainName: chain,
    token, Erc20TokenName, tokenSymbol,erc20tokenAddress,    solAddess,
    chainId,
    nativeTokenSymbol,
    mint,
    decimals,
    balance,
  } = useLocalSearchParams();
  const navigation = useNavigation();
  const chainName = chain as string;
  const activeChainId = useSelector(
    (state: RootState) => state.ethereum.activeChainId
  );
  const networks = useSelector(
    (state: RootState) => state.ethereum.networks
  );
  const ticker = (() => {
    if (tokenSymbol) return Array.isArray(tokenSymbol) ? tokenSymbol[0] : tokenSymbol;
    if (chainName === Chains.EVM) {
      const effectiveChainId = chainId ? Number(chainId) : activeChainId;
      const network = networks[effectiveChainId!] || NETWORKS.find((n) => n.chainId === effectiveChainId);
      return (nativeTokenSymbol as string) || network?.symbol || "ETH";
    }
    return "SOL";
  })();
  const amount = tokenAmount as string;
  const address = toAddress as string;

  const prices = useSelector((state: RootState) => state.price.data);
  const activeEthIndex = useSelector(
    (state: RootState) => state.ethereum.activeIndex ?? 0
  );

  const activeSolIndex = useSelector(
    (state: RootState) => state.solana.activeIndex
  );


  // Imported wallet detection — must be before walletAddress/derivationPath
  const importedEvmAddress = useSelector((state: RootState) => state.importedAccounts?.activeEvmAddress);
  const importedSolAddress = useSelector((state: RootState) => state.importedAccounts?.activeSolAddress);
  const isImportedEvm = !!importedEvmAddress;
  const isImportedSol = !!importedSolAddress;

  const walletAddress = useSelector((state: RootState) => {
    if (importedEvmAddress) return importedEvmAddress;
    return state.ethereum.globalAddresses[activeEthIndex]?.address ?? "";
  });

  const derivationPath = useSelector(
    (state: RootState) =>
      state.solana.addresses[activeSolIndex]?.derivationPath
  );

  const selectedNetwork = useSelector(
    (state: RootState) => state.solana.selectedNetwork
  );

  const nativeSolBalance = useSelector((state: RootState) => {
    if (isImportedSol && importedSolAddress) {
      const account = state.solana.addresses?.find(a => a.address === importedSolAddress);
      return account?.balance ?? 0;
    }
    return state.solana.addresses[activeSolIndex]?.balance ?? 0;
  });

  const solPrice = prices[101]?.usd ?? 0;
  const ethPrice = prices[activeChainId!]?.usd ?? 0;

  const [transactionFeeEstimate, setTransactionFeeEstimate] = useState("0.00");
  const [totalCost, setTotalCost] = useState("0.00");
  const [calculatingCosts, setCalculatingCosts] = useState(true);
  const prevCalculatingRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [isBtnDisabled, setBtnDisabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const safeSetCalculating = useCallback((v: boolean) => {
    if (!mountedRef.current || v === prevCalculatingRef.current) return;
    prevCalculatingRef.current = v;
    setCalculatingCosts(v);
  }, []);

  const chainBalance = `${amount} ${ticker}`;

  const evmService = evmServices[activeChainId!];
  if (!evmService) {
    throw new Error("EVM service not initialized");
  }

  const senderSolAddress = useSelector((state: RootState) => {
    if (solAddess) return Array.isArray(solAddess) ? solAddess[0] : solAddess;
    if (importedSolAddress) return importedSolAddress;
    return state.solana.addresses[activeSolIndex]?.address;
  });

  const csolAddess = senderSolAddress;
  
  const handleSubmit = async () => {

    setLoading(true);
    setBtnDisabled(true);

    try {
      if (chainName === Chains.EVM) {
        let ethPrivateKey: string;

        let evmIsImported = isImportedEvm && !!importedEvmAddress;

        if (__DEV__) console.log("EVM SEND DEBUG:", { isImportedEvm, importedEvmAddress, walletAddress });

        if (!evmIsImported && walletAddress) {
          // Fallback: check if sender address has a key in SecureStore
          const fallbackKey = await getImportedEvmKey(walletAddress);
          if (fallbackKey) {
            if (__DEV__) console.log("FALLBACK: Found imported EVM key for", walletAddress);
            evmIsImported = true;
          }
        }

        if (evmIsImported) {
          const addrToLookup = importedEvmAddress || walletAddress;
          const key = await getImportedEvmKey(addrToLookup);
          if (!key) throw new Error("Failed to retrieve imported private key");
          ethPrivateKey = key;
        } else {
          // Derive key from seed phrase for standard wallets
          const seedPhrase = await getPhrase();
          const { wallet } = EVMService.deriveWalletByIndex(
            seedPhrase!,
            activeEthIndex
          );
          ethPrivateKey = wallet.privateKey;
        }
// SECURITY: Private key logging removed

        const isErc20 = erc20tokenAddress?.toString();
      

        let txResult;
        if (isErc20) {
          txResult = await dispatch(
            sendErc20({
              chainId: activeChainId,
              token: isErc20!,
              privateKey: ethPrivateKey,
              to: address,
              amount
            })
          ).unwrap();
        } else {
          txResult = await dispatch(
            sendEvmTransaction({
              chainId: activeChainId,
              from: walletAddress,
              privateKey: ethPrivateKey,
              to: address,
              amount: amount,
            })
          ).unwrap();
        }
        if (txResult) {
          // Schedule balance + tx re-fetch after 2s for blockchain propagation
          setTimeout(() => {
            dispatch(fetchEvmBalance({ chainId: activeChainId, address: walletAddress })).catch(() => {});
            dispatch(fetchEvmTransactions({ chainId: activeChainId, address: walletAddress })).catch(() => {});
          }, 2000);

          navigation.dispatch(StackActions.popToTop());

          const txHash =
            typeof txResult === "string"
              ? txResult           
              : txResult.tx.hash;

          router.push({
            pathname: ROUTES.confirmation,
            params: {
              txHash,
              blockchain: Chains.EVM,
              amount,
              symbol: ticker,
              recipientAddress: address,
            },
          });
          if (__DEV__) console.log("txResult", txHash)
        }
      } else if (chainName === Chains.Solana) {
        let solPrivateKey: Uint8Array;

        // Primary check: Redux state says this is imported
        let solIsImported = isImportedSol && !!importedSolAddress;
        let solSenderAddress = solIsImported ? importedSolAddress : csolAddess;

        if (__DEV__) console.log("SOL SEND DEBUG:", { isImportedSol, importedSolAddress, csolAddess, derivationPath });

        if (!solIsImported && csolAddess) {
          // Fallback: check if sender address has a key in SecureStore
          const fallbackKey = await getImportedSolKey(csolAddess as string);
          if (fallbackKey) {
            if (__DEV__) console.log("FALLBACK: Found imported key in SecureStore for", csolAddess);
            solIsImported = true;
            solSenderAddress = csolAddess as string;
          }
        }

        if (solIsImported && solSenderAddress) {
          // Retrieve key from SecureStore for imported wallets
          const keyStr = await getImportedSolKey(solSenderAddress as string);
          if (!keyStr) throw new Error("Failed to retrieve imported private key");
          solPrivateKey = solKeyStringToUint8Array(keyStr);
        } else {
          // Derive key from seed phrase for standard wallets
          const seedPhrase = await getPhrase();
          solPrivateKey = await solanaService.derivePrivateKeysFromPhrase(
            seedPhrase!,
            derivationPath
          );
        }

        // SECURITY: Private key logging removed
        const senderSolAddress = solSenderAddress || csolAddess;

        let result;
        if (mint) {
          result = await dispatch(
            sendSolToken({
              mint: mint as string,
              to: address,
              amount: parseFloat(amount),
              decimals: Number(decimals),
              secretKey: solPrivateKey,
            })
          ).unwrap();
        } else {
          result = await dispatch(
            sendSolanaTransaction({
              privateKey: solPrivateKey,
              address,
              amount,
              fromAddress: senderSolAddress as string,
            })
          ).unwrap();
        }

        if (result?.txHash || result?.signature) {
          const txHash = result?.txHash || result?.signature;
          // Schedule balance + tx re-fetch after 2s for blockchain propagation
          const senderAddr = senderSolAddress || csolAddess;
          setTimeout(() => {
            if (senderAddr) {
              dispatch(fetchSolanaBalance(senderAddr as string)).catch(() => {});
              dispatch(fetchSolanaTransactions(senderAddr as string)).catch(() => {});
            }
          }, 2000);

          navigation.dispatch(StackActions.popToTop());
          router.push({
            pathname: ROUTES.confirmation,
            params: { 
              txHash: txHash, 
              blockchain: Chains.Solana,
              amount,
              symbol: ticker,
              recipientAddress: address,
            },
          });
        }
      }
    } catch (error: any) {
      console.error("Failed to send transaction:", error);
      const errMsg = error?.message || "";
      if (errMsg.includes("insufficient funds for rent")) {
        setError("Transaction failed: Remaining SOL balance must be either 0 or at least 0.00204 SOL (rent exemption). Try adjusting your amount.");
      } else {
        setError(errMsg || "Failed to send transaction. Please try again later.");
      }
    } finally {
      setLoading(false);
      setBtnDisabled(false);
    }
  };

 
  const nativeEthBalance = useSelector((state: RootState) => {
    const chainId = state.ethereum.activeChainId;
    const account = isImportedEvm && importedEvmAddress
      ? state.ethereum.globalAddresses?.find(a => a.address?.toLowerCase() === importedEvmAddress.toLowerCase())
      : state.ethereum.globalAddresses?.[state.ethereum.activeIndex ?? 0];
    return account?.balanceByChain?.[chainId] ?? 0;
  });

  // ─── Refs to prevent re-render storms ───
  // Only call setState when the computed value actually differs from the last
  // value we set. This eliminates the cascade that triggers
  // "Maximum update depth exceeded" on low-end devices.
  const mountedRef = useRef(true);
  const prevFeeRef = useRef(transactionFeeEstimate);
  const prevCostRef = useRef(totalCost);
  const prevErrorRef = useRef(error);
  const prevBtnRef = useRef(isBtnDisabled);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Guarded setters — only update state (and trigger a re-render) when the
  // new value differs from the previous one.
  const safeSetFee = useCallback((v: string) => {
    if (!mountedRef.current || v === prevFeeRef.current) return;
    prevFeeRef.current = v;
    setTransactionFeeEstimate(v);
  }, []);
  const safeSetCost = useCallback((v: string) => {
    if (!mountedRef.current || v === prevCostRef.current) return;
    prevCostRef.current = v;
    setTotalCost(v);
  }, []);
  const safeSetError = useCallback((v: string | null) => {
    if (!mountedRef.current || v === prevErrorRef.current) return;
    prevErrorRef.current = v;
    setError(v);
  }, []);
  const safeSetBtn = useCallback((v: boolean) => {
    if (!mountedRef.current || v === prevBtnRef.current) return;
    prevBtnRef.current = v;
    setBtnDisabled(v);
  }, []);

  const calculateTransactionCosts = useCallback(async () => {
    if (!mountedRef.current) return;
    const chainPrice = chainName === Chains.EVM ? ethPrice : solPrice;
    try {
      if (chainName === Chains.EVM) {
        const isErc20 = Boolean(erc20tokenAddress);

        if (isErc20) {
          const gasResult = await evmService.calculateGasAndAmountsForERC20Transfer(
            walletAddress,
            erc20tokenAddress as string,
            address,
            amount
          );

          if (!mountedRef.current) return;

          if (gasResult) {
            const gasCostEth = Number(gasResult.gasCostEth);
            safeSetFee(formatDollar(gasCostEth * chainPrice));
            safeSetCost("--");

            if (gasCostEth > Number(nativeEthBalance)) {
              safeSetError("Insufficient native balance to cover gas fees for ERC20 transfer.");
              safeSetBtn(true);
            } else {
              safeSetError("");
              safeSetBtn(false);
            }
          }
        } else {
          const { gasEstimate, totalCost } =
            await evmService.calculateGasAndAmounts(address, amount, walletAddress);

          if (!mountedRef.current) return;

          safeSetFee(formatDollar(parseFloat(gasEstimate) * chainPrice));
          safeSetCost(formatDollar(parseFloat(totalCost) * chainPrice));

          if (parseFloat(totalCost) > Number(nativeEthBalance)) {
            safeSetError("Not enough funds to cover amount plus gas costs.");
            safeSetBtn(true);
          } else {
            safeSetError("");
            safeSetBtn(false);
          }
        }
      }
      if (chainName === Chains.Solana) {
        let transactionFeeLamports: number = 0;

        if (mint && csolAddess) {
          const feeResult = await calculateSolSplFee({
            mint: mint as string,
            fromPubkey: new PublicKey(csolAddess as string),
            toAddress: address,
            amount: parseFloat(amount),
            decimals: Number(decimals),
          });
          transactionFeeLamports = feeResult.lamports;
        } else {
          transactionFeeLamports = await solanaService.calculateTransactionFee(
            csolAddess,
            address,
            parseFloat(amount)
          );
        }

        if (!mountedRef.current) return;

        const transactionFeeSol = transactionFeeLamports / LAMPORTS_PER_SOL;
        const sendAmount = parseFloat(amount || "0");
        let totalCostSol = sendAmount;
        if (!mint) {
          totalCostSol = sendAmount + transactionFeeSol;
        }

        const txFeeFloat = transactionFeeSol * chainPrice;
        const txFeeEstimateUsd = formatDollar(txFeeFloat);
        const totalCostPlusTxFeeUsd = formatDollar(totalCostSol * chainPrice);

        if (txFeeFloat > 0 && txFeeFloat < 0.01) {
          safeSetFee(`< ${txFeeEstimateUsd}`);
        } else {
          safeSetFee(txFeeEstimateUsd);
        }

        if (mint) {
          safeSetCost("--");
          const splBalance = Number(balance || 0);
          const nativeSolBalanceLamports = Math.round(Number(nativeSolBalance) * LAMPORTS_PER_SOL);
          const limits = await solanaService.getSolanaSendLimits(csolAddess as string, transactionFeeLamports, nativeSolBalanceLamports);

          if (!mountedRef.current) return;

          if (limits.isRentLocked) {
            safeSetError("This account's entire SOL balance is reserved for rent (Nonce Account). Add more SOL to cover fees, or close the account from another wallet.");
            safeSetBtn(true);
          } else if (sendAmount > splBalance) {
            safeSetError(`Not enough ${ticker} to send.`);
            safeSetBtn(true);
          } else {
            const remainingNativeLamports = nativeSolBalanceLamports - transactionFeeLamports;
            if (remainingNativeLamports > 0 && remainingNativeLamports < limits.rentExemptMinimum) {
              safeSetError(`Not enough SOL to cover fees and maintain rent exemption.`);
              safeSetBtn(true);
            } else {
              safeSetError("");
              safeSetBtn(false);
            }
          }
        } else {
          const balanceLamports = Math.round(Number(nativeSolBalance) * LAMPORTS_PER_SOL);
          const sendAmountLamports = Math.round(sendAmount * LAMPORTS_PER_SOL);
          const limits = await solanaService.getSolanaSendLimits(csolAddess as string, transactionFeeLamports, balanceLamports);

          if (!mountedRef.current) return;

          if (limits.isRentLocked) {
            safeSetError(`This account's entire balance (${(balanceLamports / LAMPORTS_PER_SOL).toFixed(8)} SOL) is reserved for rent. No SOL can be sent. Add more SOL or close this Nonce Account from another wallet.`);
            safeSetBtn(true);
          } else if (sendAmountLamports + transactionFeeLamports > balanceLamports) {
            safeSetError("Not enough SOL to cover amount plus fees.");
            safeSetBtn(true);
          } else {
            const remainingLamports = balanceLamports - sendAmountLamports - transactionFeeLamports;
            if (remainingLamports > 0 && remainingLamports < limits.rentExemptMinimum) {
              safeSetError(`Amount would leave ${(remainingLamports / LAMPORTS_PER_SOL).toFixed(8)} SOL below rent exemption. Press Max to send all.`);
              safeSetBtn(true);
            } else {
              safeSetError("");
              safeSetBtn(false);
            }
          }
        }
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("Failed to fetch transaction costs:", err);
      safeSetError(err?.message || "Failed to calculate transaction costs. Please check your balance or connection.");
      safeSetBtn(true);
    }
  }, [address, amount, chainName, ethPrice, solPrice, erc20tokenAddress, isImportedEvm, importedEvmAddress, activeEthIndex, evmService, walletAddress, nativeEthBalance, csolAddess, mint, decimals, balance, nativeSolBalance, ticker, safeSetFee, safeSetCost, safeSetError, safeSetBtn]);

  useEffect(() => {
    calculateTransactionCosts();

    const intervalId = setInterval(() => {
      calculateTransactionCosts();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [calculateTransactionCosts]);

  const renderNetworkName = () => {
    if (chainName === Chains.EVM) {
      const network = networks[activeChainId!] || NETWORKS.find((n) => n.chainId === activeChainId);
      return network ? network.chainName : "Unknown Network";
    }
    return selectedNetwork === "mainnet" ? "Solana Mainnet" : "Solana Devnet";
  };

  return (
    <SafeAreaContainer>
      <ContentContainer>
        <IconView>
          <IconBackground>
            <ConfirmSend width={40} height={40} fill={theme.colors.primary} />
          </IconBackground>
        </IconView>
        <BalanceContainer>
          <CryptoBalanceText>{chainBalance}</CryptoBalanceText>
          <UsdBalanceText>{totalCost}</UsdBalanceText>
        </BalanceContainer>

        <CryptoInfoCardContainer>
          <SendConfCard
            toAddress={truncateWalletAddress(address)}
            network={renderNetworkName()}
            networkFee={`Up to ${transactionFeeEstimate}`}
          />
          {error && (
            <ErrorView>
              <ErrorText>{error}</ErrorText>
            </ErrorView>
          )}
        </CryptoInfoCardContainer>
        <ButtonView>
          <ButtonContainer>
            <Button
              loading={loading}
              disabled={isBtnDisabled}
              backgroundColor={theme.colors.primary}
              color={theme.colors.realWhite}
              onPress={handleSubmit}
              title="Send"
            />
          </ButtonContainer>
        </ButtonView>
      </ContentContainer>
    </SafeAreaContainer>
  );
}
