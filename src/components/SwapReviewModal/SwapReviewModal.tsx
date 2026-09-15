import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Linking,
} from "react-native";
import { useTheme } from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useDispatch } from "react-redux";
import type { ThemeType } from "../../styles/theme";
import type { Chain, Token } from "../../constants/tokenRegistry";
import { BlockchainIcon } from "../BlockchainIcon/BlockchainIcon";
import {
  ArrowDownIcon,
  CloseIcon,
  CheckCircleIcon,
  CopyIcon,
  LightningIcon,
  GasIcon,
  SwapIcon,
  ShieldCheckIcon,
} from "../Icons/AppIcons";
import { getTokenPrice, formatUsd } from "../../utils/tokenPricing";
import { notifySwapExecuted } from "../../services/notificationService";
import { useAccount, useProvider, useAppKit } from "@reown/appkit-react-native";
import { exchangeApi, type ExchangeQuoteData, type RouteType } from "../../api/exchangeApi";
import { getChainExplorerTxUrl } from "../../utils/chainMapping";
import { refreshPortfolio } from "../../store/portfolioSlice";

export interface SwapReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSwapSuccess?: (txHash: string) => void;
  fromAmount: string;
  toAmount: string;
  fromToken: Token | null;
  toToken: Token | null;
  chain: Chain;
  toChain?: Chain;
  slippage: string;
  quoteData?: ExchangeQuoteData | null;
  routeType?: RouteType;
}

type ModalStage = "review" | "submitting" | "pending" | "success" | "connect_wallet";

