import React from "react";
import { View, Text, TouchableOpacity, TextInput, Switch, StyleSheet } from "react-native";
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
import CloseIcon from "../../assets/svg/close.svg";
import { SLIPPAGE_OPTIONS, DEADLINE_OPTIONS } from "../../hooks/useSwapState";

// ═══════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════

export interface SwapSettingsPanelProps {
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
  showHeader?: boolean;
  title?: string;
  onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export function SwapSettingsPanel(props: SwapSettingsPanelProps) {
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
  const showHeader = props.showHeader !== false;

  return (
    <View style={styles.settingsPanel}>
      {/* Header */}
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.title}>{props.title ?? "Swap Settings"}</Text>
          {props.onClose && (
            <TouchableOpacity
              onPress={props.onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <CloseIcon
                width={16}
                height={16}
                fill={theme.colors.lightGrey}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Slippage Tolerance */}
      <View style={styles.row}>
        <Text style={styles.label}>Slippage Tolerance</Text>
        <Text style={styles.value}>
          {slippageAuto ? "Auto" : `${customSlippage || slippage}%`}
        </Text>
      </View>
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

      {/* Custom slippage input */}
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

      {/* Auto checkbox */}
      <TouchableOpacity
        style={styles.autoRow}
        onPress={() => {
          handleSetSlippageAuto(!slippageAuto);
          if (!slippageAuto) {
            handleSetCustomSlippage("");
          }
        }}
      >
        <View style={[styles.checkbox, slippageAuto && styles.checkboxActive]}>
          {slippageAuto && <Text style={styles.checkboxCheck}>✓</Text>}
        </View>
        <Text style={styles.autoText}>Auto (Recommended)</Text>
      </TouchableOpacity>

      {/* Transaction Deadline */}
      <View style={[styles.row, { marginTop: 20 }]}>
        <Text style={styles.label}>Transaction Deadline</Text>
        <Text style={styles.value}>{deadline} min</Text>
      </View>
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

      {/* Expert Mode */}
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

      {/* About info box */}
      <View style={styles.aboutBox}>
        <Text style={styles.aboutTitle}>About these settings</Text>
        <Text style={styles.aboutItem}>
          • Slippage: Maximum price movement you accept
        </Text>
        <Text style={styles.aboutItem}>
          • Deadline: Transaction timeout period
        </Text>
        <Text style={styles.aboutItem}>
          • Expert Mode: Advanced features for experienced users
        </Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

function createStyles(theme: ThemeType) {
  return StyleSheet.create({
    settingsPanel: {
      backgroundColor: theme.colors.dark,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      marginBottom: 16,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    title: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 18,
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
      backgroundColor: theme.colors.cardBackground,
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
    customSlippageRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      marginBottom: 12,
      height: 44,
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
      backgroundColor: theme.colors.cardBackground,
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
    aboutBox: {
      backgroundColor: theme.colors.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginTop: 16,
    },
    aboutTitle: {
      color: theme.colors.white,
      fontFamily: theme.fonts.families.openBold,
      fontSize: 13,
      marginBottom: 8,
    },
    aboutItem: {
      color: theme.colors.lightGrey,
      fontFamily: theme.fonts.families.openRegular,
      fontSize: 12,
      lineHeight: 20,
    },
  });
}
