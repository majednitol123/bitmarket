import "react-native-get-random-values";
import "@ethersproject/shims";

import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import solanaService from "../services/SolanaService";
import { truncateBalance } from "../utils/truncateBalance";
import { withRetry } from "../utils/retry";
import { rpcCircuitBreaker } from "../utils/circuitBreaker";
import {
  GeneralStatus,
 
  Transaction,
  TransactionConfirmation,
  ConfirmationState,
  SolanaWalletState,
  SAddressState,
} from "./types";

const CONFIRMATION_TIMEOUT = 60000;
const MAX_SOL_TX_CONFIRMATIONS = 50;
const initialState: SolanaWalletState = {
  activeIndex: 0,
  selectedNetwork: "devnet",
  customRpcUrls: {},
  addresses: [
    {
      accountName: "",
      derivationPath: "",
      address: "",
      publicKey: "",
      balance: 0,
      failedNetworkRequest: false,
      status: GeneralStatus.Idle,
      transactionConfirmations: [],
      transactionMetadata: {
        paginationKey: undefined,
        transactions: [],
      },
      balanceByNetwork: {
        mainnet: 0,
        devnet: 0,
      },
      transactionsByNetwork: {
        mainnet: [],
        devnet: [],
      },
    },
  ],
};

export interface FetchTransactionsArg {
  address: string;
  paginationKey?: string[] | string;
}

export type FetchSolanaBalanceArgs = string | { address: string; network: "mainnet" | "devnet" };

