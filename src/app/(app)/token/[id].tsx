import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  Text,
  TouchableOpacity,
  Dimensions,
  Clipboard,
  InteractionManager,
  ActivityIndicator,
} from "react-native";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { router, useLocalSearchParams } from "expo-router";
import styled, { useTheme } from "styled-components/native";
import * as WebBrowser from "expo-web-browser";

import { LineChart, CandlestickChart } from "react-native-wagmi-charts";
import Svg, { Line as SvgLine, Rect as SvgRect } from "react-native-svg";
import type { ThemeType } from "../../../styles/theme";
import type { RootState, AppDispatch } from "../../../store";
import { KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from "react-native";

import { useLoadingState } from "../../../hooks/redux";
import { capitalizeFirstLetter } from "../../../utils/capitalizeFirstLetter";
import { formatDollar } from "../../../utils/formatDollars";
import { placeholderArr } from "../../../utils/placeholder";
import { Chains, GenericTransaction } from "../../../types";
import { GeneralStatus } from "../../../store/types";
import { truncateWalletAddress } from "../../../utils/truncateWalletAddress";
import SendIcon from "../../../assets/svg/send.svg";
import ReceiveIcon from "../../../assets/svg/receive.svg";
import LeftArrow from "../../../assets/svg/left-arrow.svg";
import CopyIcon from "../../../assets/svg/copy.svg";
import { BlockchainIcon } from "../../../components/BlockchainIcon/BlockchainIcon";
import { getChainIconSymbol } from "../../../utils/getChainIconSymbol";
import CryptoInfoCard from "../../../components/CryptoInfoCard/CryptoInfoCard";
import CryptoInfoCardSkeleton from "../../../components/CryptoInfoCard/CryptoInfoCardSkeleton";
import PrimaryButton from "../../../components/PrimaryButton/PrimaryButton";
import { SafeAreaContainer } from "../../../components/Styles/Layout.styles";
import {
  ErrorContainer,
  ErrorText,
} from "../../../components/Styles/Errors.styles";
import { addToken, fetchTokenErc20Balance } from "../../../store/tokenSlice";
import NETWORKS from "../../../services/defaultNetwork";

import Nfts from "../../(wallet)/nfts/nft";
import { addSolToken, fetchSplTokenBalance } from "../../../store/solTokenSlice";
import { getSplTokenMetadata } from "../../../services/solTokenService";
import TokenDetailTabs, { type TabType } from "../../../components/TokenDetailTabs/TokenDetailTabs";
import { fetchMarketData, fetchChartData } from "../../../store/priceSlice";
import { TESTNET_CHAIN_IDS } from "../../../utils/fetchCryptoPrices";
import { fetchEvmBalance, fetchEvmTransactions } from "../../../store/ethereumSlice";
import { fetchSolanaBalance, fetchSolanaTransactions } from "../../../store/solanaSlice";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Stable empty references — selectors return these instead of creating new [] or {}
// which would trigger React's "selector returned different result" warning
const EMPTY_ARRAY: any[] = [];
const EMPTY_OBJ: Record<string, any> = {};

// ═══════════════════════════════════════════════════════════
// STYLED COMPONENTS
// ═══════════════════════════════════════════════════════════

const ContentContainer = styled.View<{ theme: ThemeType }>`
  flex: 1;
  justify-content: flex-start;
  padding: ${(props) => props.theme.spacing.medium};
  margin-top: 0px;
`;

const ChainLogoContainer = styled.View`
  align-items: center;
  margin-vertical: 8px;
`;

const BalanceText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 32px;
  color: ${(props) => props.theme.colors.white};
  text-align: center;
`;

const MarketPriceText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: 14px;
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  margin-top: 8px;
`;

const PriceChangeText = styled.Text<{ positive: boolean; theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 14px;
  color: ${({ positive, theme }) =>
    positive ? "#4ade80" : "#ef4444"};
`;

const TimeSelectorContainer = styled.View`
  flex-direction: row;
  justify-content: center;
  margin-top: 8px;
  margin-bottom: 8px;
`;

const TimeButton = styled.TouchableOpacity<{ active: boolean; theme: ThemeType }>`
  padding-horizontal: 16px;
  padding-vertical: 8px;
  margin-horizontal: 4px;
  border-radius: 8px;
  background-color: ${({ active, theme }) =>
    active ? theme.colors.primary : "transparent"};
`;

const TimeButtonText = styled.Text<{ active: boolean; theme: ThemeType }>`
  font-family: ${({ theme }) => theme.fonts.families.openBold};
  font-size: 12px;
  color: ${({ active, theme }) =>
    active ? theme.colors.darkText : theme.colors.grey};
`;

const SectionTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 20px;
  color: ${(props) => props.theme.colors.white};
  margin-top: 24px;
  margin-bottom: 12px;
`;

const StatRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-vertical: 12px;
  border-bottom-width: 1px;
  border-bottom-color: ${(props) => props.theme.colors.border};
`;

const StatLabel = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: 14px;
  color: ${(props) => props.theme.colors.grey};
`;

const StatValue = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 14px;
  color: ${(props) => props.theme.colors.white};
`;

const AddressRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding-vertical: 16px;
  border-top-width: 1px;
  border-top-color: ${(props) => props.theme.colors.border};
  margin-top: 8px;
`;

const AddressValue = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 14px;
  color: ${(props) => props.theme.colors.white};
`;

const ActionContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 16px;
  margin-bottom: 24px;
`;

const NoChartText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openRegular};
  font-size: 14px;
  color: ${(props) => props.theme.colors.grey};
  text-align: center;
  margin-vertical: 40px;
`;

const AddTokenButton = styled.TouchableOpacity<{ theme: ThemeType }>`
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.cardBackground};
  border: 1px dashed ${({ theme }) => theme.colors.primary};
  border-radius: 16px;
  padding: 16px;
  margin-bottom: ${({ theme }) => theme.spacing.medium};
  width: 100%;
`;

const AddTokenIcon = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 22px;
  color: ${({ theme }) => theme.colors.primary};
  margin-right: 10px;
`;

