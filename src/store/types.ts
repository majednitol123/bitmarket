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
}

/* -------------------- Wallet Address -------------------- */
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

  // 🔹 Convenience field for UI (balance of active chain)
  activeBalance?: number;
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
}

/* -------------------- EVM Wallet -------------------- */
export interface EvmWalletState {
  activeChainId: number | null;

  // active index
  activeIndex: number;

  // chainId -> network
  networks: Record<number, CustomNetwork>;

  // addresses
  globalAddresses: AddressState[];
}
