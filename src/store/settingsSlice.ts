import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark" | "system";

export type DataUpdateInterval = 5 | 10 | 15 | 30 | 60;

export interface SettingsState {
  themeMode: ThemeMode;
  slippage: string;
  customSlippage: string;
  slippageAuto: boolean;
  deadline: string;
  expertMode: boolean;
  notificationsEnabled: boolean;
  debugOverrideAddress: string;
  dataUpdateInterval: number;
}

const initialState: SettingsState = {
  themeMode: "dark",
  slippage: "0.5",
  customSlippage: "",
  slippageAuto: true,
  deadline: "20",
  expertMode: false,
  notificationsEnabled: true,
  debugOverrideAddress: "",
  dataUpdateInterval: 15,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    setSlippage(state, action: PayloadAction<string>) {
      state.slippage = action.payload;
    },
    setCustomSlippage(state, action: PayloadAction<string>) {
      state.customSlippage = action.payload;
    },
    setSlippageAuto(state, action: PayloadAction<boolean>) {
      state.slippageAuto = action.payload;
    },
    setDeadline(state, action: PayloadAction<string>) {
      state.deadline = action.payload;
    },
    setExpertMode(state, action: PayloadAction<boolean>) {
      state.expertMode = action.payload;
    },
    setNotificationsEnabled(state, action: PayloadAction<boolean>) {
      state.notificationsEnabled = action.payload;
    },
    setDebugOverrideAddress(state, action: PayloadAction<string>) {
      state.debugOverrideAddress = action.payload.trim();
    },
    setDataUpdateInterval(state, action: PayloadAction<number>) {
      state.dataUpdateInterval = action.payload;
    },
  },
});

export const {
  setThemeMode,
  setSlippage,
  setCustomSlippage,
  setSlippageAuto,
  setDeadline,
  setExpertMode,
  setNotificationsEnabled,
  setDebugOverrideAddress,
  setDataUpdateInterval,
} = settingsSlice.actions;

export default settingsSlice.reducer;

