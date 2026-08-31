import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ethers, formatEther } from "ethers";
import {
  EvmWalletState,
  AddressState,
  CustomNetwork,
  GeneralStatus,
  ConfirmationState,
  Transaction,
} from "./types";
import {
  EVMService,
  evmServices,
  registerEvmService,
} from "../services/EthereumService";
import NETWORKS from "../services/defaultNetwork";
import { Transfer } from "../services/helper";
import { withRetry } from "../utils/retry";
import { rpcCircuitBreaker } from "../utils/circuitBreaker";


const CONFIRMATION_TIMEOUT = 60000;
const STORAGE_KEY = "EVM_WALLET_STATE";
const MAX_TX_CONFIRMATIONS = 50;
const MAX_TX_PER_CHAIN = 100;

const defaultNetworks: CustomNetwork[] = NETWORKS


const createEmptyAddress = (): AddressState => ({
  accountName: "Account 1",
  derivationPath: "",
  address: "",
  publicKey: "",

  // Per-chain balances (chainId → balance)
  balanceByChain: {},

  // Per-chain loading status
  statusByChain: {},
activeBalance: 0,  
  // Per-chain network error flags
  failedNetworkRequestByChain: {},

  // Per-chain transactions
  transactionMetadataByChain: {},

  // Global transaction confirmations
  transactionConfirmations: [],
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

    // Re-initialize EVMService for ALL networks (default + custom) that are
    // persisted in AsyncStorage but may be missing from the in-memory registry.
    // This fixes the "Service not initialized" error for custom networks after restart.
    Object.values(state.networks).forEach((net: any) => {
      if (net?.rpcUrl) {
        registerEvmService(net);
      }
    });

    Object.keys(state.networks).forEach((chainIdStr) => {
      const chainId = Number(chainIdStr);
      if (!state.globalAddresses || state.globalAddresses.length === 0) {
        state.globalAddresses = [createEmptyAddress()];
      }
      // In UI, you can render: state.globalAddresses for any chain
    });

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
  async ({ chainId, address }: { chainId: number; address: string }, thunkAPI) => {
    const chainKey = `evm-${chainId}`;

    // Circuit-breaker: skip chains with repeated failures (prevents 5s+ hangs)
    if (rpcCircuitBreaker.isOpen(chainKey)) {
      throw new Error(`Circuit open for chain ${chainId} — skipping RPC call`);
    }

    const service = evmServices[chainId];
    if (!service) throw new Error("Service not initialized");

    try {
      // Single attempt — the getBalance method already has a 5s timeout.
      // Dead RPCs (522, timeout) fail fast instead of retrying 3× with backoff.
      const balanceBN = await service.getBalance(address);
      const balance = parseFloat(ethers.formatEther(balanceBN));

      // RPC succeeded — close the circuit
      rpcCircuitBreaker.recordSuccess(chainKey);

      // Detect balance change to trigger transaction history update automatically
      try {
        const state = thunkAPI.getState() as any;
        const account = state.ethereum?.globalAddresses?.find(
          (a: any) => a.address.toLowerCase() === address.toLowerCase()
        );
        const oldBalance = account?.balanceByChain?.[chainId] ?? 0;

        if (balance !== oldBalance) {
          // Dispatch transaction history fetch asynchronously to update logs/tx history
          thunkAPI.dispatch(fetchEvmTransactions({ chainId, address }) as any);
        }
      } catch (e) {
        // safe fallback, don't crash balance thunk on selector/dispatch error
      }

      return {
        chainId,
        address,
        balance,
      };
    } catch (error) {
      // RPC failed — record failure in circuit-breaker
      rpcCircuitBreaker.recordFailure(chainKey);
      throw error;
    }
  }
);

function mapTransferToTransaction(tx: Transfer, chainId: number): Transaction {
  // Guard against NaN: explorer may return empty strings or "N/A" for value
  const rawValue = tx.value === "N/A (ERC721/ERC1155)" ? 0 : Number(tx.value);
  // Use real timestamp if available (converted to milliseconds), otherwise fallback to blockNumber Heuristic
  const stableBlockTime = tx.timestamp 
    ? tx.timestamp * 1000 
    : (tx.blockNumber ? tx.blockNumber * 1000 : Date.now());
  return {
    uniqueId: `${tx.hash}-${tx.category}-${tx.type}-${tx.to}-${tx.value}`,               
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: isNaN(rawValue) ? 0 : rawValue,
    blockTime: stableBlockTime,
    asset: tx.category,              
    direction: tx.direction.toLowerCase(), 
    chainId: chainId,
  };
}
export const fetchEvmBalanceInterval = createAsyncThunk(
  "evm/fetchBalanceInterval",
  async (payload: { chainId: number; address: string }, { dispatch }) => {
    await dispatch(fetchEvmBalance(payload));
    return true;
  }
);

export const fetchEvmTransactions = createAsyncThunk(
  "evm/fetchTransactions",
  async ({ chainId, address }: { chainId: number; address: string }) => {
    const chainKey = `evm-${chainId}`;

    // Circuit-breaker: skip chains with repeated failures
    if (rpcCircuitBreaker.isOpen(chainKey)) {
      throw new Error(`Circuit open for chain ${chainId} — skipping transaction fetch`);
    }

    const service = evmServices[chainId];
    if (!service) throw new Error("Service not initialized");

    try {
      const txs = await withRetry(
        () => service.fetchTransactions(chainId.toString(), address),
        2,
        1500,
        (err) => console.warn(`Retrying transactions for ${chainId}: ${err.message}`)
      );

      rpcCircuitBreaker.recordSuccess(chainKey);
      return { chainId, address, txs };
    } catch (error) {
      rpcCircuitBreaker.recordFailure(chainKey);
      throw error;
    }
  }
);


export const fetchEvmTransactionsInterval = createAsyncThunk(
  "evm/fetchTransactionsInterval",
  async (payload: { chainId: number; address: string }, { dispatch }) => {
    await dispatch(fetchEvmTransactions(payload));
    return true;
  }
);
export interface SendTransactionArgs {
  chainId: number;
  from: string; // ethers.AddressLike
  to: string;   // ethers.AddressLike
  privateKey: string;
  amount: string; // ETH amount as precise string
}


export const sendEvmTransaction = createAsyncThunk<
  { chainId: number; address: string; tx: any }, // ✅ fulfilled payload type
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

      // Send the transaction
      const txResponse = await service.sendTransaction(from, to, privateKey, amount);

      // Return chainId, tx, and the sender address for the reducer
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






export const confirmEvmTransaction = createAsyncThunk(
  "evm/confirmTransaction",
  async (
    { chainId, txHash, fromAddress }: { chainId: number; txHash: string; fromAddress?: string },
    { rejectWithValue }
  ) => {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const confirmationPromise = evmServices[chainId].confirmTransaction(txHash);
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Transaction confirmation timed out")), CONFIRMATION_TIMEOUT);
      });

      const confirmation = await Promise.race([confirmationPromise, timeoutPromise]);
      return { chainId, txHash, confirmation, fromAddress };
    } catch (error: any) {
      return rejectWithValue(error.message);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
      
      delete state.activeIndex
      
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
  // Update the global wallet list
  state.globalAddresses = [...action.payload.addresses];
  state.activeIndex = 0;
}

