// ─── IMPORTANT: @walletconnect/react-native-compat MUST be the first import ───
import "@walletconnect/react-native-compat";
import "text-encoding";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAppKit,
  solana,
  solanaTestnet,
  solanaDevnet,
  type AppKitNetwork,
} from "@reown/appkit-react-native";
import type { Storage } from "@reown/appkit-react-native";
import { EthersAdapter } from "@reown/appkit-ethers-react-native";
import { SolanaAdapter } from "@reown/appkit-solana-react-native";

const projectId = "9198e96ad6077e0573986f4acbd0ab2e";

// ─── EVM Networks (viem-compatible shape) ───
const mainnet = {
  id: 1,
  name: "Ethereum",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://cloudflare-eth.com"] as const },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://etherscan.io" },
  },
} as const;

const sepolia = {
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.org"] as const },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://sepolia.etherscan.io" },
  },
  testnet: true,
} as const;

// ─── AsyncStorage adapter for AppKit persistence ───
const appKitStorage: Storage = {
  async getKeys() {
    const keys = await AsyncStorage.getAllKeys();
    return [...keys];
  },
  async getEntries<T = any>(): Promise<[string, T][]> {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet([...keys]);
    return pairs
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, JSON.parse(v!) as T]);
  },
  async getItem<T = any>(key: string): Promise<T | undefined> {
    const value = await AsyncStorage.getItem(key);
    if (value == null) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },
  async setItem<T = any>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

// ─── Chain Adapters ───
const ethersAdapter = new EthersAdapter();
const solanaAdapter = new SolanaAdapter();

// ─── Create AppKit instance ───
export const appKit = createAppKit({
  projectId,
  networks: [mainnet, sepolia, solana, solanaTestnet, solanaDevnet] as AppKitNetwork[],
  defaultNetwork: mainnet as unknown as AppKitNetwork,
  adapters: [ethersAdapter, solanaAdapter],
  storage: appKitStorage,
  metadata: {
    name: "BitMarket",
    description: "Multi-chain crypto exchange and wallet aggregator",
    url: "https://bitmarket.app",
    icons: ["https://bitmarket.app/icon.png"],
    redirect: {
      native: "bitmarket://",
    },
  },
});
