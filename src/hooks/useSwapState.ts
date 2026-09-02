import { useState, useCallback, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import {
  setSlippage as setSlippageAction,
  setCustomSlippage as setCustomSlippageAction,
  setSlippageAuto as setSlippageAutoAction,
  setDeadline as setDeadlineAction,
  setExpertMode as setExpertModeAction,
} from "../store/settingsSlice";
import {
  CHAINS,
  TOKENS_BY_CHAIN,
  DEFAULT_TOKENS,
  type Chain,
  type Token,
} from "../constants/tokenRegistry";

// ═══════════════════════════════════════════════════════════
// SWAP SETTINGS
// ═══════════════════════════════════════════════════════════

export const SLIPPAGE_OPTIONS = ["0.1", "0.5", "1", "3"];
export const DEADLINE_OPTIONS = ["5", "10", "20", "30"];

// ═══════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════

export function useSwapState() {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((state: RootState) => state.settings);

  // ─── Exchange state ───
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [selectedChainFrom, setSelectedChainFrom] = useState<Chain>(CHAINS[0]);
  const [selectedChainTo, setSelectedChainTo] = useState<Chain>(CHAINS[0]);
  const [selectedTokenFrom, setSelectedTokenFrom] = useState<Token | null>(null);
  const [selectedTokenTo, setSelectedTokenTo] = useState<Token | null>(null);

  // ─── Modal state ───
  const [chainModalVisible, setChainModalVisible] = useState(false);
  const [chainModalTarget, setChainModalTarget] = useState<"from" | "to">("from");
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [tokenModalTarget, setTokenModalTarget] = useState<"from" | "to">("from");
  const [tokenSearch, setTokenSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  // ─── Settings state (from Redux) ───
  const [settingsOpen, setSettingsOpen] = useState(false);
  const slippage = settings?.slippage ?? "0.5";
  const customSlippage = settings?.customSlippage ?? "";
  const slippageAuto = settings?.slippageAuto ?? true;
  const deadline = settings?.deadline ?? "20";
  const expertMode = settings?.expertMode ?? false;

  const setSlippage = useCallback((val: string) => {
    dispatch(setSlippageAction(val));
  }, [dispatch]);

  const setCustomSlippage = useCallback((val: string) => {
    dispatch(setCustomSlippageAction(val));
  }, [dispatch]);

  const setSlippageAuto = useCallback((val: boolean) => {
    dispatch(setSlippageAutoAction(val));
  }, [dispatch]);

  const setDeadline = useCallback((val: string) => {
    dispatch(setDeadlineAction(val));
  }, [dispatch]);

  const setExpertMode = useCallback((val: boolean) => {
    dispatch(setExpertModeAction(val));
  }, [dispatch]);

  // ─── Refresh ───
  const [refreshing, setRefreshing] = useState(false);

  // ─── Animation ───
  const swapRotation = useRef(new Animated.Value(0)).current;

  const rotateInterpolate = swapRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  // ─── Handlers ───
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const openChainModal = useCallback((target: "from" | "to") => {
    setChainModalTarget(target);
    setChainModalVisible(true);
  }, []);

  const selectChain = useCallback(
    (chain: Chain) => {
      if (chainModalTarget === "from") {
        setSelectedChainFrom(chain);
        setSelectedTokenFrom(null);
      } else {
        setSelectedChainTo(chain);
        setSelectedTokenTo(null);
      }
      setChainModalVisible(false);
    },
    [chainModalTarget]
  );

  const openTokenModal = useCallback((target: "from" | "to") => {
    setTokenModalTarget(target);
    setTokenSearch("");
    setTokenModalVisible(true);
  }, []);

  const selectToken = useCallback(
    (token: Token) => {
      if (tokenModalTarget === "from") {
        setSelectedTokenFrom(token);
      } else {
        setSelectedTokenTo(token);
      }
      setTokenModalVisible(false);
    },
    [tokenModalTarget]
  );

  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  }, []);

  const handleSwap = useCallback(() => {
    Animated.timing(swapRotation, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      swapRotation.setValue(0);
    });

    const tempChain = selectedChainFrom;
    const tempToken = selectedTokenFrom;
    const tempAmount = fromAmount;
    setSelectedChainFrom(selectedChainTo);
    setSelectedTokenFrom(selectedTokenTo);
    setFromAmount(toAmount);
    setSelectedChainTo(tempChain);
    setSelectedTokenTo(tempToken);
    setToAmount(tempAmount);
  }, [
    selectedChainFrom,
    selectedChainTo,
    selectedTokenFrom,
    selectedTokenTo,
    fromAmount,
    toAmount,
    swapRotation,
  ]);

  // ─── Derived values ───
  const activeChainForModal =
    tokenModalTarget === "from" ? selectedChainFrom : selectedChainTo;

  const tokensForModal =
    TOKENS_BY_CHAIN[activeChainForModal.id] || DEFAULT_TOKENS;

  const filteredTokens = tokensForModal.filter((t) => {
    const query = tokenSearch.toLowerCase();
    return (
      t.symbol.toLowerCase().includes(query) ||
      t.name.toLowerCase().includes(query) ||
      t.address.toLowerCase().includes(query)
    );
  });

  const displayChain = selectedChainFrom;

  return {
    // Exchange
    fromAmount,
    setFromAmount,
    toAmount,
    setToAmount,
    selectedChainFrom,
    selectedChainTo,
    selectedTokenFrom,
    selectedTokenTo,
    displayChain,

    // Modals
    chainModalVisible,
    setChainModalVisible,
    chainModalTarget,
    tokenModalVisible,
    setTokenModalVisible,
    tokenModalTarget,
    tokenSearch,
    setTokenSearch,
    activeChainForModal,
    filteredTokens,
    favorites,

    // Settings
    settingsOpen,
    setSettingsOpen,
    slippage,
    setSlippage,
    customSlippage,
    setCustomSlippage,
    slippageAuto,
    setSlippageAuto,
    deadline,
    setDeadline,
    expertMode,
    setExpertMode,

    // Refresh
    refreshing,
    onRefresh,

    // Animation
    rotateInterpolate,

    // Actions
    openChainModal,
    selectChain,
    openTokenModal,
    selectToken,
    toggleFavorite,
    handleSwap,
  };
}
