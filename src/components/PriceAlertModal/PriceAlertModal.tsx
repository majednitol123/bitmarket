import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useTheme } from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccount } from "@reown/appkit-react-native";
import type { ThemeType } from "../../styles/theme";
import { BlockchainIcon } from "../BlockchainIcon/BlockchainIcon";
import {
  CloseIcon,
  BellIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
} from "../Icons/AppIcons";
import { alertApi, AlertCondition, PriceAlert } from "../../api/alertApi";

export interface PriceAlertModalProps {
  visible: boolean;
  onClose: () => void;
  tokenId: string;
  tokenSymbol: string;
  tokenName?: string;
  currentPrice: number;
  walletAddress?: string;
  onAlertCreated?: (alert: PriceAlert) => void;
}

const PRESETS_ABOVE = [2, 5, 10, 20, 50];
const PRESETS_BELOW = [-2, -5, -10, -20, -50];

const COOLDOWN_OPTIONS: { label: string; minutes: number }[] = [
  { label: "1h", minutes: 60 },
  { label: "6h (Default)", minutes: 360 },
  { label: "24h", minutes: 1440 },
  { label: "Once", minutes: 0 },
];

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  visible,
  onClose,
  tokenId,
  tokenSymbol,
  tokenName,
  currentPrice,
  walletAddress: propWallet,
  onAlertCreated,
}) => {
  const theme = useTheme() as ThemeType;
  const { address } = useAccount();
  const effectiveWallet = propWallet || address || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const [condition, setCondition] = useState<AlertCondition>("above");
  const [targetPriceStr, setTargetPriceStr] = useState<string>("");
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(360);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Initialize target price when modal opens
  useEffect(() => {
    if (visible && currentPrice > 0) {
      const defaultTarget = condition === "above" ? currentPrice * 1.05 : currentPrice * 0.95;
      setTargetPriceStr(defaultTarget >= 1 ? defaultTarget.toFixed(2) : defaultTarget.toFixed(6));
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [visible, condition, currentPrice]);

  const targetPriceNum = parseFloat(targetPriceStr);

  const pctDiff = useMemo(() => {
    if (isNaN(targetPriceNum) || currentPrice <= 0 || targetPriceNum <= 0) return null;
    return ((targetPriceNum - currentPrice) / currentPrice) * 100;
  }, [targetPriceNum, currentPrice]);

  const handleApplyPreset = (pct: number) => {
    if (currentPrice <= 0) return;
    const newPrice = currentPrice * (1 + pct / 100);
    setTargetPriceStr(newPrice >= 1 ? newPrice.toFixed(2) : newPrice.toFixed(6));
    setErrorMsg(null);
  };

  const handleToggleCondition = (newCond: AlertCondition) => {
    if (newCond === condition) return;
    setCondition(newCond);
    if (currentPrice > 0) {
      const defaultTarget = newCond === "above" ? currentPrice * 1.05 : currentPrice * 0.95;
      setTargetPriceStr(defaultTarget >= 1 ? defaultTarget.toFixed(2) : defaultTarget.toFixed(6));
    }
  };

  const handleCreateAlert = async () => {
    if (isNaN(targetPriceNum) || targetPriceNum <= 0) {
      setErrorMsg("Please enter a valid target price greater than $0");
      return;
    }

    if (condition === "above" && targetPriceNum <= currentPrice) {
      setErrorMsg(`Target price must be above current price ($${currentPrice.toFixed(2)})`);
      return;
    }

    if (condition === "below" && targetPriceNum >= currentPrice) {
      setErrorMsg(`Target price must be below current price ($${currentPrice.toFixed(2)})`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const alert = await alertApi.createAlert({
        walletAddress: effectiveWallet,
        tokenId,
        tokenSymbol,
        tokenName: tokenName || tokenSymbol,
        condition,
        targetPrice: targetPriceNum,
        basePrice: currentPrice,
        cooldownMinutes,
      });

      setIsSuccess(true);
      if (onAlertCreated) {
        onAlertCreated(alert);
      }

      setTimeout(() => {
        setIsSuccess(false);
        setIsSubmitting(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      const msg = err.response?.data?.error || err.message || "Failed to create price alert";
      setErrorMsg(msg);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={styles.backdropPressable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Top Grab Handle */}
          <View style={styles.grabHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.bellBadge}>
                <BellIcon size={18} color="#38BDF8" />
              </View>
              <View>
                <Text style={styles.titleText}>Set Price Alert</Text>
                <Text style={styles.subtitleText}>
                  Zero-delay notifications when price hits target
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <CloseIcon size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
          >
            {/* Token Live Snapshot Card */}
            <View style={styles.tokenCard}>
              <View style={styles.tokenCardLeft}>
                <BlockchainIcon symbol={tokenSymbol} size={36} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.tokenCardSymbol}>{tokenSymbol}</Text>
                  <Text style={styles.tokenCardName} numberOfLines={1}>
                    {tokenName || tokenSymbol}
                  </Text>
                </View>
              </View>
              <View style={styles.tokenCardRight}>
                <Text style={styles.livePriceLabel}>Live Price</Text>
                <Text style={styles.livePriceValue}>
                  ${currentPrice >= 1 ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : currentPrice.toFixed(6)}
                </Text>
              </View>
            </View>

            {/* Direction Selector Tabs */}
            <View style={styles.directionToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.directionTab,
                  condition === "above" && styles.directionTabActiveAbove,
                ]}
                activeOpacity={0.8}
                onPress={() => handleToggleCondition("above")}
              >
                <ArrowUpIcon
                  size={16}
                  color={condition === "above" ? "#10B981" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.directionTabText,
                    condition === "above" && styles.directionTabTextActiveAbove,
                  ]}
                >
                  Rises Above (≥)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.directionTab,
                  condition === "below" && styles.directionTabActiveBelow,
                ]}
                activeOpacity={0.8}
                onPress={() => handleToggleCondition("below")}
              >
                <ArrowDownIcon
                  size={16}
                  color={condition === "below" ? "#F43F5E" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.directionTabText,
                    condition === "below" && styles.directionTabTextActiveBelow,
                  ]}
                >
                  Drops Below (≤)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Target Price Input */}
            <View style={styles.inputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>Target Price (USD)</Text>
                {pctDiff !== null && (
                  <View
                    style={[
                      styles.pctBadge,
                      {
                        backgroundColor:
                          pctDiff >= 0
                            ? "rgba(16, 185, 129, 0.15)"
                            : "rgba(244, 63, 94, 0.15)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pctBadgeText,
                        { color: pctDiff >= 0 ? "#10B981" : "#F43F5E" },
                      ]}
                    >
                      {pctDiff >= 0 ? `+${pctDiff.toFixed(2)}%` : `${pctDiff.toFixed(2)}%`}{" "}
                      from live
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput
                  style={styles.textInput}
                  value={targetPriceStr}
                  onChangeText={(val) => {
                    setTargetPriceStr(val);
                    setErrorMsg(null);
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  autoFocus={false}
                />
              </View>
            </View>

            {/* Quick Percentage Presets */}
            <View style={styles.presetSection}>
              <Text style={styles.sectionSmallLabel}>Quick Presets</Text>
              <View style={styles.presetRow}>
                {(condition === "above" ? PRESETS_ABOVE : PRESETS_BELOW).map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={styles.presetChip}
                    activeOpacity={0.7}
                    onPress={() => handleApplyPreset(pct)}
                  >
                    <Text style={styles.presetChipText}>
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cooldown Period Selection */}
            <View style={styles.cooldownSection}>
              <View style={styles.cooldownLabelRow}>
                <Text style={styles.sectionSmallLabel}>Alert Frequency / Cooldown</Text>
                <Text style={styles.cooldownHint}>Avoids repeated spam</Text>
              </View>
              <View style={styles.cooldownRow}>
                {COOLDOWN_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[
                      styles.cooldownChip,
                      cooldownMinutes === opt.minutes && styles.cooldownChipActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => setCooldownMinutes(opt.minutes)}
                  >
                    <Text
                      style={[
                        styles.cooldownChipText,
                        cooldownMinutes === opt.minutes && styles.cooldownChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Error Banner */}
            {errorMsg && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Success Banner */}
            {isSuccess && (
              <View style={styles.successBox}>
                <CheckCircleIcon size={18} color="#10B981" />
                <Text style={styles.successText}>Price alert created successfully!</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (isSubmitting || isSuccess) && styles.submitBtnDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleCreateAlert}
              disabled={isSubmitting || isSuccess}
            >
              <LinearGradient
                colors={
                  condition === "above"
                    ? ["#059669", "#10B981"]
                    : ["#E11D48", "#F43F5E"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : isSuccess ? (
                  <View style={styles.btnContentRow}>
                    <CheckCircleIcon size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Alert Armed</Text>
                  </View>
                ) : (
                  <View style={styles.btnContentRow}>
                    <BellIcon size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>
                      Set {condition === "above" ? "Rise (≥)" : "Drop (≤)"} Alert
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  backdropPressable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#0B0F19",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "85%",
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bellBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitleText: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollBody: {
    gap: 16,
    paddingBottom: 20,
  },
  tokenCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 14,
  },
  tokenCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  tokenCardSymbol: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  tokenCardName: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
    maxWidth: 120,
  },
  tokenCardRight: {
    alignItems: "flex-end",
  },
  livePriceLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
  },
  livePriceValue: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 2,
  },
  directionToggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  directionTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  directionTabActiveAbove: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  directionTabActiveBelow: {
    backgroundColor: "rgba(244, 63, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.35)",
  },
  directionTabText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  directionTabTextActiveAbove: {
    color: "#10B981",
    fontWeight: "700",
  },
  directionTabTextActiveBelow: {
    color: "#F43F5E",
    fontWeight: "700",
  },
  inputSection: {
    gap: 8,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputLabel: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pctBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    height: 52,
  },
  currencyPrefix: {
    color: "#64748B",
    fontSize: 20,
    fontWeight: "700",
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    padding: 0,
  },
  presetSection: {
    gap: 8,
  },
  sectionSmallLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  presetChipText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  cooldownSection: {
    gap: 8,
  },
  cooldownLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cooldownHint: {
    color: "#64748B",
    fontSize: 11,
  },
  cooldownRow: {
    flexDirection: "row",
    gap: 8,
  },
  cooldownChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cooldownChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  cooldownChipText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  cooldownChipTextActive: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  successText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.8,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
