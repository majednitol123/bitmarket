import { computeDashboardData } from "../hooks/useDashboardData";
import { RootState } from "../store";
import { GeneralStatus } from "../store/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("alchemy-sdk", () => ({
  Alchemy: jest.fn(),
  Network: {},
}));

jest.mock("@solana/web3.js", () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn(),
  LAMPORTS_PER_SOL: 1000000000,
}));

// Mock ethereum service and network module to avoid provider instantiation errors
jest.mock("../services/EthereumService", () => {
  return {
    evmServices: {},
    registerEvmService: jest.fn(),
    getEvmService: jest.fn().mockReturnValue({
      createWalletByIndex: jest.fn().mockResolvedValue({
        address: "0x111",
        publicKey: "0x111",
        derivationPath: "m/44'/60'/0'/0/0",
      }),
    }),
    EVMService: jest.fn().mockImplementation(() => ({
      createWallet: jest.fn().mockResolvedValue({
        address: "0x111",
        publicKey: "0x111",
        mnemonic: { phrase: "phrase" },
      }),
    })),
  };
});

// Mock solTokenService to prevent importing ESM dependencies inside node_modules/@solana
jest.mock("../services/solTokenService", () => ({
  __esModule: true,
  getSolBalance: jest.fn(),
  getSplTokenBalance: jest.fn(),
  getAllSplTokens: jest.fn(),
  getWalletNFTs: jest.fn(),
  sendSplToken: jest.fn(),
  setSolTokenNetwork: jest.fn(),
  getSplTokenMetadata: jest.fn(),
}));

describe("Imported Account Single-Chain Isolation Tests", () => {
  const createMockBaseState = (): RootState => ({
    ethereum: {
      activeChainId: 1,
      activeIndex: 0,
      globalAddresses: [
        {
          address: "0xSeedAddress",
          balanceByChain: { 1: 5.5 },
          statusByChain: { 1: GeneralStatus.Idle },
          transactionMetadataByChain: { 1: { transactions: [], paginationKey: undefined } },
          failedNetworkRequestByChain: {},
        },
      ],
      networks: {
        1: { chainId: 1, chainName: "Ethereum", symbol: "ETH", rpcUrl: "", explorerUrl: "" },
      },
      status: GeneralStatus.Idle,
      error: null,
    },
    solana: {
      activeIndex: 0,
      addresses: [
        {
          address: "SolSeedAddress",
          balance: 10,
          status: GeneralStatus.Idle,
          failedNetworkRequest: false,
          transactionConfirmations: [],
          transactionMetadata: { transactions: [], paginationKey: undefined },
          balanceByNetwork: { mainnet: 10, devnet: 0 },
          transactionsByNetwork: { mainnet: [], devnet: [] },
        },
      ],
      selectedNetwork: "mainnet",
      status: GeneralStatus.Idle,
      error: null,
    },
    importedAccounts: {
      accounts: [],
      nextId: 1,
      activeEvmAddress: undefined,
      activeSolAddress: undefined,
    },
    price: {
      data: {
        1: { usd: 2000 },
        101: { usd: 100 },
      },
      status: GeneralStatus.Idle,
      error: null,
      lastUpdated: Date.now(),
    },
    biometrics: {
      unlocked: true,
      unlockedAt: Date.now(),
      biometricsEnabled: false,
    },
    settings: {
      theme: "dark",
    },
    erc20: {
      trackedTokens: [],
      balances: {},
      transfers: {},
      allNfts: [],
      status: GeneralStatus.Idle,
      error: null,
    },
    solToken: {
      trackedTokens: [],
      balances: {},
      metadataCache: {},
      status: GeneralStatus.Idle,
      error: null,
    },
  } as unknown as RootState);

  test("Should verify standard seed account state includes both chains", () => {
    const state = createMockBaseState();
    const data = computeDashboardData(state);

    expect(data.ethWalletAddress).toBe("0xSeedAddress");
    expect(data.solWalletAddress).toBe("SolSeedAddress");
    expect(data.showEvmAssets).toBe(true);
    expect(data.showSolAssets).toBe(true);
    expect(data.totalUsdBalance).toBe(5.5 * 2000 + 10 * 100); // 11000 + 1000 = 12000
  });

  test("Should verify Solana-only imported account isolates EVM fetches and returns empty EVM state", () => {
    const state = createMockBaseState();
    state.importedAccounts.activeSolAddress = "SolImportedOnlyAddress";
    state.importedAccounts.activeEvmAddress = undefined; // Solana only key imported

    const data = computeDashboardData(state);

    // EVM address must be empty since it wasn't imported
    expect(data.ethWalletAddress).toBe("");
    expect(data.showEvmAssets).toBe(false);
    expect(data.ethereumAssets).toEqual([]);

    // Solana should show correctly
    expect(data.solWalletAddress).toBe(""); // because we mocked importedAccounts but didn't add the address in state.solana.addresses
    expect(data.showSolAssets).toBe(true);
  });

  test("Should resolve Solana address from solana.addresses if it matches activeSolAddress", () => {
    const state = createMockBaseState();
    state.importedAccounts.activeSolAddress = "SolImportedOnlyAddress";
    state.solana.addresses.push({
      address: "SolImportedOnlyAddress",
      balance: 15,
      status: GeneralStatus.Idle,
      failedNetworkRequest: false,
      transactionConfirmations: [],
      transactionMetadata: { transactions: [], paginationKey: undefined },
      balanceByNetwork: { mainnet: 15, devnet: 0 },
      transactionsByNetwork: { mainnet: [], devnet: [] },
    } as any);

    const data = computeDashboardData(state);
    expect(data.solWalletAddress).toBe("SolImportedOnlyAddress");
    expect(data.solBalance).toBe(15);
    expect(data.showSolAssets).toBe(true);
    expect(data.showEvmAssets).toBe(false);
  });

  test("Should verify EVM-only imported account isolates Solana fetches and returns empty Solana state", () => {
    const state = createMockBaseState();
    state.importedAccounts.activeEvmAddress = "0xImportedEVMAddress";
    state.importedAccounts.activeSolAddress = undefined;

    state.ethereum.globalAddresses.push({
      address: "0xImportedEVMAddress",
      balanceByChain: { 1: 2.0 },
      statusByChain: { 1: GeneralStatus.Idle },
      transactionMetadataByChain: {},
      failedNetworkRequestByChain: {},
    } as any);

    const data = computeDashboardData(state);

    expect(data.ethWalletAddress).toBe("0xImportedEVMAddress");
    expect(data.ethBalance).toBe(2.0);
    expect(data.showEvmAssets).toBe(true);

    // Solana should be completely hidden and silent
    expect(data.solWalletAddress).toBe("");
    expect(data.showSolAssets).toBe(false);
    expect(data.solBalance).toBe(0);
    expect(data.solUsd).toBe(0);
  });
});
