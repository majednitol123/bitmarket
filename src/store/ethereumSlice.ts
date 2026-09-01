import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers } from "ethers";
import {
  EvmWalletState,
  AddressState,
  CustomNetwork,
  GeneralStatus,
} from "./types";
import {
  EVMService,
  evmServices,
  registerEvmService,
} from "../services/EthereumService";
import DEFAULT_NETWORKS from "../constants/networks";

const STORAGE_KEY = "EVM_WALLET_STATE";
const defaultNetworks: CustomNetwork[] = DEFAULT_NETWORKS;

const createEmptyAddress = (): AddressState => ({
  accountName: "Account 1",
  derivationPath: "",
  address: "",
  publicKey: "",
  balanceByChain: {},
  statusByChain: {},
  activeBalance: 0,
  failedNetworkRequestByChain: {},
});

const initialState: EvmWalletState = {
  activeChainId: defaultNetworks[0].chainId,
  activeIndex: 0,
  networks: {},
  globalAddresses: [],
};

defaultNetworks.forEach((net) => {
  initialState.networks[net.chainId] = net;
  initialState.activeIndex = 0;
});

defaultNetworks.forEach((chain) => {
  if (!chain.rpcUrl) {
    console.warn(`Skipping chain ${chain.chainId} because RPC URL is missing`);
    return;
  }
  evmServices[chain.chainId] = new EVMService(chain);
});

export const loadWalletState = createAsyncThunk(
  "evm/loadWalletState",
  async () => {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    let state: EvmWalletState = json ? JSON.parse(json) : initialState;

    const validChainIds = new Set(defaultNetworks.map((n) => n.chainId));
    const cleanedNetworks: Record<number, CustomNetwork> = {};
    defaultNetworks.forEach((net) => {
      cleanedNetworks[net.chainId] = net;
    });

    state.networks = cleanedNetworks;
    if (!state.activeChainId || !state.networks[state.activeChainId]) {
      state.activeChainId = defaultNetworks[0].chainId;
    }

    Object.values(state.networks).forEach((net: any) => {
      if (net?.rpcUrl) {
        registerEvmService(net);
      }
    });

    if (!state.globalAddresses || state.globalAddresses.length === 0) {
      state.globalAddresses = [createEmptyAddress()];
    }

    return state;
  }
);

export const saveWalletState = createAsyncThunk(
  "evm/saveWalletState",
  async (state: EvmWalletState) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
);

export const fetchEvmBalance = createAsyncThunk(
  "evm/fetchBalance",
  async ({ chainId, address }: { chainId: number; address: string }) => {
    const service = evmServices[chainId];
    if (!service) throw new Error("Service not initialized");

    try {
      const balanceBN = await service.getBalance(address);
      const balance = parseFloat(ethers.formatEther(balanceBN));

      return {
        chainId,
        address,
        balance,
      };
    } catch (error) {
      throw error;
    }
  }
);

export const fetchEvmBalanceInterval = createAsyncThunk(
  "evm/fetchBalanceInterval",
  async (payload: { chainId: number; address: string }, { dispatch }) => {
    await dispatch(fetchEvmBalance(payload));
    return true;
  }
);

export interface SendTransactionArgs {
  chainId: number;
  from: string;
  to: string;
  privateKey: string;
  amount: string;
}

export const sendEvmTransaction = createAsyncThunk<
  { chainId: number; address: string; tx: any },
  SendTransactionArgs,
  { rejectValue: string }
>(
  "evm/sendTransaction",
  async ({ chainId, from, to, privateKey, amount }: SendTransactionArgs, { rejectWithValue }) => {
    try {
      const service = evmServices[chainId];
      if (!service) {
        throw new Error(`EVM service not initialized for chain ${chainId}`);
      }

      const txResponse = await service.sendTransaction(from, to, privateKey, amount);

      return {
        chainId,
        address: from.toLowerCase(),
        tx: txResponse,
      };
    } catch (error: any) {
      console.error("Send transaction failed:", error);
      return rejectWithValue(error.message || "Transaction failed");
    }
  }
);

/* =======================================================
   SLICE
======================================================= */