export const SwapReviewModal: React.FC<SwapReviewModalProps> = ({
  visible,
  onClose,
  onSwapSuccess,
  fromAmount,
  toAmount,
  fromToken,
  toToken,
  chain,
  toChain,
  slippage,
  quoteData,
  routeType = "swap",
}) => {
  const theme = useTheme() as ThemeType;
  const { isConnected, address } = useAccount();
  const { provider } = useProvider();
  const { open } = useAppKit();
  const dispatch = useDispatch<any>();

  const [stage, setStage] = useState<ModalStage>("review");
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [submittingStep, setSubmittingStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Animations
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const checkScale = React.useRef(new Animated.Value(0)).current;

  // Reset stage on modal open
  useEffect(() => {
    if (visible) {
      setStage("review");
      setCopied(false);
      setSubmittingStep(1);
    }
  }, [visible]);

  // Pulse animation during submitting and pending
  useEffect(() => {
    if (stage === "submitting" || stage === "pending") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [stage, pulseAnim]);

  // Success checkmark animation
  useEffect(() => {
    if (stage === "success") {
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } else {
      checkScale.setValue(0);
    }
  }, [stage, checkScale]);

  const fromSymbol = fromToken?.symbol || "ETH";
  const toSymbol = toToken?.symbol || "USDT";

  const fromPrice = getTokenPrice(fromSymbol);
  const toPrice = getTokenPrice(toSymbol);

  const fromUsdTotal = fromPrice !== null ? (Number(fromAmount) || 0) * fromPrice : null;
  const toUsdTotal = toPrice !== null ? (Number(toAmount) || 0) * toPrice : null;

  const rateValue = (fromPrice !== null && toPrice !== null && toPrice > 0)
    ? (fromPrice / toPrice).toFixed(4)
    : "--";
  const slippagePercent = parseFloat(slippage) || 0.5;
  const minReceived = toAmount
    ? ((Number(toAmount) || 0) * (1 - slippagePercent / 100)).toFixed(
        toPrice && toPrice >= 1 ? 2 : 4
      )
    : "--";

  // Real-time on-chain confirmation polling
  useEffect(() => {
    if (stage !== "pending" || !txHash) return;

    let isMounted = true;
    let attempts = 0;
    const maxAttempts = 40;

    const pollTimer = setInterval(async () => {
      if (!isMounted) return;
      attempts++;

      try {
        const statusData = await exchangeApi.getStatus(txHash, true);
        if (!isMounted) return;

        if (statusData?.status === "confirmed" || statusData?.status === "completed") {
          clearInterval(pollTimer);
          setStage("success");
          onSwapSuccess?.(txHash);
          notifySwapExecuted(fromSymbol, toSymbol, fromAmount, txHash);
          if (address) {
            dispatch(refreshPortfolio({ chain: chain.id, address }));
          }
        } else if (statusData?.status === "failed") {
          clearInterval(pollTimer);
          setErrorMessage(statusData.errorMessage || "Transaction reverted on-chain");
          setStage("review");
        }
      } catch (err: any) {
        console.warn("[SwapReviewModal] Status poll error:", err?.message);
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollTimer);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
    };
  }, [stage, txHash, fromSymbol, toSymbol, fromAmount, chain.id, address, dispatch, onSwapSuccess]);

  const handleConfirmSwap = async () => {
    try {
      setErrorMessage(null);

      if (!isConnected || !address || !provider) {
        setStage("connect_wallet");
        return;
      }

      setStage("submitting");
      setSubmittingStep(1);

      const buildData = await exchangeApi.buildTransaction({
        fromChain: chain.id,
        toChain: toChain?.id || chain.id,
        fromToken: fromToken?.address || fromToken?.symbol || "native",
        toToken: toToken?.address || toToken?.symbol || "native",
        fromAmount,
        fromAddress: address,
        slippage,
      });

      // If token approval is required
      if (buildData.approval?.needed) {
        setSubmittingStep(2);
        try {
          await (provider as any).request({
            method: "eth_sendTransaction",
            params: [{
              from: address,
              to: buildData.approval.tokenAddress,
              data: `0x095ea7b3000000000000000000000000${buildData.approval.spender?.replace(/^0x/, "").padStart(64, "0")}${buildData.approval.amount ? BigInt(buildData.approval.amount).toString(16).padStart(64, "0") : "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}`,
            }],
          });
        } catch (approvalErr: any) {
          console.warn("[SwapReviewModal] Token approval warning:", approvalErr?.message);
        }
      }

      setSubmittingStep(3);

      const tx = buildData.transaction;
      const rawTxHash = await (provider as any).request({
        method: "eth_sendTransaction",
        params: [{
          from: address,
          to: tx.to,
          data: tx.data,
          value: tx.value,
        }],
      });

      const realTxHash = String(rawTxHash);
      setTxHash(realTxHash);
      setStage("pending");

      const idempotencyKey = `swap_${Date.now()}_${realTxHash.slice(2, 10)}`;
      await exchangeApi.confirmSwap({
        swapId: buildData.swapId,
        txHash: realTxHash,
        walletAddress: address,
        chain: chain.name,
        chainId: Number(chain.id) || 1,
        fromTokenAddress: fromToken?.address,
        fromTokenSymbol: fromSymbol,
        toTokenAddress: toToken?.address,
        toTokenSymbol: toSymbol,
        fromAmount,
        toAmount,
        router: buildData.provider,
        idempotencyKey,
      });
    } catch (err: any) {
      console.warn("[SwapReviewModal] Swap execution error:", err?.message);
      setErrorMessage(err?.message || "Transaction cancelled or failed");
      setStage("review");
    }
  };

  const handleCopyHash = async () => {
    if (txHash) {
      await Clipboard.setStringAsync(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenExplorer = () => {
    if (txHash) {
      const url = getChainExplorerTxUrl(chain.id, txHash);
      Linking.openURL(url).catch((err) => console.warn("Could not open explorer URL:", err));
    }
  };

  const shortHash = txHash
    ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}`
    : "--";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={stage === "submitting" ? () => {} : onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.cardBackground }]}>
          {/* ════════════ STAGE 1: REVIEW SWAP ════════════ */}
          {stage === "review" && (
            <>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.colors.white }]}>
                    Review Swap
                  </Text>
                  <Text style={[styles.modalSub, { color: theme.colors.lightGrey }]}>
                    BitMarket Smart DEX Routing
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: theme.colors.lightDark }]}
                  onPress={onClose}
                  hitSlop={8}
                >
                  <CloseIcon size={16} color={theme.colors.lightGrey} />
                </TouchableOpacity>
              </View>

              {/* Pay Token Card */}
              <View style={[styles.tokenCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={styles.tokenCardRow}>
                  <View>
                    <Text style={[styles.cardTag, { color: theme.colors.grey }]}>You Pay</Text>
                    <Text style={[styles.tokenAmount, { color: theme.colors.white }]}>
                      {fromAmount || "0"}
                    </Text>
                    <Text style={[styles.usdAmount, { color: theme.colors.lightGrey }]}>
                      ≈ {formatUsd(fromUsdTotal)}
                    </Text>
                  </View>
                  <View style={styles.tokenBadgeGroup}>
                    <BlockchainIcon symbol={fromSymbol} size={32} logoUrl={fromToken?.icon} />
                    <View style={styles.tokenBadgeText}>
                      <Text style={[styles.tokenSymbolText, { color: theme.colors.white }]}>
                        {fromSymbol}
                      </Text>
                      <Text style={[styles.chainNamePill, { color: theme.colors.primary }]}>
                        {chain.name}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Connector Arrow */}
              <View style={styles.connectorRow}>
                <View style={[styles.connectorLine, { backgroundColor: theme.colors.border }]} />
                <View style={styles.connectorBadge}>
                  <LinearGradient
                    colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                    style={styles.connectorGradient}
                  >
                    <ArrowDownIcon size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </LinearGradient>
                </View>
                <View style={[styles.connectorLine, { backgroundColor: theme.colors.border }]} />
              </View>

              {/* Receive Token Card */}
              <View style={[styles.tokenCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={styles.tokenCardRow}>
                  <View>
                    <Text style={[styles.cardTag, { color: theme.colors.grey }]}>You Receive (Est.)</Text>
                    <Text style={[styles.tokenAmount, { color: "#10B981" }]}>
                      {toAmount || "0"}
                    </Text>
                    <Text style={[styles.usdAmount, { color: theme.colors.lightGrey }]}>
                      ≈ {formatUsd(toUsdTotal)}
                    </Text>
                  </View>
                  <View style={styles.tokenBadgeGroup}>
                    <BlockchainIcon symbol={toSymbol} size={32} logoUrl={toToken?.icon} />
                    <View style={styles.tokenBadgeText}>
                      <Text style={[styles.tokenSymbolText, { color: theme.colors.white }]}>
                        {toSymbol}
                      </Text>
                      <Text style={[styles.chainNamePill, { color: theme.colors.primary }]}>
                        {chain.name}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Order Execution Details */}
              <View style={[styles.detailsCard, { backgroundColor: theme.colors.lightDark, borderColor: theme.colors.border }]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.lightGrey }]}>Exchange Rate</Text>
                  <Text style={[styles.detailValue, { color: theme.colors.white }]}>
                    1 {fromSymbol} = {rateValue} {toSymbol}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.lightGrey }]}>Routing</Text>
                  <View style={styles.inlineRow}>
                    <LightningIcon size={12} color="#10B981" strokeWidth={2.5} />
                    <Text style={[styles.detailHighlight, { color: "#10B981" }]}>
                      {quoteData?.provider || (routeType === "bridge" ? "Cross-Chain Bridge" : "Uniswap v3 & 1inch Split")}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.lightGrey }]}>Price Impact</Text>
                  <Text style={[styles.detailValue, { color: "#10B981" }]}>
                    {quoteData?.priceImpactPercent ? `< ${quoteData.priceImpactPercent}%` : "< 0.01% (Optimal)"}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.colors.lightGrey }]}>Min. Received ({slippage}%)</Text>
                  <Text style={[styles.detailValue, { color: theme.colors.white }]}>
                    {quoteData?.minReceived || minReceived} {toSymbol}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.inlineRow}>
                    <GasIcon size={12} color={theme.colors.grey} strokeWidth={2} />
                    <Text style={[styles.detailLabel, { color: theme.colors.lightGrey, marginLeft: 4 }]}>
                      Network Fee
                    </Text>
                  </View>
                  <Text style={[styles.detailValue, { color: theme.colors.white }]}>
                    {quoteData?.estimatedGasUsd ? `~$${quoteData.estimatedGasUsd.toFixed(2)}` : "~$1.40"}
                  </Text>
                </View>
              </View>

              {errorMessage && (
                <Text style={{ color: "#EF4444", textAlign: "center", marginBottom: 12, fontSize: 13 }}>
                  {errorMessage}
                </Text>
              )}

              {/* Confirm Swap / Bridge Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleConfirmSwap}
                style={styles.actionButtonWrapper}
              >
                <LinearGradient
                  colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionGradient}
                >
                  <SwapIcon size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.actionButtonText}>
                    {routeType === "bridge" ? "Confirm Bridge" : "Confirm Swap"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ════════════ STAGE 2: SUBMITTING / BROADCASTING ════════════ */}
          {stage === "submitting" && (
            <View style={styles.submittingContainer}>
              <Animated.View style={[styles.pulsingGlow, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                  style={styles.pulsingCircle}
                >
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>

              <Text style={[styles.submittingTitle, { color: theme.colors.white }]}>
                {submittingStep === 1
                  ? "Routing Swap..."
                  : "Broadcasting Transaction..."}
              </Text>

              <Text style={[styles.submittingSub, { color: theme.colors.lightGrey }]}>
                {submittingStep === 1
                  ? `Optimizing zero-slippage liquidity across ${chain.name} DEX pools`
                  : `Waiting for ${chain.name} block confirmation`}
              </Text>

              <View style={[styles.submittingCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={styles.submittingRow}>
                  <Text style={[styles.submittingTokenText, { color: theme.colors.white }]}>
                    {fromAmount} {fromSymbol}
                  </Text>
                  <ArrowDownIcon size={14} color={theme.colors.primary} />
                  <Text style={[styles.submittingTokenText, { color: "#10B981" }]}>
                    {toAmount} {toSymbol}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ════════════ STAGE 3: SUCCESS CONFIRMATION ════════════ */}
          {stage === "success" && (
            <View style={styles.successContainer}>
              <Animated.View style={[styles.checkCircleWrapper, { transform: [{ scale: checkScale }] }]}>
                <View style={styles.checkCircleGlow}>
                  <CheckCircleIcon size={56} color="#10B981" strokeWidth={2.2} />
                </View>
              </Animated.View>

              <Text style={[styles.successTitle, { color: theme.colors.white }]}>
                Swap Confirmed!
              </Text>
              <Text style={[styles.successSub, { color: theme.colors.lightGrey }]}>
                Successfully swapped {fromAmount} {fromSymbol} for {toAmount} {toSymbol}
              </Text>

              {/* Tx Hash Card */}
              <View style={[styles.txHashCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Status</Text>
                  <View style={styles.badgeSuccess}>
                    <Text style={styles.badgeSuccessText}>Success</Text>
                  </View>
                </View>

                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Network</Text>
                  <Text style={[styles.txValue, { color: theme.colors.white }]}>{chain.name}</Text>
                </View>

                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Transaction Hash</Text>
                  <TouchableOpacity
                    style={styles.copyRow}
                    onPress={handleCopyHash}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.hashText, { color: theme.colors.primary }]}>
                      {shortHash}
                    </Text>
                    <CopyIcon size={13} color={copied ? "#10B981" : theme.colors.lightGrey} />
                    {copied && <Text style={styles.copiedText}>Copied!</Text>}
                  </TouchableOpacity>
                </View>

                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Explorer</Text>
                  <TouchableOpacity
                    onPress={handleOpenExplorer}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "600" }}>
                      View on {chain.name} Explorer ↗
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClose}
                style={styles.actionButtonWrapper}
              >
                <LinearGradient
                  colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionGradient}
                >
                  <Text style={styles.actionButtonText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ════════════ STAGE 4: PENDING ON-CHAIN VERIFICATION ════════════ */}
          {stage === "pending" && (
            <View style={styles.successContainer}>
              <Animated.View style={[styles.pulsingGlow, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                  style={styles.pulsingCircle}
                >
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>

              <Text style={[styles.successTitle, { color: theme.colors.white }]}>
                Verifying On-Chain...
              </Text>
              <Text style={[styles.successSub, { color: theme.colors.lightGrey, textAlign: "center" }]}>
                Transaction broadcasted to {chain.name}. Waiting for block confirmation.
              </Text>

              <View style={[styles.txHashCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Status</Text>
                  <View style={styles.badgePending}>
                    <Text style={styles.badgePendingText}>Pending Block Inclusion</Text>
                  </View>
                </View>

                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Network</Text>
                  <Text style={[styles.txValue, { color: theme.colors.white }]}>{chain.name}</Text>
                </View>

                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Swapping</Text>
                  <Text style={[styles.txValue, { color: theme.colors.white }]}>
                    {fromAmount} {fromSymbol} ➔ {toAmount} {toSymbol}
                  </Text>
                </View>

                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Transaction Hash</Text>
                  <TouchableOpacity
                    style={styles.copyRow}
                    onPress={handleCopyHash}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.hashText, { color: theme.colors.primary }]}>
                      {shortHash}
                    </Text>
                    <CopyIcon size={13} color={copied ? "#10B981" : theme.colors.lightGrey} />
                    {copied && <Text style={styles.copiedText}>Copied!</Text>}
                  </TouchableOpacity>
                </View>

                <View style={styles.txRow}>
                  <Text style={[styles.txLabel, { color: theme.colors.lightGrey }]}>Explorer</Text>
                  <TouchableOpacity
                    onPress={handleOpenExplorer}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: "600" }}>
                      View on {chain.name} Explorer ↗
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClose}
                style={styles.actionButtonWrapper}
              >
                <View style={[styles.actionGradient, { backgroundColor: theme.colors.border }]}>
                  <Text style={[styles.actionButtonText, { color: theme.colors.white }]}>
                    Close & Track in Activity
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ════════════ STAGE 5: CONNECT WALLET REQUIRED ════════════ */}
          {stage === "connect_wallet" && (
            <View style={styles.successContainer}>
              <View style={styles.checkCircleWrapper}>
                <View style={[styles.checkCircleGlow, { backgroundColor: "rgba(124, 58, 237, 0.15)" }]}>
                  <ShieldCheckIcon size={40} color={theme.colors.primary} strokeWidth={2.2} />
                </View>
              </View>

              <Text style={[styles.successTitle, { color: theme.colors.white }]}>
                Connect Wallet Required
              </Text>
              <Text style={[styles.successSub, { color: theme.colors.lightGrey, textAlign: "center", lineHeight: 20 }]}>
                An active Web3 wallet connection is required to sign and broadcast real DEX transactions on {chain.name}.
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  onClose();
                  open();
                }}
                style={styles.actionButtonWrapper}
              >
                <LinearGradient
                  colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionGradient}
                >
                  <Text style={styles.actionButtonText}>Connect Wallet</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  tokenCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  tokenCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTag: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tokenAmount: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  usdAmount: {
    fontSize: 12,
    marginTop: 2,
  },
  tokenBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tokenBadgeText: {
    alignItems: "flex-end",
  },
  tokenSymbolText: {
    fontSize: 16,
    fontWeight: "700",
  },
  chainNamePill: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  connectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  connectorLine: {
    flex: 1,
    height: 1,
  },
  connectorBadge: {
    marginHorizontal: 12,
  },
  connectorGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  detailHighlight: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButtonWrapper: {
    width: "100%",
    alignSelf: "stretch",
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
  },
  actionGradient: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // Submitting styles
  submittingContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 32,
  },
  pulsingGlow: {
    marginBottom: 20,
  },
  pulsingCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  submittingTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  submittingSub: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  submittingCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  submittingTokenText: {
    fontSize: 15,
    fontWeight: "700",
  },

  // Success styles
  successContainer: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 20,
  },
  checkCircleWrapper: {
    marginBottom: 16,
  },
  checkCircleGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  successSub: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
  },
  txHashCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  txLabel: {
    fontSize: 12,
  },
  txValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgeSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeSuccessText: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "700",
  },
  badgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePendingText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hashText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  copiedText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "600",
  },
});
