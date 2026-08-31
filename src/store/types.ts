/* -------------------- General Enums -------------------- */
export enum GeneralStatus {
  Idle = "IDLE",
  Loading = "LOADING",
  Failed = "FAILED",
  Success = "success",
}
 export interface Network {
    name: string;
    chainId: number;
    rpcUrl: string;
    nftRpcUrl?: string;
}
export enum ConfirmationState {
  Pending = "Pending",
  Confirmed = "Confirmed",
  Failed = "Failed",
}

/* -------------------- Transactions -------------------- */
export interface Transaction {
  uniqueId: string;
  from: string;
  to: string;
  hash: string;
  value: number;
  blockTime: number;
  asset: string;
  direction: string;
  chainId?: number;
  solanaNetwork?: "mainnet" | "devnet";
}

export interface TransactionConfirmation {
  txHash: string;
  status: ConfirmationState;
  error?: string;
}

/* -------------------- Wallet Address -------------------- */
export interface SAddressState {
  accountName: string;
  derivationPath: string;
  address: string;
  publicKey: string;
  balance: number;
  status: GeneralStatus;
  failedNetworkRequest: boolean;
  transactionMetadata: {
    paginationKey?: string[];
    transactions: Transaction[];
  };
  transactionConfirmations: TransactionConfirmation[];
  balanceByNetwork?: Record<"mainnet" | "devnet", number>;
  transactionsByNetwork?: Record<"mainnet" | "devnet", Transaction[]>;
}
export interface AddressState {
  accountName: string;
  derivationPath: string;
  address: string;
  publicKey: string;

  // 🔹 PER-CHAIN balances (chainId → balance)
  balanceByChain: Record<number, number>;

  // 🔹 PER-CHAIN loading status
  statusByChain: Record<number, GeneralStatus>;

  // 🔹 PER-CHAIN network error flags
  failedNetworkRequestByChain: Record<number, boolean>;

  // 🔹 PER-CHAIN transactions
  transactionMetadataByChain: Record<
    number,
    {
      paginationKey?: string[];
      transactions: Transaction[];
    }
  >;

  // 🔹 Convenience field for UI (balance of active chain)
  activeBalance?: number;

  // 🔹 Transaction confirmations (global)
  transactionConfirmations: TransactionConfirmation[];
}
export interface TransactionMetadata {
  paginationKey: undefined | string | string[];
  transactions: Transaction[];
}
/* -------------------- Custom Network -------------------- */
export interface CustomNetwork {
  chainId: number;
  chainType: string;
  chainName: string;
  rpcUrl: string;
  socketUrl?: string;
  symbol: string;
  explorerUrl?: string;
  nftRpcUrl?: string;
}

/* -------------------- EVM Wallet -------------------- */
export interface EvmWalletState {
  activeChainId: number | null;

  // chainId -> active index
  activeIndex: number;

  // chainId -> network
  networks: Record<number, CustomNetwork>;

  // chainId -> addresses
  // addresses: Record<number, AddressState[]>;
  globalAddresses: AddressState[];
}

/* -------------------- Solana Wallet -------------------- */
export interface SolanaWalletState {
  activeIndex: number;
  addresses: SAddressState[];
  selectedNetwork?: "mainnet" | "devnet";
  customRpcUrls?: {
    mainnet?: string;
    devnet?: string;
  };
}
