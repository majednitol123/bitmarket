import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "styled-components/native";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import {
  setSlippage as setSlippageAction,
  setCustomSlippage as setCustomSlippageAction,
  setSlippageAuto as setSlippageAutoAction,
  setDeadline as setDeadlineAction,
  setExpertMode as setExpertModeAction,
} from "../../store/settingsSlice";
import type { ThemeType } from "../../styles/theme";
import { SLIPPAGE_OPTIONS, DEADLINE_OPTIONS } from "../../hooks/useSwapState";

// ═══════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════

export interface SwapSettingsBottomSheetProps {
  isPresented: boolean;
  onDismiss: () => void;
  chainName?: string;
  slippage?: string;
  setSlippage?: (val: string) => void;
  customSlippage?: string;
  setCustomSlippage?: (val: string) => void;
  slippageAuto?: boolean;
  setSlippageAuto?: (val: boolean) => void;
  deadline?: string;
  setDeadline?: (val: string) => void;
  expertMode?: boolean;
  setExpertMode?: (val: boolean) => void;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export function SwapSettingsBottomSheet(props: SwapSettingsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const reduxSettings = useSelector((state: RootState) => state.settings);

  const slippage = props.slippage ?? reduxSettings?.slippage ?? "0.5";
  const customSlippage = props.customSlippage ?? reduxSettings?.customSlippage ?? "";
  const slippageAuto = props.slippageAuto ?? reduxSettings?.slippageAuto ?? true;
  const deadline = props.deadline ?? reduxSettings?.deadline ?? "20";
  const expertMode = props.expertMode ?? reduxSettings?.expertMode ?? false;

  const handleSetSlippage = (val: string) => {
    if (props.setSlippage) props.setSlippage(val);
    else dispatch(setSlippageAction(val));
  };

  const handleSetCustomSlippage = (val: string) => {
    if (props.setCustomSlippage) props.setCustomSlippage(val);
    else dispatch(setCustomSlippageAction(val));
  };

  const handleSetSlippageAuto = (val: boolean) => {
    if (props.setSlippageAuto) props.setSlippageAuto(val);
    else dispatch(setSlippageAutoAction(val));
  };

  const handleSetDeadline = (val: string) => {
    if (props.setDeadline) props.setDeadline(val);
    else dispatch(setDeadlineAction(val));
  };

  const handleSetExpertMode = (val: boolean) => {
    if (props.setExpertMode) props.setExpertMode(val);
    else dispatch(setExpertModeAction(val));
  };

  const theme = useTheme() as ThemeType;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={props.isPresented}
      transparent
      animationType="slide"
      onRequestClose={props.onDismiss}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={props.onDismiss}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 16) + 12 },
          ]}
        >
          {/* Drag Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Swap Settings</Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ─── Slippage Tolerance ─── */}
            <View style={styles.row}>
              <Text style={styles.label}>Slippage Tolerance</Text>
              <Text style={styles.value}>
                {slippageAuto ? "Auto" : `${customSlippage || slippage}%`}
              </Text>
            </View>

            {/* Slippage Option Buttons */}
            <View style={styles.optionButtonsRow}>
              {SLIPPAGE_OPTIONS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.optionButton,
                    slippage === val && !customSlippage && styles.optionButtonActive,
                  ]}
                  onPress={() => {
                    handleSetSlippage(val);
                    handleSetCustomSlippage("");
                    handleSetSlippageAuto(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      slippage === val &&
                        !customSlippage &&
                        styles.optionButtonTextActive,
                    ]}
                  >
                    {val}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Slippage Input with Gradient Border */}
            <LinearGradient
              colors={theme.colors.buttonGradient || (["#7C3AED", "#A855F7"] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.customSlippageGradient}
            >
              <View style={styles.customSlippageRow}>
                <TextInput
                  style={styles.customSlippageInput}
                  value={customSlippage}
                  onChangeText={(text) => {
                    handleSetCustomSlippage(text);
                    if (text) handleSetSlippageAuto(false);
                  }}
                  placeholder="Custom"
                  placeholderTextColor={theme.colors.grey}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.customSlippagePercent}>%</Text>
              </View>
            </LinearGradient>

            {/* Auto (Recommended) Checkbox */}
            <TouchableOpacity
              style={styles.autoRow}
              activeOpacity={0.7}
              onPress={() => {
                handleSetSlippageAuto(!slippageAuto);
                if (!slippageAuto) {
                  handleSetCustomSlippage("");
                }
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  slippageAuto && styles.checkboxActive,
                ]}
              >
                {slippageAuto && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.autoText}>Auto (Recommended)</Text>
            </TouchableOpacity>

            {/* ─── Transaction Deadline ─── */}
            <View style={[styles.row, { marginTop: 20 }]}>
              <Text style={styles.label}>Transaction Deadline</Text>
              <Text style={styles.value}>{deadline} min</Text>
            </View>

            {/* Deadline Option Buttons */}
            <View style={styles.optionButtonsRow}>
              {DEADLINE_OPTIONS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.optionButton,
                    deadline === val && styles.optionButtonActive,
                  ]}
                  onPress={() => handleSetDeadline(val)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      deadline === val && styles.optionButtonTextActive,
                    ]}
                  >
                    {val}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.deadlineHint}>
              Transaction will revert if it's pending for longer than the selected time
            </Text>

            {/* ─── Expert Mode ─── */}
            <View style={[styles.row, { marginTop: 20 }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.label}>Expert Mode</Text>
                <Text style={styles.expertSubtext}>
                  Allows high slippage trades and advanced features
                </Text>
              </View>
              <Switch
                value={expertMode}
                onValueChange={handleSetExpertMode}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>

          {/* ─── Bottom Done Button ─── */}
          <TouchableOpacity
            style={styles.doneButtonWrapper}
            activeOpacity={0.85}
            onPress={props.onDismiss}
          >
            <LinearGradient
              colors={theme.colors.buttonGradient || (["#3772FF", "#9B59B6"] as const)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneGradient}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

function createStyles(theme: ThemeType) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0, 0, 0, 0.65)",
    },
    backdrop: {
      flex: 1,
    },
    sheetContainer: {
      width: "100%",
      backgroundColor: theme.colors.cardBackground,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderBottomWidth: 0,
      maxHeight: "88%",
    },
    handleContainer: {
      alignItems: "center",
      paddingVertical: 6,
      marginBottom: 6,
    },
    handleBar: {
      width: 44,
      height: 4.5,
      borderRadius: 2.5,
      backgroundColor: "#3A3D46",
    },
    header: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
      marginTop: 2,
    },
    title: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 18,
      textAlign: "center",
    },
    scrollContent: {
      paddingBottom: 8,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    label: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 14,
    },
    value: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 13,
    },
    optionButtonsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    optionButton: {
      flex: 1,
      backgroundColor: theme.colors.dark,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 10,
      alignItems: "center",
    },
    optionButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    optionButtonText: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 13,
    },
    optionButtonTextActive: {
      color: "#FFFFFF",
    },
    customSlippageGradient: {
      borderRadius: 12,
      padding: 1.5,
      marginBottom: 12,
    },
    customSlippageRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.dark,
      borderRadius: 10.5,
      paddingHorizontal: 14,
      height: 42,
    },
    customSlippageInput: {
      flex: 1,
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 14,
    },
    customSlippagePercent: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 14,
    },
    autoRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.dark,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    checkboxActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    checkboxCheck: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "700",
    },
    autoText: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 13,
    },
    deadlineHint: {
      color: theme.colors.grey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 12,
      marginTop: 4,
      marginBottom: 4,
    },
    expertSubtext: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 12,
      marginTop: 2,
    },
    doneButtonWrapper: {
      borderRadius: 16,
      overflow: "hidden",
      marginTop: 16,
    },
    doneGradient: {
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    doneButtonText: {
      color: "#FFFFFF",
      fontFamily: theme.fonts.families.openBold,
      fontSize: 16,
      letterSpacing: 0.3,
    },
  });
}
