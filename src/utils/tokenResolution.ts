import axios from "axios";
import {
  CHAINS,
  TOKENS_BY_CHAIN,
  type Chain,
  type Token,
} from "../constants/tokenRegistry";
import { marketApi, ContractAddressInfo } from "../api/marketApi";

// External DEX Aggregator / Li.Fi Token Contract Resolver
async function fetchContractFromLiFi(chainId: string, symbol: string): Promise<string | null> {
  try {
    const res = await axios.get("https://li.quest/v1/token", {
      params: { chain: chainId, token: symbol },
      timeout: 3500,
    });
    if (res.data?.address && typeof res.data.address === "string") {
      return res.data.address;
    }
  } catch {
    // Fallback gracefully
  }
  return null;
}

// Mapping of CoinStats/CoinGecko blockchain strings to our chain IDs
const BLOCKCHAIN_TO_CHAIN_ID: Record<string, string> = {
  ethereum: "1",
  eth: "1",
  "1": "1",
  "binance-smart-chain": "56",
  binancesmartchain: "56",
  smartchain: "56",
  bsc: "56",
  "56": "56",
  polygon: "137",
  "polygon-pos": "137",
  matic: "137",
  "137": "137",
  arbitrum: "42161",
  "arbitrum-one": "42161",
  "42161": "42161",
  optimism: "10",
  "optimistic-ethereum": "10",
  "10": "10",
  base: "8453",
  "8453": "8453",
  avalanche: "43114",
  "avalanche-c": "43114",
  avalanchec: "43114",
  "43114": "43114",
  fantom: "250",
  "250": "250",
  solana: "sol",
  sol: "sol",
};

export interface ResolveTokenInput {
  symbol: string;
  name?: string;
  coinId?: string;
  contractAddress?: string;
  contractAddresses?: ContractAddressInfo[];
  chainId?: string;
  logoUrl?: string;
}

export interface ResolvedSwapPair {
  chain: Chain;
  token: Token;
}

/**
 * Resolves a token from Market, Portfolio, or CoinStats into a verified Token
 * with the correct contract address for the target chain.
 */
