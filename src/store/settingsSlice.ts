import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark" | "system";

export interface SettingsState {
  themeMode: ThemeMode;
}

const initialState: SettingsState = {
  themeMode: "system",
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
  },
});

export const { setThemeMode } = settingsSlice.actions;
export default settingsSlice.reducer;
