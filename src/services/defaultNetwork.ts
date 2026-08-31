import { CustomNetwork } from "../store/types";

const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY || (process.env.NODE_ENV === "test" ? "dummy_test_key" : undefined);
if (!ALCHEMY_KEY) {
  throw new Error("EXPO_PUBLIC_ALCHEMY_API_KEY is not set");
}

const NETWORKS: CustomNetwork[] = [
  {
    "chainName": "Ethereum Mainnet",
    "chainType": "EVM",
    "chainId": 1,
    "rpcUrl": `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://etherscan.io"
  },
  {
    "chainName": "Ethereum Sepolia",
    "chainId": 11155111,
    "chainType": "EVM",
    "rpcUrl": `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://eth-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sepolia.etherscan.io"
  },
  {
    "chainName": "Polygon Mainnet",
    "chainId": 137,
    "chainType": "EVM",
    "rpcUrl": `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "MATIC",
    "explorerUrl": "https://polygonscan.com"
  },
  {
    "chainName": "Polygon Amoy",
    "chainId": 80002,
    "chainType": "EVM",
    "rpcUrl": `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://polygon-amoy.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "MATIC",
    "explorerUrl": "https://amoy.polygonscan.com"
  },
  {
    "chainName": "Arbitrum Mainnet",
    "chainId": 42161,
    "chainType": "EVM",
    "rpcUrl": `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://arb-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://arbiscan.io"
  },
  {
    "chainName": "Arbitrum Sepolia",
    "chainId": 421614,
    "chainType": "EVM",
    "rpcUrl": `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://arb-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sepolia.arbiscan.io"
  },
  {
    "chainName": "OP Mainnet Mainnet",
    "chainId": 10,
    "chainType": "EVM",
    "rpcUrl": `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://opt-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://optimism.etherscan.io"
  },
  {
    "chainName": "OP Mainnet Sepolia",
    "chainId": 11155420,
    "chainType": "EVM",
    "rpcUrl": `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://opt-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sepolia-optimism.etherscan.io"
  },
  {
    "chainName": "Base Mainnet",
    "chainId": 8453,
    "chainType": "EVM",
    "rpcUrl": `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://basescan.org"
  },
  {
    "chainName": "Base Sepolia",
    "chainId": 84532,
    "chainType": "EVM",
    "rpcUrl": `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://base-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sepolia.basescan.org"
  },
  {
    "chainName": "Avalanche Mainnet",
    "chainId": 43114,
    "chainType": "EVM",
    "rpcUrl": `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://avax-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "AVAX",
    "explorerUrl": "https://snowtrace.io"
  },
  {
    "chainName": "Avalanche Fuji",
    "chainId": 43113,
    "chainType": "EVM",
    "rpcUrl": `https://avax-fuji.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://avax-fuji.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://avax-fuji.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "AVAX",
    "explorerUrl": "https://testnet.snowtrace.io"
  },
  {
    "chainName": "ZKsync Mainnet",
    "chainId": 324,
    "chainType": "EVM",
    "rpcUrl": `https://zksync-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://zksync-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://zksync-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://era.zksync.network"
  },
  {
    "chainName": "ZKsync Sepolia",
    "chainId": 300,
    "chainType": "EVM",
    "rpcUrl": `https://zksync-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://zksync-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://zksync-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sepolia.era.zksync.network"
  },
  {
    "chainName": "Polygon zkEVM Mainnet",
    "chainId": 1101,
    "chainType": "EVM",
    "rpcUrl": `https://polygonzkevm-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://polygonzkevm-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://polygonzkevm-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://zkevm.polygonscan.com"
  },
  {
    "chainName": "Polygon zkEVM Cardona",
    "chainId": 2442,
    "chainType": "EVM",
    "rpcUrl": `https://polygonzkevm-cardona.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://polygonzkevm-cardona.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://polygonzkevm-cardona.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://cardona-zkevm.polygonscan.com"
  },
  {
    "chainName": "Scroll Mainnet",
    "chainId": 534352,
    "chainType": "EVM",
    "rpcUrl": `https://scroll-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://scroll-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://scroll-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://scrollscan.com"
  },
  {
    "chainName": "Scroll Sepolia",
    "chainId": 534351,
    "chainType": "EVM",
    "rpcUrl": `https://scroll-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://scroll-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://scroll-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sepolia.scrollscan.com"
  },
  {
    "chainName": "Blast Mainnet",
    "chainId": 81457,
    "chainType": "EVM",
    "rpcUrl": `https://blast-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://blast-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://blast-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://blastscan.io"
  },
  {
    "chainName": "Blast Sepolia",
    "chainId": 168587773,
    "chainType": "EVM",
    "rpcUrl": `https://blast-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://blast-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://blast-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sep.blastscan.io"
  },
  {
    "chainName": "Linea Mainnet",
    "chainId": 59144,
    "chainType": "EVM",
    "rpcUrl": `https://linea-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://linea-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://linea-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://lineascan.build"
  },
  {
    "chainName": "Linea Sepolia",
    "chainId": 59141,
    "chainType": "EVM",
    "rpcUrl": `https://linea-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://linea-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://linea-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "ETH",
    "explorerUrl": "https://sepolia.lineascan.build"
  },
  {
    "chainName": "Celo Mainnet",
    "chainId": 42220,
    "chainType": "EVM",
    "rpcUrl": `https://celo-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://celo-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://celo-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "CELO",
    "explorerUrl": "https://celoscan.io"
  },
  {
    "chainName": "Celo Sepolia",
    "chainId": 11142220,
    "chainType": "EVM",
    "rpcUrl": `https://celo-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://celo-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://celo-sepolia.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "CELO",
    "explorerUrl": "https://celo-sepolia.blockscout.com"
  },
  {
    "chainName": "Gnosis Mainnet",
    "chainId": 100,
    "chainType": "EVM",
    "rpcUrl": `https://gnosis-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "socketUrl": `wss://gnosis-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    "nftRpcUrl": `https://gnosis-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`,
    "symbol": "GNO",
    "explorerUrl": "https://gnosisscan.io"
  },
  {
    "chainName": "SecureChain Mainnet",
    "chainId": 34,
    "chainType": "EVM",
    "rpcUrl": "https://mainnet-rpc.scai.network",
    "socketUrl": "wss://mainnet-rpc.scai.network",
    "symbol": "SCAI",
    "explorerUrl": "https://explorer.securechain.ai",
    "nftRpcUrl" :"https://explorer.securechain.ai/api/v2"
  },
  {
    "chainName": "BSC Mainnet",
    "chainId": 56,
    "chainType": "BSC",
    "rpcUrl": "https://bsc-dataseed.binance.org/",
    "socketUrl": "wss://bsc-ws-mainnet.binance.org/",
    "symbol": "BNB",
    "explorerUrl": "https://bscscan.com"
  },
  {
    "chainName": "BSC Testnet",
    "chainId": 97,
    "chainType": "BSC",
    "rpcUrl": "https://data-seed-prebsc-1-s1.binance.org:8545/",
    "socketUrl": "wss://data-seed-prebsc-1-s1.binance.org:8545/",
    "symbol": "BNB",
    "explorerUrl": "https://testnet.bscscan.com"
  },
];

export default NETWORKS;
