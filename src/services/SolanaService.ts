import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair,
  TransactionConfirmationStrategy,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import uuid from "react-native-uuid";
import { validateMnemonic, mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";
import { TransactionObject } from "../types";

class SolanaService {
  private connection: Connection;
  constructor(private rpcUrl: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  selectNetwork(network: "mainnet" | "devnet", customRpcUrl?: string) {
    const rpcUrl = customRpcUrl || (network === "mainnet"
      ? "https://mainnet.helius-rpc.com/?api-key=4ea6a1a7-e963-4e68-8b02-5e072f7e77a8"
      : "https://devnet.helius-rpc.com/?api-key=800c9b64-37ba-4cd3-a7e9-807406f383a9");
    this.rpcUrl = rpcUrl;
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  updateRpcUrl(newRpcUrl: string) {
    this.rpcUrl = newRpcUrl;
    this.connection = new Connection(newRpcUrl, "confirmed");
  }

  restoreWalletFromPhrase(mnemonicPhrase: string): Promise<Keypair> {
    return new Promise((resolve, reject) => {
      try {
        const seed = mnemonicToSeedSync(mnemonicPhrase, "");
        const path = `m/44'/501'/0'/0'`;
        const keypair = Keypair.fromSeed(
          derivePath(path, seed.toString("hex")).key
        );

        resolve(keypair);
      } catch (error:any) {
        reject(new Error("Failed to import solana wallet: " + error.message));
      }
    });
  }

  async createWalletByIndex(phrase: string, index: number = 0) {
    try {
      const seed = mnemonicToSeedSync(phrase, "");
      const path = `m/44'/501'/${index}'/0'`;
      const keypair = Keypair.fromSeed(
        derivePath(path, seed.toString("hex")).key
      );

      return {
        publicKey: keypair.publicKey.toBase58(),
        address: keypair.publicKey.toBase58(),
        derivationPath: path,
      };
    } catch (error) {
      throw new Error(
        "failed to create Solana wallet by index: " + (error as Error).message
      );
    }
  }

  async getBalance(publicKeyString: string) {
    try {
      const publicKey = new PublicKey(publicKeyString);
      const balance = await this.connection.getBalance(publicKey);
      const solBalance = balance / 1e9;
      return solBalance;
    } catch (error) {
      console.error("Error fetching Solana balance:", error);
      throw error;
    }
  }

  async #fetchTransactionsSequentially(signatures: any[]) {
    const transactions = [];
    const chunkSize = 10;

    for (let i = 0; i < signatures.length; i += chunkSize) {
      const chunk = signatures.slice(i, i + chunkSize);
      const promises = chunk.map(async (signature) => {
        let retries = 5;
        let delayMs = 300;
        while (retries > 0) {
          try {
            const transaction = await this.connection.getParsedTransaction(
              signature.signature,
              { maxSupportedTransactionVersion: 0 }
            );
            return transaction;
          } catch (error: any) {
            const errorMsg = error?.message || "";
            if (
              errorMsg.includes("429") ||
              errorMsg.includes("rate limit") ||
              errorMsg.includes("Too Many Requests")
            ) {
              console.warn(`[Solana] ParsedTransaction rate limited, retrying in ${delayMs}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              delayMs *= 2;
              retries--;
            } else {
              console.error("Failed to fetch transaction:", error);
              return null;
            }
          }
        }
        return null;
      });

      const results = await Promise.all(promises);
      for (const tx of results) {
        if (tx) {
          transactions.push(tx);
        }
      }
    }

    return transactions;
  }

  #extractTransactionDetails(
    transactionObject: TransactionObject,
    addressOfInterest: string
  ) {
    const hash = transactionObject.transaction.signatures[0];
    const uniqueId = uuid.v4().toString();
    const blockTime = transactionObject.blockTime;

    // Try standard parsed transfer instruction first
    const transferInstruction =
      transactionObject.transaction.message.instructions.find(
        (instruction) =>
          instruction.parsed && instruction.parsed.type === "transfer"
      );

    if (transferInstruction) {
      const info = transferInstruction.parsed.info;
      let direction = "other";
      if (info.source === addressOfInterest) {
        direction = "sent";
      } else if (info.destination === addressOfInterest) {
        direction = "received";
      }

      const from = info.source;
      const to = info.destination;
      const amountSentLamports = info.lamports;
      const value = amountSentLamports / 1000000000;

      return {
        uniqueId,
        from,
        to,
        hash,
        value,
        direction,
        blockTime: blockTime ? blockTime * 1000 : Date.now(), // Standardize to milliseconds
        asset: "SOL",
        chainId: 101,
      };
    }

    // Fallback: Calculate net balance change from preBalances and postBalances
    try {
      const accountKeys = transactionObject.transaction.message.accountKeys;
      const accountIndex = accountKeys.findIndex((acc: any) => {
        const pubkeyStr = typeof acc === "string" 
          ? acc 
          : (acc.pubkey?.toBase58?.() || acc.pubkey?.toString?.() || acc.toString?.());
        return pubkeyStr === addressOfInterest;
      });

      if (accountIndex !== -1 && transactionObject.meta) {
        const preBalance = transactionObject.meta.preBalances[accountIndex];
        const postBalance = transactionObject.meta.postBalances[accountIndex];
        const change = postBalance - preBalance; // in lamports

        if (change !== 0) {
          const value = Math.abs(change) / 1000000000;
          const direction = change < 0 ? "sent" : "received";
          
          // Determine from/to addresses
          const firstKey: any = accountKeys[0];
          const feePayer = typeof firstKey === "string" 
            ? firstKey 
            : (firstKey?.pubkey?.toBase58?.() || firstKey?.pubkey?.toString?.() || firstKey?.toBase58?.() || firstKey?.toString?.());
          
          const from = change < 0 ? addressOfInterest : (feePayer || "unknown");
          
          const secondKey: any = accountKeys[1];
          const to = change < 0 
            ? (secondKey ? (typeof secondKey === "string" ? secondKey : (secondKey.pubkey?.toBase58?.() || secondKey.pubkey?.toString?.() || secondKey.toBase58?.() || secondKey.toString?.())) : "unknown") 
            : addressOfInterest;

          return {
            uniqueId,
            from,
            to,
            hash,
            value,
            direction,
            blockTime: blockTime ? blockTime * 1000 : Date.now(), // Standardize to milliseconds
            asset: "SOL",
            chainId: 101,
          };
        }
      }
    } catch (e) {
      console.warn("[SolanaService] Fallback transaction extraction failed:", e);
    }

    // Default fallback for pure contract interactions / zero SOL balance change
    try {
      const firstKey: any = transactionObject.transaction.message.accountKeys[0];
      const feePayer = typeof firstKey === "string"
        ? firstKey
        : (firstKey?.pubkey?.toBase58?.() || firstKey?.pubkey?.toString?.() || firstKey?.toBase58?.() || firstKey?.toString?.());
      
      const isSent = feePayer === addressOfInterest;

      return {
        uniqueId,
        from: isSent ? addressOfInterest : (feePayer || "unknown"),
        to: isSent ? "Contract" : addressOfInterest,
        hash,
        value: 0,
        direction: isSent ? "sent" : "received",
        blockTime: blockTime ? blockTime * 1000 : Date.now(), // Standardize to milliseconds
        asset: "SOL",
        chainId: 101,
      };
    } catch (e) {
      return undefined;
    }
  }

  async getTransactionsByWallet(
    walletAddress: string,
    beforeSignature?: string,
    limit: number = 50
  ) {
    const publicKey = new PublicKey(walletAddress);
    let signatures: any;

    try {
      signatures = await this.connection.getSignaturesForAddress(publicKey, {
        before: beforeSignature,
        limit,
      });
    } catch (err) {
      console.error("Error fetching signatures:", err);
    }

    if (signatures) {
      try {
        const rawTransactions = await this.#fetchTransactionsSequentially(
          signatures
        );

        const transactions = rawTransactions
          .filter((tx: any) => tx != null)
          .map((tx: any) => this.#extractTransactionDetails(tx, walletAddress))
          .filter(Boolean)
          .sort((a: any, b: any) => b.blockTime - a.blockTime);
        return transactions;
      } catch (error) {
        console.error("Failed to process transactions:", error);
        return [];
      }
    }
  }

  async validateAddress(addr: string) {
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(addr);
      return await PublicKey.isOnCurve(publicKey.toBytes());
    } catch (err) {
      return false;
    }
  }

  async calculateTransactionFee(from: string, to: string, amount: number) {
    try {
      if (!from || !to || isNaN(amount) || amount <= 0) {
        return 5000;
      }
      const transaction = new Transaction();
      if (this.rpcUrl.includes("mainnet")) {
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 150000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500000 })
        );
      }
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(from),
          toPubkey: new PublicKey(to),
          lamports: Math.round(amount * LAMPORTS_PER_SOL),
        })
      );
      if (__DEV__) console.log("Estimating transaction fee for Solana:", transaction)
      let recentBlockhash = (
        await this.connection.getLatestBlockhash("finalized")
      ).blockhash;
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = new PublicKey(from);

      const response = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        "confirmed"
      );
      return response.value ?? 5000;
      
    } catch (err) {
      console.warn("Error fetching Solana transaction fee, using fallback 5000 lamports:", err);
      return 5000;
    }
  }

  async sendTransaction(secretKey: Uint8Array, to: string, amount: number) {
    try {
      const keyPair = Keypair.fromSecretKey(secretKey);
      const senderPubkey = keyPair.publicKey;
      const balance = await this.connection.getBalance(senderPubkey);
      const lamportsToSend = Math.round(amount * LAMPORTS_PER_SOL);

      if (balance < lamportsToSend) {
        throw new Error("Insufficient funds for the transaction");
      }

      // Check if sender is a data-bearing account (e.g. Nonce Account)
      const accountInfo = await this.connection.getAccountInfo(senderPubkey);
      const space = accountInfo ? accountInfo.data.length : 0;
      const rentExemptMin = (space + 128) * 6960;
      const isNonceAccount = space === 80
        && accountInfo?.owner.equals(SystemProgram.programId);

      // If it's a Nonce Account and balance <= rentExemptMin, regular transfer
      // will fail because fee deduction puts it below rent. Use NonceWithdraw.
      const useNonceWithdraw = isNonceAccount && balance <= rentExemptMin;

      const transaction = new Transaction();
      if (this.rpcUrl.includes("mainnet")) {
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 150000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 500000 })
        );
      }

      if (useNonceWithdraw) {
        // NonceWithdraw closes the account atomically, bypassing the
        // rent-exemption check that blocks regular transfers.
        transaction.add(
          SystemProgram.nonceWithdraw({
            noncePubkey: senderPubkey,
            authorizedPubkey: senderPubkey,
            toPubkey: new PublicKey(to),
            lamports: lamportsToSend,
          })
        );
      } else {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: new PublicKey(to),
            lamports: lamportsToSend,
          })
        );
      }

      const recentBlockhash = (
        await this.connection.getLatestBlockhash("finalized")
      ).blockhash;
      transaction.recentBlockhash = recentBlockhash;
      transaction.feePayer = senderPubkey;

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [keyPair]
      );
      return signature;
    } catch (err) {
      console.error("Error sending Solana transaction:", err);
      throw err;
    }
  }

  async derivePrivateKeysFromPhrase(mnemonicPhrase: string, path: string) {
    if (!mnemonicPhrase) {
      throw new Error("Empty mnemonic phrase ");
    }
    if (!validateMnemonic(mnemonicPhrase)) {
      throw new Error("Invalid mnemonic phrase ");
    }

    try {
      const seed = mnemonicToSeedSync(mnemonicPhrase, "");
      const keypair = Keypair.fromSeed(
        derivePath(path, seed.toString("hex")).key
      );

      return keypair.secretKey;
    } catch (error) {
      throw new Error(
        "Failed to derive wallet from mnemonic: " + (error as Error).message
      );
    }
  }

  async findNextUnusedWalletIndex(
    mnemonicPhrase: string,
    indexOffset: number = 0
  ) {
    if (!mnemonicPhrase) {
      throw new Error("Empty mnemonic phrase ");
    }

    if (!validateMnemonic(mnemonicPhrase)) {
      throw new Error("Invalid mnemonic phrase ");
    }

    const GAP_LIMIT = 5;
    const seed = mnemonicToSeedSync(mnemonicPhrase, "");

    // Scan both mainnet and devnet to find all accounts
    const connections = [
      this.connection, // current network
      new Connection("https://mainnet.helius-rpc.com/?api-key=4ea6a1a7-e963-4e68-8b02-5e072f7e77a8", "confirmed"),
      new Connection("https://api.devnet.solana.com", "confirmed"),
    ];

    const connectionFailureCounts = new Map<Connection, number>();
    let currentIndex = indexOffset;
    let lastUsedIndex = -1;
    let consecutiveUnused = 0;
    const BATCH_SIZE = 5;

    while (consecutiveUnused < GAP_LIMIT) {
      // Filter out connections that have failed 2 or more times
      const activeConnections = connections.filter(c => (connectionFailureCounts.get(c) || 0) < 2);
      if (activeConnections.length === 0) {
        activeConnections.push(connections[0]); // Always keep at least the primary connection
      }

      const batchIndices = Array.from({ length: BATCH_SIZE }, (_, i) => currentIndex + i);
      const batchPublicKeys = batchIndices.map(idx => {
        const path = `m/44'/501'/${idx}'/0'`;
        const keypair = Keypair.fromSeed(derivePath(path, seed.toString("hex")).key);
        return { index: idx, publicKey: keypair.publicKey };
      });

      // Check all batch addresses in parallel
      const batchResults = await Promise.all(batchPublicKeys.map(async ({ index: idx, publicKey }) => {
        let isUsed = false;

        const checks = activeConnections.map(async (conn) => {
          let timeoutId: NodeJS.Timeout | null = null;
          try {
            // Add a 2000ms timeout to each check to prevent slow connections from hanging
            const result = await Promise.race([
              Promise.all([
                conn.getBalance(publicKey),
                conn.getSignaturesForAddress(publicKey, { limit: 1 })
              ]),
              new Promise<any>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("Timeout")), 2000);
              })
            ]);
            
            const [balance, signatures] = result;
            return balance > 0 || signatures.length > 0;
          } catch (err) {
            const currentFailures = connectionFailureCounts.get(conn) || 0;
            connectionFailureCounts.set(conn, currentFailures + 1);
            return false;
          } finally {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          }
        });

        const results = await Promise.all(checks);
        isUsed = results.some(Boolean);
        return { index: idx, isUsed };
      }));

      // Process results in order
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

    // Return: lastUsedIndex + 2 to include the last used index in collection
    // (collectedUsedAddresses uses <= startingIndex which is unusedIndex - 1)
    return lastUsedIndex >= 0 ? lastUsedIndex + 2 : 0;
  }

  async collectedUsedAddresses(mnemonicPhrase: string, unusedIndex: number) {
    const startingIndex = unusedIndex > 0 ? unusedIndex - 1 : unusedIndex;
    const seed = mnemonicToSeedSync(mnemonicPhrase, "");
    const keyPairsUsed = [];

    for (let i = 0; i <= startingIndex; i++) {
      const path = `m/44'/501'/${i}'/0'`;
      const keypair = Keypair.fromSeed(
        derivePath(path, seed.toString("hex")).key
      );
      const normalizedKeyPair = {
        publicKey: keypair.publicKey.toBase58(),
      };
      const keypairWithDetails = {
        ...normalizedKeyPair,
        derivationPath: path,
      };
      keyPairsUsed.push(keypairWithDetails);
    }

    return keyPairsUsed;
  }

  async importAllActiveAddresses(mnemonicPhrase: string, offsetIndex?: number) {
    if (offsetIndex) {
      const usedAddresses = await this.collectedUsedAddresses(
        mnemonicPhrase,
        offsetIndex
      );
      return usedAddresses;
    } else {
      const unusedAddressIndex = await this.findNextUnusedWalletIndex(
        mnemonicPhrase
      );
      const usedAddresses = await this.collectedUsedAddresses(
        mnemonicPhrase,
        unusedAddressIndex
      );
      return usedAddresses;
    }
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      // Poll for confirmation instead of using signatureSubscribe (not supported by Alchemy)
      const maxRetries = 30;
      const delayMs = 2000;

      for (let i = 0; i < maxRetries; i++) {
        const status = await this.connection.getSignatureStatus(signature);

        if (status?.value?.err) {
          console.error("Transaction failed:", status.value.err);
          return false;
        }

        if (
          status?.value?.confirmationStatus === "confirmed" ||
          status?.value?.confirmationStatus === "finalized"
        ) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      console.warn("Transaction confirmation timed out");
      return false;
    } catch (error) {
      console.error("Error confirming Solana transaction:", error);
      return false;
    }
  }

  async getSolanaSendLimits(fromAddress: string, feeLamports: number, totalBalanceLamports: number) {
    try {
      const pubkey = new PublicKey(fromAddress);
      const info = await this.connection.getAccountInfo(pubkey);
      const space = info ? info.data.length : 0;
      const rentExemptMinimum = (space + 128) * 6960;

      // For data-bearing accounts (space > 0): the fee payer must remain
      // rent-exempt after fee deduction, OR be exactly 0.
      // If balance <= rentExemptMinimum, even the base fee (5000 lamports)
      // would put the account below rent but above 0 → "InsufficientFundsForFee".
      // This account is rent-locked: NO transaction can be sent from it.
      const isRentLocked = space > 0 && totalBalanceLamports <= rentExemptMinimum;

      let maxSendable = 0;
      if (isRentLocked) {
        maxSendable = 0;
      } else if (space > 0) {
        // Data account with balance above rent: can send down to rent minimum
        maxSendable = totalBalanceLamports - feeLamports - rentExemptMinimum;
      } else {
        // Normal account (no data): can empty to 0
        maxSendable = totalBalanceLamports - feeLamports;
      }

      return {
        rentExemptMinimum,
        maxSendable: Math.max(maxSendable, 0),
        isRentLocked,
        space,
      };
    } catch (err) {
      console.error("Error fetching Solana send limits:", err);
      return {
        rentExemptMinimum: 890880,
        maxSendable: Math.max(totalBalanceLamports - feeLamports, 0),
        isRentLocked: false,
        space: 0,
      };
    }
  }

}
// https://devnet.helius-rpc.com/?api-key=800c9b64-37ba-4cd3-a7e9-807406f383a9
// const  EXPO_PUBLIC_ALCHEMY_SOL_URL = "https://solana-devnet.g.alchemy.com/v2/"
const  EXPO_PUBLIC_ALCHEMY_SOL_URL = "https://devnet.helius-rpc.com/?api-key="
//  const  EXPO_PUBLIC_ALCHEMY_SOL_API_KEY = "iQ_8RwrWNQWD7MLe5YNZJ"
const  EXPO_PUBLIC_ALCHEMY_SOL_API_KEY = "800c9b64-37ba-4cd3-a7e9-807406f383a9"
const customRpcUrl =
  EXPO_PUBLIC_ALCHEMY_SOL_URL + EXPO_PUBLIC_ALCHEMY_SOL_API_KEY;

const solanaService = new SolanaService(customRpcUrl);
export default solanaService;
