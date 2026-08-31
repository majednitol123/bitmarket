import * as SecureStore from "expo-secure-store";
import { Wallet } from "ethers";
import { Keypair } from "@solana/web3.js";

const IMPORTED_EVM_PREFIX = "imported_evm_";
const IMPORTED_SOL_PREFIX = "imported_sol_";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58ToBytes(base58Str: string): Uint8Array {
  const alphabetMap = new Map<string, number>();
  for (let i = 0; i < BASE58_ALPHABET.length; i++) {
    alphabetMap.set(BASE58_ALPHABET[i], i);
  }

  let leadingZeros = 0;
  for (const char of base58Str) {
    if (char === "1") leadingZeros++;
    else break;
  }

  const base = BigInt(58);
  let num = BigInt(0);
  for (const char of base58Str) {
    const val = alphabetMap.get(char);
    if (val === undefined) throw new Error(`Invalid base58 character: ${char}`);
    num = num * base + BigInt(val);
  }

  const hex = num.toString(16);
  const hexPadded = hex.length % 2 === 1 ? "0" + hex : hex;

  const bytes: number[] = [];
  for (let i = 0; i < hexPadded.length; i += 2) {
    bytes.push(parseInt(hexPadded.slice(i, i + 2), 16));
  }

  const result = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[leadingZeros + i] = bytes[i];
  }

  return result;
}

/**
 * Store imported EVM private key securely
 */
export async function storeImportedEvmKey(
  address: string,
  privateKey: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      `${IMPORTED_EVM_PREFIX}${address.toLowerCase()}`,
      privateKey
    );
  } catch (error) {
    console.error("Failed to store imported EVM key:", error);
    throw error;
  }
}

/**
 * Store imported Solana private key securely
 */
export async function storeImportedSolKey(
  address: string,
  privateKey: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      `${IMPORTED_SOL_PREFIX}${address}`,
      privateKey
    );
  } catch (error) {
    console.error("Failed to store imported SOL key:", error);
    throw error;
  }
}

/**
 * Get imported EVM private key
 */
export async function getImportedEvmKey(
  address: string
): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      `${IMPORTED_EVM_PREFIX}${address.toLowerCase()}`
    );
  } catch (error) {
    console.error("Failed to get imported EVM key:", error);
    return null;
  }
}

/**
 * Get imported Solana private key
 */
export async function getImportedSolKey(
  address: string
): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(`${IMPORTED_SOL_PREFIX}${address}`);
  } catch (error) {
    console.error("Failed to get imported SOL key:", error);
    return null;
  }
}

/**
 * Delete imported EVM private key
 */
export async function deleteImportedEvmKey(address: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(
      `${IMPORTED_EVM_PREFIX}${address.toLowerCase()}`
    );
  } catch (error) {
    console.error("Failed to delete imported EVM key:", error);
  }
}

/**
 * Delete imported Solana private key
 */
export async function deleteImportedSolKey(address: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(`${IMPORTED_SOL_PREFIX}${address}`);
  } catch (error) {
    console.error("Failed to delete imported SOL key:", error);
  }
}

/**
 * Get address from EVM private key
 */
export function getEvmAddressFromPrivateKey(privateKey: string): string {
  try {
    const wallet = new Wallet(privateKey);
    return wallet.address;
  } catch (error) {
    throw new Error("Invalid EVM private key");
  }
}

/**
 * Get address from Solana private key
 * Supports hex string or base58 string
 */
export function getSolAddressFromPrivateKey(privateKey: string): string {
  try {
    let secretKey: Uint8Array;

    // Try hex format first (0x... or plain hex)
    if (privateKey.startsWith("0x") || /^[0-9a-fA-F]+$/.test(privateKey)) {
      const hex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
      secretKey = new Uint8Array(
        hex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
      );
    } else {
      // Try base58 format
      secretKey = base58ToBytes(privateKey);
    }

    const keypair = Keypair.fromSecretKey(secretKey);
    return keypair.publicKey.toBase58();
  } catch (error) {
    console.error("Error parsing Solana private key:", error);
    throw new Error(
      "Invalid Solana private key. Must be hex or base58 format."
    );
  }
}
