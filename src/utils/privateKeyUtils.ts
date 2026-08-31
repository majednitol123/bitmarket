import { EVMService } from "../services/EthereumService";
import solanaService from "../services/SolanaService";
import { getPhrase } from "../hooks/useStorageState";

/**
 * Derive Ethereum private key from encrypted seed phrase
 * @param index - wallet index (default 0)
 * @returns hex private key string (0x...)
 */
export async function deriveEthPrivateKey(index: number = 0): Promise<string | null> {
  try {
    const seedPhrase = await getPhrase();
    if (!seedPhrase) return null;

    const { wallet } = EVMService.deriveWalletByIndex(seedPhrase, index);
    return wallet.privateKey;
  } catch (error) {
    console.error("Failed to derive ETH private key:", error);
    return null;
  }
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive Solana private key from encrypted seed phrase
 * @param derivationPath - Solana derivation path
 * @returns hex private key string
 */
export async function deriveSolPrivateKey(derivationPath: string): Promise<string | null> {
  try {
    const seedPhrase = await getPhrase();
    if (!seedPhrase) return null;

    const privateKeyBytes = await solanaService.derivePrivateKeysFromPhrase(seedPhrase, derivationPath);
    
    // Convert Uint8Array to hex string for display
    return uint8ArrayToHex(privateKeyBytes);
  } catch (error) {
    console.error("Failed to derive SOL private key:", error);
    return null;
  }
}