export const fetchSolanaTransactions = createAsyncThunk(
  "wallet/fetchSolanaTransactions",
  async (arg: FetchSolanaBalanceArgs, { rejectWithValue, getState }): Promise<any> => {
    try {
      const state = getState() as any;
      const address = typeof arg === "string" ? arg : arg.address;
      const network = typeof arg === "string" ? (state.solana.selectedNetwork ?? "devnet") : arg.network;
      const chainKey = `solana-${network}`;

      // Circuit-breaker: skip networks with repeated failures
      if (rpcCircuitBreaker.isOpen(chainKey)) {
        return rejectWithValue(`Circuit open for Solana ${network} — skipping`);
      }

      const customUrl = state.solana.customRpcUrls?.[network];
      solanaService.selectNetwork(network, customUrl);
      const transactions = await withRetry(
        () => solanaService.getTransactionsByWallet(address),
        1,
        1500,
        (err) => console.warn(`Retrying Solana transactions: ${err.message}`)
      );

      rpcCircuitBreaker.recordSuccess(chainKey);
      return { transactions, network, address };
    } catch (error: any) {
      const state = getState() as any;
      const network = typeof arg === "string" ? (state.solana.selectedNetwork ?? "devnet") : arg.network;
      rpcCircuitBreaker.recordFailure(`solana-${network}`);
      console.error("error", error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSolanaTransactionsInterval = createAsyncThunk(
  "wallet/fetchSolanaTransactionsInterval",
  async (arg: FetchSolanaBalanceArgs, { rejectWithValue, getState }): Promise<any> => {
    const state = getState() as any;
    const network = typeof arg === "string" ? (state.solana.selectedNetwork ?? "devnet") : arg.network;
    const chainKey = `solana-${network}`;

    if (rpcCircuitBreaker.isOpen(chainKey)) {
      return rejectWithValue(`Circuit open for Solana ${network} — skipping interval`);
    }

    try {
      const address = typeof arg === "string" ? arg : arg.address;
      const customUrl = state.solana.customRpcUrls?.[network];
      solanaService.selectNetwork(network, customUrl);
      const transactions = await solanaService.getTransactionsByWallet(address);
      rpcCircuitBreaker.recordSuccess(chainKey);
      return { transactions, network, address };
    } catch (error: any) {
      rpcCircuitBreaker.recordFailure(chainKey);
      console.error("error", error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSolanaBalance = createAsyncThunk(
  "wallet/fetchSolanaBalance",
  async (arg: FetchSolanaBalanceArgs, { rejectWithValue, getState }): Promise<any> => {
    try {
      const state = getState() as any;
      const address = typeof arg === "string" ? arg : arg.address;
      const network = typeof arg === "string" ? (state.solana.selectedNetwork ?? "devnet") : arg.network;
      const chainKey = `solana-${network}`;

      // Circuit-breaker: skip networks with repeated failures
      if (rpcCircuitBreaker.isOpen(chainKey)) {
        return rejectWithValue(`Circuit open for Solana ${network} — skipping`);
      }

      const customUrl = state.solana.customRpcUrls?.[network];
      solanaService.selectNetwork(network, customUrl);
      const currentSolBalance = await withRetry(
        () => solanaService.getBalance(address),
        2,
        1000,
        (err) => console.warn(`Retrying Solana balance: ${err.message}`)
      );

      rpcCircuitBreaker.recordSuccess(chainKey);
      return { bal: currentSolBalance, network, address };
    } catch (error: any) {
      const state = getState() as any;
      const network = typeof arg === "string" ? (state.solana.selectedNetwork ?? "devnet") : arg.network;
      rpcCircuitBreaker.recordFailure(`solana-${network}`);
      console.error("error", error);
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSolanaBalanceInterval = createAsyncThunk(
  "wallet/fetchSolanaBalanceInterval",
  async (arg: FetchSolanaBalanceArgs, { rejectWithValue, getState }): Promise<any> => {
    const state = getState() as any;
    const network = typeof arg === "string" ? (state.solana.selectedNetwork ?? "devnet") : arg.network;
    const chainKey = `solana-${network}`;

    if (rpcCircuitBreaker.isOpen(chainKey)) {
      return rejectWithValue(`Circuit open for Solana ${network} — skipping interval`);
    }

    try {
      const address = typeof arg === "string" ? arg : arg.address;
      const customUrl = state.solana.customRpcUrls?.[network];
      solanaService.selectNetwork(network, customUrl);
      const currentSolBalance = await solanaService.getBalance(address);
      rpcCircuitBreaker.recordSuccess(chainKey);
      return { bal: currentSolBalance, network, address };
    } catch (error: any) {
      rpcCircuitBreaker.recordFailure(chainKey);
      console.error("error", error);
      return rejectWithValue(error.message);
    }
  }
);

interface SolTransactionArgs {
  privateKey: Uint8Array;
  address: string;
  amount: string;
  fromAddress: string;
}

export const sendSolanaTransaction = createAsyncThunk(
  "solana/sendSolanaTransaction",
  async (
    { privateKey, address, amount, fromAddress }: SolTransactionArgs,
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as any;
      const network = state.solana.selectedNetwork ?? "devnet";
      const customUrl = state.solana.customRpcUrls?.[network];
      solanaService.selectNetwork(network, customUrl);
      const response = await solanaService.sendTransaction(
        privateKey,
        address,
        parseFloat(amount)
      );
      return { txHash: response, fromAddress };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const confirmSolanaTransaction = createAsyncThunk(
  "wallet/confirmSolanaTransaction",
  async ({ txHash, fromAddress }: { txHash: string; fromAddress: string }, { rejectWithValue, getState }) => {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const state = getState() as any;
      const network = state.solana.selectedNetwork ?? "devnet";
      const customUrl = state.solana.customRpcUrls?.[network];
      solanaService.selectNetwork(network, customUrl);
      const confirmationPromise = solanaService.confirmTransaction(txHash);
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Transaction confirmation timed out")),
          CONFIRMATION_TIMEOUT
        );
      });

      const confirmation = await Promise.race([
        confirmationPromise,
        timeoutPromise,
      ]);
      return { txHash, confirmation, fromAddress };
    } catch (error: any) {
      return rejectWithValue({ txHash, error: error.message, fromAddress });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
);

export const solanaSlice = createSlice({
  name: "solana",
  initialState,
  reducers: {
    setSelectedNetwork: (state, action: PayloadAction<"mainnet" | "devnet">) => {
      state.selectedNetwork = action.payload;
      state.addresses.forEach((addr) => {
        if (!addr.balanceByNetwork) {
          addr.balanceByNetwork = { mainnet: 0, devnet: 0 };
        }
        if (!addr.transactionsByNetwork) {
          addr.transactionsByNetwork = { mainnet: [], devnet: [] };
        }
        addr.balance = addr.balanceByNetwork[action.payload] ?? 0;
        addr.transactionMetadata.transactions = addr.transactionsByNetwork[action.payload] ?? [];
        // Reset status so a stuck Loading/Failed state from previous network doesn't block UI
        addr.status = GeneralStatus.Idle;
        addr.failedNetworkRequest = false;
      });
    },
    saveSolanaAddresses: (state, action: PayloadAction<SAddressState[]>) => {
      state.addresses = action.payload.map((addr) => ({
        ...addr,
        balanceByNetwork: addr.balanceByNetwork || { mainnet: 0, devnet: 0 },
        transactionsByNetwork: addr.transactionsByNetwork || { mainnet: [], devnet: [] },
      }));
      state.activeIndex = 0;
    },
    depositSolana: (state, action: PayloadAction<number>) => {
      const activeNetwork = state.selectedNetwork ?? "devnet";
      const addr = state.addresses[state.activeIndex];
      addr.balance += action.payload;
      if (!addr.balanceByNetwork) addr.balanceByNetwork = { mainnet: 0, devnet: 0 };
      addr.balanceByNetwork[activeNetwork] = addr.balance;
    },
    withdrawSolana: (state, action: PayloadAction<number>) => {
      const activeNetwork = state.selectedNetwork ?? "devnet";
      const addr = state.addresses[state.activeIndex];
      if (addr.balance >= action.payload) {
        addr.balance -= action.payload;
        if (!addr.balanceByNetwork) addr.balanceByNetwork = { mainnet: 0, devnet: 0 };
        addr.balanceByNetwork[activeNetwork] = addr.balance;
      } else {
        console.warn("Not enough Solana balance");
      }
    },
    addSolanaTransaction: (state, action: PayloadAction<Transaction>) => {
      const activeNetwork = state.selectedNetwork ?? "devnet";
      const addr = state.addresses[state.activeIndex];
      addr.transactionMetadata.transactions.push(action.payload);
      if (!addr.transactionsByNetwork) addr.transactionsByNetwork = { mainnet: [], devnet: [] };
      addr.transactionsByNetwork[activeNetwork] = addr.transactionMetadata.transactions;
    },
    updateSolanaBalance: (state, action: PayloadAction<number>) => {
      const activeNetwork = state.selectedNetwork ?? "devnet";
      const addr = state.addresses[state.activeIndex];
      addr.balance = action.payload;
      if (!addr.balanceByNetwork) addr.balanceByNetwork = { mainnet: 0, devnet: 0 };
      addr.balanceByNetwork[activeNetwork] = addr.balance;
    },
    updateSolanaAddresses: (state, action: PayloadAction<SAddressState>) => {
      const exists = state.addresses.some((a) => a.address === action.payload.address);
      if (!exists) {
        state.addresses.push({
          ...action.payload,
          balanceByNetwork: action.payload.balanceByNetwork || { mainnet: 0, devnet: 0 },
          transactionsByNetwork: action.payload.transactionsByNetwork || { mainnet: [], devnet: [] },
        });
      }
    },
    updateSolanaAccountName: (
      state,
      action: PayloadAction<{
        accountName: string;
        solAddress: string;
      }>
    ) => {
      const solAddressIndex = state.addresses.findIndex(
        (item) => item.address === action.payload.solAddress
      );
      if (solAddressIndex !== -1) {
        state.addresses[solAddressIndex].accountName = action.payload.accountName;
      }
    },
    setActiveSolanaAccount: (state, action: PayloadAction<number>) => {
      state.activeIndex = action.payload;
    },
    resetSolanaState: (state) => {
      return initialState;
    },
    setCustomRpcUrl: (
      state,
      action: PayloadAction<{ network: "mainnet" | "devnet"; rpcUrl: string }>
    ) => {
      if (!state.customRpcUrls) {
        state.customRpcUrls = {};
      }
      const url = action.payload.rpcUrl.trim();
      if (!url) {
        delete state.customRpcUrls[action.payload.network];
      } else {
        state.customRpcUrls[action.payload.network] = url;
      }
    },
  },
  extraReducers: (builder) => {
    // Helper: find index by address (from thunk arg), fallback to activeIndex
    const findIdx = (state: SolanaWalletState, address?: string) => {
      if (address) {
        const idx = state.addresses.findIndex(a => a.address === address);
        if (idx >= 0) return idx;
      }
      return state.activeIndex;
    };

    builder
      .addCase(fetchSolanaBalance.pending, (state, action) => {
        const address = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.address;
        const idx = findIdx(state, address);
        state.addresses[idx].status = GeneralStatus.Loading;
      })
      .addCase(fetchSolanaBalance.fulfilled, (state, action) => {
        const { bal, network, address } = action.payload;
        if (state.selectedNetwork !== network) return;
        const idx = findIdx(state, address);
        const parsed = parseFloat(truncateBalance(bal, 9));
        state.addresses[idx].balance = parsed;
        if (!state.addresses[idx].balanceByNetwork) {
          state.addresses[idx].balanceByNetwork = { mainnet: 0, devnet: 0 };
        }
        state.addresses[idx].balanceByNetwork[network] = parsed;
        state.addresses[idx].status = GeneralStatus.Idle;
      })
      .addCase(fetchSolanaBalance.rejected, (state, action) => {
        const address = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.address;
        const idx = findIdx(state, address);
        state.addresses[idx].status = GeneralStatus.Failed;
        console.error("Failed to fetch balance:", action.payload);
      })
      .addCase(fetchSolanaBalanceInterval.fulfilled, (state, action) => {
        const { bal, network, address } = action.payload;
        if (state.selectedNetwork !== network) return;
        const idx = findIdx(state, address);
        const parsed = parseFloat(truncateBalance(bal, 9));
        state.addresses[idx].balance = parsed;
        if (!state.addresses[idx].balanceByNetwork) {
          state.addresses[idx].balanceByNetwork = { mainnet: 0, devnet: 0 };
        }
        state.addresses[idx].balanceByNetwork[network] = parsed;
        state.addresses[idx].status = GeneralStatus.Idle;
      })
      .addCase(fetchSolanaBalanceInterval.rejected, (state, action) => {
        const address = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.address;
        const idx = findIdx(state, address);
        state.addresses[idx].status = GeneralStatus.Failed;
        console.error("Failed to fetch balance:", action.payload);
      })
      .addCase(fetchSolanaTransactions.pending, (state, action) => {
        const address = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.address;
        const idx = findIdx(state, address);
        state.addresses[idx].status = GeneralStatus.Loading;
      })
      .addCase(fetchSolanaTransactions.fulfilled, (state, action) => {
        const { transactions, network, address } = action.payload;
        if (state.selectedNetwork !== network) return;
        const idx = findIdx(state, address);
        if (transactions) {
          const mappedTxs = transactions.map((tx: any) => ({
            ...tx,
            solanaNetwork: network
          }));
          state.addresses[idx].failedNetworkRequest = false;
          state.addresses[idx].transactionMetadata.transactions = mappedTxs;
          if (!state.addresses[idx].transactionsByNetwork) {
            state.addresses[idx].transactionsByNetwork = { mainnet: [], devnet: [] };
          }
          state.addresses[idx].transactionsByNetwork[network] = mappedTxs;
        } else {
          state.addresses[idx].failedNetworkRequest = true;
        }
        state.addresses[idx].status = GeneralStatus.Idle;
      })
      .addCase(fetchSolanaTransactions.rejected, (state, action) => {
        const address = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.address;
        const idx = findIdx(state, address);
        state.addresses[idx].status = GeneralStatus.Failed;
        console.error("Failed to fetch transactions:", action.payload);
      })
      .addCase(fetchSolanaTransactionsInterval.fulfilled, (state, action) => {
        const { transactions, network, address } = action.payload;
        if (state.selectedNetwork !== network) return;
        const idx = findIdx(state, address);
        if (transactions) {
          const mappedTxs = transactions.map((tx: any) => ({
            ...tx,
            solanaNetwork: network
          }));
          state.addresses[idx].failedNetworkRequest = false;
          state.addresses[idx].transactionMetadata.transactions = mappedTxs;
          if (!state.addresses[idx].transactionsByNetwork) {
            state.addresses[idx].transactionsByNetwork = { mainnet: [], devnet: [] };
          }
          state.addresses[idx].transactionsByNetwork[network] = mappedTxs;
        } else {
          state.addresses[idx].failedNetworkRequest = true;
        }
        state.addresses[idx].status = GeneralStatus.Idle;
      })
      .addCase(fetchSolanaTransactionsInterval.rejected, (state, action) => {
        const address = typeof action.meta.arg === "string" ? action.meta.arg : action.meta.arg.address;
        const idx = findIdx(state, address);
        state.addresses[idx].status = GeneralStatus.Failed;
        console.error("Failed to fetch transactions:", action.payload);
      })
      .addCase(confirmSolanaTransaction.pending, (state, action) => {
        const { txHash, fromAddress } = action.meta.arg;
        const idx = findIdx(state, fromAddress);
        const newConfirmation: TransactionConfirmation = {
          txHash,
          status: ConfirmationState.Pending,
        };
        state.addresses[idx].transactionConfirmations.push(
          newConfirmation
        );
        // BUG #5 FIX: Cap to prevent unbounded growth
        if (state.addresses[idx].transactionConfirmations.length > MAX_SOL_TX_CONFIRMATIONS) {
          state.addresses[idx].transactionConfirmations = state.addresses[idx].transactionConfirmations.slice(-MAX_SOL_TX_CONFIRMATIONS);
        }
      })
      .addCase(confirmSolanaTransaction.fulfilled, (state, action) => {
        const { txHash, confirmation, fromAddress } = action.payload;
        const idx = findIdx(state, fromAddress);
        const confIdx = state.addresses[idx].transactionConfirmations.findIndex(
          (tx) => tx.txHash === txHash
        );
        if (confIdx !== -1) {
          state.addresses[idx].transactionConfirmations[confIdx].status =
            confirmation ? ConfirmationState.Confirmed : ConfirmationState.Failed;
        }
      })
      .addCase(confirmSolanaTransaction.rejected, (state, action) => {
        const { txHash, error, fromAddress } = action.payload as any;
        const idx = findIdx(state, fromAddress);
        const confIdx = state.addresses[idx].transactionConfirmations.findIndex(
          (tx: any) => tx.txHash === txHash
        );
        if (confIdx !== -1) {
          state.addresses[idx].transactionConfirmations[confIdx].status =
            ConfirmationState.Failed;
          state.addresses[idx].transactionConfirmations[confIdx].error = error;
        }
      })
      .addCase(sendSolanaTransaction.pending, (state, action) => {
        const idx = findIdx(state, action.meta.arg.fromAddress);
        state.addresses[idx].status = GeneralStatus.Loading;
      })
      .addCase(sendSolanaTransaction.fulfilled, (state, action) => {
        const { txHash, fromAddress } = action.payload;
        const idx = findIdx(state, fromAddress);
        state.addresses[idx].status = GeneralStatus.Idle;
        state.addresses[idx].transactionConfirmations.push({
          txHash,
          status: ConfirmationState.Pending,
        });
        // BUG #5 FIX: Cap to prevent unbounded growth
        if (state.addresses[idx].transactionConfirmations.length > MAX_SOL_TX_CONFIRMATIONS) {
          state.addresses[idx].transactionConfirmations = state.addresses[idx].transactionConfirmations.slice(-MAX_SOL_TX_CONFIRMATIONS);
        }
      })
      .addCase(sendSolanaTransaction.rejected, (state, action) => {
        const idx = findIdx(state, action.meta.arg.fromAddress);
        state.addresses[idx].status = GeneralStatus.Failed;
        console.error("Failed to send Solana transaction:", action.payload);
      });
  },
});

export const {
  depositSolana,
  withdrawSolana,
  addSolanaTransaction,
  updateSolanaBalance,
  saveSolanaAddresses,
  resetSolanaState,
  setActiveSolanaAccount,
  updateSolanaAddresses,
  updateSolanaAccountName,
  setSelectedNetwork,
  setCustomRpcUrl,
} = solanaSlice.actions;

export default solanaSlice.reducer;