const AddTokenText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${({ theme }) => theme.colors.primary};
`;

const FilterContainer = styled.View<{ theme: ThemeType }>`
  flex-direction: row;
  width: 100%;
  margin-bottom: ${(props) => props.theme.spacing.tiny};
  margin-top: 0px;
`;

const FilterButton = styled.TouchableOpacity<{
  theme: ThemeType;
  highlighted: boolean;
}>`
  background-color: ${({ theme, highlighted }) => {
    return highlighted ? theme.colors.primary : theme.colors.dark;
  }};
  height: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 35px;
  border-radius: 8px;
  margin-right: 5px;
  padding: 0 20px;
`;

const FilterText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.normal};
  color: ${(props) => props.theme.colors.white};
  text-align: center;
`;

const EmptyText = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: ${(props) => props.theme.fonts.sizes.header};
  color: ${(props) => props.theme.colors.lightGrey};
  text-align: center;
  margin-top: 40px;
`;

enum FilterTypes {
  ALL,
  RECEIVE,
  SENT,
}

// (react-native-chart-kit getChartConfig removed in favor of react-native-wagmi-charts)

const TIME_PERIODS = [
  { label: "1D", value: "1" },
  { label: "1W", value: "7" },
  { label: "1M", value: "30" },
  { label: "3M", value: "90" },
  { label: "1Y", value: "365" },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

// Header component for chain name
const HeaderTitle = styled.Text<{ theme: ThemeType }>`
  font-family: ${(props) => props.theme.fonts.families.openBold};
  font-size: 18px;
  color: ${(props) => props.theme.colors.white};
  text-align: center;
  flex: 1;
`;

const FloatingButtonContainer = styled.View`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  flex-direction: row;
  justify-content: space-between;
  z-index: 100;
  gap: 12px;
  background-color: ${({ theme }) => theme.colors.darker};
  padding-horizontal: 16px;
  padding-vertical: 16px;
  border-top-width: 1px;
  border-top-color: ${({ theme }) => theme.colors.border};
`;



const FloatingButton = styled.TouchableOpacity<{ theme: ThemeType; variant?: "send" | "receive" }>`
  flex: 1;
  height: 50px;
  border-radius: 16px;
  background-color: ${({ variant, theme }) =>
    variant === "send" ? theme.colors.primary : "transparent"};
  border-width: ${({ variant }) => (variant === "receive" ? 1 : 0)}px;
  border-color: ${({ variant, theme }) =>
    variant === "receive" ? theme.colors.primary : theme.colors.white};
  justify-content: center;
  align-items: center;
`;


const FloatingButtonText = styled.Text<{ variant?: "send" | "receive"; theme: ThemeType }>`
  font-family: ${({ theme }) => theme.fonts.families.openBold};
  font-size: 16px;
  color: ${({ variant, theme }) =>
    variant === "send" ? theme.colors.darkText : theme.colors.white};
