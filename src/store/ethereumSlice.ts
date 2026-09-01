import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EvmWalletState,
  CustomNetwork,
} from "./types";
import {
  EVMService,
  evmServices,
  registerEvmService,
} from "../services/EthereumService";
import DEFAULT_NETWORKS from "../constants/networks";

const STORAGE_KEY = "EVM_WALLET_STATE";
const defaultNetworks: CustomNetwork[] = DEFAULT_NETWORKS;

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

    if (!state.globalAddresses) {
      state.globalAddresses = [];
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

/* =======================================================
   SLICE
======================================================= */

const evmSlice = createSlice({
  name: "evm",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // ---------------- Load / Save Wallet State ----------------
      .addCase(loadWalletState.fulfilled, (_, action) => action.payload)
      .addCase(saveWalletState.fulfilled, (_, action) => action.payload);
  },
});

export default evmSlice.reducer;
