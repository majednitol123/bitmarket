
 import { JsonRpcProvider, Wallet, HDNodeWallet, AddressLike, parseEther, formatEther, isAddress, Mnemonic, ethers, Network as EthersNetwork } from "ethers";
import { CustomNetwork, AddressState } from "../store/types";
import { validateMnemonic } from "bip39";
import uuid from "react-native-uuid";
import { Alchemy, Network } from "alchemy-sdk";
import fetchTransfers, { getAllWalletNfts, INFT, Transfer } from "./helper";
export interface ExtendedHDNodeWallet {
  wallet: HDNodeWallet;
  derivationPath: string;
}
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address,uint256) returns (bool)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
];
export interface Transaction {
  uniqueId: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  blockTime: number;
  asset: string;
  direction: string;
}
interface SendTransactionResponse {
  gasEstimate: string;
  totalCost: string;
  totalCostMinusGas: string;
  gasFee: bigint;
}
const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY || (process.env.NODE_ENV === "test" ? "dummy_test_key" : undefined);
if (!ALCHEMY_KEY) {
  throw new Error("EXPO_PUBLIC_ALCHEMY_API_KEY is not set");
}

export class EVMService {
  private _provider: JsonRpcProvider | null = null;
  network: CustomNetwork;
  constructor(network: CustomNetwork) {
    this.network = network;
  }

  get provider(): JsonRpcProvider {
    if (!this._provider) {
      try {
        // Use explicit Network constructor with name + chainId to completely
        // skip ethers' internal auto-detection (which causes retry loops
        // for unknown/custom chain IDs like SecureChain 34/3434).
        const network = new EthersNetwork(
          this.network.chainName || `chain-${this.network.chainId}`,
          BigInt(this.network.chainId)
        );
        
        this._provider = new JsonRpcProvider(this.network.rpcUrl, network, {
          staticNetwork: true,
          batchMaxCount: 1,
        });
      } catch (error) {
        console.warn(`[EVM] Failed to create provider for ${this.network.chainName}:`, error);
        throw error;
      }
    }
    return this._provider;
  }

