import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  Commitment,
} from "@solana/web3.js";

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";


/* ---------------- CONFIG ---------------- */

export let heliusRpc = "https://devnet.helius-rpc.com/?api-key=800c9b64-37ba-4cd3-a7e9-807406f383a9";

export let connection = new Connection(heliusRpc, "confirmed");

export function setSolTokenNetwork(network: "mainnet" | "devnet") {
  const newRpc = network === "mainnet"
    ? "https://mainnet.helius-rpc.com/?api-key=4ea6a1a7-e963-4e68-8b02-5e072f7e77a8"
    : "https://devnet.helius-rpc.com/?api-key=800c9b64-37ba-4cd3-a7e9-807406f383a9";
  
  if (heliusRpc !== newRpc) {
    heliusRpc = newRpc;
    connection = new Connection(newRpc, "confirmed");
  }
}

/* ---------------- TYPES ---------------- */

export interface SolBalance {
  lamports: number;
  sol: number;
}

export interface SplTokenInfo {
  mint: string;
  ata: string;
  amount: number;
  decimals: number;
}

export interface SplTokenAccount {
  mint: string;
  amount: number;
  decimals: number;
}

export interface WalletNFT {
  mint: string;
  name?: string;
  uri?: string;
  image?: string;
}

/* ---------------- SOL ---------------- */

export async function getSolBalance(
  address: string
): Promise<SolBalance> {
  const pubkey = new PublicKey(address);
  const lamports = await connection.getBalance(pubkey);

  return {
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
  };
}

/* ---------------- SPL TOKEN (Single) ---------------- */

export async function getSplTokenBalance(
  wallet: string,
  mint: string,
  programIdOption?: string | PublicKey
): Promise<SplTokenInfo | null> {
  try {
    const walletPubkey = new PublicKey(wallet);
    const mintPubkey = new PublicKey(mint);

    let programId: PublicKey;
    if (programIdOption) {
      programId = typeof programIdOption === "string" ? new PublicKey(programIdOption) : programIdOption;
    } else {
      programId = await resolveTokenProgramId(mint);
    }

    const ata = await getAssociatedTokenAddress(
      mintPubkey,
      walletPubkey,
      false,
      programId
    );

    try {
      const balance = await connection.getTokenAccountBalance(ata);
      return {
        mint,
        ata: ata.toBase58(),
        amount: balance.value.uiAmount ?? 0,
        decimals: balance.value.decimals,
      };
    } catch {
      // Return 0 balance with dynamic/default decimals if ATA account is not initialized yet
      return {
        mint,
        ata: ata.toBase58(),
        amount: 0,
        decimals: 9,
      };
    }
  } catch {
    return null;
  }
}

/* ---------------- SPL TOKEN TRANSFER FEE ---------------- */

export async function calculateSplTokenTransactionFee(params: {
  mint: string;
  fromPubkey: PublicKey;
  toAddress: string;
  amount: number;
  decimals: number;
}): Promise<{
  lamports: number;
  sol: number;
}> {
  const { mint, fromPubkey, toAddress, amount, decimals } = params;

  const mintPubkey = new PublicKey(mint);
  const toPubkey = new PublicKey(toAddress);

  // Detect token program
  const mintAccountInfo = await connection.getAccountInfo(mintPubkey);
  const programId = mintAccountInfo?.owner || TOKEN_PROGRAM_ID;

  const senderAta = await getAssociatedTokenAddress(
    mintPubkey,
    fromPubkey,
    false,
    programId
  );

  const receiverAta = await getAssociatedTokenAddress(
    mintPubkey,
    toPubkey,
    false,
    programId
  );

  const instructions = [];

  const receiverInfo = await connection.getAccountInfo(receiverAta);
  if (!receiverInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        fromPubkey,
        receiverAta,
        toPubkey,
        mintPubkey,
        programId
      )
    );
  }

  const amountInBaseUnits = BigInt(
    Math.round(amount * Math.pow(10, decimals))
  );

  instructions.push(
    createTransferCheckedInstruction(
      senderAta,
      mintPubkey,
      receiverAta,
      fromPubkey,
      amountInBaseUnits,
      decimals,
      [],
      programId
    )
  );

  const tx = new Transaction().add(...instructions);
  tx.feePayer = fromPubkey;

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  const fee = await connection.getFeeForMessage(
    tx.compileMessage()
  );

  const lamports = fee.value ?? 0;

  return {
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
  };
}

/* ---------------- SPL TOKENS (ALL) ---------------- */

export async function getAllSplTokens(
  wallet: string
): Promise<SplTokenAccount[]> {
  const walletPubkey = new PublicKey(wallet);

  const [tokenAccounts, token2022Accounts] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(walletPubkey, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(walletPubkey, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];

  return allAccounts.map(acc => {
    const info = acc.account.data.parsed.info;
    return {
      mint: info.mint,
      amount: info.tokenAmount.uiAmount ?? 0,
      decimals: info.tokenAmount.decimals,
    };
  });
}

/* ---------------- NFTs (Helius DAS) ---------------- */

export async function getWalletNFTs(
  wallet: string
): Promise<WalletNFT[]> {
  const res = await fetch(heliusRpc, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "nfts",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: wallet,
        page: 1,
        limit: 100,
      },
    }),
  });

  const json = await res.json();

  if (!json?.result?.items) return [];

  return json.result.items.map((nft: any) => ({
    mint: nft.id,
    name: nft.content?.metadata?.name || nft.content?.metadata?.symbol || "Unnamed NFT",
    uri: nft.content?.json_uri,
    image: nft.content?.links?.image || nft.content?.files?.[0]?.uri || undefined,
  }));
}

