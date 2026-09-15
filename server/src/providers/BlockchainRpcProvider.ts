import axios from 'axios';
import { BaseProvider } from './core/BaseProvider';
import { ProviderError } from './core/ProviderErrors';

export interface RpcNativeBalanceResult {
  chain: string;
  chainId: number;
  address: string;
  rawWei: string;
  formattedEther: string;
  symbol: string;
}

export interface RpcTokenBalanceResult {
  chain: string;
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  rawUnits: string;
  formattedUnits: string;
}

export interface RpcTransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string | null;
  status: 'success' | 'reverted';
  gasUsed: string;
  effectiveGasPrice?: string;
  confirmations: number;
}

interface ChainRpcConfig {
  name: string;
  symbol: string;
  alchemyNetwork?: string;
  fallbackRpcs: string[];
}

const SUPPORTED_CHAINS: Record<number, ChainRpcConfig> = {
  1: {
    name: 'Ethereum',
    symbol: 'ETH',
    alchemyNetwork: 'eth-mainnet',
    fallbackRpcs: [
      'https://cloudflare-eth.com',
      'https://rpc.ankr.com/eth',
      'https://eth.llamarpc.com',
    ],
  },
  137: {
    name: 'Polygon',
    symbol: 'POL',
    alchemyNetwork: 'polygon-mainnet',
    fallbackRpcs: [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon.llamarpc.com',
    ],
  },
  42161: {
    name: 'Arbitrum',
    symbol: 'ETH',
    alchemyNetwork: 'arb-mainnet',
    fallbackRpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://rpc.ankr.com/arbitrum',
    ],
  },
  10: {
    name: 'Optimism',
    symbol: 'ETH',
    alchemyNetwork: 'opt-mainnet',
    fallbackRpcs: [
      'https://mainnet.optimism.io',
      'https://rpc.ankr.com/optimism',
    ],
  },
  8453: {
    name: 'Base',
    symbol: 'ETH',
    alchemyNetwork: 'base-mainnet',
    fallbackRpcs: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
    ],
  },
  56: {
    name: 'BSC',
    symbol: 'BNB',
    fallbackRpcs: [
      'https://bsc-dataseed.binance.org',
      'https://rpc.ankr.com/bsc',
      'https://binance.llamarpc.com',
    ],
  },
};

const CHAIN_NAME_TO_ID: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  '1': 1,
  polygon: 137,
  matic: 137,
  pol: 137,
  '137': 137,
  arbitrum: 42161,
  arb: 42161,
  '42161': 42161,
  optimism: 10,
  opt: 10,
  '10': 10,
  base: 8453,
  '8453': 8453,
  bsc: 56,
  binance: 56,
  '56': 56,
};

export class BlockchainRpcProvider extends BaseProvider {
  private alchemyApiKey: string;

  constructor() {
    super('BlockchainRpc', {
      defaultTimeoutMs: 6000,
      maxConsecutiveFailures: 5,
      circuitBreakerCooldownMs: 20000,
    });

    this.alchemyApiKey =
      process.env.ALCHEMY_API_KEY ||
      process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ||
      '';

    console.log(
      `[BlockchainRpcProvider] Initialized with Alchemy key: ${
        this.alchemyApiKey ? 'PRESENT' : 'NONE (using public RPC fallbacks)'
      }`
    );
  }

  /**
   * Normalizes chain input to numeric chain ID
   */
  public normalizeChainId(chain: string | number): number {
    if (typeof chain === 'number') return chain;
    const lower = String(chain).toLowerCase().trim();
    if (CHAIN_NAME_TO_ID[lower]) {
      return CHAIN_NAME_TO_ID[lower];
    }
    const parsed = parseInt(lower, 10);
    return isNaN(parsed) ? 1 : parsed;
  }

  /**
   * Builds ordered list of RPC endpoint URLs (Alchemy primary + public fallbacks)
   */
  private getRpcUrlsForChain(chainId: number): string[] {
    const chainConfig = SUPPORTED_CHAINS[chainId];
    if (!chainConfig) {
      throw new ProviderError('BlockchainRpc', `Unsupported chain ID: ${chainId}`, 400, 'UNSUPPORTED_CHAIN');
    }

    const urls: string[] = [];
    if (this.alchemyApiKey && chainConfig.alchemyNetwork) {
      urls.push(`https://${chainConfig.alchemyNetwork}.g.alchemy.com/v2/${this.alchemyApiKey}`);
    }
    urls.push(...chainConfig.fallbackRpcs);
    return urls;
  }