export async function resolveTokenForSwap(
  input: ResolveTokenInput
): Promise<ResolvedSwapPair> {
  const symbolUpper = (input.symbol || "ETH").toUpperCase().trim();
  let targetChainId = input.chainId || "1";

  // If chainId was passed as a name (e.g. "ethereum" or "bsc")
  if (BLOCKCHAIN_TO_CHAIN_ID[targetChainId.toLowerCase()]) {
    targetChainId = BLOCKCHAIN_TO_CHAIN_ID[targetChainId.toLowerCase()];
  }

  // If targetChainId is not in CHAINS, default to Ethereum ("1")
  let targetChain = CHAINS.find((c) => c.id === targetChainId) || CHAINS[0];

  // If token has contractAddresses list and no explicit chain was selected, check if Ethereum is available
  let contractAddress = input.contractAddress;
  let contractAddresses = input.contractAddresses;

  // 1. If contractAddress is missing, try fetching detailed info from CoinStats by coinId
  if (!contractAddress && (!contractAddresses || contractAddresses.length === 0) && input.coinId) {
    try {
      const detailed = await marketApi.getTokenById(input.coinId);
      if (detailed) {
        if (detailed.contractAddress) contractAddress = detailed.contractAddress;
        if (detailed.contractAddresses && detailed.contractAddresses.length > 0) {
          contractAddresses = detailed.contractAddresses;
        }
      }
    } catch {
      // Fallback gracefully to search / registry
    }
  }

  // 2. If still missing, try CoinStats search by symbol
  if (!contractAddress && (!contractAddresses || contractAddresses.length === 0)) {
    try {
      const searchResults = await marketApi.searchTokens(symbolUpper);
      const match = searchResults.find(
        (t) => t.symbol.toUpperCase() === symbolUpper || t.id.toLowerCase() === input.coinId?.toLowerCase()
      );
      if (match) {
        if (match.contractAddress) contractAddress = match.contractAddress;
        if (match.contractAddresses && match.contractAddresses.length > 0) {
          contractAddresses = match.contractAddresses;
        }
      }
    } catch {
      // Fallback gracefully
    }
  }

  // If we have contractAddresses array, check if target chain has a matching address
  if (contractAddresses && contractAddresses.length > 0) {
    const matchForTargetChain = contractAddresses.find((c) => {
      const mappedId = BLOCKCHAIN_TO_CHAIN_ID[c.blockchain.toLowerCase()];
      return mappedId === targetChain.id;
    });

    if (matchForTargetChain) {
      contractAddress = matchForTargetChain.contractAddress;
    } else if (!contractAddress) {
      // If target chain didn't match, see if there is an Ethereum or first valid address
      const ethMatch = contractAddresses.find(
        (c) => BLOCKCHAIN_TO_CHAIN_ID[c.blockchain.toLowerCase()] === "1"
      );
      if (ethMatch) {
        targetChain = CHAINS[0]; // Ethereum
        contractAddress = ethMatch.contractAddress;
      } else {
        const first = contractAddresses[0];
        const firstMappedId = BLOCKCHAIN_TO_CHAIN_ID[first.blockchain.toLowerCase()];
        const matchedChain = CHAINS.find((c) => c.id === firstMappedId);
        if (matchedChain) {
          targetChain = matchedChain;
          contractAddress = first.contractAddress;
        }
      }
    }
  }

  // 1. Check registry for targetChain
  const registryTokens = TOKENS_BY_CHAIN[targetChain.id] || [];

  // Match by contract address first (if provided and not "native")
  if (contractAddress && contractAddress.toLowerCase() !== "native") {
    const matchByAddr = registryTokens.find(
      (t) => t.address.toLowerCase() === contractAddress!.toLowerCase()
    );
    if (matchByAddr) {
      return { chain: targetChain, token: matchByAddr };
    }
  }

  // Match by symbol in registry
  const matchBySymbol = registryTokens.find(
    (t) => t.symbol.toUpperCase() === symbolUpper
  );
  if (matchBySymbol) {
    return { chain: targetChain, token: matchBySymbol };
  }

  // Special cases:
  // BTC on Ethereum -> WBTC
  if (symbolUpper === "BTC") {
    if (targetChain.id === "1") {
      const wbtc = registryTokens.find((t) => t.symbol === "WBTC");
      if (wbtc) return { chain: targetChain, token: wbtc };
    } else if (targetChain.id === "56") {
      const btcb = registryTokens.find((t) => t.symbol === "BTCB");
      if (btcb) return { chain: targetChain, token: btcb };
    }
  }

  // Native gas tokens
  const isNativeGas =
    (symbolUpper === "ETH" && (targetChain.id === "1" || targetChain.id === "42161" || targetChain.id === "10" || targetChain.id === "8453")) ||
    (symbolUpper === "BNB" && targetChain.id === "56") ||
    ((symbolUpper === "MATIC" || symbolUpper === "POL") && targetChain.id === "137") ||
    (symbolUpper === "AVAX" && targetChain.id === "43114") ||
    (symbolUpper === "FTM" && targetChain.id === "250") ||
    (symbolUpper === "SOL" && targetChain.id === "sol");

  if (isNativeGas) {
    const nativeToken = registryTokens.find((t) => t.address === "native") || {
      symbol: symbolUpper,
      name: input.name || targetChain.name,
      color: targetChain.color,
      icon: input.logoUrl || targetChain.icon,
      address: "native",
    };
    return { chain: targetChain, token: nativeToken };
  }

  // 4. If contractAddress is still missing, query live DEX aggregator (Li.Fi) for the target chain
  if (!contractAddress || contractAddress.toLowerCase() === "native") {
    try {
      const lifiAddr = await fetchContractFromLiFi(targetChain.id, symbolUpper);
      if (lifiAddr) {
        contractAddress = lifiAddr;
      }
    } catch {
      // Ignore
    }
  }

  // Fallback: construct Token with resolved contractAddress or native gas fallback
  const finalAddress = contractAddress || "native";
  const customToken: Token = {
    symbol: symbolUpper,
    name: input.name || symbolUpper,
    color: "#8B5CF6",
    icon: input.logoUrl || "",
    address: finalAddress,
  };

  return { chain: targetChain, token: customToken };
}