  async getBalance(address: AddressLike): Promise<bigint> {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Race against a 5s timeout so dead/unresponsive RPCs fail fast
      // (A healthy RPC responds in <1s; 10s was too generous and blocked the UI)
      const balance = await Promise.race([
        this.provider.getBalance(address),
        new Promise<bigint>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`RPC timeout for ${this.network.chainName}`)), 5000);
        }),
      ]);
      return balance;
    } catch (error) {
      console.warn(`[EVM] Balance check failed for ${this.network.chainName}:`, error instanceof Error ? error.message : "Unknown error");
      // Throw the error so the Redux thunk goes into the `.rejected` state, preserving old balance
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  static validateAddress(address: string) {
    return isAddress(address);
  }
  async findNextUnusedWalletIndex(phrase: string, index: number = 0) {
    const GAP_LIMIT = 5;
    let currentIndex = index;
    const mnemonic = Mnemonic.fromPhrase(phrase);

    // Key chains with corresponding chainIds to scan for account activity
    const scanRpcConfigs = [
      { url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, chainId: 1, name: "mainnet" },
      { url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, chainId: 137, name: "matic" },
      { url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, chainId: 42161, name: "arbitrum" },
      { url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, chainId: 8453, name: "base" },
      { url: "https://bsc-dataseed.binance.org/", chainId: 56, name: "bnb" },
      { url: "https://mainnet-rpc.scai.network", chainId: 22062011, name: "securechain" },
      { url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`, chainId: 11155111, name: "sepolia" },
      { url: `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`, chainId: 421614, name: "arbitrum-sepolia" },
    ];

    // Create lightweight providers for balance checks
    const providers = scanRpcConfigs.map((config) => {
      try {
        const net = new EthersNetwork(config.name, BigInt(config.chainId));
        return new JsonRpcProvider(config.url, net, { staticNetwork: true, batchMaxCount: 1 });
      } catch (error) {
        console.warn(`[EVM] Failed to create scan provider for ${config.name}:`, error);
        return null;
      }
    }).filter(Boolean) as JsonRpcProvider[];

    // Also include current active provider
    if (this.provider && !providers.includes(this.provider)) {
      providers.push(this.provider);
    }

    const providerFailureCounts = new Map<JsonRpcProvider, number>();
    let lastUsedIndex = -1;
    let consecutiveUnused = 0;
    const BATCH_SIZE = 5;

    while (consecutiveUnused < GAP_LIMIT) {
      // Filter out providers that have failed 2 or more times
      const activeProviders = providers.filter(p => (providerFailureCounts.get(p) || 0) < 2);
      if (activeProviders.length === 0 && providers.length > 0) {
        activeProviders.push(providers[0]); // Always keep at least one provider
      }

      const batchIndices = Array.from({ length: BATCH_SIZE }, (_, i) => currentIndex + i);
      const batchAddresses = batchIndices.map(idx => {
        const path = `m/44'/60'/0'/0/${idx}`;
        return {
          index: idx,
          address: HDNodeWallet.fromMnemonic(mnemonic, path).address
        };
      });

      // Check all batch addresses in parallel
      const batchResults = await Promise.all(batchAddresses.map(async ({ index: idx, address }) => {
        let isUsed = false;

        // Check balance across active providers
        const balanceChecks = activeProviders.map(async (provider) => {
          let timeoutId: NodeJS.Timeout | null = null;
          try {
            const balance = await Promise.race([
              provider.getBalance(address),
              new Promise<bigint>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("Timeout")), 1500);
              })
            ]);
            return balance > 0n;
          } catch (err) {
            const currentFailures = providerFailureCounts.get(provider) || 0;
            providerFailureCounts.set(provider, currentFailures + 1);
            return false;
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        });

        const results = await Promise.all(balanceChecks);
        isUsed = results.some(Boolean);

        // If no balance found, also check transaction history on the active provider
        if (!isUsed) {
          try {
            const chainIdentifier = this.network.chainId.toString();
            const transactions = await this.fetchTransactions(chainIdentifier, address);
            isUsed = transactions.transferHistory.length > 0;
          } catch {
            // ignore
          }
        }

        return { index: idx, isUsed };
      }));

      // Process results in order to properly calculate consecutiveUnused
      let shouldBreak = false;
      for (const res of batchResults) {
        if (res.isUsed) {
          lastUsedIndex = res.index;
          consecutiveUnused = 0;
        } else {
          consecutiveUnused++;
        }
        if (consecutiveUnused >= GAP_LIMIT) {
          shouldBreak = true;
          break;
        }
      }

      if (shouldBreak) {
        break;
      }

      currentIndex += BATCH_SIZE;
      // Pace requests to prevent hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return lastUsedIndex >= 0 ? lastUsedIndex + 2 : 0;
  }
   async importAllActiveAddresses(mnemonicPhrase: string, index?: number) {
    const unusedIndex = index ?? (await this.findNextUnusedWalletIndex(mnemonicPhrase));
    return this.collectedUsedAddresses(mnemonicPhrase, unusedIndex);
   }
  
    async collectedUsedAddresses(phrase: string, unusedIndex: number) {
    const mnemonic = Mnemonic.fromPhrase(phrase);
    const startingIndex = unusedIndex > 0 ? unusedIndex - 1 : unusedIndex;
    const addressesUsed: any[] = [];
    for (let i = 0; i <= startingIndex; i++) {
      const path = `m/44'/60'/0'/0/${i}`;
      const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);
      addressesUsed.push({ ...wallet, derivationPath: path });
    }
    return addressesUsed;
  }
  private erc20Contract(contractAddress: string, privateKey?: string) {
    let signer: ethers.Signer | undefined;
    if (__DEV__) console.log("this.provider",this.provider)
  if (privateKey) signer = new Wallet(privateKey, this.provider);
  return new ethers.Contract(contractAddress, ERC20_ABI, signer ?? this.provider);
}
  async sendTransaction(from : AddressLike, to: AddressLike, privateKey: string, value: string) {
    const wallet = new Wallet(privateKey, this.provider);
    return wallet.sendTransaction({from, to, value: parseEther(value) });
  }
  async createWalletByIndex(phrase: string, index: number = 0): Promise<any> {
    const path = `m/44'/60'/0'/0/${index}`;
    const wallet = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(phrase), path);
    return { ...wallet, derivationPath: path };
  }


