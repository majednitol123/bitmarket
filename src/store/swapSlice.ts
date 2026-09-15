import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PendingSwapToken {
  symbol: string;
  name: string;
  address: string; // Verified contract address or "native"
  chainId: string;
  logoUrl?: string;
  color?: string;
}

export interface SwapSliceState {
  pendingFromToken: PendingSwapToken | null;
}

const initialState: SwapSliceState = {
  pendingFromToken: null,
};

const swapSlice = createSlice({
  name: "swap",
  initialState,
  reducers: {
    setPendingSwapFromToken(state, action: PayloadAction<PendingSwapToken>) {
      state.pendingFromToken = action.payload;
    },
    clearPendingSwapToken(state) {
      state.pendingFromToken = null;
    },
  },
});

export const { setPendingSwapFromToken, clearPendingSwapToken } = swapSlice.actions;
export default swapSlice.reducer;
