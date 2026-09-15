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
  Switch,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "styled-components/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccount } from "@reown/appkit-react-native";
import { AppDispatch, RootState } from "../../store";
import { ThemeType } from "../../styles/theme";
import {
  fetchAlerts,
  createAlert,
  rearmAlert,
  deleteAlert,
  toggleAlertEnabled,
} from "../../store/alertSlice";
import { GeneralStatus } from "../../store/types";
import { BlockchainIcon } from "../BlockchainIcon/BlockchainIcon";
import {
  CloseIcon,
  BellIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircleIcon,
  TrashIcon,
  RotateCcwIcon,
  InfoIcon,
} from "../Icons/AppIcons";
import { AlertCondition, PriceAlert, AlertStatus } from "../../api/alertApi";

export interface PriceAlertModalProps {
  visible: boolean;
  onClose: () => void;
  tokenId: string;
  tokenSymbol: string;
  tokenName?: string;
  currentPrice: number;
  chain?: string;
  tokenAddress?: string;
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
  chain = "ethereum",
  tokenAddress,
  walletAddress: propWallet,
  onAlertCreated,
}) => {
  const theme = useTheme() as ThemeType;
  const isDark = theme?.colors?.cardBackground !== "#FFFFFF";
  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const dispatch = useDispatch<AppDispatch>();
  const { address } = useAccount();
  const effectiveWallet = propWallet || address || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const { alerts, createStatus, rearmStatus, deleteStatus } = useSelector(
    (state: RootState) => state.alerts
  );

  const [activeTab, setActiveTab] = useState<"create" | "list">("create");
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [targetPriceStr, setTargetPriceStr] = useState<string>("");
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(360);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [operatingAlertId, setOperatingAlertId] = useState<number | null>(null);

  // Filter alerts for this token
  const tokenAlerts = useMemo(() => {
    return alerts.filter(
      (a) =>
        a.tokenId.toLowerCase().trim() === tokenId.toLowerCase().trim() ||
        a.tokenSymbol.toLowerCase().trim() === tokenSymbol.toLowerCase().trim()
    );
  }, [alerts, tokenId, tokenSymbol]);

  // Fetch alerts for this wallet on modal display
  useEffect(() => {
    if (visible && effectiveWallet) {
      dispatch(fetchAlerts({ walletAddress: effectiveWallet, tokenId }));
    }
  }, [visible, effectiveWallet, tokenId, dispatch]);

  // Initialize target price when modal opens or condition flips
  useEffect(() => {
    if (visible && currentPrice > 0) {
      const defaultTarget = condition === "above" ? currentPrice * 1.05 : currentPrice * 0.95;
      setTargetPriceStr(defaultTarget >= 1 ? defaultTarget.toFixed(2) : defaultTarget.toFixed(6));
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [visible, condition, currentPrice]);

  const targetPriceNum = parseFloat(targetPriceStr);

  // Detect if an identical active alert is already armed for this token and threshold
  const duplicateAlert = useMemo(() => {
    if (isNaN(targetPriceNum) || targetPriceNum <= 0) return null;
    return tokenAlerts.find(
      (a) =>
        a.enabled &&
        a.condition === condition &&
        Math.abs(Number(a.targetPrice) - targetPriceNum) < 0.0000001
    );
  }, [tokenAlerts, condition, targetPriceNum]);

  // Detect if an identical disabled alert exists (eligible for automatic re-arming)
  const existingInactiveAlert = useMemo(() => {
    if (isNaN(targetPriceNum) || targetPriceNum <= 0) return null;
    return tokenAlerts.find(
      (a) =>
        !a.enabled &&
        a.condition === condition &&
        Math.abs(Number(a.targetPrice) - targetPriceNum) < 0.0000001
    );
  }, [tokenAlerts, condition, targetPriceNum]);

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

    if (duplicateAlert) {
      setErrorMsg(
        `An active ${condition === "above" ? "rise (≥)" : "drop (≤)"} alert is already set for $${
          targetPriceNum >= 1 ? targetPriceNum.toFixed(2) : targetPriceNum.toFixed(6)
        }. Check the 'Active Alerts' tab.`
      );
      return;
    }

    setErrorMsg(null);

    try {
      const created = await dispatch(
        createAlert({
          walletAddress: effectiveWallet,
          chain,
          tokenAddress,
          tokenId,
          tokenSymbol,
          tokenName: tokenName || tokenSymbol,
          condition,
          targetPrice: targetPriceNum,
          basePrice: currentPrice,
          currency: "USD",
          cooldownMinutes,
        })
      ).unwrap();

      setIsSuccess(true);
      if (onAlertCreated) {
        onAlertCreated(created);
      }

      setTimeout(() => {
        setIsSuccess(false);
        setActiveTab("list");
      }, 1000);
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to create price alert");
    }
  };

  const handleRearm = async (alertId: number) => {
    setOperatingAlertId(alertId);
    try {
      await dispatch(rearmAlert({ id: alertId, walletAddress: effectiveWallet })).unwrap();
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to re-arm alert");
    } finally {
      setOperatingAlertId(null);
    }
  };

  const handleToggleEnabled = async (alertId: number, currentEnabled: boolean) => {
    setOperatingAlertId(alertId);
    try {
      await dispatch(
        toggleAlertEnabled({
          id: alertId,
          walletAddress: effectiveWallet,
          enabled: !currentEnabled,
        })
      ).unwrap();
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to update alert");
    } finally {
      setOperatingAlertId(null);
    }
  };

  const handleDelete = async (alertId: number) => {
    setOperatingAlertId(alertId);
    try {
      await dispatch(deleteAlert({ id: alertId, walletAddress: effectiveWallet })).unwrap();
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to delete alert");
    } finally {
      setOperatingAlertId(null);
    }
  };

  const isSubmitting = createStatus === GeneralStatus.Loading;

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
          {/* Grab Handle */}
          <View style={styles.grabHandle} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.bellBadge}>
                <BellIcon size={18} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.titleText}>Price Alerts</Text>
                <Text style={styles.subtitleText}>
                  Instant push notifications on threshold crossings
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <CloseIcon size={16} color={isDark ? "#94A3B8" : "#64748B"} />
            </TouchableOpacity>
          </View>

          {/* Mode Switcher Segmented Control */}
          <View style={styles.modeTabsContainer}>
            <TouchableOpacity
              style={[
                styles.modeTab,
                activeTab === "create" && styles.modeTabActive,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                setActiveTab("create");
                setErrorMsg(null);
              }}
            >
              <Text
                style={[
                  styles.modeTabText,
                  activeTab === "create" && styles.modeTabTextActive,
                ]}
              >
                Set Alert
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                activeTab === "list" && styles.modeTabActive,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                setActiveTab("list");
                setErrorMsg(null);
              }}
            >
              <Text
                style={[
                  styles.modeTabText,
                  activeTab === "list" && styles.modeTabTextActive,
                ]}
              >
                Active Alerts ({tokenAlerts.length})
              </Text>
            </TouchableOpacity>
          </View>

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
                $
                {currentPrice >= 1
                  ? currentPrice.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : currentPrice.toFixed(6)}
              </Text>
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
              <CheckCircleIcon size={18} color={isDark ? "#10B981" : "#059669"} />
              <Text style={styles.successText}>Alert armed successfully!</Text>
            </View>
          )}

          {/* TAB 1: CREATE ALERT */}
          {activeTab === "create" ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollBody}
            >
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
                    color={condition === "above" ? (isDark ? "#10B981" : "#059669") : (isDark ? "#94A3B8" : "#64748B")}
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
                    color={condition === "below" ? (isDark ? "#F43F5E" : "#E11D48") : (isDark ? "#94A3B8" : "#64748B")}
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
                              ? (isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.12)")
                              : (isDark ? "rgba(244, 63, 94, 0.15)" : "rgba(244, 63, 94, 0.12)"),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pctBadgeText,
                          { color: pctDiff >= 0 ? (isDark ? "#10B981" : "#059669") : (isDark ? "#F43F5E" : "#E11D48") },
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
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    keyboardType="decimal-pad"
                    autoFocus={false}
                  />
                </View>

                {/* Duplicate Active Alert Notification */}
                {duplicateAlert && (
                  <TouchableOpacity
                    style={styles.duplicateWarningBox}
                    activeOpacity={0.8}
                    onPress={() => setActiveTab("list")}
                  >
                    <InfoIcon size={16} color={isDark ? "#F59E0B" : "#D97706"} />
                    <View style={styles.duplicateWarningContent}>
                      <Text style={styles.duplicateWarningTitle}>Alert Already Active</Text>
                      <Text style={styles.duplicateWarningText}>
                        An active {condition === "above" ? "rise (≥)" : "drop (≤)"} alert is already armed for $
                        {targetPriceNum >= 1 ? targetPriceNum.toFixed(2) : targetPriceNum.toFixed(6)}. Tap to view in Active Alerts.
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Inactive Alert Matching Re-arm Notification */}
                {!duplicateAlert && existingInactiveAlert && (
                  <View style={styles.rearmInfoBox}>
                    <RotateCcwIcon size={14} color={isDark ? "#38BDF8" : "#0284C7"} />
                    <Text style={styles.rearmInfoText}>
                      A matching inactive alert will be re-armed when submitted.
                    </Text>
                  </View>
                )}
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

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (isSubmitting || isSuccess || !!duplicateAlert) && styles.submitBtnDisabled,
                ]}
                activeOpacity={0.85}
                onPress={handleCreateAlert}
                disabled={isSubmitting || isSuccess || !!duplicateAlert}
              >
                <LinearGradient
                  colors={
                    duplicateAlert
                      ? (isDark ? ["#334155", "#1E293B"] : ["#CBD5E1", "#94A3B8"])
                      : condition === "above"
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
                  ) : duplicateAlert ? (
                    <View style={styles.btnContentRow}>
                      <InfoIcon size={18} color={isDark ? "#94A3B8" : "#475569"} />
                      <Text style={[styles.submitBtnText, { color: isDark ? "#94A3B8" : "#334155" }]}>
                        Alert Already Armed
                      </Text>
                    </View>
                  ) : existingInactiveAlert ? (
                    <View style={styles.btnContentRow}>
                      <RotateCcwIcon size={18} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>
                        Re-arm Existing {condition === "above" ? "Rise (≥)" : "Drop (≤)"} Alert
                      </Text>
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
          ) : (
            /* TAB 2: ACTIVE ALERTS LIST */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
            >
              {tokenAlerts.length === 0 ? (
                <View style={styles.emptyListContainer}>
                  <View style={styles.emptyIconCircle}>
                    <BellIcon size={24} color={isDark ? "#64748B" : "#94A3B8"} />
                  </View>
                  <Text style={styles.emptyTitle}>No Alerts for {tokenSymbol}</Text>
                  <Text style={styles.emptySubtitle}>
                    You haven't set any threshold price alerts for this token yet.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionBtn}
                    activeOpacity={0.8}
                    onPress={() => setActiveTab("create")}
                  >
                    <Text style={styles.emptyActionBtnText}>Set Your First Alert</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                tokenAlerts.map((alert) => {
                  const isOperating = operatingAlertId === alert.id;
                  const targetDiff =
                    currentPrice > 0
                      ? ((alert.targetPrice - currentPrice) / currentPrice) * 100
                      : null;

                  return (
                    <View key={alert.id} style={styles.alertItemCard}>
                      <View style={styles.alertItemHeader}>
                        {/* Condition & Target */}
                        <View style={styles.alertConditionRow}>
                          <View
                            style={[
                              styles.alertDirectionIcon,
                              alert.condition === "above"
                                ? styles.alertIconAbove
                                : styles.alertIconBelow,
                            ]}
                          >
                            {alert.condition === "above" ? (
                              <ArrowUpIcon size={14} color={isDark ? "#10B981" : "#059669"} />
                            ) : (
                              <ArrowDownIcon size={14} color={isDark ? "#F43F5E" : "#E11D48"} />
                            )}
                          </View>
                          <View>
                            <Text style={styles.alertTargetText}>
                              {alert.condition === "above" ? "Rise ≥" : "Drop ≤"} $
                              {alert.targetPrice >= 1
                                ? alert.targetPrice.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : alert.targetPrice.toFixed(6)}
                            </Text>
                            {targetDiff !== null && (
                              <Text style={styles.alertDiffText}>
                                {targetDiff >= 0
                                  ? `+${targetDiff.toFixed(1)}%`
                                  : `${targetDiff.toFixed(1)}%`}{" "}
                                away
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Status Badge */}
                        <View
                          style={[
                            styles.statusBadge,
                            alert.status === "ARMED" && styles.statusBadgeArmed,
                            alert.status === "TRIGGERED" && styles.statusBadgeTriggered,
                            alert.status === "DISABLED" && styles.statusBadgeDisabled,
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              alert.status === "ARMED" && styles.statusDotArmed,
                              alert.status === "TRIGGERED" && styles.statusDotTriggered,
                              alert.status === "DISABLED" && styles.statusDotDisabled,
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              alert.status === "ARMED" && styles.statusTextArmed,
                              alert.status === "TRIGGERED" && styles.statusTextTriggered,
                              alert.status === "DISABLED" && styles.statusTextDisabled,
                            ]}
                          >
                            {alert.status}
                          </Text>
                        </View>
                      </View>

                      {/* Alert Item Footer Actions */}
                      <View style={styles.alertItemFooter}>
                        <View style={styles.alertMetaRow}>
                          <Text style={styles.alertMetaText}>
                            Cooldown: {alert.cooldownMinutes > 0 ? `${alert.cooldownMinutes}m` : "Once"}
                          </Text>
                          {alert.triggerCount > 0 && (
                            <Text style={styles.alertMetaText}>
                              • Triggered: {alert.triggerCount}x
                            </Text>
                          )}
                        </View>

                        <View style={styles.alertActionsRow}>
                          {/* Re-arm button if triggered or disabled */}
                          {alert.status !== "ARMED" && (
                            <TouchableOpacity
                              style={styles.rearmBtn}
                              activeOpacity={0.7}
                              onPress={() => handleRearm(alert.id)}
                              disabled={isOperating}
                            >
                              <RotateCcwIcon size={14} color={isDark ? "#38BDF8" : "#0284C7"} />
                              <Text style={styles.rearmBtnText}>Re-arm</Text>
                            </TouchableOpacity>
                          )}

                          {/* Enable/Disable Switch */}
                          <Switch
                            value={alert.enabled}
                            onValueChange={() => handleToggleEnabled(alert.id, alert.enabled)}
                            trackColor={{
                              false: isDark ? "rgba(255,255,255,0.1)" : "#CBD5E1",
                              true: isDark ? "#059669" : "#10B981",
                            }}
                            thumbColor={alert.enabled ? "#FFFFFF" : (isDark ? "#94A3B8" : "#FFFFFF")}
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                            disabled={isOperating}
                          />

                          {/* Delete Button */}
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            activeOpacity={0.7}
                            onPress={() => handleDelete(alert.id)}
                            disabled={isOperating}
                          >
                            {isOperating ? (
                              <ActivityIndicator size="small" color="#F43F5E" />
                            ) : (
                              <TrashIcon size={16} color="#F43F5E" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: ThemeType, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "flex-end",
    },
    backdropPressable: {
      flex: 1,
    },
    sheetContainer: {
      backgroundColor: isDark ? "#0B0F19" : "#FFFFFF",
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
      maxHeight: "88%",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 10,
      elevation: 16,
    },
    grabHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)",
      alignSelf: "center",
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
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
      backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(124, 58, 237, 0.1)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(139, 92, 246, 0.3)" : "rgba(124, 58, 237, 0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    titleText: {
      color: isDark ? "#FFFFFF" : "#0F172A",
      fontSize: 18,
      fontFamily: theme.fonts?.families?.openBold || "OpenSans_700Bold",
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    subtitleText: {
      color: isDark ? "#94A3B8" : "#64748B",
      fontSize: 12,
      fontFamily: theme.fonts?.families?.openRegular || "OpenSans_400Regular",
      marginTop: 2,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
      alignItems: "center",
      justifyContent: "center",
    },
    modeTabsContainer: {
      flexDirection: "row",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9",
      borderRadius: 12,
      borderWidth: isDark ? 0 : 1,
      borderColor: "#E2E8F0",
      padding: 3,
      marginBottom: 14,
    },
    modeTab: {
      flex: 1,
      paddingVertical: 9,
      alignItems: "center",
      borderRadius: 9,
    },
    modeTabActive: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#FFFFFF",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 2,
      elevation: isDark ? 0 : 2,
    },
    modeTabText: {
      color: isDark ? "#94A3B8" : "#64748B",
      fontSize: 13,
      fontWeight: "600",
    },
    modeTabTextActive: {
      color: isDark ? "#FFFFFF" : theme.colors.primary,
      fontWeight: "700",
    },
    tokenCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#E2E8F0",
      padding: 14,
      marginBottom: 14,
    },
    tokenCardLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    tokenCardSymbol: {
      color: isDark ? "#FFFFFF" : "#0F172A",
      fontSize: 16,
      fontWeight: "700",
    },
    tokenCardName: {
      color: isDark ? "#94A3B8" : "#64748B",
      fontSize: 12,
      marginTop: 2,
      maxWidth: 120,
    },
    tokenCardRight: {
      alignItems: "flex-end",
    },
    livePriceLabel: {
      color: isDark ? "#64748B" : "#94A3B8",
      fontSize: 11,
      fontWeight: "500",
    },
    livePriceValue: {
      color: isDark ? "#FFFFFF" : "#0F172A",
      fontSize: 17,
      fontWeight: "700",
      marginTop: 2,
    },
    scrollBody: {
      gap: 14,
      paddingBottom: 20,
    },
    directionToggleContainer: {
      flexDirection: "row",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F1F5F9",
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
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.12)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.3)",
    },
    directionTabActiveBelow: {
      backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : "rgba(244, 63, 94, 0.12)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(244, 63, 94, 0.35)" : "rgba(244, 63, 94, 0.3)",
    },
    directionTabText: {
      color: isDark ? "#94A3B8" : "#64748B",
      fontSize: 13,
      fontWeight: "600",
    },
    directionTabTextActiveAbove: {
      color: isDark ? "#10B981" : "#059669",
      fontWeight: "700",
    },
    directionTabTextActiveBelow: {
      color: isDark ? "#F43F5E" : "#E11D48",
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
      color: isDark ? "#E2E8F0" : "#1E293B",
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
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#CBD5E1",
      paddingHorizontal: 16,
      height: 52,
    },
    currencyPrefix: {
      color: isDark ? "#64748B" : "#94A3B8",
      fontSize: 20,
      fontWeight: "700",
      marginRight: 6,
    },
    textInput: {
      flex: 1,
      color: isDark ? "#FFFFFF" : "#0F172A",
      fontSize: 18,
      fontWeight: "700",
      padding: 0,
    },
    presetSection: {
      gap: 8,
    },
    sectionSmallLabel: {
      color: isDark ? "#94A3B8" : "#64748B",
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
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
    },
    presetChipText: {
      color: isDark ? "#E2E8F0" : "#1E293B",
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
      color: isDark ? "#64748B" : "#94A3B8",
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
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
    },
    cooldownChipActive: {
      backgroundColor: isDark ? "rgba(139, 92, 246, 0.18)" : "rgba(124, 58, 237, 0.12)",
      borderColor: isDark ? "rgba(139, 92, 246, 0.45)" : "rgba(124, 58, 237, 0.35)",
    },
    cooldownChipText: {
      color: isDark ? "#94A3B8" : "#64748B",
      fontSize: 11,
      fontWeight: "600",
    },
    cooldownChipTextActive: {
      color: isDark ? "#A78BFA" : "#7C3AED",
      fontWeight: "700",
    },
    errorBox: {
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.3)",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
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
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.1)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.25)",
      borderRadius: 12,
      padding: 12,
      gap: 8,
      marginBottom: 8,
    },
    successText: {
      color: isDark ? "#10B981" : "#059669",
      fontSize: 13,
      fontWeight: "600",
    },
    duplicateWarningBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.08)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.25)",
      borderRadius: 12,
      padding: 10,
      gap: 8,
      marginTop: 8,
    },
    duplicateWarningContent: {
      flex: 1,
    },
    duplicateWarningTitle: {
      color: isDark ? "#FBBF24" : "#D97706",
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 2,
    },
    duplicateWarningText: {
      color: isDark ? "#FCD34D" : "#B45309",
      fontSize: 11,
      lineHeight: 15,
    },
    rearmInfoBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(56, 189, 248, 0.1)" : "rgba(14, 165, 233, 0.08)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(56, 189, 248, 0.3)" : "rgba(14, 165, 233, 0.25)",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
      marginTop: 8,
    },
    rearmInfoText: {
      color: isDark ? "#7DD3FC" : "#0284C7",
      fontSize: 11,
      fontWeight: "500",
      flex: 1,
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
    /* List Styles */
    emptyListContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 36,
      paddingHorizontal: 20,
      gap: 8,
    },
    emptyIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#F1F5F9",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    emptyTitle: {
      color: isDark ? "#FFFFFF" : "#0F172A",
      fontSize: 16,
      fontWeight: "700",
    },
    emptySubtitle: {
      color: isDark ? "#64748B" : "#64748B",
      fontSize: 13,
      textAlign: "center",
      lineHeight: 18,
    },
    emptyActionBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(124, 58, 237, 0.1)",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? "rgba(139, 92, 246, 0.35)" : "rgba(124, 58, 237, 0.25)",
    },
    emptyActionBtnText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "600",
    },
    alertItemCard: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#E2E8F0",
      padding: 14,
      gap: 12,
    },
    alertItemHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    alertConditionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    alertDirectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    alertIconAbove: {
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.12)",
    },
    alertIconBelow: {
      backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : "rgba(244, 63, 94, 0.12)",
    },
    alertTargetText: {
      color: isDark ? "#FFFFFF" : "#0F172A",
      fontSize: 15,
      fontWeight: "700",
    },
    alertDiffText: {
      color: isDark ? "#94A3B8" : "#64748B",
      fontSize: 11,
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 5,
    },
    statusBadgeArmed: {
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.1)",
    },
    statusBadgeTriggered: {
      backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.12)",
    },
    statusBadgeDisabled: {
      backgroundColor: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(148, 163, 184, 0.15)",
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusDotArmed: {
      backgroundColor: isDark ? "#10B981" : "#059669",
    },
    statusDotTriggered: {
      backgroundColor: isDark ? "#F59E0B" : "#D97706",
    },
    statusDotDisabled: {
      backgroundColor: isDark ? "#94A3B8" : "#64748B",
    },
    statusText: {
      fontSize: 11,
      fontWeight: "700",
    },
    statusTextArmed: {
      color: isDark ? "#10B981" : "#059669",
    },
    statusTextTriggered: {
      color: isDark ? "#F59E0B" : "#D97706",
    },
    statusTextDisabled: {
      color: isDark ? "#94A3B8" : "#64748B",
    },
    alertItemFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: isDark ? "rgba(255, 255, 255, 0.04)" : "#E2E8F0",
      paddingTop: 10,
    },
    alertMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    alertMetaText: {
      color: isDark ? "#64748B" : "#94A3B8",
      fontSize: 11,
    },
    alertActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    rearmBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(14, 165, 233, 0.1)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    rearmBtnText: {
      color: isDark ? "#38BDF8" : "#0284C7",
      fontSize: 11,
      fontWeight: "600",
    },
    deleteBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: "rgba(244, 63, 94, 0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
  });