async sendToken(contractAddress: string, privateKey: string, to: string, amount: string) {
  const contract = this.erc20Contract(contractAddress, privateKey);
  const decimals = await contract.decimals();
  const tx = await contract.transfer(to, ethers.parseUnits(amount, decimals));
  await tx.wait();
  return tx.hash;
}async getTransfers(contractAddress: string, wallet: string, fromBlock = 0) {
  const provider = this.provider;
  const contract = this.erc20Contract(contractAddress);

  const logs = await provider.getLogs({
    address: contractAddress,
    fromBlock,
    toBlock: "latest",
    topics: [ethers.id("Transfer(address,address,uint256)")],
  });


  return logs.map((log) => {
    const parsed = contract.interface.parseLog(log);
    const { from, to, value } = parsed.args;

    return {
      uniqueId: uuid.v4().toString(), // for FlatList key
      hash: log.transactionHash,
      from,
      to,
      value: ethers.formatUnits(value, 18), // default 18 decimals
      direction: from.toLowerCase() === wallet.toLowerCase() ? "sent" : "received",
      asset: contractAddress,
      blockTime: Date.now(), // optional, placeholder
    };
  });
}
  async fetchAllNFTs(address: string, chainId: number): Promise<INFT[]> {
  if (!address) throw new Error("Wallet address is required");
  if (isNaN(chainId)) throw new Error("Invalid chainId");

  try {
    const nfts = await getAllWalletNfts(address, chainId);

    return nfts.length ? nfts : [];
  } catch (err: any) {
    console.error(
      `[EVMService] fetchAllNFTs error for ${address} on chain ${chainId}:`,
      err?.message || err
    );
    return [];
  }
}

  async getTokenBalance(chainId: number, token: string, wallet: string) {
    if (__DEV__) console.log("getTokenBalance called with:", { chainId, token, wallet });
  const metadata = await this.getErc20Metadata(token);
  const balance = await this.getErc20Balance(token, wallet, metadata.decimals);

  return {
    chainId,
    token,
    name: metadata.name,
    symbol: metadata.symbol,
    balance,
  };
}
async getErc20Transfers(contractAddress: string, wallet: string, fromBlock = 0) {
  const provider = this.provider;
  const c = this.erc20Contract(contractAddress);

  const logs = await provider.getLogs({
    address: contractAddress,
    fromBlock,
    toBlock: "latest",
    topics: [ethers.id("Transfer(address,address,uint256)")],
  });

  return logs.map((log) => {
    const parsed = c.interface.parseLog(log);
    const { from, to, value } = parsed.args;

    return {
      txHash: log.transactionHash,
      from,
      to,
      amount: value.toString(),
      direction: from.toLowerCase() === wallet.toLowerCase() ? "OUT" : "IN",
    };
  });
}

  async restoreWalletFromPhrase(mnemonicPhrase: string): Promise<HDNodeWallet> {
    if (!mnemonicPhrase) throw new Error("Mnemonic phrase cannot be empty");
    if (!validateMnemonic(mnemonicPhrase)) throw new Error("Invalid mnemonic phrase");
    return HDNodeWallet.fromPhrase(mnemonicPhrase);
  }
  async calculateGasAndAmountsForERC20Transfer(fromAddress: string, tokenAddress: string, toAddress: string, amount: string, tokenDecimals = 18) {
    try {
      const erc20Abi = [
        "function transfer(address to, uint256 value) public returns (bool)",
        "function balanceOf(address owner) view returns (uint256)"
      ];

      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);

      const amountWei = ethers.parseUnits(amount, tokenDecimals);
      const senderBalance = await contract.balanceOf(fromAddress);

      if (senderBalance < amountWei) {
        if (__DEV__) console.log("❌ Insufficient token balance");
        return;
      }

      // Encode transfer data
      const txData = contract.interface.encodeFunctionData("transfer", [toAddress, amountWei]);

      // Estimate gas
      const gasEstimate = await this.provider.estimateGas({
        to: tokenAddress,
        from: fromAddress,
        data: txData
      });

      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      const gasCostEth = ethers.formatEther(gasEstimate * gasPrice);

      return {
        gasEstimate: gasEstimate.toString(),
        gasCostEth: gasCostEth.toString()
      };
    } catch (err: any) {
      console.warn("❌ Error during ERC-20 gas calculation:", err?.message || err);
    }
  }

   
  async fetchNFTs(owner: string) {
  const alchemy = new Alchemy({
    apiKey: "YOUR_KEY",
    network: Network.ETH_MAINNET,
  });

  const res = await alchemy.nft.getNftsForOwner(owner);

  return {
    chainId: this.network.chainId,
    account: owner,
    nfts: res.ownedNfts.map((nft) => {
      const metadata = nft.raw?.metadata;

      return {
        chainId: this.network.chainId,
        contractAddress: nft.contract.address,
        tokenId: nft.tokenId,
        name:
          nft.name ||
          metadata?.name ||
          `#${parseInt(nft.tokenId, 16)}`,
        description:
          nft.description || metadata?.description || "",
        image:
          nft.image?.cachedUrl ||
          nft.image?.pngUrl ||
          nft.image?.originalUrl ||
          metadata?.image ||
          "",
        owner,
      };
    }),
  };
}

   async createWallet(): Promise<HDNodeWallet> {
    return HDNodeWallet.createRandom();
   }
  async getErc20Balance(
  contractAddress: string,
  owner: string,
  decimals: number
  ) {
    // 0xd3aC5710463ccBFA8B7cD8213808e1350530e3F7
  const abi = ["function balanceOf(address) view returns (uint256)"];
    const contract = new ethers.Contract(contractAddress, abi, this.provider);
    
  const balance = await contract.balanceOf(owner);
  return ethers.formatUnits(balance, decimals);
}
  async getErc20Metadata(address: string) {
  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
  ];
  const contract = new ethers.Contract(address, abi, this.provider);
  return {
    chainId: this.network.chainId,
    contractAddress: address,
    name: await contract.name(),
    symbol: await contract.symbol(),
    decimals: await contract.decimals(),
    balance: "0",
  };
  }
  
  async getErc20DataBatch(tokenAddresses: string[], owner: string): Promise<any[]> {
    if (tokenAddresses.length === 0) return [];
    
    const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
    const MULTICALL_ABI = [
      "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])"
    ];
    const ERC20_ABI = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function balanceOf(address) view returns (uint256)"
    ];
    
    const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL_ABI, this.provider);
    const erc20Interface = new ethers.Interface(ERC20_ABI);
    
    const calls: any[] = [];
    for (const addr of tokenAddresses) {
      calls.push(
        { target: addr, allowFailure: true, callData: erc20Interface.encodeFunctionData("name") },
        { target: addr, allowFailure: true, callData: erc20Interface.encodeFunctionData("symbol") },
        { target: addr, allowFailure: true, callData: erc20Interface.encodeFunctionData("decimals") },
        { target: addr, allowFailure: true, callData: erc20Interface.encodeFunctionData("balanceOf", [owner]) }
      );
    }
    
    try {
      const results = await multicall.aggregate3(calls);
      const data: any[] = [];
      
      for (let i = 0; i < tokenAddresses.length; i++) {
        const addr = tokenAddresses[i];
        const resName = results[i * 4];
        const resSymbol = results[i * 4 + 1];
        const resDecimals = results[i * 4 + 2];
        const resBalance = results[i * 4 + 3];
        
        let name = "Unknown Token";
        let symbol = "TOKEN";
        let decimals = 18;
        let balanceVal = 0n;
        
        try {
          if (resName.success) {
            name = erc20Interface.decodeFunctionResult("name", resName.returnData)[0];
          }
        } catch (_) {}
        
        try {
          if (resSymbol.success) {
            symbol = erc20Interface.decodeFunctionResult("symbol", resSymbol.returnData)[0];
          }
        } catch (_) {}
        
        try {
          if (resDecimals.success) {
            decimals = Number(erc20Interface.decodeFunctionResult("decimals", resDecimals.returnData)[0]);
          }
        } catch (_) {}
        
        try {
          if (resBalance.success) {
            balanceVal = erc20Interface.decodeFunctionResult("balanceOf", resBalance.returnData)[0];
          }
        } catch (_) {}
        
        data.push({
          chainId: this.network.chainId,
          token: addr,
          name,
          symbol,
          balance: ethers.formatUnits(balanceVal, decimals),
          decimals,
        });
      }
      return data;
    } catch (err: any) {
      console.warn(`[EVMService] Multicall3 batch failed, falling back to sequential calls:`, err.message || err);
      const data: any[] = [];
      for (const addr of tokenAddresses) {
        try {
          const meta = await this.getErc20Metadata(addr);
          const balance = await this.getErc20Balance(addr, owner, meta.decimals);
          data.push({
            chainId: this.network.chainId,
            token: addr,
            name: meta.name,
            symbol: meta.symbol,
            balance,
          });
        } catch (e: any) {
          console.warn(`[EVMService] Fallback balance check failed for ${addr}:`, e.message);
        }
      }
      return data;
    }
  }
  
  
  async fetchTransactions(chain: string, address: string): Promise<{ transferHistory: Transfer[]; pageKey?: string }> {
    try {

      const chainId = Number(chain);
      if (isNaN(chainId)) throw new Error("Invalid chainId");
      const transfers = await fetchTransfers(chainId, address, this.network.explorerUrl);

      return {
        transferHistory: transfers,
        pageKey: undefined,
      };
    } catch (err: any) {
      console.error(`[EVMService] fetchTransactions error for ${address} on chain ${chain}:`, err.message || err);
      return { transferHistory: [], pageKey: undefined };
    }
  }
  
