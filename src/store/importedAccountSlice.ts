import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ImportedAccountPair {
  id: string;
  accountName: string;
  evmAddress?: string;
  solAddress?: string;
}

export interface ImportedAccountState {
  accounts: ImportedAccountPair[];
  nextId: number;
  activeEvmAddress?: string;
  activeSolAddress?: string;
}

const initialState: ImportedAccountState = {
  accounts: [],
  nextId: 1,
};

const importedAccountSlice = createSlice({
  name: "importedAccounts",
  initialState,
  reducers: {
    addImportedEvmAccount: (
      state,
      action: PayloadAction<{ address: string }>
    ) => {
      const { address } = action.payload;
      const existingAccount = state.accounts.find((acc) => !acc.evmAddress);
      if (existingAccount) {
        existingAccount.evmAddress = address;
      } else {
        state.accounts.push({
          id: `imported-${state.nextId}`,
          accountName: `Imported Account ${state.nextId}`,
          evmAddress: address,
        });
        state.nextId += 1;
      }
    },
    addImportedSolAccount: (
      state,
      action: PayloadAction<{ address: string }>
    ) => {
      const { address } = action.payload;
      const existingAccount = state.accounts.find((acc) => !acc.solAddress);
      if (existingAccount) {
        existingAccount.solAddress = address;
      } else {
        state.accounts.push({
          id: `imported-${state.nextId}`,
          accountName: `Imported Account ${state.nextId}`,
          solAddress: address,
        });
        state.nextId += 1;
      }
    },
    removeImportedAccount: (state, action: PayloadAction<string>) => {
      state.accounts = state.accounts.filter(
        (acc) => acc.id !== action.payload
      );
    },
    updateImportedAccountName: (
      state,
      action: PayloadAction<{ id: string; accountName: string }>
    ) => {
      const account = state.accounts.find((acc) => acc.id === action.payload.id);
      if (account) {
        account.accountName = action.payload.accountName;
      }
    },
    clearImportedAccounts: (state) => {
      state.accounts = [];
      state.nextId = 1;
      state.activeEvmAddress = undefined;
      state.activeSolAddress = undefined;
    },
    setActiveImportedAccount: (
      state,
      action: PayloadAction<{ evmAddress?: string; solAddress?: string }>
    ) => {
      state.activeEvmAddress = action.payload.evmAddress;
      state.activeSolAddress = action.payload.solAddress;
    },
    clearActiveImportedAccount: (state) => {
      state.activeEvmAddress = undefined;
      state.activeSolAddress = undefined;
    },
  },
});

export const {
  addImportedEvmAccount,
  addImportedSolAccount,
  removeImportedAccount,
  updateImportedAccountName,
  clearImportedAccounts,
  setActiveImportedAccount,
  clearActiveImportedAccount,
} = importedAccountSlice.actions;

export default importedAccountSlice.reducer;
