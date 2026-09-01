import {
  JsonRpcProvider,
  Wallet,
  AddressLike,
  parseEther,
  formatEther,
  isAddress,
  Network as EthersNetwork,
} from "ethers";
import { CustomNetwork } from "../store/types";

const ALCHEMY_KEY =
  process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ||
  (process.env.NODE_ENV === "test" ? "dummy_test_key" : undefined);
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
        const network = new EthersNetwork(
          this.network.chainName || `chain-${this.network.chainId}`,
          BigInt(this.network.chainId)
        );

        this._provider = new JsonRpcProvider(this.network.rpcUrl, network, {
          staticNetwork: true,
          batchMaxCount: 1,
        });
      } catch (error) {
        console.warn(
          `[EVM] Failed to create provider for ${this.network.chainName}:`,
          error
        );
        throw error;
      }
    }
    return this._provider;
  }

  async getBalance(address: AddressLike): Promise<bigint> {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const balance = await Promise.race([
        this.provider.getBalance(address),
        new Promise<bigint>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error(`RPC timeout for ${this.network.chainName}`)),
            5000
          );
        }),
      ]);
      return balance;
    } catch (error) {
      console.warn(
        `[EVM] Balance check failed for ${this.network.chainName}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
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

  async sendTransaction(
    from: AddressLike,
    to: AddressLike,
    privateKey: string,
    value: string
  ) {
    const wallet = new Wallet(privateKey, this.provider);
    return wallet.sendTransaction({ from, to, value: parseEther(value) });
  }

  async calculateGasAndAmounts(
    toAddress: string,
    amount: string,
    fromAddress?: string
  ) {
    const amountInWei: bigint = parseEther(amount);
    const transaction = {
      to: toAddress,
      value: amountInWei,
      from: fromAddress,
    };

    try {
      let gasEstimate: bigint;
      try {
        gasEstimate = await this.provider.estimateGas(transaction);
      } catch (estError: any) {
        const isInsufficientFunds =
          estError?.code === "INSUFFICIENT_FUNDS" ||
          estError?.message?.toLowerCase().includes("insufficient funds") ||
          estError?.info?.error?.message?.toLowerCase().includes("insufficient funds") ||
          estError?.data?.message?.toLowerCase().includes("insufficient funds");

        if (isInsufficientFunds) {
          gasEstimate = await this.provider.estimateGas({
            ...transaction,
            value: 0n,
          });
        } else {
          throw estError;
        }
      }

      gasEstimate = (gasEstimate * 110n) / 100n;
      const feeData = await this.provider.getFeeData();
      const gasPricePerUnit: bigint =
        feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
      const gasPriceTotal: bigint = gasEstimate * gasPricePerUnit;
      const totalCost: bigint = amountInWei + gasPriceTotal;
      const totalCostMinusGas: bigint =
        amountInWei > gasPriceTotal ? amountInWei - gasPriceTotal : 0n;

      return {
        gasEstimate: formatEther(gasPriceTotal),
        totalCost: formatEther(totalCost),
        totalCostMinusGas: formatEther(totalCostMinusGas),
        gasFee: gasPricePerUnit,
      };
    } catch (error: any) {
      console.warn(
        "[EVMService] calculateGasAndAmounts fallback used:",
        error?.message || error
      );
      const fallbackGas = 21000n;
      const feeData = await this.provider.getFeeData();
      const gasPricePerUnit = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
      const gasPriceTotal = fallbackGas * gasPricePerUnit;

      return {
        gasEstimate: formatEther(gasPriceTotal),
        totalCost: formatEther(amountInWei + gasPriceTotal),
        totalCostMinusGas:
          amountInWei > gasPriceTotal ? formatEther(amountInWei - gasPriceTotal) : "0",
        gasFee: gasPricePerUnit,
      };
    }
  }

  async confirmTransaction(txHash: string) {
    const receipt = await this.provider.waitForTransaction(txHash);
    return receipt?.status === 1;
  }

  destroy() {
    // Clean up resources
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
    if (__DEV__)
      console.log(
        `[EVM] Service initialized/updated for ${network.chainName} (${network.chainId})`
      );
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