// async calculateGasAndAmounts(toAddress: string, amount: string): Promise<SendTransactionResponse> {
//     const amountInWei = parseEther(amount);
//     const transaction = { to: toAddress, value: amountInWei };
//     const gasEstimate = await this.provider.estimateGas(transaction);
//     const gasFee = (await this.provider.getFeeData()).maxFeePerGas;
//     const gasPrice = BigInt(gasEstimate) * BigInt(gasFee);
//     const totalCost = amountInWei + gasPrice;
//     const totalCostMinusGas = amountInWei - gasPrice;
//     return {
//       gasEstimate: formatEther(gasPrice),
//       totalCost: formatEther(totalCost),
//       totalCostMinusGas: formatEther(totalCostMinusGas),
//       gasFee,
//     };
  //   }
  
  async calculateGasAndAmounts(toAddress: string, amount: string, fromAddress?: string) {
  // parseEther returns bigint in Ethers v6
  const amountInWei: bigint = parseEther(amount); 
  const transaction = { 
    to: toAddress, 
    value: amountInWei,
    from: fromAddress // Include from address for more accurate estimation and L2 compatibility
  };

  try {
    // estimateGas returns bigint
    let gasEstimate: bigint;
    try {
      gasEstimate = await this.provider.estimateGas(transaction); 
    } catch (estError: any) {
      // If it failed due to insufficient funds, retry with value = 0 (highly standard for max balance calculation)
      const isInsufficientFunds = 
        estError?.code === "INSUFFICIENT_FUNDS" || 
        estError?.message?.toLowerCase().includes("insufficient funds") ||
        estError?.info?.error?.message?.toLowerCase().includes("insufficient funds") ||
        estError?.data?.message?.toLowerCase().includes("insufficient funds");
      
      if (isInsufficientFunds) {
        if (__DEV__) console.log("[EVMService] estimateGas failed due to insufficient funds, retrying with 0 value for gas estimation.");
        gasEstimate = await this.provider.estimateGas({
          ...transaction,
          value: 0n
        });
      } else {
        throw estError;
      }
    }
    
    // Add 10% buffer to gas estimate for safety, especially on L2s
    gasEstimate = (gasEstimate * 110n) / 100n;

    // getFeeData returns gas price info
    const feeData = await this.provider.getFeeData();
    
    // Use maxFeePerGas for EIP-1559, fall back to gasPrice
    const gasPricePerUnit: bigint = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n; 

    // simple bigint arithmetic
    const gasPriceTotal: bigint = gasEstimate * gasPricePerUnit;
    const totalCost: bigint = amountInWei + gasPriceTotal;
    
    // For Max calculation: what remains if we subtract gas from the input amount (which would be the total balance)
    const totalCostMinusGas: bigint = amountInWei > gasPriceTotal ? amountInWei - gasPriceTotal : 0n;

    return {
      gasEstimate: formatEther(gasPriceTotal), // string
      totalCost: formatEther(totalCost), // string
      totalCostMinusGas: formatEther(totalCostMinusGas), // string
      gasFee: gasPricePerUnit, // bigint
    };
  } catch (error: any) {
    console.warn("[EVMService] calculateGasAndAmounts fallback used:", error?.message || error);
    // Fallback if estimateGas fails (common on zkSync if funds are low or address is new)
    const fallbackGas = 21000n; 
    const feeData = await this.provider.getFeeData();
    const gasPricePerUnit = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const gasPriceTotal = fallbackGas * gasPricePerUnit;
    
    return {
      gasEstimate: formatEther(gasPriceTotal),
      totalCost: formatEther(amountInWei + gasPriceTotal),
      totalCostMinusGas: amountInWei > gasPriceTotal ? formatEther(amountInWei - gasPriceTotal) : "0",
      gasFee: gasPricePerUnit,
    };
  }
}
  async confirmTransaction(txHash: string) {
    const receipt = await this.provider.waitForTransaction(txHash);
    return receipt?.status === 1;
  }

  static createWallet() {
    return HDNodeWallet.createRandom();
  }

  static restoreWalletFromMnemonic(mnemonicPhrase: string) {
    if (!validateMnemonic(mnemonicPhrase)) throw new Error("Invalid mnemonic");
    return HDNodeWallet.fromPhrase(mnemonicPhrase);
  }

static deriveWalletByIndex(
  mnemonicPhrase: string,
  index = 0
): ExtendedHDNodeWallet {
  const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase); // wrap string
  const path = `m/44'/60'/0'/0/${index}`;
  const wallet = HDNodeWallet.fromMnemonic(mnemonic, path);
  return { wallet, derivationPath: path };
}

  destroy() {
    // Clean up resources if needed
  }
}

/* ---------------- GLOBAL REGISTRY ---------------- */
export const evmServices: Partial<Record<number, EVMService | null>> = {};

export const registerEvmService = (network: CustomNetwork) => {
  const existing = evmServices[network.chainId];
  if (
    !existing ||
    existing.network.rpcUrl !== network.rpcUrl ||
    existing.network.chainName !== network.chainName ||
    existing.network.symbol !== network.symbol
  ) {
    evmServices[network.chainId] = new EVMService(network);
    if (__DEV__) console.log(`[EVM] Service initialized/updated for ${network.chainName} (${network.chainId})`);
  }
};



export const getEvmService = (chainId: number): EVMService | null => {
  const service = evmServices[chainId];
  if (!service) {
    console.warn(`EVM service not initialized for chain ${chainId}`);
    return null;
  }
  return service;
};