,

    updateAddresses(
  state,
  action: PayloadAction<{ addresses: AddressState[] }>
) {
  const { addresses } = action.payload;

  addresses.forEach((addr) => {
    const idx = state.globalAddresses.findIndex(a => a.address === addr.address);
    if (idx >= 0) {
      // Update existing address
      state.globalAddresses[idx] = addr;
    } else {
      // Add new address
      state.globalAddresses.push(addr);
    }
  });
},


    addAddress(state, action: PayloadAction<AddressState>) {
  const addr = action.payload;

  // Check if the address already exists
  const exists = state.globalAddresses.some(a => a.address === addr.address);
  if (!exists) {
    // Add to global list
    state.globalAddresses.push(addr);
  } else {
    // Optionally update existing address
    const idx = state.globalAddresses.findIndex(a => a.address === addr.address);
    state.globalAddresses[idx] = addr;
  }
}
,





    /* -------- Balance -------- */

deposit(
  state,
  action: PayloadAction<{ chainId: number; amount: number }>
) {
  const { chainId, amount } = action.payload;

  // Get the active index for this chain
  const idx = state.activeIndex ?? 0;

  // Ensure there is an account at that index
  const account = state.globalAddresses[idx];
  if (!account) return;

  // Initialize balance for this chain if undefined
  if (account.balanceByChain[chainId] === undefined) {
    account.balanceByChain[chainId] = 0;
  }

  // Add balance for this specific chain
  account.balanceByChain[chainId] += amount;
},


  withdraw(
  state,
  action: PayloadAction<{ chainId: number; amount: number }>
) {
  const { chainId, amount } = action.payload;

  // Get the active index for this chain
  const idx = state.activeIndex ?? 0;

  // Ensure the account exists
  const account = state.globalAddresses[idx];
  if (!account) return;

  // Initialize balance for this chain if undefined
  if (account.balanceByChain[chainId] === undefined) {
    account.balanceByChain[chainId] = 0;
  }

  // Subtract balance safely for this specific chain
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

  // Find the account in globalAddresses
  const account = state.globalAddresses.find(a => a.address === address);
  if (!account) return;

  // Initialize per-chain objects if undefined
  if (!account.balanceByChain) account.balanceByChain = {};
  if (!account.statusByChain) account.statusByChain = {};
  if (!account.failedNetworkRequestByChain) account.failedNetworkRequestByChain = {};

  // Update balance for this chain
  account.balanceByChain[chainId] = balance;

  // Reset status flags for this chain
  account.statusByChain[chainId] = GeneralStatus.Idle;
  account.failedNetworkRequestByChain[chainId] = false;

  // Optionally, update global "balance" for the active chain (UI can read this)
  const activeIndex = state.activeIndex ?? 0;
  if (state.globalAddresses[activeIndex]?.address === address) {
    account.activeBalance = balance; // use a new field activeBalance for UI convenience
  }
},



   addTransaction(
  state,
  action: PayloadAction<{ chainId: number; address: string; tx: Transaction }>
) {
  const { chainId, address, tx } = action.payload;

  // Find the account in globalAddresses
  const account = state.globalAddresses.find(a => a.address === address);
  if (!account) return;
 account.transactionMetadataByChain ??= {};
  // Initialize transactionMetadataByChain for this chain if undefined
  if (!account.transactionMetadataByChain[chainId]) {
    account.transactionMetadataByChain[chainId] = {
      transactions: [],
      paginationKey: undefined,
    };
  }

  // Add the new transaction at the top
  account.transactionMetadataByChain[chainId].transactions.unshift({
    ...tx,
    chainId: chainId,
  });
}