  /**
   * Dispatches JSON-RPC call across available RPC nodes with fallback failover
   */
  private async callRpc<T>(chainId: number, method: string, params: any[]): Promise<T> {
    const rpcUrls = this.getRpcUrlsForChain(chainId);
    let lastError: any = null;

    for (let i = 0; i < rpcUrls.length; i++) {
      const url = rpcUrls[i];
      try {
        return await this.executeWithResilience(
          `RPC:${method}:${chainId}`,
          async () => {
            const res = await axios.post(
              url,
              {
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params,
              },
              {
                headers: { 'Content-Type': 'application/json' },
                timeout: this.defaultTimeoutMs,
              }
            );

            if (res.data?.error) {
              throw new Error(`RPC Error: ${res.data.error.message || JSON.stringify(res.data.error)}`);
            }

            return res.data?.result;
          },
          {
            timeoutMs: this.defaultTimeoutMs,
            retries: 1,
          }
        );
      } catch (err: any) {
        lastError = err;
        console.warn(`[BlockchainRpcProvider] Node ${url} failed for ${method}: ${err.message}. Trying next node...`);
      }
    }

    throw new ProviderError(
      'BlockchainRpc',
      `All RPC nodes failed for chain ${chainId} (${method}): ${lastError?.message}`,
      502,
      'RPC_NODES_EXHAUSTED',
      false,
      lastError
    );
  }

  /**
   * Retrieves current on-chain native gas balance (e.g. ETH, POL, BNB)
   */
  public async getNativeBalance(
    chain: string | number,
    address: string
  ): Promise<RpcNativeBalanceResult> {
    const chainId = this.normalizeChainId(chain);
    const chainConfig = SUPPORTED_CHAINS[chainId];

    const hexBalance = await this.callRpc<string>(chainId, 'eth_getBalance', [address, 'latest']);
    const rawWei = hexBalance ? BigInt(hexBalance).toString(10) : '0';
    const formattedEther = this.formatUnits(rawWei, 18);

    return {
      chain: chainConfig?.name || `Chain-${chainId}`,
      chainId,
      address,
      rawWei,
      formattedEther,
      symbol: chainConfig?.symbol || 'ETH',
    };
  }

  /**
   * Retrieves ERC20 token balance via on-chain `balanceOf(address)` eth_call
   */
  public async getTokenBalance(
    chain: string | number,
    tokenAddress: string,
    walletAddress: string,
    decimals: number = 18
  ): Promise<RpcTokenBalanceResult> {
    const chainId = this.normalizeChainId(chain);
    const chainConfig = SUPPORTED_CHAINS[chainId];

    // balanceOf(address) function selector: 0x70a08231
    const cleanWallet = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = `0x70a08231${cleanWallet}`;

    const hexResult = await this.callRpc<string>(chainId, 'eth_call', [
      {
        to: tokenAddress,
        data: callData,
      },
      'latest',
    ]);

    const rawUnits = hexResult && hexResult !== '0x' ? BigInt(hexResult).toString(10) : '0';
    const formattedUnits = this.formatUnits(rawUnits, decimals);

    return {
      chain: chainConfig?.name || `Chain-${chainId}`,
      chainId,
      walletAddress,
      tokenAddress,
      rawUnits,
      formattedUnits,
    };
  }

  /**
   * Fetches latest mined block number
   */
  public async getBlockNumber(chain: string | number): Promise<number> {
    const chainId = this.normalizeChainId(chain);
    const hexBlock = await this.callRpc<string>(chainId, 'eth_blockNumber', []);
    return hexBlock ? parseInt(hexBlock, 16) : 0;
  }

  /**
   * Fetches transaction receipt from the chain
   */
  public async getTransactionReceipt(
    chain: string | number,
    txHash: string
  ): Promise<RpcTransactionReceipt | null> {
    const chainId = this.normalizeChainId(chain);
    const receipt = await this.callRpc<any>(chainId, 'eth_getTransactionReceipt', [txHash]);

    if (!receipt) return null;

    const currentBlock = await this.getBlockNumber(chainId);
    const receiptBlock = parseInt(receipt.blockNumber, 16);
    const confirmations = Math.max(0, currentBlock - receiptBlock + 1);

    return {
      transactionHash: receipt.transactionHash,
      blockNumber: receiptBlock,
      blockHash: receipt.blockHash,
      from: receipt.from,
      to: receipt.to,
      status: receipt.status === '0x1' ? 'success' : 'reverted',
      gasUsed: BigInt(receipt.gasUsed || '0x0').toString(10),
      effectiveGasPrice: receipt.effectiveGasPrice ? BigInt(receipt.effectiveGasPrice).toString(10) : undefined,
      confirmations,
    };
  }

  /**
   * Checks whether a transaction is confirmed on-chain
   */
  public async isTransactionConfirmed(
    chain: string | number,
    txHash: string,
    requiredConfirmations: number = 1
  ): Promise<{ confirmed: boolean; confirmations: number; status?: 'success' | 'reverted' }> {
    const receipt = await this.getTransactionReceipt(chain, txHash);
    if (!receipt) {
      return { confirmed: false, confirmations: 0 };
    }

    return {
      confirmed: receipt.confirmations >= requiredConfirmations,
      confirmations: receipt.confirmations,
      status: receipt.status,
    };
  }

  /**
   * Helper to format atomic integer units to decimal string without floating point inaccuracies
   */
  private formatUnits(rawStr: string, decimals: number): string {
    if (!rawStr || rawStr === '0') return '0';
    const padded = rawStr.padStart(decimals + 1, '0');
    const intPart = padded.slice(0, padded.length - decimals);
    const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
    return fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  }
}

export const blockchainRpcProvider = new BlockchainRpcProvider();
