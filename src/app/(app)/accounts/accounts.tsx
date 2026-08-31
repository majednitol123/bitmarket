
import { useState, useEffect, useCallback, useMemo, memo, useRef } from "react";
import { View, Dimensions, Platform, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import { useSelector, useDispatch } from "react-redux";
import * as ethers from "ethers";
import { MotiView } from "moti";
import * as SecureStore from "expo-secure-store";
import { authenticateBiometric } from "../../../store/biometricsSlice";
import { Skeleton } from "moti/skeleton";
import { formatDollar } from "../../../utils/formatDollars";
import solanaService from "../../../services/SolanaService";
import { getPhrase } from "../../../hooks/useStorageState";
import { store, type AppDispatch, type RootState } from "../../../store";
import type { AddressState, SAddressState } from "../../../store/types";
import type { ThemeType } from "../../../styles/theme";
import { GeneralStatus } from "../../../store/types";
import {
  fetchEvmBalance,
  setActiveAccount,
  updateAddresses,
} from "../../../store/ethereumSlice";
import {
  setActiveSolanaAccount,
  updateSolanaAddresses,
} from "../../../store/solanaSlice";
import {
  setActiveImportedAccount,
  clearActiveImportedAccount,
} from "../../../store/importedAccountSlice";

import { TESTNET_CHAIN_IDS } from "../../../utils/fetchCryptoPrices";
import { ROUTES } from "../../../constants/routes";
import RightArrowIcon from "../../../assets/svg/right-arrow.svg";
import PhraseIcon from "../../../assets/svg/phrase.svg";
import EditIcon from "../../../assets/svg/edit.svg";
import { SafeAreaContainer } from "../../../components/Styles/Layout.styles";
import Button from "../../../components/Button/Button";
import { placeholderArr } from "../../../utils/placeholder";
import { evmServices, getEvmService } from "../../../services/EthereumService";
import { LinearGradientBackground } from "../../../components/Styles/Gradient";
import BlockieAvatar from "../../../components/BlockieAvatar/BlockieAvatar";

interface WalletContainerProps {
  theme: ThemeType;
  isLast: boolean;
  isActiveAccount: boolean;
}

interface WalletSkeletonContainerProps {
  theme: ThemeType;
  isLast: boolean;
  isActiveAccount: boolean;
}

const ScrollContainer = styled.ScrollView`
  flex: 1;
`;

const ContentContainer = styled.View<{ theme: ThemeType }>`
  padding: ${({ theme }) => theme.spacing.medium};
  padding-top: 50px;
  padding-bottom: 24px;
`;

const BottomButtonContainer = styled.View<{ theme: ThemeType }>`
  padding: ${({ theme }) => theme.spacing.medium};
  padding-bottom: 32px;
  background-color: transparent;
`;

const PageTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 28px;
  color: ${(props) => props.theme.colors.white};
  margin-bottom: 24px;
`;

const WalletContainer = styled.TouchableOpacity<WalletContainerProps>`
  flex-direction: row;
  justify-content: space-between;
  background-color: ${({ theme, isActiveAccount }) =>
    isActiveAccount ? "rgba(240, 185, 11, 0.1)" : theme.colors.cardBackground};
  padding: 18px;
  border-radius: 14px;
  margin-bottom: 12px;
  border: 1px solid
    ${({ theme, isActiveAccount }) =>
    isActiveAccount ? "rgba(240, 185, 11, 0.3)" : theme.colors.border};
`;

const WalletSkeletonContainer = styled.View <WalletSkeletonContainerProps>`
  flex-direction: row;
  justify-content: space-between;
  background-color: ${({ theme, isActiveAccount }) =>
    isActiveAccount ? "rgba(240, 185, 11, 0.1)" : theme.colors.cardBackground};
  padding: 18px;
  border-radius: 14px;
  margin-bottom: 12px;
  border: 1px solid
    ${({ theme, isActiveAccount }) =>
    isActiveAccount ? "rgba(240, 185, 11, 0.3)" : theme.colors.border};
`;

const AccountDetails = styled.View`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
`;

const EditIconContainer = styled.TouchableOpacity`
  justify-content: center;
  align-items: center;
  width: 44px;
  height: 44px;
`;

const WalletPhraseContainer = styled.View<{ theme: ThemeType }>`
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
`;

const SectionTitle = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.fonts.colors.primary};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  margin-left: ${({ theme }) => theme.spacing.medium};
  text-align: left;
`;

const AccountDetailsText = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.fonts.colors.primary};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  margin-left: ${(props) => props.theme.spacing.medium};
`;

const SectionCaption = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.colors.lightGrey};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
`;


const AccountTitle = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.colors.white};
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.large};
  margin-bottom: 4px;
  text-align: left;