const evmSlice = createSlice({
  name: "evm",
  initialState,
  reducers: {
    /* -------- Network -------- */
    addNetwork(state, action: PayloadAction<CustomNetwork>) {
      const net = action.payload;
      if (!state.networks[net.chainId]) {
        state.networks[net.chainId] = net;
        state.activeIndex = 0;
      }
      state.activeChainId = net.chainId;
    },

    updateNetwork(state, action: PayloadAction<CustomNetwork>) {
      const net = action.payload;
      if (!state.networks[net.chainId]) return;
      state.networks[net.chainId] = net;
    },

    removeNetwork(state, action: PayloadAction<number>) {
      const chainId = action.payload;
      if (defaultNetworks.some((n) => n.chainId === chainId)) return;
      delete state.networks[chainId];
      state.activeChainId = defaultNetworks[0].chainId;
    },

    setActiveChain(state, action: PayloadAction<number>) {
      if (state.networks[action.payload]) {
        state.activeChainId = action.payload;
      }
    },

    /* -------- Address -------- */
    saveAddresses(
      state,
      action: PayloadAction<{ addresses: AddressState[] }>
    ) {
      state.globalAddresses = [...action.payload.addresses];
      state.activeIndex = 0;
    },

    updateAddresses(
      state,
      action: PayloadAction<{ addresses: AddressState[] }>
    ) {
      const { addresses } = action.payload;
      addresses.forEach((addr) => {
        const idx = state.globalAddresses.findIndex((a) => a.address === addr.address);
        if (idx >= 0) {
          state.globalAddresses[idx] = addr;
        } else {
          state.globalAddresses.push(addr);
        }
      });
    },

    addAddress(state, action: PayloadAction<AddressState>) {
      const addr = action.payload;
      const idx = state.globalAddresses.findIndex((a) => a.address === addr.address);
      if (idx >= 0) {
        state.globalAddresses[idx] = addr;
      } else {
        state.globalAddresses.push(addr);
      }
    },

    /* -------- Balance -------- */
    deposit(
      state,
      action: PayloadAction<{ chainId: number; amount: number }>
    ) {
      const { chainId, amount } = action.payload;
      const idx = state.activeIndex ?? 0;
      const account = state.globalAddresses[idx];
      if (!account) return;

      if (account.balanceByChain[chainId] === undefined) {
        account.balanceByChain[chainId] = 0;
      }
      account.balanceByChain[chainId] += amount;
    },

    withdraw(
      state,
      action: PayloadAction<{ chainId: number; amount: number }>
    ) {
      const { chainId, amount } = action.payload;
      const idx = state.activeIndex ?? 0;
      const account = state.globalAddresses[idx];
      if (!account) return;

      if (account.balanceByChain[chainId] === undefined) {
        account.balanceByChain[chainId] = 0;
      }
      if (account.balanceByChain[chainId] >= amount) {
        account.balanceByChain[chainId] -= amount;
      } else {
        account.balanceByChain[chainId] = 0;
      }
    },

    updateBalance(
      state,
      action: PayloadAction<{ chainId: number; address: string; balance: number }>
    ) {
      const { chainId, address, balance } = action.payload;
      const account = state.globalAddresses.find((a) => a.address === address);
      if (!account) return;

      if (!account.balanceByChain) account.balanceByChain = {};
      if (!account.statusByChain) account.statusByChain = {};
      if (!account.failedNetworkRequestByChain) account.failedNetworkRequestByChain = {};

      account.balanceByChain[chainId] = balance;
      account.statusByChain[chainId] = GeneralStatus.Idle;
      account.failedNetworkRequestByChain[chainId] = false;

      const activeIndex = state.activeIndex ?? 0;
      if (state.globalAddresses[activeIndex]?.address === address) {
        account.activeBalance = balance;
      }
    },

    updateAccountName(
      state,
      action: PayloadAction<{ address: string; accountName: string }>
    ) {
      const { address, accountName } = action.payload;
      const account = state.globalAddresses.find((a) => a.address === address);
      if (!account) return;
      account.accountName = accountName;
    },

    setActiveAccount: (
      state,
      action: PayloadAction<{ index: number }>
    ) => {
      const { index } = action.payload;
      if (index < 0 || index >= state.globalAddresses.length) return;
      state.activeIndex = index;
    },

    setActiveNetwork(state, action: PayloadAction<number>) {
      const chainId = action.payload;
      if (state.networks[chainId]) state.activeChainId = chainId;
    },

    resetState() {
      return initialState;
    },
  },

  extraReducers: (builder) => {
    builder
      // ---------------- Fetch Balance ----------------
      .addCase(fetchEvmBalance.pending, (state, action) => {
        const { chainId, address } = action.meta.arg;
        const account = state.globalAddresses.find(
          (a) => a.address.toLowerCase() === address.toLowerCase()
        );
        if (!account) return;

        if (!account.statusByChain) {
          account.statusByChain = {};
        }
        account.statusByChain[chainId] = GeneralStatus.Loading;
      })

      .addCase(fetchEvmBalance.fulfilled, (state, action) => {
        const { chainId, address, balance } = action.payload;
        const account = state.globalAddresses.find(
          (a) => a.address.toLowerCase() === address.toLowerCase()
        );
        if (!account) return;

        if (!account.balanceByChain) account.balanceByChain = {};
        if (!account.statusByChain) account.statusByChain = {};
        if (!account.failedNetworkRequestByChain) account.failedNetworkRequestByChain = {};

        account.balanceByChain[chainId] = balance;
        account.statusByChain[chainId] = GeneralStatus.Idle;
        account.failedNetworkRequestByChain[chainId] = false;
      })

      .addCase(fetchEvmBalance.rejected, (state, action) => {
        const { chainId, address } = action.meta.arg;
        const account = state.globalAddresses.find(
          (a) => a.address.toLowerCase() === address.toLowerCase()
        );
        if (!account) return;

        if (!account.statusByChain) account.statusByChain = {};
        if (!account.failedNetworkRequestByChain) account.failedNetworkRequestByChain = {};

        account.statusByChain[chainId] = GeneralStatus.Failed;
        account.failedNetworkRequestByChain[chainId] = true;
      })

      // ---------------- Load / Save Wallet State ----------------
      .addCase(loadWalletState.fulfilled, (_, action) => action.payload)
      .addCase(saveWalletState.fulfilled, (_, action) => action.payload);
  },
});

/* =======================================================
   EXPORTS
====================================================== */

export const {
  addNetwork,
  updateNetwork,
  removeNetwork,
  setActiveChain,
  saveAddresses,
  updateAddresses,
  addAddress,
  setActiveAccount,
  updateAccountName,
  deposit,
  withdraw,
  updateBalance,
  resetState,
} = evmSlice.actions;

export default evmSlice.reducer;
