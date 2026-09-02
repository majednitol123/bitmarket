import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark" | "system";

export interface SettingsState {
  themeMode: ThemeMode;
  slippage: string;
  customSlippage: string;
  slippageAuto: boolean;
  deadline: string;
  expertMode: boolean;
  notificationsEnabled: boolean;
}

const initialState: SettingsState = {
  themeMode: "system",
  slippage: "0.5",
  customSlippage: "",
  slippageAuto: true,
  deadline: "20",
  expertMode: false,
  notificationsEnabled: true,
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
} = settingsSlice.actions;

export default settingsSlice.reducer;