/* ---------------- SEND SPL TOKEN ---------------- */

export async function sendSplToken(
  params: {
    mint: string;
    fromKeypair: Keypair;
    toAddress: string;
    amount: number;
    decimals: number;
  }
): Promise<{ signature: string }> {
  const { mint, fromKeypair, toAddress, amount, decimals } = params;

  const fromPubkey = fromKeypair.publicKey;
  const toPubkey = new PublicKey(toAddress);
  const mintPubkey = new PublicKey(mint);

  // Detect token program
  const mintAccountInfo = await connection.getAccountInfo(mintPubkey);
  const programId = mintAccountInfo?.owner || TOKEN_PROGRAM_ID;

  const senderAta = await getAssociatedTokenAddress(
    mintPubkey,
    fromPubkey,
    false,
    programId
  );

  const receiverAta = await getAssociatedTokenAddress(
    mintPubkey,
    toPubkey,
    false,
    programId
  );

  const instructions = [];

  const receiverInfo = await connection.getAccountInfo(receiverAta);
  if (!receiverInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        fromPubkey,
        receiverAta,
        toPubkey,
        mintPubkey,
        programId
      )
    );
  }

  const amountInBaseUnits = BigInt(
    Math.round(amount * Math.pow(10, decimals))
  );

  instructions.push(
    createTransferCheckedInstruction(
      senderAta,
      mintPubkey,
      receiverAta,
      fromPubkey,
      amountInBaseUnits,
      decimals,
      [],
      programId
    )
  );

  const tx = new Transaction().add(...instructions);

  const signature = await sendAndConfirmTransaction(
    connection,
    tx,
    [fromKeypair]
  );

  return { signature };
}

/* ---------------- DYNAMIC PROGRAM RESOLUTION ---------------- */

export async function resolveTokenProgramId(mintAddress: string): Promise<PublicKey> {
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const accountInfo = await connection.getAccountInfo(mintPubkey);
    if (accountInfo?.owner) {
      return accountInfo.owner;
    }
  } catch (err) {
    if (__DEV__) console.log("resolveTokenProgramId failed:", err);
  }
  return TOKEN_PROGRAM_ID;
}

/* ---------------- GET SPL TOKEN METADATA ---------------- */

export async function getSplTokenMetadata(
  mint: string,
  network: "mainnet" | "devnet"
): Promise<{ name: string; symbol: string; decimals: number; logo?: string; programId: string }> {
  try {
    const resolvedProgram = await resolveTokenProgramId(mint);
    const programIdStr = resolvedProgram.toBase58();

    // Tier 1: Jupiter Token API for Mainnet (Free, fast, rich metadata)
    if (network === "mainnet") {
      try {
        const response = await fetch(`https://api.jup.ag/tokens/v2/search?query=${mint}`, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "x-api-key": "jup_331469eee25f5af28c5b4b6936882531ec6c6bfeb5a68d59bc17189c990bcf9d",
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const token = data[0];
            if (token && token.symbol) {
              return {
                name: token.name || token.symbol,
                symbol: token.symbol,
                decimals: token.decimals ?? 9,
                logo: token.icon || undefined,
                programId: token.tokenProgram || programIdStr,
              };
            }
          }
        }
      } catch (err) {
        if (__DEV__) console.log("Jupiter API failed:", err);
      }
    }

    // Tier 2: Helius DAS getAsset API (Supports Devnet, Token-2022, Token-2025)
    try {
      const currentRpc = network === "mainnet"
        ? "https://mainnet.helius-rpc.com/?api-key=4ea6a1a7-e963-4e68-8b02-5e072f7e77a8"
        : "https://devnet.helius-rpc.com/?api-key=800c9b64-37ba-4cd3-a7e9-807406f383a9";

      const res = await fetch(currentRpc, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "get-asset",
          method: "getAsset",
          params: { id: mint }
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.result) {
          const result = json.result;
          const tokenInfo = result.token_info;
          const metadata = result.content?.metadata;
          const links = result.content?.links;

          if (tokenInfo || metadata) {
            return {
              name: metadata?.name || tokenInfo?.symbol || "Unknown Token",
              symbol: metadata?.symbol || tokenInfo?.symbol || "SPL",
              decimals: tokenInfo?.decimals ?? 9,
              logo: links?.image || result.content?.files?.[0]?.uri || undefined,
              programId: programIdStr,
            };
          }
        }
      }
    } catch (err) {
      if (__DEV__) console.log("Helius DAS failed:", err);
    }

    // Tier 3: On-Chain parsed fallback (Query Connection for Decimals)
    try {
      const mintPubkey = new PublicKey(mint);
      const accountInfo = await connection.getParsedAccountInfo(mintPubkey);
      if (accountInfo?.value?.data) {
        const data = accountInfo.value.data as any;
        if (data.parsed?.info) {
          const decimals = data.parsed.info.decimals ?? 9;
          return {
            name: "Unknown Token",
            symbol: "SPL",
            decimals,
            logo: undefined,
            programId: programIdStr,
          };
        }
      }
    } catch (err) {
      if (__DEV__) console.log("On-chain parsed fallback failed:", err);
    }

    // Default Fallback
    return {
      name: "Unknown Token",
      symbol: "SPL",
      decimals: 9,
      logo: undefined,
      programId: programIdStr,
    };
  } catch (err) {
    if (__DEV__) console.log("getSplTokenMetadata overall failed:", err);
    return {
      name: "Unknown Token",
      symbol: "SPL",
      decimals: 9,
      logo: undefined,
      programId: TOKEN_PROGRAM_ID.toBase58(),
    };
  }
}