`;


export default function Index() {
  const dispatch = useDispatch<AppDispatch>();
  const { id, asset } = useLocalSearchParams();
  const assetObj = asset ? JSON.parse(asset as string) : null;
  const mockCandlesRef = useRef<Record<string, any[]>>({});

  const symbol = assetObj?.symbol;
  let numberOfTokens = assetObj?.numberOfTokens ?? 0;
  const chainId = assetObj?.chainId;
  const price = assetObj?.price ?? 0;

  const theme = useTheme();
  const isStateLoading = useLoadingState();
  const chainName = id as string;

  const isSolana = chainName === Chains.Solana;
  const isEvm = !isSolana && chainName !== "";
  const selectedSolanaNetwork = useSelector((state: RootState) => state.solana.selectedNetwork ?? "devnet");

  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [selectedPeriod, setSelectedPeriod] = useState("1");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(FilterTypes.ALL);
  const [erc20ModalVisible, setErc20ModalVisible] = useState(false);
  const [erc20Contract, setErc20Contract] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewToken, setPreviewToken] = useState<any>(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    if (!erc20ModalVisible) {
      setPreviewToken(null);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }

    const trimmed = erc20Contract.trim();
    const isSolAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

    if (isSolana && isSolAddress) {
      setPreviewLoading(true);
      setPreviewError("");
      setPreviewToken(null);

      const delayDebounce = setTimeout(async () => {
        try {
          const metadata = await getSplTokenMetadata(trimmed, selectedSolanaNetwork);
          if (metadata) {
            setPreviewToken({
              mint: trimmed,
              name: metadata.name,
              symbol: metadata.symbol,
              decimals: metadata.decimals,
              logo: metadata.logo,
              programId: metadata.programId,
            });
          } else {
            setPreviewError("No token metadata found for this address.");
          }
        } catch (err) {
          setPreviewError("Failed to fetch token metadata.");
        } finally {
          setPreviewLoading(false);
        }
      }, 500);

      return () => clearTimeout(delayDebounce);
    } else {
      setPreviewToken(null);
      setPreviewError("");
      setPreviewLoading(false);
    }
  }, [erc20Contract, erc20ModalVisible, isSolana, selectedSolanaNetwork]);

  // Use chainId from route params (the actual chain being viewed)
  const activeChainId = chainId ?? useSelector(
    (state: RootState) => state.ethereum.activeChainId
  );

  const storeBalance = useSelector((state: RootState) => {
    if (isSolana) {
      const solIdx = state.solana.activeIndex ?? 0;
      const importedSol = state.importedAccounts?.activeSolAddress;
      const currentSolAccount = importedSol
        ? state.solana.addresses?.find((a) => a.address === importedSol)
        : state.solana.addresses?.[solIdx];
      return currentSolAccount?.balance ?? 0;
    }
    const idx = state.ethereum.activeIndex ?? 0;
    const importedEvm = state.importedAccounts?.activeEvmAddress;
    const currentEvmAccount = importedEvm
      ? state.ethereum.globalAddresses?.find((a) => a.address?.toLowerCase() === importedEvm.toLowerCase())
      : state.ethereum.globalAddresses?.[idx];
    return currentEvmAccount?.balanceByChain?.[activeChainId] ?? 0;
  });

  numberOfTokens = storeBalance !== undefined ? storeBalance : numberOfTokens;

  const isSecureChain = false;

  const erc20Tokens = useSelector(
    (state: RootState) =>
      state.erc20.trackedTokens?.filter((t) => t.chainId === activeChainId) ?? EMPTY_ARRAY,
    shallowEqual
  );

  const erc20Balances = useSelector(
    (state: RootState) => state.erc20?.balances ?? EMPTY_OBJ
  );

  const solTrackedTokens = useSelector(
    (state: RootState) => {
      const activeSolNetwork = state.solana.selectedNetwork ?? "devnet";
      return state.solToken.trackedTokens?.filter((t) => t.network === activeSolNetwork) ?? EMPTY_ARRAY;
    },
    shallowEqual
  );

  const solBalances = useSelector(
    (state: RootState) => state.solToken.balances
  );

  const tokenAddress = useSelector((state: RootState) => {
    const isSolana = chainName === "solana";
    if (isSolana) {
      const activeIndex = state.solana.activeIndex ?? 0;
      const importedSol = state.importedAccounts?.activeSolAddress;
      if (importedSol) return importedSol;
      return state.solana.addresses?.[activeIndex]?.address ?? "";
    }
    // EVM
    const importedEvm = state.importedAccounts?.activeEvmAddress;
    if (importedEvm) return importedEvm;
    const activeIndex = state.ethereum.activeIndex ?? 0;
    return state.ethereum.globalAddresses?.[activeIndex]?.address ?? "";
  });

  const isTestnet = useMemo(() => {
    if (isSolana) {
      return selectedSolanaNetwork === "devnet";
    }
    return TESTNET_CHAIN_IDS.has(Number(activeChainId));
  }, [isSolana, selectedSolanaNetwork, activeChainId]);

  const [transitionFinished, setTransitionFinished] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTransitionFinished(true);
    }, 500); // 0.5s delay to ensure smooth page transition and load from cache
    return () => clearTimeout(timer);
  }, []);


  // Market Data
  const marketData = useSelector(
    (state: RootState) => state.price.marketData[activeChainId]
  );
  const chartData = useSelector(
    (state: RootState) => state.price.chartData[`${activeChainId}:${selectedPeriod}`]
  );
  const chartDataStatus = useSelector(
    (state: RootState) => state.price.chartDataStatus
  );
  const isChartLoading = chartDataStatus === GeneralStatus.Loading;

  const chartPrices = chartData?.prices ?? EMPTY_ARRAY;
  const hasChartData = !isTestnet && chartPrices.length > 1;

  const wagmiChartData = useMemo(() => {
    if (isTestnet) {
      return [
        { timestamp: Date.now() - 86400000, value: 0 },
        { timestamp: Date.now(), value: 0 }
      ];
    }
    if (!hasChartData) return [];
    return chartPrices.map((p: any) => ({
      timestamp: p.timestamp,
      value: p.price,
    }));
  }, [chartPrices, hasChartData, isTestnet]);

  const { minPrice, maxPrice, midPrice } = useMemo(() => {
    if (wagmiChartData.length === 0) return { minPrice: 0, maxPrice: 0, midPrice: 0 };
    const prices = wagmiChartData.map(d => d.value);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const mid = (min + max) / 2;
    return { minPrice: min, maxPrice: max, midPrice: mid };
  }, [wagmiChartData]);

  // Compute 30 high-fidelity candlesticks (open, high, low, close, timestamp)
  const tokenKey = `${id}:${symbol ?? ""}`;
  const candlestickData = useMemo(() => {
    if (isTestnet) {
      if (!mockCandlesRef.current[tokenKey]) {
        // Create high-fidelity dummy candles for a premium feel
        const mockCandles = [];
        let prevClose = 2000;
        const now = Date.now();
        const candlesCount = 30;
        const interval = 86400000 / candlesCount;
        for (let i = 0; i < candlesCount; i++) {
          const timestamp = now - (candlesCount - i) * interval;
          const change = (Math.random() - 0.48) * 30;
          const open = prevClose;
          const close = prevClose + change;
          const high = Math.max(open, close) + Math.random() * 10;
          const low = Math.min(open, close) - Math.random() * 10;
          mockCandles.push({
            timestamp,
            open,
            high,
            low,
            close,
          });
          prevClose = close;
        }
        mockCandlesRef.current[tokenKey] = mockCandles;
      }
      return mockCandlesRef.current[tokenKey];
    }

    if (!wagmiChartData || wagmiChartData.length === 0) return [];

    const points = wagmiChartData;
    const numCandles = Math.min(points.length, 30);
    if (numCandles < 2) {
      // fallback in case there are very few data points
      return points.map(p => ({
        timestamp: p.timestamp,
        open: p.value,
        high: p.value * 1.002,
        low: p.value * 0.998,
        close: p.value,
      }));
    }

    const pointsPerCandle = Math.ceil(points.length / numCandles);
    const candles = [];

    for (let i = 0; i < numCandles; i++) {
      const startIdx = i * pointsPerCandle;
      const endIdx = Math.min(startIdx + pointsPerCandle, points.length);
      if (startIdx >= points.length) break;

      const chunk = points.slice(startIdx, endIdx);
      if (chunk.length === 0) continue;

      const values = chunk.map(p => p.value);
      const open = chunk[0].value;
      const close = chunk[chunk.length - 1].value;
      const high = Math.max(...values);
      const low = Math.min(...values);
      const timestamp = chunk[Math.floor(chunk.length / 2)].timestamp;

      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
      });
    }
    return candles;
  }, [wagmiChartData, isTestnet]);

  // Compute min, max, mid bounds over the actual candlestick high/low levels
  const { minCandlePrice, maxCandlePrice, midCandlePrice } = useMemo(() => {
    if (candlestickData.length === 0) return { minCandlePrice: 0, maxCandlePrice: 0, midCandlePrice: 0 };
    const highs = candlestickData.map(c => c.high);
    const lows = candlestickData.map(c => c.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const mid = (min + max) / 2;
    return { minCandlePrice: min, maxCandlePrice: max, midCandlePrice: mid };
  }, [candlestickData]);

  // Compute realistic volumes for our candles
  const volumeData = useMemo(() => {
    if (candlestickData.length === 0) return [];
    return candlestickData.map((c, index) => {
      const spread = c.high - c.low;
      const body = Math.abs(c.close - c.open);
      const base = (spread + body) * (0.6 + (index % 5) * 0.1) + 10;
      return {
        value: base,
        isPositive: c.close >= c.open,
      };
    });
  }, [candlestickData]);

  const maxVolume = useMemo(() => {
    if (volumeData.length === 0) return 1;
    return Math.max(...volumeData.map(v => v.value));
  }, [volumeData]);

  // Artificially extend the Y-domain limits to create separate visual layers
  const { mappedMinPrice, mappedMaxPrice, mappedMidPrice } = useMemo(() => {
    const diff = maxCandlePrice - minCandlePrice;
    const paddingBottom = diff * 0.35 || 1; // 35% empty space at bottom for volume
    const paddingTop = diff * 0.05 || 0.1;   // 5% margin at the top
    const min = Math.max(0, minCandlePrice - paddingBottom);
    const max = maxCandlePrice + paddingTop;
    const mid = (min + max) / 2;
    return { mappedMinPrice: min, mappedMaxPrice: max, mappedMidPrice: mid };
  }, [minCandlePrice, maxCandlePrice]);

  // Transaction history
  const transactionHistory = useSelector((state: RootState) => {
    if (!chainName) return EMPTY_ARRAY;
    const isSolana = chainName === "solana";
    if (isSolana) {
      const activeIndex = state.solana.activeIndex ?? 0;
      const importedSol = state.importedAccounts?.activeSolAddress;
      const account = importedSol
        ? state.solana.addresses?.find(a => a.address === importedSol)
        : state.solana.addresses?.[activeIndex];
      return account?.transactionMetadata?.transactions ?? EMPTY_ARRAY;
    }
    const importedEvm = state.importedAccounts?.activeEvmAddress;
    const activeIndex = state.ethereum.activeIndex ?? 0;
    const account = importedEvm
      ? state.ethereum.globalAddresses?.find(a => a.address?.toLowerCase() === importedEvm.toLowerCase())
      : state.ethereum.globalAddresses?.[activeIndex];
    return account?.transactionMetadataByChain?.[activeChainId]?.transactions ?? EMPTY_ARRAY;
  }, shallowEqual);

  const failedStatus = useSelector((state: RootState) => {
    if (!chainName) return false;
    const isSolana = chainName === "solana";
    if (isSolana) {
      const activeIndex = state.solana.activeIndex ?? 0;
      const account = state.solana.addresses?.[activeIndex];
      return account?.status === GeneralStatus.Failed;
    }
    const activeIndex = state.ethereum.activeIndex ?? 0;
    const account = state.ethereum.globalAddresses?.[activeIndex];
    return account?.statusByChain?.[activeChainId] === GeneralStatus.Failed;
  });



  // Fetch market data + chart on mount / period change
  useEffect(() => {
    if (chainId && activeTab === "info" && !isTestnet) {
      if (__DEV__) console.log("[id.tsx] Fetching data for chainId:", chainId, "price from assetObj:", price);
      dispatch(fetchMarketData(Number(chainId)));
      dispatch(fetchChartData({ chainId: Number(chainId), days: selectedPeriod }));
    }
  }, [chainId, selectedPeriod, activeTab, dispatch, isTestnet]);

  // Debug: log marketData when it changes
  useEffect(() => {
    if (__DEV__) console.log("[id.tsx] marketData updated:", marketData ? {
      price: marketData.price,
      marketCap: marketData.marketCap,
      totalVolume: marketData.totalVolume,
      ath: marketData.ath,
      atl: marketData.atl,
    } : "undefined");
  }, [marketData]);

  // Debug: log chartData when it changes
  useEffect(() => {
    const key = `${chainId}:${selectedPeriod}`;
    if (__DEV__) console.log("[id.tsx] chartData updated for key:", key, "hasData:", !!chartData, "points:", chartData?.prices?.length ?? 0);
  }, [chartData, chainId, selectedPeriod]);

  // Fetch token balances
  useEffect(() => {
    if (!tokenAddress || !erc20Tokens.length) return;
    erc20Tokens.forEach((t) => {
      dispatch(
        fetchTokenErc20Balance({
          chainId: t.chainId,
          token: t.token,
          wallet: tokenAddress,
        })
      );
    });
  }, [erc20Tokens, tokenAddress, dispatch]);

  useEffect(() => {
    if (!tokenAddress || !solTrackedTokens.length || !isSolana) return;
    solTrackedTokens.forEach((t) => {
      dispatch(fetchSplTokenBalance({ mint: t.mint, wallet: tokenAddress }));
    });
  }, [solTrackedTokens, tokenAddress, isSolana, dispatch]);

  useEffect(() => {
    if (!tokenAddress) return;
    if (isSolana) {
      dispatch(fetchSolanaBalance(tokenAddress));
      dispatch(fetchSolanaTransactions(tokenAddress));
    } else if (isEvm) {
      dispatch(fetchEvmBalance({ chainId: Number(activeChainId), address: tokenAddress }));
      dispatch(fetchEvmTransactions({ chainId: Number(activeChainId), address: tokenAddress }));
    }
  }, [tokenAddress, isSolana, isEvm, activeChainId, dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (chainId && !isTestnet) {
      dispatch(fetchMarketData(Number(chainId)));
      dispatch(fetchChartData({ chainId: Number(chainId), days: selectedPeriod }));
    }
    setTimeout(() => setRefreshing(false), 2000);
  }, [chainId, selectedPeriod, dispatch, isTestnet]);

  const handleCopyAddress = () => {
    Clipboard.setString(tokenAddress);
  };

  const allNetworks = useSelector((state: RootState) => state.ethereum.networks);

  const urlBuilder = (hash: string, solanaNetwork?: "mainnet" | "devnet") => {
    if (isSolana) {
      const solNetwork = solanaNetwork || selectedSolanaNetwork;
      return solNetwork === "devnet"
        ? `https://explorer.solana.com/tx/${hash}?cluster=devnet`
        : `https://explorer.solana.com/tx/${hash}`;
    }
    // First check Redux networks (includes custom chains), then fall back to hardcoded list
    const net = allNetworks[activeChainId] || NETWORKS.find(n => n.chainId === activeChainId);
    const base = net?.explorerUrl || "https://etherscan.io";
    return `${base}/tx/${hash}`;
  };

  // ═══════════════════════════════════════════════════════════
  // INFO TAB CONTENT
  // ═══════════════════════════════════════════════════════════

  const renderInfoTab = () => {
    const md = isTestnet ? undefined : marketData;
    const displayPrice = isTestnet ? 0 : (md?.price ?? price ?? 0);
    const priceChangePct = isTestnet ? 0 : (md?.priceChangePercentage24h ?? 0);
    const isPositive = priceChangePct >= 0;

    const isLightTheme = theme.colors.background === "#F4F6FA";
    const gridlineColor = isLightTheme ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.06)";
    const badgeBg = isLightTheme ? "#0B0E14" : "#FFFFFF";
    const badgeTextColor = isLightTheme ? "#FFFFFF" : "#111111";
    const lastPriceLineColor = isLightTheme ? "rgba(11, 14, 20, 0.4)" : "rgba(255, 255, 255, 0.35)";

    const formatStatValue = (value: number | undefined, isCurrency = true): string => {
      if (value === undefined || value === null || isNaN(value) || value === 0) {
        return "$0.00";
      }
      const prefix = isCurrency ? "$" : "";
      if (value >= 1e9) {
        return `${prefix}${(value / 1e9).toFixed(3)}B USD`;
      }
      if (value >= 1e6) {
        return `${prefix}${(value / 1e6).toFixed(2)}M USD`;
      }
      return `${prefix}${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)} USD`;
    };

    return (
      <>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.white}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <ContentContainer>
            {/* Chain Logo */}
            <ChainLogoContainer>
              <BlockchainIcon
                symbol={getChainIconSymbol(chainName, symbol, chainId)}
                chainId={chainId}
                chainName={chainName}
                size={60}
              />
            </ChainLogoContainer>

            {/* Balance */}
            <BalanceText>
              {numberOfTokens} {isSolana ? "SOL" : symbol}
            </BalanceText>

            {/* Market Price */}
            <MarketPriceText>
              Market Price:{" "}
              {formatDollar(displayPrice)}USD{" "}
              <PriceChangeText positive={isPositive}>
                ({isPositive ? "+" : ""}
                {priceChangePct.toFixed(3)}%)
              </PriceChangeText>
            </MarketPriceText>

            {/* Chart Container - Fixed Height to Prevent Layout Shakes */}
            <View style={{ height: 280, width: SCREEN_WIDTH - 32, alignSelf: "center", marginTop: 16, overflow: "hidden" }}>
              {!transitionFinished || (isChartLoading && !hasChartData && !isTestnet) ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.cardBackground, borderRadius: 16 }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginBottom: 8 }} />
                  <Text style={{ fontFamily: theme.fonts.families.openRegular, color: theme.colors.lightGrey, fontSize: 14 }}>
                    Loading chart...
                  </Text>
                </View>
              ) : hasChartData && candlestickData.length > 1 ? (
                <CandlestickChart.Provider data={candlestickData} valueRangeY={[mappedMinPrice, mappedMaxPrice]}>
                  {/* Dynamic interactive header */}
                  <View style={{ height: 60, justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
                    <CandlestickChart.PriceText
                      precision={6}
                      format={({ value }) => {
                        'worklet';
                        if (!value) return '';
                        const val = parseFloat(value);
                        if (isNaN(val)) return '';
                        let decimals = 2;
                        if (val > 0 && val < 0.01) {
                          decimals = 6;
                        } else if (val > 0 && val < 1) {
                          decimals = 4;
                        }
                        return '$' + val.toFixed(decimals) + ' USD';
                      }}
                      style={{
                        fontFamily: theme.fonts.families.openBold,
                        fontSize: 24,
                        color: theme.colors.white,
                      }}
                    />
                    <CandlestickChart.DatetimeText
                      format={({ value }) => {
                        'worklet';
                        if (!value) return '';
                        const date = new Date(value);
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                      }}
                      style={{
                        fontFamily: theme.fonts.families.openRegular,
                        fontSize: 12,
                        color: theme.colors.lightGrey,
                        marginTop: 4,
                      }}
                    />
                  </View>

                  {/* Chart Row */}
                  <View style={{ flexDirection: "row", alignItems: "center", position: "relative" }}>
                    
                    {/* Gridlines Background Backdrop */}
                    <View style={{ position: "absolute", left: 0, top: 0, width: SCREEN_WIDTH - 32 - 73, height: 180, pointerEvents: "none" }}>
                      <Svg width={SCREEN_WIDTH - 32 - 73} height={180}>
                        {/* Horizontal Grid lines */}
                        <SvgLine x1="0" y1="0" x2={SCREEN_WIDTH - 32 - 73} y2="0" stroke={gridlineColor} strokeWidth="1" />
                        <SvgLine x1="0" y1="36" x2={SCREEN_WIDTH - 32 - 73} y2="36" stroke={gridlineColor} strokeWidth="1" />
                        <SvgLine x1="0" y1="72" x2={SCREEN_WIDTH - 32 - 73} y2="72" stroke={gridlineColor} strokeWidth="1" />
                        <SvgLine x1="0" y1="108" x2={SCREEN_WIDTH - 32 - 73} y2="108" stroke={gridlineColor} strokeWidth="1" />
                        <SvgLine x1="0" y1="144" x2={SCREEN_WIDTH - 32 - 73} y2="144" stroke={gridlineColor} strokeWidth="1" />
                        
                        {/* Vertical Grid lines */}
                        <SvgLine x1={(SCREEN_WIDTH - 32 - 73) * 0.33} y1="0" x2={(SCREEN_WIDTH - 32 - 73) * 0.33} y2="180" stroke={gridlineColor} strokeWidth="1" />
                        <SvgLine x1={(SCREEN_WIDTH - 32 - 73) * 0.66} y1="0" x2={(SCREEN_WIDTH - 32 - 73) * 0.66} y2="180" stroke={gridlineColor} strokeWidth="1" />
                      </Svg>
                    </View>

                    {/* SVG Volume Bars Overlay at bottom */}
                    <View style={{ position: "absolute", left: 0, bottom: 0, width: SCREEN_WIDTH - 32 - 73, height: 180, pointerEvents: "none" }}>
                      <Svg width={SCREEN_WIDTH - 32 - 73} height={180}>
                        {volumeData.map((v, i) => {
                          const barHeight = (v.value / maxVolume) * 28; // volume height cap 28px in its own layer
                          const width = SCREEN_WIDTH - 32 - 73;
                          const barWidth = (width / volumeData.length) * 0.7;
                          const x = i * (width / volumeData.length) + (width / volumeData.length - barWidth) / 2;
                          const y = 178 - barHeight; // base of volume bars is at 178px
                          return (
                            <SvgRect
                              key={i}
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              fill={v.isPositive ? "rgba(163, 230, 53, 0.35)" : "rgba(255, 96, 115, 0.35)"}
                              rx={1}
                            />
                          );
                        })}
                      </Svg>
                    </View>

                    {/* Horizontal Dashed/Dotted Line at Latest Price */}
                    {(() => {
                      const lastPriceObj = candlestickData[candlestickData.length - 1];
                      if (!lastPriceObj) return null;
                      const lastPrice = lastPriceObj.close;
                      let ratio = 0.5;
                      if (mappedMaxPrice !== mappedMinPrice) {
                        ratio = (mappedMaxPrice - lastPrice) / (mappedMaxPrice - mappedMinPrice);
                      }
                      const lastPriceY = Math.max(10, Math.min(170, ratio * 180)); // scaled correctly against padded limits
                      
                      return (
                        <>
                          {/* Dashed line */}
                          <View
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 73,
                              top: lastPriceY,
                              borderStyle: "dashed",
                              borderWidth: 0.8,
                              borderColor: lastPriceLineColor,
                              height: 0,
                              zIndex: 5,
                            }}
                          />
                          {/* Price Pill Badge Overlay on the Right price axis */}
                          <View
                            style={{
                              position: "absolute",
                              right: 0,
                              top: lastPriceY - 8,
                              width: 68,
                              backgroundColor: badgeBg,
                              borderRadius: 3,
                              paddingHorizontal: 4,
                              paddingVertical: 2,
                              zIndex: 10,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={{
                                fontFamily: theme.fonts.families.openBold,
                                fontSize: 9,
                                color: badgeTextColor,
                              }}
                            >
                              {(() => {
                                const val = lastPrice;
                                if (val >= 1000) {
                                  return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
                                }
                                let dec = 2;
                                if (val > 0 && val < 0.01) {
                                  dec = 6;
                                } else if (val > 0 && val < 1) {
                                  dec = 4;
                                }
                                return val.toLocaleString(undefined, {
                                  minimumFractionDigits: dec,
                                  maximumFractionDigits: dec,
                                });
                              })()}
                            </Text>
                          </View>
                        </>
                      );
                    })()}

                    {/* Interactive Candlestick Chart */}
                    <CandlestickChart height={180} width={SCREEN_WIDTH - 32 - 73}>
                      <CandlestickChart.Candles positiveColor="#A3E635" negativeColor="#fa6775" />
                      <CandlestickChart.Crosshair color={theme.colors.primary}>
                        <CandlestickChart.Tooltip
                          style={{ backgroundColor: badgeBg }}
                          textStyle={{ color: badgeTextColor }}
                          tooltipTextProps={{
                            precision: 6,
                            format: ({ value }) => {
                              'worklet';
                              if (!value) return '';
                              const val = parseFloat(value);
                              if (isNaN(val)) return '';
                              let decimals = 2;
                              if (val > 0 && val < 0.01) {
                                decimals = 6;
                              } else if (val > 0 && val < 1) {
                                decimals = 4;
                              }
                              return val.toFixed(decimals);
                            }
                          }}
                        />
                      </CandlestickChart.Crosshair>
                    </CandlestickChart>

                    {/* Right Y-axis labels */}
                    <View style={{ width: 65, height: 144, justifyContent: "space-between", marginLeft: 8, alignSelf: "flex-start" }}>
                      {(() => {
                        const diff = mappedMaxPrice - mappedMinPrice;
                        const priceStep1 = mappedMaxPrice;
                        const priceStep2 = mappedMaxPrice - diff * 0.25;
                        const priceStep3 = mappedMidPrice;
                        const priceStep4 = mappedMinPrice + diff * 0.25;
                        const priceStep5 = mappedMinPrice;
                        return (
                          <>
                            <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 10, color: theme.colors.lightGrey, textAlign: "left" }}>
                              {formatDollar(priceStep1)}
                            </Text>
                            <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 10, color: theme.colors.grey, textAlign: "left" }}>
                              {formatDollar(priceStep2)}
                            </Text>
                            <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 10, color: theme.colors.grey, textAlign: "left" }}>
                              {formatDollar(priceStep3)}
                            </Text>
                            <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 10, color: theme.colors.grey, textAlign: "left" }}>
                              {formatDollar(priceStep4)}
                            </Text>
                            <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 10, color: theme.colors.lightGrey, textAlign: "left" }}>
                              {formatDollar(priceStep5)}
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                  </View>

                  {/* Dates X-Axis display underneath the volume bars */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", width: SCREEN_WIDTH - 32 - 73, marginTop: 8, paddingHorizontal: 12 }}>
                    {(() => {
                      if (candlestickData.length < 2) return null;
                      const formatDate = (ts: number) => {
                        const date = new Date(ts);
                        if (selectedPeriod === "1") {
                          const hrs = date.getHours().toString().padStart(2, '0');
                          const mins = date.getMinutes().toString().padStart(2, '0');
                          return `${hrs}:${mins}`;
                        }
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      };
                      const startText = formatDate(candlestickData[0].timestamp);
                      const midText = formatDate(candlestickData[Math.floor(candlestickData.length / 2)].timestamp);
                      const endText = formatDate(candlestickData[candlestickData.length - 1].timestamp);
                      return (
                        <>
                          <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 9, color: theme.colors.grey }}>
                            {startText}
                          </Text>
                          <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 9, color: theme.colors.grey }}>
                            {midText}
                          </Text>
                          <Text style={{ fontFamily: theme.fonts.families.openRegular, fontSize: 9, color: theme.colors.grey }}>
                            {endText}
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                </CandlestickChart.Provider>
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <NoChartText>No chart data available</NoChartText>
                </View>
              )}
            </View>

            {/* Time period selectors - ALWAYS visible */}
            <TimeSelectorContainer>
              {TIME_PERIODS.map((period) => (
                <TimeButton
                  key={period.value}
                  active={selectedPeriod === period.value}
                  onPress={() => setSelectedPeriod(period.value)}
                >
                  <TimeButtonText active={selectedPeriod === period.value}>
                    {period.label}
                  </TimeButtonText>
                </TimeButton>
              ))}
            </TimeSelectorContainer>

            {/* Stats - HIDDEN for SecureChain */}
            {!isSecureChain && (
              <>
                <SectionTitle>Stats</SectionTitle>
                {[
                  { label: "Market Cap", value: formatStatValue(md?.marketCap) },
                  { label: "Current Volume", value: formatStatValue(md?.totalVolume) },
                  { label: "Max Volume", value: formatStatValue(md?.totalVolume) },
                  { label: "1 Year Low", value: md?.atl ? `${formatDollar(md.atl)} USD` : "$0.00" },
                  { label: "1 Year High", value: md?.ath ? `${formatDollar(md.ath)} USD` : "$0.00" },
                ].map((stat) => (
                  <StatRow key={stat.label}>
                    <StatLabel>{stat.label}</StatLabel>
                    <StatValue>{stat.value}</StatValue>
                  </StatRow>
                ))}
              </>
            )}

            {/* Address */}
            <AddressRow>
              <StatLabel>Address</StatLabel>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <AddressValue>{truncateWalletAddress(tokenAddress)}</AddressValue>
                <TouchableOpacity onPress={handleCopyAddress} style={{ marginLeft: 8 }}>
                  <CopyIcon fill={theme.colors.primary} width={18} height={18} />
                </TouchableOpacity>
              </View>
            </AddressRow>
          </ContentContainer>
        </ScrollView>

        {/* Floating Send/Receive Buttons */}
        <FloatingButtonContainer>
          <FloatingButton
            variant="send"
            onPress={() =>
              router.push({
                pathname: `token/send/${chainName}`,
                params: {
                  chainId: activeChainId,
                  solAddess: assetObj?.address,
                  nativeTokenSymbol: symbol,
                  isNative: "true",
                },
              })
            }
          >
            <FloatingButtonText variant="send">Send</FloatingButtonText>
          </FloatingButton>
          <FloatingButton
            variant="receive"
            onPress={() => router.push(`token/receive/${chainName}`)}
          >
            <FloatingButtonText>Receive</FloatingButtonText>
          </FloatingButton>
        </FloatingButtonContainer>
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // ACTIVITY TAB CONTENT
  // ═══════════════════════════════════════════════════════════

  const filteredTransactions = useMemo(() => {
    switch (filter) {
      case FilterTypes.RECEIVE:
        return transactionHistory.filter((item) => item?.direction === "received");
      case FilterTypes.SENT:
        return transactionHistory.filter((item) => item?.direction === "sent");
      default:
        return transactionHistory;
    }
  }, [transactionHistory, filter]);

  const renderTransactionItem = ({ item }: { item: any }) => {
    if (isStateLoading) {
      return <CryptoInfoCardSkeleton hideBackground={true} />;
    }
    if (failedStatus) {
      return (
        <ErrorContainer>
          <ErrorText>There seems to be a network error, please try again later</ErrorText>
        </ErrorContainer>
      );
    }
    if (!item) return null;

    const sign = item.direction === "received" ? "+" : "-";
    return (
      <CryptoInfoCard
        onPress={() => _handlePressButtonAsync(urlBuilder(item.hash, item.solanaNetwork))}
        title={capitalizeFirstLetter(item.direction)}
        caption={item.direction === "received" ? `From ${truncateWalletAddress(item.from)}` : `To ${truncateWalletAddress(item.to)}`}
        details={`${sign} ${item.value} ${item.asset}`}
      />
    );
  };

  const _handlePressButtonAsync = async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
  };

  const renderActivityTab = () => {
    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.white} />
        }
      >
        <ContentContainer>
          <FilterContainer>
            <FilterButton
              onPress={() => !isStateLoading && setFilter(FilterTypes.ALL)}
              highlighted={filter === FilterTypes.ALL}
            >
              <FilterText>All</FilterText>
            </FilterButton>
            <FilterButton
              onPress={() => !isStateLoading && setFilter(FilterTypes.RECEIVE)}
              highlighted={filter === FilterTypes.RECEIVE}
            >
              <FilterText>Received</FilterText>
            </FilterButton>
            <FilterButton
              onPress={() => !isStateLoading && setFilter(FilterTypes.SENT)}
              highlighted={filter === FilterTypes.SENT}
            >
              <FilterText>Sent</FilterText>
            </FilterButton>
          </FilterContainer>

          {filteredTransactions.length === 0 && !isStateLoading && (
            <EmptyText>
              {isSolana
                ? `Add some ${symbol} to your wallet`
                : `Add some ${symbol} to your wallet`}
            </EmptyText>
          )}

          {filteredTransactions.map((item, index) => (
            <View key={`${item?.uniqueId || 'tx'}-${index}`}>
              {renderTransactionItem({ item })}
            </View>
          ))}
        </ContentContainer>
      </ScrollView>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // TOKEN TAB CONTENT
  // ═══════════════════════════════════════════════════════════

  const renderTokenTab = () => {
    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.white} />
        }
      >
        <ContentContainer>
          <AddTokenButton onPress={() => setErc20ModalVisible(true)}>
            <AddTokenIcon>+</AddTokenIcon>
            <AddTokenText>Add New Token</AddTokenText>
          </AddTokenButton>

          {/* ERC-20 Tokens */}
          {erc20Tokens?.map((t) => {
            const key = `${t.chainId}:${t.token.toLowerCase()}`;
            const data = erc20Balances[key];
            if (!data) return null;
            return (
              <CryptoInfoCard
                key={key}
                title={data.name}
                caption={data.symbol}
                details={`${data.balance} ${data.symbol}`}
                onPress={() =>
                  router.push({
                    pathname: `token/send/${data.name}`,
                    params: {
                      chainId: t.chainId,
                      token: t.token,
                      balance: data.balance,
                      symbol: data.symbol,
                      erc20tokenAddress: t.token,
                      Erc20TokenName: data.name,
                      isNative: "false",
                    },
                  })
                }
                icon={<BlockchainIcon symbol={data.symbol} size={35} />}
              />
            );
          })}

          {/* SPL Tokens */}
          {isSolana &&
            solTrackedTokens.map((t) => {
              const data = solBalances[t.mint];
              const title = data ? data.name : "Loading Token...";
              const symbol = data ? data.symbol : "SPL";
              const amount = data ? `${data.amount} ${data.symbol}` : "0.00 SPL";
              const logo = data ? data.logo : undefined;

              return (
                <CryptoInfoCard
                  key={`sol-${t.mint}`}
                  title={title}
                  caption={data ? symbol : `Mint: ${t.mint.slice(0, 8)}...${t.mint.slice(-8)}`}
                  details={amount}
                  icon={<BlockchainIcon symbol={symbol} size={35} logoUrl={logo} />}
                  onPress={() => {
                    if (!data) return;
                    router.push({
                      pathname: `token/send/solana`,
                      params: {
                        selectedTokenAddress: t.mint,
                        mint: t.mint,
                        symbol: data.symbol,
                        balance: data.amount,
                        decimals: data.decimals,
                        logo: data.logo,
                        isNative: "false",
                      },
                    })
                  }}
                />
              );
            })}

        </ContentContainer>
      </ScrollView>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // NFT TAB CONTENT
  // ═══════════════════════════════════════════════════════════

  const renderNftTab = () => {
    return (
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.white} />
        }
      >
        <ContentContainer>
          <Nfts wallet={tokenAddress} chainId={activeChainId} isEvm={isEvm} />
        </ContentContainer>
      </ScrollView>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // ERC20 MODAL
  // ═══════════════════════════════════════════════════════════

  const renderErc20Modal = () => {
    if (!erc20ModalVisible) return null;
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%", maxWidth: 400, paddingHorizontal: 20 }}
          >
            <View
              style={{
                backgroundColor: theme.colors.cardBackground,
                borderRadius: 20,
                padding: 24,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={{ fontFamily: theme.fonts.families.openBold, fontSize: 18, color: theme.colors.white }}>
                  Add {isSolana ? "SPL" : "ERC-20"} Token
                </Text>
                <TouchableOpacity
                  onPress={() => setErc20ModalVisible(false)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: theme.colors.grey,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: theme.colors.white, fontSize: 18, fontWeight: "bold" }}>×</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder={`Paste ${isSolana ? "SPL" : "ERC-20"} contract address`}
                placeholderTextColor={theme.colors.lightGrey}
                value={erc20Contract}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setErc20Contract}
                style={{
                  backgroundColor: theme.colors.dark,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  padding: 14,
                  borderRadius: 12,
                  color: theme.colors.white,
                  marginBottom: 16,
                  fontFamily: theme.fonts.families.openRegular,
                  fontSize: 14,
                }}
              />

              {/* Real-time Preview Section */}
              {isSolana && previewLoading && (
                <View style={{ marginVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={{ marginTop: 6, color: theme.colors.lightGrey, fontSize: 12, fontFamily: theme.fonts.families.openRegular }}>
                    Resolving Solana Token...
                  </Text>
                </View>
              )}

              {isSolana && previewError !== "" && (
                <View style={{ marginVertical: 12, padding: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 10 }}>
                  <Text style={{ color: theme.colors.error, fontSize: 12, textAlign: 'center', fontFamily: theme.fonts.families.openRegular }}>
                    {previewError}
                  </Text>
                </View>
              )}

              {isSolana && previewToken && (
                <View style={{
                  marginVertical: 14,
                  padding: 12,
                  backgroundColor: theme.colors.dark,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <BlockchainIcon symbol={previewToken.symbol} logoUrl={previewToken.logo} size={40} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: theme.colors.white, fontWeight: 'bold', fontSize: 14, fontFamily: theme.fonts.families.openBold }}>
                      {previewToken.name} ({previewToken.symbol})
                    </Text>
                    <Text style={{ color: theme.colors.lightGrey, fontSize: 11, marginTop: 2, fontFamily: theme.fonts.families.openRegular }}>
                      Decimals: {previewToken.decimals} | Standard: {previewToken.programId.includes("Tokenz") ? "Token-2022/2025" : "SPL"}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  if (!erc20Contract) return;
                  if (isSolana) {
                    dispatch(addSolToken({ mint: erc20Contract.trim(), network: selectedSolanaNetwork }));
                  } else {
                    dispatch(addToken({ chainId: activeChainId, token: erc20Contract.trim() }));
                  }
                  setErc20Contract("");
                  setErc20ModalVisible(false);
                }}
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontFamily: theme.fonts.families.openBold, fontSize: 14, color: theme.colors.realWhite }}>
                  Add Token
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setErc20ModalVisible(false)}
                style={{
                  backgroundColor: theme.colors.grey,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: theme.fonts.families.openBold, fontSize: 14, color: theme.colors.white }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <SafeAreaContainer>
      {/* Header with chain name */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center", marginLeft: -4 }}>
          <LeftArrow fill={theme.colors.white} width={32} height={32} />
        </TouchableOpacity>
        <HeaderTitle>
          {capitalizeFirstLetter(chainName)} {symbol ? `(${symbol})` : ""}
        </HeaderTitle>
        <View style={{ width: 36 }} />
      </View>


      <TokenDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "info" && renderInfoTab()}
      {activeTab === "activity" && renderActivityTab()}
      {activeTab === "token" && renderTokenTab()}
      {activeTab === "nft" && renderNftTab()}

      {renderErc20Modal()}
    </SafeAreaContainer>
  );
}
