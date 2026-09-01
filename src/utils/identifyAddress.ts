import { EVMService } from "../services/EthereumService";
import { Chains } from "../types";

export function identifyAddress(address: string) {
  if (EVMService.validateAddress(address)) {
    return Chains.EVM;
  }

  return "Unknown";
}