`;

const PriceText = styled.Text<{ theme: ThemeType }>`
  color: ${(props) => props.theme.colors.lightGrey};
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  text-align: left;
`;

const PhraseTextContent = styled.View`
  display: flex;
  flex-direction: row;
`;

interface WalletPairs {
  isImported: boolean;
  id: string;
  accountName: string;
  isActiveAccount: boolean;
  ethIndex: number;   // index in seed-only array (or -1 for imported)
  solIndex: number;   // index in seed-only array (or -1 for imported)
  walletDetails: {
    ethereum: AddressState | {};
    solana: SAddressState | {};
  };
}


// ✅ Component
const AccountsIndex = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  // --- STATE FOR PASSWORD CONFIRMATION ---
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isPasswordInputFocused, setIsPasswordInputFocused] = useState(false);

  const { biometricAvailable } = useSelector((state: RootState) => state.biometrics);

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
        setEnteredPassword("");
        router.push({ pathname: ROUTES.seedPhrase, params: { readOnly: "true" } });
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
    } catch (e) {
      setPasswordError("Failed to verify password.");
    }
  };

  const handlePhraseAccess = async () => {
    setPasswordError("");
    setEnteredPassword("");

    if (biometricAvailable) {
      try {
        const result = await (dispatch as AppDispatch)(authenticateBiometric()).unwrap();
        if (result) {
          router.push({ pathname: ROUTES.seedPhrase, params: { readOnly: "true" } });
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

  // --- SELECTORS ---
  const activeChainId = useSelector(
    (state: RootState) => state.ethereum.activeChainId

  );

  const service = getEvmService(activeChainId);

  const ethAccounts = useSelector(
    (state: RootState) => state.ethereum.globalAddresses || []
  );


  const activeEthIndex = useSelector(
    (state: RootState) =>
      state.ethereum.activeIndex ?? 0
  );

  const activeEthAddress = ethAccounts[activeEthIndex] ?? null;

  const solAccounts = useSelector((state: RootState) => state.solana.addresses);
  const activeSolIndex = useSelector(
    (state: RootState) => state.solana.activeIndex
  );
  const activeSolAddress = solAccounts[activeSolIndex] ?? null;

  const importedAccounts = useSelector(
    (state: RootState) => state.importedAccounts?.accounts ?? []
  );
  const activeImportedEvmAddress = useSelector(
    (state: RootState) => state.importedAccounts?.activeEvmAddress
  );
  const activeImportedSolAddress = useSelector(
    (state: RootState) => state.importedAccounts?.activeSolAddress
  );

  const prices = useSelector((state: RootState) => state.price.data);
  const selectedSolanaNetwork = useSelector(
    (state: RootState) => state.solana.selectedNetwork ?? "devnet"
  );

  const ethdispatch = useDispatch<AppDispatch>();
  // --- STATE ---
  const [walletCreationLoading, setWalletCreationLoading] = useState(false);
  const [priceAndBalanceLoading, setPriceAndBalanceLoading] = useState(false);
  const [accounts, setAccounts] = useState<WalletPairs[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const liveDataLoaded = useRef(false);
  // --- HELPERS ---
  //  const compileAddressesConcurrently = useCallback(
  //   async (ethAcc: AddressState[], solAcc: SAddressState[]) => {
  //     const service = getEvmService(activeChainId);


  //     if (!service) {
  //       console.log("EVM service not initialized yet, skipping balances");
  //       return {
  //         ethereum: ethAcc.map(a => ({ ...a, balance: a.activeBalance ?? 0})),
  //         solana: await Promise.all(
  //           solAcc.map(async a => ({
  //             ...a,
  //             balance: await solanaService.getBalance(a.address),
  //           }))
  //         ),
  //       };
  //     }


  //  const fetchAllBalances = async (
  //   dispatch: AppDispatch,
  //   getState: () => RootState
  // ): Promise<Record<number, number>> => {
  //   const state = getState();
  //   const result: Record<number, number> = {};

  //   // Get the active account index for each chain
  //   const addresses = state.ethereum.globalAddresses;
  //   if (!addresses || addresses.length === 0) return result;

  //   const activeAccountIndex = state.ethereum.activeIndexByChain;
  //   const activeAccount = addresses[0]; // or pick based on chainId if needed

  //   // Iterate all networks
  //   for (const chainIdStr of Object.keys(state.ethereum.networks)) {
  //     const chainId = Number(chainIdStr);

  //     // Get the active index for this chain
  //     const idx = activeAccountIndex[chainId] ?? 0;
  //     const account = addresses[idx];
  //     if (!account) continue;

  //     // Fetch balance from blockchain
  //     try {
  //       const res = await dispatch(
  //         fetchEvmBalance({ chainId, address: account.address })
  //       ).unwrap();

  //       // Store in result
  //       result[chainId] = res.balance;
  //     } catch (err) {
  //       console.warn(`Failed to fetch balance for chain ${chainId}:`, err);
  //       result[chainId] = 0;
  //     }
  //   }

  //   return result;
  //  };

  //  useEffect(() => {
  //   if (!ethAccounts.length) return;

  //   const fetchBalancesAsync = async () => {
  //     try {
  //       const result = await fetchAllBalances(ethdispatch, () => store.getState());
  //       setBalances(result);
  //     } catch (err) {
  //       console.error("Failed to fetch balances:", err);
  //     }
  //   };

  //   fetchBalancesAsync();
  // }, [ethAccounts]);




  //     const ethereumBalancePromise = ethAcc.map(async (account) => {
  //       const balance = await service.getBalance(account.address);
  //       return { ...account, balance: Number(ethers.formatEther(balance)) };
  //     });

  //     const solanaBalancePromise = solAcc.map(async (account) => {
  //       const balance = await solanaService.getBalance(account.address);
  //       return { ...account, balance };
  //     });

  //     const [ethereum, solana] = await Promise.all([
  //       Promise.all(ethereumBalancePromise),
  //       Promise.all(solanaBalancePromise),
  //     ]);

  //     return { ethereum, solana };
  //   },
  //   [activeChainId]
  // );


  //   const compileInactiveAddresses = useCallback(
  //     (
  //       ethAcc: AddressState[],
  //       solAcc: SAddressState[],
  //       activeEthAddress: string | null,
  //       activeSolAddress: string | null
  //     ) => {
  //       const mergedWalletPairs: WalletPairs[] = [];
  //       const highestAccAmount = Math.max(ethAcc.length, solAcc.length);

  //       for (let i = 0; i < highestAccAmount; i++) {
  //         const eth = ethAcc[i] ?? null;
  //         const sol = solAcc[i] ?? null;
  //         const isActiveAccount =
  //           eth?.address === activeEthAddress && sol?.address === activeSolAddress;
  //         mergedWalletPairs.push({
  //           id: `${i}-${eth?.address ?? sol?.address ?? i}`,
  //           accountName: eth?.accountName || sol?.accountName || `Account ${i + 1}`,
  //           isActiveAccount,
  //           walletDetails: { ethereum: eth, solana: sol },
  //         });
  //       }

  //       return mergedWalletPairs;
  //     },
  //     []
  //   );

  //   // --- CREATE NEW WALLET ---
  //   const createNewWalletPair = useCallback(async () => {
  //   setWalletCreationLoading(true);

  //   try {
  //     const phrase = await getPhrase();
  //     if (!phrase) throw new Error("Seed phrase not found");

  //     const ethService = getEvmService(activeChainId);


  //     if (!ethService) {
  //       console.warn("EVM service not ready yet");
  //       return;
  //     }

  //     const nextEthIndex = ethAccounts.length;
  //     const nextSolIndex = solAccounts.length;

  //     const newEthWallet = await ethService.createWalletByIndex(
  //       phrase,
  //       nextEthIndex
  //     );

  //     const newSolWallet = await solanaService.createWalletByIndex(
  //       phrase,
  //       nextSolIndex
  //     );

  //    const transformedEthWallet: AddressState = {
  //   accountName: `Account ${nextEthIndex + 1}`,
  //   derivationPath: newEthWallet.derivationPath,
  //   address: newEthWallet.address,
  //   publicKey: newEthWallet.publicKey,

  //   // Per-chain balances & status
  //   balanceByChain: {},
  //   statusByChain: {},
  //   activeBalance: 0,
  //   failedNetworkRequestByChain: {},

  //   // Per-chain transaction metadata
  //   transactionMetadataByChain: {
  //     [activeChainId]: {
  //       transactions: [],
  //       paginationKey: undefined,
  //     },
  //   },

  //   // Global transaction confirmations
  //   transactionConfirmations: [],
  // };


  //     const transformedSolWallet: SAddressState = {
  //       accountName: `Account ${nextSolIndex + 1}`,
  //       derivationPath: newSolWallet.derivationPath,
  //       address: newSolWallet.address,
  //       publicKey: newSolWallet.publicKey,
  //       balance: 0,
  //       transactionMetadata: { paginationKey: undefined, transactions: [] },
  //       failedNetworkRequest: false,
  //       status: GeneralStatus.Idle,
  //       transactionConfirmations: [],
  //     };

  //     dispatch(
  //       updateAddresses({
  //         addresses: [transformedEthWallet],
  //       })
  //     );

  //     dispatch(updateSolanaAddresses(transformedSolWallet));
  //   } catch (err) {
  //     console.error("Failed to create wallet pair:", err);
  //   } finally {
  //     setWalletCreationLoading(false);
  //   }
  // }, [activeChainId, ethAccounts.length, solAccounts.length, dispatch]);


  //   // --- SET ACTIVE ACCOUNT ---
  //   const setNextActiveAccounts = useCallback(
  //     (index: number) => {
  //       dispatch(setActiveAccount({ chainId: activeChainId, index }));
  //       dispatch(setActiveSolanaAccount(index));
  //     },
  //     [dispatch, activeChainId]
  //   );

  //   // --- FETCH BALANCES ---
  //   const fetchBalances = useCallback(async () => {
  //     try {
  //        if (!ethAccounts.length && !solAccounts.length) return;
  //       const { ethereum, solana } = await compileAddressesConcurrently(ethAccounts, solAccounts);
  //       setAccounts(
  //         compileInactiveAddresses(
  //           ethereum,
  //           solana,
  //           activeEthAddress?.address ?? null,
  //           activeSolAddress?.address ?? null
  //         )
  //       );
  //     } catch (err) {
  //       console.error("Failed fetching balances:", err);
  //     } finally {
  //       setPriceAndBalanceLoading(false);
  //     }
  //   }, [
  //     ethAccounts,
  //     solAccounts,
  //     activeEthAddress,
  //     activeSolAddress,
  //     compileAddressesConcurrently,
  //     compileInactiveAddresses,
  //   ]);

  //   const debouncedFetchBalances = useMemo(() => debounce(fetchBalances, 300), [fetchBalances]);

  //   useEffect(() => {
  //     debouncedFetchBalances();
  //     return () => debouncedFetchBalances.cancel();
  //   }, [debouncedFetchBalances]);

  //   const memoizedAccounts = useMemo(
  //     () => (priceAndBalanceLoading ? placeholderArr(ethAccounts.length) : accounts),
  //     [priceAndBalanceLoading, ethAccounts.length, accounts]
  //   );

  //   const width = Dimensions.get("window").width * 0.6;

  // const calculateTotalPrice = useCallback(
  //   (
  //     evmBalances: Record<number, number>, 
  //     solBalance: number                  
  //   ) => {
  //     const evmTotal = Object.entries(evmBalances).reduce((acc, [chainIdStr, balance]) => {
  //       const chainId = Number(chainIdStr);
  //       const price = prices[chainId]?.usd ?? 0; 
  //       return acc + balance * price;
  //     }, 0);
  //   const solUsd = prices[101]?.usd ?? 0;
  //     const total = evmTotal + solBalance * solUsd;
  // // console.log("total",total)
  //     return formatDollar(total);
  //   },
  //   [prices]
  // );


  //   const renderItem = useCallback(
  //     ({ item, index }) => {
  //       if (priceAndBalanceLoading) {
  //         return (
  //           <WalletSkeletonContainer isActiveAccount={false} isLast={index === accounts.length - 1}>
  //             <Skeleton height={35} colors={[theme.colors.grey, theme.colors.dark, theme.colors.dark, theme.colors.grey]} width={width} />
  //             <Skeleton height={35} colors={[theme.colors.grey, theme.colors.dark, theme.colors.dark, theme.colors.grey]} width={50} />
  //           </WalletSkeletonContainer>
  //         );
  //       }

  //       const balance = calculateTotalPrice(
  //   balances ?? {}, 
  //   item.walletDetails.solana?.balance ?? 0           
  // );
  // console.log("balance",balance)
  //       return (
  //         <WalletContainer
  //           onPress={() => {
  //             setNextActiveAccounts(index);
  //             router.back();
  //           }}
  //           isActiveAccount={item.isActiveAccount}
  //           isLast={index === accounts.length - 1}
  //         >
  //           <AccountDetails>
  //             <AccountTitle>{item.accountName}</AccountTitle>
  //             <PriceText>{balance}</PriceText>
  //           </AccountDetails>
  //           <EditIconContainer
  //             onPress={() => {
  //               router.push({
  //                 pathname: ROUTES.accountModal,
  //                 params: {
  //                   ethAddress: item.walletDetails.ethereum?.address ?? "",
  //                   solAddress: item.walletDetails.solana?.address ?? "",
  //                   balance,
  //                 },
  //               });
  //             }}
  //           >
  //             <EditIcon width={20} height={20} fill={theme.colors.white} />
  //           </EditIconContainer>
  //         </WalletContainer>
  //       );
  //     },
  //     [accounts.length, calculateTotalPrice, priceAndBalanceLoading, setNextActiveAccounts, theme]
  //   );


  // -------------------- 1. FETCH BALANCES --------------------
  const compileAddressesConcurrently = useCallback(
    async (ethAcc: AddressState[], solAcc: SAddressState[]) => {
      const service = getEvmService(activeChainId);

      if (!service) {
        if (__DEV__) console.log("EVM service not initialized yet, skipping balances");
        const solBalances = await Promise.all(
          solAcc.map(async (a) => {
            try {
              const balance = await solanaService.getBalance(a.address);
              return { ...a, balance };
            } catch (err) {
              console.warn(`Failed to fetch Solana balance for ${a.address} (EVM service not ready):`, err);
              return { ...a, balance: a.balance ?? 0 };
            }
          })
        );
        return {
          ethereum: ethAcc.map((a) => ({ ...a, balance: a.activeBalance ?? 0 })),
          solana: solBalances,
        };
      }

      // Fetch Ethereum balances concurrently
      const ethereumBalancePromise = ethAcc.map(async (account) => {
        try {
          const balance = await service.getBalance(account.address);
          return { ...account, balance: Number(ethers.formatEther(balance)) };
        } catch (err) {
          console.warn(`Failed to fetch EVM balance for ${account.address}:`, err);
          return { ...account, balance: account.activeBalance ?? 0 };
        }
      });

      // Fetch Solana balances concurrently
      const solanaBalancePromise = solAcc.map(async (account) => {
        try {
          const balance = await solanaService.getBalance(account.address);
          return { ...account, balance };
        } catch (err) {
          console.warn(`Failed to fetch Solana balance for ${account.address}:`, err);
          return { ...account, balance: account.balance ?? 0 };
        }
      });

      const [ethereum, solana] = await Promise.all([
        Promise.all(ethereumBalancePromise),
        Promise.all(solanaBalancePromise),
      ]);

      return { ethereum, solana };
    },
    [activeChainId]
  );

  // -------------------- 2. MERGE ACCOUNTS --------------------
  const compileInactiveAddresses = useCallback(
    (
      ethAcc: AddressState[],
      solAcc: SAddressState[],
      activeEthAddress: string | null,
      activeSolAddress: string | null,
      importedAcc: { id: string; accountName: string; evmAddress?: string; solAddress?: string }[],
      activeImportedEvm?: string,
      activeImportedSol?: string
    ) => {
      const mergedWalletPairs: WalletPairs[] = [];

      // Filter to seed-derived accounts only for proper pairing
      // (imported accounts exist in ethAcc but NOT in solAcc, causing index misalignment)
      const seedEth = ethAcc.filter(a => !!a.derivationPath);
      const seedSol = solAcc.filter(a => !!a.derivationPath);
      const highestSeedCount = Math.max(seedEth.length, seedSol.length);

      // Determine "true" active addresses (imported takes precedence)
      const trueActiveEth = activeImportedEvm || activeEthAddress;
      const trueActiveSol = activeImportedSol || activeSolAddress;

      for (let i = 0; i < highestSeedCount; i++) {
        const eth = seedEth[i] ?? null;
        const sol = seedSol[i] ?? null;

        // Seed-derived account is active ONLY when no imported account is active
        const isActiveAccount =
          !activeImportedEvm && !activeImportedSol &&
          (eth ? eth.address === activeEthAddress : true) &&
          (sol ? sol.address === activeSolAddress : true);

        mergedWalletPairs.push({
          id: `seed-${i}-${eth?.address ?? sol?.address ?? i}`,
          accountName: eth?.accountName || sol?.accountName || `Account ${i + 1}`,
          isActiveAccount,
          isImported: false,
          ethIndex: i,
          solIndex: i,
          walletDetails: { ethereum: eth ?? {}, solana: sol ?? {} },
        });
      }

      // Add imported accounts
      for (const imported of importedAcc) {
        const isActiveAccount =
          (imported.evmAddress && imported.evmAddress === trueActiveEth) ||
          (imported.solAddress && imported.solAddress === trueActiveSol) ||
          false;

        mergedWalletPairs.push({
          id: imported.id,
          accountName: imported.accountName,
          isActiveAccount,
          isImported: true,
          ethIndex: -1,
          solIndex: -1,
          walletDetails: {
            ethereum: imported.evmAddress ? { address: imported.evmAddress } : {},
            solana: imported.solAddress ? { address: imported.solAddress } : {},
          },
        });
      }

      return mergedWalletPairs;
    },
    []
  );
  // Load cached accounts from AsyncStorage on mount for immediate UI availability
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cachedAccounts = await AsyncStorage.getItem("manage_wallets_accounts_cache");
        if (cachedAccounts && !liveDataLoaded.current) {
          const parsed = JSON.parse(cachedAccounts);
          if (parsed && Array.isArray(parsed) && parsed.length > 0) {
            // Get current active addresses from store to highlight the correct card instantly on mount
            const s = store.getState();
            const activeEthIdx = s.ethereum.activeIndex ?? 0;
            const activeSolIdx = s.solana.activeIndex ?? 0;
            const activeEth = s.ethereum.globalAddresses?.[activeEthIdx]?.address ?? null;
            const activeSol = s.solana.addresses?.[activeSolIdx]?.address ?? null;
            const impEvm = s.importedAccounts?.activeEvmAddress;
            const impSol = s.importedAccounts?.activeSolAddress;

            const trueActiveEth = impEvm || activeEth;
            const trueActiveSol = impSol || activeSol;

            const updatedCache = parsed.map((item: any) => {
              if (item.isImported) {
                const isActive =
                  (item.walletDetails.ethereum?.address && item.walletDetails.ethereum.address === trueActiveEth) ||
                  (item.walletDetails.solana?.address && item.walletDetails.solana.address === trueActiveSol) ||
                  false;
                return { ...item, isActiveAccount: isActive };
              } else {
                const ethAddr = item.walletDetails.ethereum?.address ?? null;
                const solAddr = item.walletDetails.solana?.address ?? null;
                const isActive =
                  !impEvm && !impSol &&
                  (ethAddr ? ethAddr === activeEth : true) &&
                  (solAddr ? solAddr === activeSol : true);
                return { ...item, isActiveAccount: isActive };
              }
            });
            setAccounts(updatedCache);
          }
        }
      } catch (err) {
        console.error("Failed to load cached accounts:", err);
      }
    };
    loadCache();
  }, []);

  useEffect(() => {
    let isMounted = true;
    liveDataLoaded.current = true;

    // 1️⃣ Synchronously merge and display accounts and correct active highlights instantly
    const initialMerged = compileInactiveAddresses(
      ethAccounts,
      solAccounts,
      activeEthAddress?.address ?? null,
      activeSolAddress?.address ?? null,
      importedAccounts,
      activeImportedEvmAddress,
      activeImportedSolAddress
    );
    setAccounts(initialMerged);

    // 2️⃣ Asynchronously fetch fresh balances from RPC in the background
    const fetchBalances = async () => {
      try {
        const { ethereum, solana } = await compileAddressesConcurrently(
          ethAccounts,
          solAccounts
        );
        if (!isMounted) return;

        const freshMerged = compileInactiveAddresses(
          ethereum,
          solana,
          activeEthAddress?.address ?? null,
          activeSolAddress?.address ?? null,
          importedAccounts,
          activeImportedEvmAddress,
          activeImportedSolAddress
        );

        setAccounts(freshMerged);
        await AsyncStorage.setItem("manage_wallets_accounts_cache", JSON.stringify(freshMerged));
      } catch (err) {
        console.warn("Failed fetching fresh balances in background:", err);
      }
    };

    fetchBalances();

    return () => {
      isMounted = false;
    };
  }, [
    ethAccounts,
    solAccounts,
    activeEthAddress,
    activeSolAddress,
    importedAccounts,
    activeImportedEvmAddress,
    activeImportedSolAddress,
    compileAddressesConcurrently,
    compileInactiveAddresses
  ]);


  // -------------------- 3. CREATE NEW WALLET --------------------
  // const createNewWalletPair = useCallback(async () => {
  //   setWalletCreationLoading(true);

  //   try {
  //     const phrase = await getPhrase();
  //     if (!phrase) throw new Error("Seed phrase not found");

  //     const ethService = getEvmService(activeChainId);
  //     if (!ethService) {
  //       console.warn("EVM service not ready yet");
  //       return;
  //     }

  //     const nextEthIndex = ethAccounts.length;
  //     const nextSolIndex = solAccounts.length;

  //     const newEthWallet = await ethService.createWalletByIndex(phrase, nextEthIndex);
  //     const newSolWallet = await solanaService.createWalletByIndex(phrase, nextSolIndex);

  //     const transformedEthWallet: AddressState = {
  //       accountName: `Account ${nextEthIndex + 1}`,
  //       derivationPath: newEthWallet.derivationPath,
  //       address: newEthWallet.address,
  //       publicKey: newEthWallet.publicKey,
  //       balanceByChain: {},
  //       statusByChain: {},
  //       activeBalance: 0,
  //       failedNetworkRequestByChain: {},
  //       transactionMetadataByChain: {
  //         [activeChainId]: { transactions: [], paginationKey: undefined },
  //       },
  //       transactionConfirmations: [],
  //     };

  //     const transformedSolWallet: SAddressState = {
  //       accountName: `Account ${nextSolIndex + 1}`,
  //       derivationPath: newSolWallet.derivationPath,
  //       address: newSolWallet.address,
  //       publicKey: newSolWallet.publicKey,
  //       balance: 0,
  //       transactionMetadata: { paginationKey: undefined, transactions: [] },
  //       failedNetworkRequest: false,
  //       status: GeneralStatus.Idle,
  //       transactionConfirmations: [],
  //     };

  //     // dispatch(updateAddresses({ addresses: [transformedEthWallet] }));
  //     const currentEthAccounts = store.getState().ethereum.globalAddresses || [];
  // dispatch(updateAddresses({ addresses: [...currentEthAccounts, transformedEthWallet] }));

  //     dispatch(updateSolanaAddresses(transformedSolWallet));
  //   } catch (err) {
  //     console.error("Failed to create wallet pair:", err);
  //   } finally {
  //     setWalletCreationLoading(false);
  //   }
  // }, [activeChainId, ethAccounts.length, solAccounts.length, dispatch]);
  const createNewWalletPair = useCallback(async () => {
    setWalletCreationLoading(true);

    try {
      // 1️⃣ Get seed phrase
      const phrase = await getPhrase();
      if (!phrase) throw new Error("Seed phrase not found");

      const ethService = getEvmService(activeChainId);
      if (!ethService) {
        console.warn("EVM service not ready yet");
        return;
      }

      // 2️⃣ Determine next wallet index across BOTH Ethereum and Solana standard accounts
      const standardEthAccounts = ethAccounts.filter(a => !!a.derivationPath);
      let maxEthIndex = 0;
      standardEthAccounts.forEach((acc) => {
        const parts = acc.derivationPath.split("/");
        const idx = parseInt(parts[parts.length - 1]);
        if (!isNaN(idx) && idx >= maxEthIndex) {
          maxEthIndex = idx + 1;
        }
      });

      // 3️⃣ Determine next wallet index for Solana
      const standardSolAccounts = solAccounts.filter(a => !!a.derivationPath);
      let maxSolIndex = 0;
      standardSolAccounts.forEach((acc) => {
        const parts = acc.derivationPath.split("/");
        if (parts.length >= 4) {
          const idxStr = parts[3].replace("'", "");
          const idx = parseInt(idxStr);
          if (!isNaN(idx) && idx >= maxSolIndex) {
            maxSolIndex = idx + 1;
          }
        }
      });

      // Use the maximum index to keep them perfectly synced!
      const nextIndex = Math.max(maxEthIndex, maxSolIndex);
      const nextAccountNum = Math.max(standardEthAccounts.length, standardSolAccounts.length) + 1;

      // 4️⃣ Create Ethereum wallet by index
      const newEthWallet = await ethService.createWalletByIndex(phrase, nextIndex);

      // 5️⃣ Create Solana wallet by index
      const newSolWallet = await solanaService.createWalletByIndex(phrase, nextIndex);

      // 6️⃣ Transform Ethereum wallet for Redux
      const transformedEthWallet: AddressState = {
        accountName: `Account ${nextAccountNum}`,
        derivationPath: newEthWallet.derivationPath,
        address: newEthWallet.address,
        publicKey: newEthWallet.publicKey,
        balanceByChain: {},
        statusByChain: {},
        activeBalance: 0,
        failedNetworkRequestByChain: {},
        transactionMetadataByChain: {
          [activeChainId]: { transactions: [], paginationKey: undefined },
        },
        transactionConfirmations: [],
      };

      // 7️⃣ Transform Solana wallet for Redux
      const transformedSolWallet: SAddressState = {
        accountName: `Account ${nextAccountNum}`,
        derivationPath: newSolWallet.derivationPath,
        address: newSolWallet.address,
        publicKey: newSolWallet.publicKey,
        balance: 0,
        transactionMetadata: { paginationKey: undefined, transactions: [] },
        failedNetworkRequest: false,
        status: GeneralStatus.Idle,
        transactionConfirmations: [],
      };

      // 8️⃣ Dispatch to Redux
      await dispatch(updateAddresses({ addresses: [transformedEthWallet] }));
      await dispatch(updateSolanaAddresses(transformedSolWallet));
    } catch (err) {
      console.error("Failed to create wallet pair:", err);
    } finally {
      setWalletCreationLoading(false);
    }
  }, [activeChainId, ethAccounts, solAccounts, dispatch]);

  // ----- memoizedAccounts -----
  const memoizedAccounts = useMemo(
    () =>
      priceAndBalanceLoading
        ? placeholderArr(ethAccounts.length || 3) // fallback 3 placeholders
        : accounts,
    [priceAndBalanceLoading, ethAccounts.length, accounts]
  );
  const setNextActiveAccounts = useCallback(
    (seedIndex: number) => {
      dispatch(clearActiveImportedAccount());

      // Find the actual globalAddresses index for this seed-derived account
      const seedEthAccounts = ethAccounts.filter(a => !!a.derivationPath);
      const targetAddress = seedEthAccounts[seedIndex]?.address;
      const globalIdx = ethAccounts.findIndex(a => a.address === targetAddress);
      dispatch(setActiveAccount({ index: globalIdx >= 0 ? globalIdx : seedIndex }));

      // Same for Solana
      const seedSolAccounts = solAccounts.filter(a => !!a.derivationPath);
      const targetSolAddress = seedSolAccounts[seedIndex]?.address;
      const solIdx = solAccounts.findIndex(a => a.address === targetSolAddress);
      dispatch(setActiveSolanaAccount(solIdx >= 0 ? solIdx : seedIndex));
    },
    [dispatch, ethAccounts, solAccounts]
  );
  const calculateTotalPrice = useCallback(
    (evmBalances: Record<number, number>, solBalance: number) => {
      const evmTotal = Object.entries(evmBalances).reduce(
        (acc, [chainIdStr, balance]) => {
          const chainId = Number(chainIdStr);
          if (TESTNET_CHAIN_IDS.has(chainId)) {
            return acc;
          }
          const price = prices[chainId]?.usd ?? 0;
          return acc + balance * price;
        },
        0
      );

      const solUsd = selectedSolanaNetwork === "devnet" ? 0 : (prices[101]?.usd ?? 0);
      const total = evmTotal + solBalance * solUsd;

      return formatDollar(total);
    },
    [prices, selectedSolanaNetwork]
  );

  // ----- renderItem -----
  const renderItem = useCallback(
    ({ item, index }) => {
      if (priceAndBalanceLoading) {
        return (
          <WalletSkeletonContainer
            isActiveAccount={false}
            isLast={index === accounts.length - 1}
          >
            <Skeleton
              height={35}
              colors={[theme.colors.grey, theme.colors.dark, theme.colors.dark, theme.colors.grey]}
              width={Dimensions.get("window").width * 0.6}
            />
            <Skeleton
              height={35}
              colors={[theme.colors.grey, theme.colors.dark, theme.colors.dark, theme.colors.grey]}
              width={50}
            />
          </WalletSkeletonContainer>
        );
      }

      const balance = calculateTotalPrice(
        item.walletDetails.ethereum?.balanceByChain ?? {},
        item.walletDetails.solana?.balance ?? 0
      );

      return (
        <WalletContainer
          onPress={() => {
            if (item.isImported) {
              dispatch(setActiveImportedAccount({
                evmAddress: item.walletDetails.ethereum?.address,
                solAddress: item.walletDetails.solana?.address,
              }));
            } else {
              setNextActiveAccounts(item.ethIndex);
            }
            router.back();
          }}
          isActiveAccount={item.isActiveAccount}
          isLast={index === accounts.length - 1}
        >
          <AccountDetails>
            <BlockieAvatar
              address={item.walletDetails.ethereum?.address || item.walletDetails.solana?.address || `account-${index}`}
              size={40}
              borderWidth={2}
              borderColor={item.isActiveAccount ? "rgba(240, 185, 11, 0.4)" : theme.colors.border}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <AccountTitle theme={theme}>{item.accountName}</AccountTitle>
              <PriceText theme={theme}>{item.isImported ? "Imported" : balance}</PriceText>
            </View>
          </AccountDetails>
          <EditIconContainer
            onPress={() =>
              router.push({
                pathname: ROUTES.accountModal,
                params: {
                  ethAddress: item.walletDetails.ethereum?.address ?? "",
                  solAddress: item.walletDetails.solana?.address ?? "",
                  balance,
                },
              })
            }
          >
            <EditIcon width={20} height={20} fill={theme.colors.white} />
          </EditIconContainer>
        </WalletContainer>
      );
    },
    [
      accounts,
      priceAndBalanceLoading,
      calculateTotalPrice,
      setNextActiveAccounts,
      theme.colors.white,
      theme.colors.dark,
      theme.colors.border
    ]
  );


  return (
    <LinearGradientBackground colors={theme.colors.primaryLinearGradient}>
      <SafeAreaContainer edges={["bottom", "left", "right"]}>
        <ScrollContainer showsVerticalScrollIndicator={false}>
          <ContentContainer style={{ paddingTop: insets.top + 60 }}>

            {!(activeImportedEvmAddress || activeImportedSolAddress) && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePhraseAccess}
              >
                <WalletPhraseContainer theme={theme}>
                  <PhraseTextContent>
                    <PhraseIcon width={24} height={24} fill={theme.colors.realWhite} />
                    <SectionTitle style={{ color: theme.colors.realWhite }}>
                      Secret Recovery Phrase
                    </SectionTitle>
                  </PhraseTextContent>
                  <RightArrowIcon width={20} height={20} fill={theme.colors.realWhite} />
                </WalletPhraseContainer>
              </TouchableOpacity>
            )}

            {memoizedAccounts.map((item: any, index: number) => (
              <View key={item.id || item.uniqueId || index}>{renderItem({ item, index })}</View>
            ))}
          </ContentContainer>
        </ScrollContainer>

        <BottomButtonContainer>
          <Button
            backgroundColor={theme.colors.primary}
            color={theme.colors.realWhite}
            loading={walletCreationLoading}
            onPress={createNewWalletPair}
            title="Create Wallet"
          />
        </BottomButtonContainer>

        {isPasswordModalVisible && (
          <Modal
            animationType="fade"
            transparent
            visible={isPasswordModalVisible}
            onRequestClose={() => setIsPasswordModalVisible(false)}
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
                      Enter your wallet password to reveal the secret recovery phrase.
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
                          setEnteredPassword("");
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
      </SafeAreaContainer>
    </LinearGradientBackground>
  );
};

export default memo(AccountsIndex);
