import{ EVMService, evmServices } from "../services/EthereumService";
import solanaService from "../services/SolanaService";
import { Chains } from "../types";

export function identifyAddress(address: string) {
  if (EVMService.validateAddress(address)) {
    return Chains.EVM;
  }

  if (solanaService.validateAddress(address)) {
    return Chains.Solana;
  }

  return "Unknown";
}
