import { CustomNetwork } from "../store/types";

const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY || (process.env.NODE_ENV === "test" ? "dummy_test_key" : undefined);
if (!ALCHEMY_KEY) {
  throw new Error("EXPO_PUBLIC_ALCHEMY_API_KEY is not set");
}

export const DEFAULT_NETWORKS: CustomNetwork[] = [
  {
    chainName: "Ethereum Mainnet",
    chainType: "EVM",
    chainId: 1,
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    socketUrl: `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    symbol: "ETH",
    explorerUrl: "https://etherscan.io",
  },
  {
    chainName: "Ethereum Sepolia",
    chainId: 11155111,
    chainType: "EVM",
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    socketUrl: `wss://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    symbol: "ETH",
    explorerUrl: "https://sepolia.etherscan.io",
  },
];

export default DEFAULT_NETWORKS;