,
   updateAccountName(
  state,
  action: PayloadAction<{ address: string; accountName: string }>
) {
  const { address, accountName } = action.payload;

  // 🔹 Update the account in globalAddresses
  const account = state.globalAddresses.find(a => a.address === address);
  if (!account) return;

  account.accountName = accountName;

  // ✅ No need to update per-network addresses anymore
},


    setActiveAccount: (
  state,
  action: PayloadAction<{ index: number }>
) => {
  const { index } = action.payload;

  // 🔹 Ensure index is within bounds of globalAddresses
  if (index < 0 || index >= state.globalAddresses.length) return;

  // 🔹 Set active index for the network
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
    a => a.address.toLowerCase() === address.toLowerCase()
  );
  if (!account) return;

  // Initialize statusByChain if undefined
  if (!account.statusByChain) {
    account.statusByChain = {};
  }

  // Set status for this specific chain
  account.statusByChain[chainId] = GeneralStatus.Loading;
})


    .addCase(fetchEvmBalance.fulfilled, (state, action) => {
  const { chainId, address, balance } = action.payload;

  const account = state.globalAddresses.find(
    a => a.address.toLowerCase() === address.toLowerCase()
  );
  if (!account) return;

  // Initialize per-chain fields if undefined
  if (!account.balanceByChain) account.balanceByChain = {};
  if (!account.statusByChain) account.statusByChain = {};
  if (!account.failedNetworkRequestByChain) account.failedNetworkRequestByChain = {};

  // Update the balance for this chain
  account.balanceByChain[chainId] = balance;

  // Update the status and failed flag for this chain
  account.statusByChain[chainId] = GeneralStatus.Idle;
  account.failedNetworkRequestByChain[chainId] = false;
})



    .addCase(fetchEvmBalance.rejected, (state, action) => {
  const { chainId, address } = action.meta.arg;

  const account = state.globalAddresses.find(
    a => a.address.toLowerCase() === address.toLowerCase()
  );
  if (!account) return;

  // Initialize per-chain fields if undefined
  if (!account.statusByChain) account.statusByChain = {};
  if (!account.failedNetworkRequestByChain) account.failedNetworkRequestByChain = {};

  // Update the status and failed flag for this specific chain
  account.statusByChain[chainId] = GeneralStatus.Failed;
  account.failedNetworkRequestByChain[chainId] = true;
})


    // ---------------- Fetch Transactions ----------------
    .addCase(fetchEvmTransactions.fulfilled, (state, action) => {
  const { chainId, txs, address } = action.payload;

  // Find the account by address
  const account = state.globalAddresses.find(
    a => a.address.toLowerCase() === address.toLowerCase()
  );
  if (!account || !txs) return;

  // Initialize per-chain transaction metadata if undefined
  if (!account.transactionMetadataByChain) {
    account.transactionMetadataByChain = {};
  }
  if (!account.transactionMetadataByChain[chainId]) {
    account.transactionMetadataByChain[chainId] = {
      transactions: [],
      paginationKey: undefined,
    };
  }
  // Map and deduplicate by uniqueId
  const mappedTxs = txs.transferHistory.map(tx => mapTransferToTransaction(tx, chainId));
  const uniqueTxs: Transaction[] = [];
  const seenIds = new Set<string>();
  
  for (const tx of mappedTxs) {
    if (!seenIds.has(tx.uniqueId)) {
      uniqueTxs.push(tx);
      seenIds.add(tx.uniqueId);
    }
  }

  account.transactionMetadataByChain[chainId].transactions = uniqueTxs
    .sort((a, b) => b.blockTime - a.blockTime)
    .slice(0, MAX_TX_PER_CHAIN); // BUG #5 FIX: cap to prevent unbounded growth

  account.transactionMetadataByChain[chainId].paginationKey = txs.pageKey ? [txs.pageKey] : [];

})


    // ---------------- Send Transaction ----------------
    .addCase(sendEvmTransaction.fulfilled, (state, action) => {
  const { chainId, tx, address } = action.payload;

  // Find the account by address
  const account = state.globalAddresses.find(
    a => a.address.toLowerCase() === address.toLowerCase()
  );
  if (!account) return;

  // Initialize per-chain transaction metadata if undefined
  if (!account.transactionMetadataByChain) {
    account.transactionMetadataByChain = {};
  }
  if (!account.transactionMetadataByChain[chainId]) {
    account.transactionMetadataByChain[chainId] = {
      transactions: [],
      paginationKey: undefined,
    };
  }

  const userAddress = account.address.toLowerCase();

  // Add the new transaction to the top of the list for this chain
  account.transactionMetadataByChain[chainId].transactions.unshift({
    uniqueId: tx.hash, // or generate a UUID if needed
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: Number(formatEther(tx.value ?? 0n)),
    blockTime: Date.now(),
    asset: "ETH", // optionally dynamically based on network
    direction: tx.from.toLowerCase() === userAddress ? "sent" : "received",
    chainId: chainId,
  });
})


    // ---------------- Confirm Transaction ----------------
    .addCase(confirmEvmTransaction.fulfilled, (state, action) => {
  const { chainId, txHash, confirmation, fromAddress } = action.payload;

  // Find account by address if provided, otherwise fall back to activeIndex
  const addr = fromAddress
    ? state.globalAddresses.find(a => a.address?.toLowerCase() === fromAddress.toLowerCase())
    : state.globalAddresses[state.activeIndex ?? 0];
  if (!addr) return;

  addr.transactionConfirmations ??= [];

  addr.transactionConfirmations.push({
    txHash,
    status: confirmation
      ? ConfirmationState.Confirmed
      : ConfirmationState.Failed,
  });

  // BUG #5 FIX: Cap to prevent unbounded growth (persisted via redux-persist)
  if (addr.transactionConfirmations.length > MAX_TX_CONFIRMATIONS) {
    addr.transactionConfirmations = addr.transactionConfirmations.slice(-MAX_TX_CONFIRMATIONS);
  }
})



    // ---------------- Load / Save Wallet State ----------------
    .addCase(loadWalletState.fulfilled, (_, action) => action.payload)
    .addCase(saveWalletState.fulfilled, (_, action) => action.payload);
},

});

/* =======================================================
   EXPORTS
======================================================= */

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
  addTransaction,
  resetState,
} = evmSlice.actions;

export default evmSlice.reducer;
