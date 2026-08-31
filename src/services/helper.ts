import axios from "axios";
import NETWORKS from "./defaultNetwork";
import { ethers } from "ethers";
export type UnifiedNftType = "ERC721" | "ERC1155" | "ERC404";

export interface INFT {
  chainId: number;
  tokenId: string;
  name?: string;
  imageUrl?: string;
}
export interface Transfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  category: string;
  direction: "received" | "sent"; // strict union
  type: "NORMAL" | "TOKEN" | "ERC20/ERC721/ERC1155";
  blockNumber: number;
  timestamp?: number; // timestamp in seconds
}
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT = 15000;

function normalizeAlchemyImage(nft: any): string | undefined {
  return (
    nft.image?.cachedUrl ||
    nft.image?.gateway ||
    nft.media?.[0]?.gateway ||
    nft.metadata?.image ||
    undefined
  );
}

export async function getAllWalletNfts(
  address: string,
  chainId: number
): Promise<INFT[]> {
  const network = NETWORKS.find(n => n.chainId === chainId);
  if (!network) throw new Error(`Network not found for chainId ${chainId}`);
if (__DEV__) console.log("network",network)
  try {
    if (chainId === 34|| chainId === 3434) {
      const res = await axios.get(
        `${network.nftRpcUrl}/addresses/${address}/nft`,
        {
          params: {
            type: ["ERC-721", "ERC-1155", "ERC-404"].join(","),
          },
          timeout: REQUEST_TIMEOUT,
        }
      );

      return (res.data?.items ?? []).map((nft: any): INFT => ({
        chainId,
        tokenId: nft.id,
        name: nft.metadata?.name,
        imageUrl: nft.image_url ?? undefined,
      }));
    }

    if (!network.nftRpcUrl) return [];

    let pageKey: string;
    const allNFTs: INFT[] = [];

    do {
      const { data } = await axios.get(network.nftRpcUrl, {
        params: {
          owner: address,
          withMetadata: true,
          pageSize: PAGE_SIZE,
          pageKey,
        },
        headers: { accept: "application/json" },
        timeout: REQUEST_TIMEOUT,
      });

      const ownedNfts = data?.ownedNfts ?? [];

      allNFTs.push(
        ...ownedNfts.map((nft: any): INFT => ({
          chainId,
          tokenId: nft.tokenId,
          name: nft.name ?? nft.metadata?.name,
          imageUrl: normalizeAlchemyImage(nft),
        }))
      );

      pageKey = data?.pageKey;
    } while (pageKey);

    return allNFTs; 
  } catch (err: any) {
    // Only log critical errors, suppress 404/network errors to avoid red boxes
    if (err.response?.status !== 404) {
      console.warn(`[getAllWalletNfts] Error for chain ${chainId}:`, err?.message || err);
    }
    return [];
  }
}
// ----------------- Blockscout v2 Mappings -----------------
const BLOCKSCOUT_APIS: Record<number, string> = {
  100: "https://gnosis.blockscout.com/api",
  42220: "https://celo.blockscout.com/api",
  11142220: "https://celo-sepolia.blockscout.com/api",
  43114: "https://avalanche.blockscout.com/api",
  43113: "https://avalanche-fuji.blockscout.com/api",
  324: "https://zksync.blockscout.com/api",
  300: "https://zksync-sepolia.blockscout.com/api",
  59144: "https://explorer.linea.build/api",
  59141: "https://linea-sepolia.blockscout.com/api",
  534352: "https://scroll.blockscout.com/api",
  534351: "https://scroll-sepolia.blockscout.com/api",
  81457: "https://blast.blockscout.com/api",
};

// Chains where Alchemy's alchemy_getAssetTransfers is supported
const ALCHEMY_SUPPORTED_CHAINS = new Set([
  1,        // Ethereum Mainnet
  11155111, // Ethereum Sepolia
  137,      // Polygon Mainnet
  80002,    // Polygon Amoy
  42161,    // Arbitrum Mainnet
  421614,   // Arbitrum Sepolia
  10,       // Optimism Mainnet
  11155420, // Optimism Sepolia
  8453,     // Base Mainnet
  84532,    // Base Sepolia
]);

// Helper to deduplicate native asset transfers returned as token transfers
function deduplicateTransfers(transfers: Transfer[], chainId: number): Transfer[] {
  const nativeSymbol = NETWORKS.find(n => n.chainId === chainId)?.symbol;
  if (!nativeSymbol) return transfers;

  const normalHashes = new Set(
    transfers.filter(tx => tx.type === "NORMAL").map(tx => tx.hash.toLowerCase())
  );

  return transfers.filter(tx => {
    if (tx.type !== "NORMAL") {
      const isNativeToken =
        tx.category?.toUpperCase() === nativeSymbol.toUpperCase() ||
        ((chainId === 42220 || chainId === 11142220) && tx.category?.toLowerCase() === "celo native asset");
      
      if (isNativeToken && normalHashes.has(tx.hash.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

// ----------------- Fetch Transfers -----------------
export async function fetchTransfers(chainId: number, wallet: string, explorerUrl?: string): Promise<Transfer[]> {
  const transfers = await fetchTransfersInternal(chainId, wallet, explorerUrl);
  return deduplicateTransfers(transfers, chainId);
}

async function fetchTransfersInternal(chainId: number, wallet: string, explorerUrl?: string): Promise<Transfer[]> {
  const network = NETWORKS.find(n => n.chainId === chainId);
  const effectiveExplorerUrl = explorerUrl || network?.explorerUrl;
  
  // if (__DEV__) console.log("chainId", chainId, wallet, "explorer", effectiveExplorerUrl);
  
  const isSecureChain = chainId === 34 || chainId === 3434;

  // 1. ----------------- Blockscout API v2 (Highly preferred for supported non-core/testnet chains) -----------------
  const blockscoutApiUrl = BLOCKSCOUT_APIS[chainId];
  if (blockscoutApiUrl) {
    try {
      let normalTxs: Transfer[] = [];
      let tokenTxs: Transfer[] = [];

      try {
        const res = await axios.get(`${blockscoutApiUrl}/v2/addresses/${wallet}/transactions`, { timeout: 10000 });
        const items = res.data?.items || [];
        normalTxs = items.map((item: any): Transfer => ({
          hash: item.hash,
          from: item.from?.hash || "",
          to: item.to?.hash || "",
          value: ethers.formatEther(item.value ?? "0"),
          category: "NORMAL",
          direction: (item.from?.hash?.toLowerCase() === wallet.toLowerCase() ? "sent" : "received") as "received" | "sent",
          type: "NORMAL",
          blockNumber: Number(item.block ?? 0),
          timestamp: item.timestamp ? new Date(item.timestamp).getTime() / 1000 : undefined
        }));
      } catch (err: any) {
        if (__DEV__) console.warn(`[Blockscout] Failed normal txs fetch for chain ${chainId}:`, err.message || err);
      }

      try {
        const res = await axios.get(`${blockscoutApiUrl}/v2/addresses/${wallet}/token-transfers`, { timeout: 10000 });
        const items = res.data?.items || [];
        tokenTxs = items.map((item: any): Transfer => ({
          hash: item.transaction_hash || item.tx_hash || item.hash || "",
          from: item.from?.hash || "",
          to: item.to?.hash || "",
          value: ethers.formatUnits(item.total?.value || item.value || "0", Number(item.token?.decimals || 18)),
          category: item.token?.symbol || "TOKEN",
          direction: (item.from?.hash?.toLowerCase() === wallet.toLowerCase() ? "sent" : "received") as "received" | "sent",
          type: "ERC20/ERC721/ERC1155",
          blockNumber: Number(item.block_number || item.block || 0),
          timestamp: item.timestamp ? new Date(item.timestamp).getTime() / 1000 : undefined
        }));
      } catch (err: any) {
        if (__DEV__) console.warn(`[Blockscout] Failed token txs fetch for chain ${chainId}:`, err.message || err);
      }

      const allTransfers = [...normalTxs, ...tokenTxs];
      if (allTransfers.length > 0) {
        return allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);
      }
    } catch (err: any) {
      if (__DEV__) console.warn(`[Blockscout] Failed general fetch for chain ${chainId}:`, err.message || err);
    }
  }

  // 2. ----------------- Alchemy-style (For core chains only) -----------------
  const isAlchemy =
    !isSecureChain &&
    ALCHEMY_SUPPORTED_CHAINS.has(chainId) &&
    network?.rpcUrl.includes("alchemy.com");

  if (isAlchemy && network) {
    try {
      const outgoing = await axios.post(network.rpcUrl, {
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [{ 
          fromBlock: "0x0",
          toBlock: "latest",
          fromAddress: wallet,
          category: ["external","erc20","erc721","erc1155"],
          maxCount: "0x3e8",
          withMetadata: true
        }]
      });

      const incoming = await axios.post(network.rpcUrl, {
        jsonrpc: "2.0",
        id: 2,
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock: "0x0",
          toBlock: "latest",
          toAddress: wallet,
          category: ["external","erc20","erc721","erc1155"],
          maxCount: "0x3e8",
          withMetadata: true
        }]
      });

      const allTransfers: Transfer[] = [
        ...(outgoing.data.result?.transfers || []),
        ...(incoming.data.result?.transfers || [])
      ].map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value ?? "N/A (ERC721/ERC1155)",
        category: tx.category,
        direction: (tx.from.toLowerCase() === wallet.toLowerCase() ? "sent" : "received") as "received" | "sent",
        type: "ERC20/ERC721/ERC1155",
        blockNumber: parseInt(tx.blockNum, 16),
        timestamp: tx.metadata?.blockTimestamp ? new Date(tx.metadata.blockTimestamp).getTime() / 1000 : undefined
      }));

      return allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);

    } catch (err:any) {
      console.error(`[ChainId ${chainId}] Alchemy fetch error:`, err.message || err);
      return [];
    }
  }

  // 3. ----------------- Explorer-style (Etherscan/Blockscout Fallback) -----------------
  if (effectiveExplorerUrl || isSecureChain) {
    let baseUrl = effectiveExplorerUrl ? 
      (effectiveExplorerUrl.endsWith("/") ? effectiveExplorerUrl.slice(0, -1) : effectiveExplorerUrl) : 
      "https://explorer.securechain.ai";
    
    // Most explorers expose the API at /api
    let apiEndpoint = `${baseUrl}/api`;

    // Intelligent check: if it's a known explorer that uses 'api.' subdomain (like Monadscan, Etherscan)
    if (baseUrl.includes("monadscan.com") && !baseUrl.includes("api.")) {
      apiEndpoint = "https://api.monadscan.com/api";
    } else if (baseUrl.includes("bscscan.com")) {
      if (baseUrl.includes("testnet")) {
        apiEndpoint = "https://api-testnet.bscscan.com/api";
      } else {
        apiEndpoint = "https://api.bscscan.com/api";
      }
    }

    try {
      // Helper to try a request and return results sequentially with try-catch and 429 support
      const tryFetch = async (endpoint: string) => {
        let retries = 3;
        let delayMs = 500;
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        };
        
        while (retries > 0) {
          try {
            let normalResult: any[] = [];
            let tokenResult: any[] = [];
            let isDeprecated = false;

            // Fetch normal transactions
            try {
              const normalRes = await axios.get(`${endpoint}?module=account&action=txlist&address=${wallet}&sort=desc`, { headers, timeout: 8000 });
              if (typeof normalRes.data.result === "string" && normalRes.data.result.includes("deprecated V1")) {
                isDeprecated = true;
              } else if (Array.isArray(normalRes.data.result)) {
                normalResult = normalRes.data.result;
              }
            } catch (e: any) {
              if (e.response?.status === 429) throw e; // bubble up 429 to retry
              if (__DEV__) console.warn(`[tryFetch] txlist failed:`, e.message || e);
            }

            if (isDeprecated) return null;

            // Wait a small delay to avoid hitting keyless concurrent limits on Etherscan APIs
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Fetch token transactions
            try {
              const tokenRes = await axios.get(`${endpoint}?module=account&action=tokentx&address=${wallet}&sort=desc`, { headers, timeout: 8000 });
              if (Array.isArray(tokenRes.data.result)) {
                tokenResult = tokenRes.data.result;
              }
            } catch (e: any) {
              if (e.response?.status === 429) throw e; // bubble up 429 to retry
              if (__DEV__) console.warn(`[tryFetch] tokentx failed:`, e.message || e);
            }

            return { normal: normalResult, token: tokenResult };
          } catch (e: any) {
            const status = e.response?.status;
            if (status === 429) {
              console.warn(`[tryFetch] Rate limit (429) on ${endpoint}. Retrying after ${delayMs}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              delayMs *= 2;
              retries--;
            } else {
              return null;
            }
          }
        }
        return null;
      };

      let res = await tryFetch(apiEndpoint);
      if (!res) {
        const v2 = apiEndpoint.replace(/\/api$/, "/api/v2");
        if (__DEV__) console.log(`⚠️  V1 Deprecated, trying V2: ${v2}`);
        res = await tryFetch(v2);
      }

      const normalTxs = res?.normal || [];
      const tokenTxs = res?.token || [];

      const allTxs: Transfer[] = [
        ...(Array.isArray(normalTxs) ? normalTxs : []).map((tx: any): Transfer => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value ?? "0"), 
          category: "NORMAL",
          direction:
            tx.from.toLowerCase() === wallet.toLowerCase()
              ? "sent"
              : "received", 
          type: "NORMAL",
          blockNumber: Number(tx.blockNumber),
          timestamp: tx.timeStamp ? Number(tx.timeStamp) : undefined,
        })),

        ...(Array.isArray(tokenTxs) ? tokenTxs : []).map((tx: any): Transfer => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.formatUnits(
            tx.value ?? "0",
            Number(tx.tokenDecimal ?? 18)
          ), 
          category: tx.tokenName || "TOKEN",
          direction:
            tx.from.toLowerCase() === wallet.toLowerCase()
              ? "sent"
              : "received",
          type: "ERC20/ERC721/ERC1155", 
          blockNumber: Number(tx.blockNumber),
          timestamp: tx.timeStamp ? Number(tx.timeStamp) : undefined,
        })),
      ];

      // If we got zero transactions from the API but explorerUrl is available, we try HTML scraping as a highly robust fallback
      if (allTxs.length === 0 && effectiveExplorerUrl) {
        try {
          if (__DEV__) console.log(`ℹ️ API returned no transactions. Attempting HTML scraping from explorer: ${effectiveExplorerUrl}/address/${wallet}`);
          const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
          };
          const response = await axios.get(`${effectiveExplorerUrl}/address/${wallet}`, { headers, timeout: 15000 });
          const html = response.data;
          const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) || [];
          
          for (const row of rows) {
            const txHashMatch = row.match(/href='\/tx\/(0x[a-fA-F0-9]{64})'/);
            if (!txHashMatch) continue;

            const hash = txHashMatch[1];
            
            // Block number
            const blockMatch = row.match(/href='\/block\/(\d+)'/);
            const blockNumber = blockMatch ? parseInt(blockMatch[1]) : 0;

            // Extract full addresses from clipboard attributes
            const addressMatches = [...row.matchAll(/data-clipboard-text='(0x[a-fA-F0-9]{40})'/ig)].map(m => m[1]);
            const from = addressMatches[0] || wallet;
            const to = addressMatches[1] || wallet;

            // Direction
            const direction = from.toLowerCase() === wallet.toLowerCase() ? "sent" : "received";

            // Value & Td Texts
            const rawTds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
            const tdMatches = rawTds.map(td => td.replace(/<[^>]*>/g, '').trim());
            
            // Find value by checking for currencies or numbers
            let value = "0";
            for (const tdText of tdMatches) {
              if (tdText.includes("BNB") || tdText.includes("ETH") || tdText.includes("SCAI") || tdText.includes("SCAIP")) {
                value = tdText.replace(/(BNB|ETH|SCAIP|SCAI)/g, "").trim();
                break;
              }
            }

            // Extract timestamp from HTML age column (relative age or absolute title)
            let timestamp: number = Date.now() / 1000;
            for (const td of rawTds) {
              const cleanText = td.replace(/<[^>]*>/g, '').trim();
              
              if (/ago/i.test(cleanText)) {
                const titleMatch = td.match(/title=['"]([^'"]+)['"]/);
                if (titleMatch) {
                  let dateStr = titleMatch[1].trim();
                  if (!/utc|gmt|z|[+-]\d{2}/i.test(dateStr)) {
                    dateStr += " UTC";
                  }
                  const parsed = Date.parse(dateStr);
                  if (!isNaN(parsed)) {
                    timestamp = parsed / 1000;
                    break;
                  }
                }
                
                const ageRegex = /(\d+)\s*(sec|second|min|minute|hr|hour|day|week|month|year|yr)s?\s*ago/i;
                const match = cleanText.match(ageRegex);
                if (match) {
                  const amount = parseInt(match[1]);
                  const unit = match[2].toLowerCase();
                  let seconds = 0;
                  if (unit.startsWith("sec")) seconds = amount;
                  else if (unit.startsWith("min")) seconds = amount * 60;
                  else if (unit.startsWith("hr") || unit.startsWith("ho")) seconds = amount * 3600;
                  else if (unit.startsWith("day")) seconds = amount * 86400;
                  else if (unit.startsWith("week")) seconds = amount * 86400 * 7;
                  else if (unit.startsWith("month")) seconds = amount * 86400 * 30;
                  else if (unit.startsWith("year") || unit.startsWith("yr")) seconds = amount * 86400 * 365;
                  
                  timestamp = (Date.now() - (seconds * 1000)) / 1000;
                  break;
                }
              }

              const isDateStr = /\d{4}-\d{2}-\d{2}/.test(cleanText) || /[A-Za-z]{3}-\d{2}-\d{4}/.test(cleanText);
              if (isDateStr) {
                let dateStr = cleanText;
                if (!/utc|gmt|z|[+-]\d{2}/i.test(dateStr)) {
                  dateStr += " UTC";
                }
                const parsed = Date.parse(dateStr);
                if (!isNaN(parsed)) {
                  timestamp = parsed / 1000;
                  break;
                }
              }
            }

            allTxs.push({
              hash,
              from,
              to,
              value,
              category: "NORMAL",
              direction: direction as "received" | "sent",
              type: "NORMAL",
              blockNumber,
              timestamp
            });
          }
        } catch (scrapeErr: any) {
          console.warn(`[ChainId ${chainId}] HTML scraping fallback failed:`, scrapeErr?.message || scrapeErr);
        }
      }

      return allTxs.sort((a, b) => b.blockNumber - a.blockNumber);
    } catch (err: any) {
      console.warn(`[ChainId ${chainId}] Explorer fetch error at ${apiEndpoint}:`, err?.message || err);
      return [];
    }
  }

  console.warn(`[ChainId ${chainId}] No fetch method implemented.`);
  return [];
}

export default fetchTransfers;


 
// ----------------- Example Usage / Testing -----------------
// To test, uncomment the lines below and run with a TS-friendly node environment.
/*
(async () => {
  const wallet = "0x58BFd42F60b20BF1Ec934B0EfA9F0a6efeCe29F0";
  const chainId = 534351; // Scroll Sepolia
  const explorerUrl = "https://sepolia.scrollscan.com";

  if (__DEV__) console.log(`\n🔍 Testing data fetch for wallet ${wallet} on chain ${chainId}...`);
  try {
    const transfers = await fetchTransfers(chainId, wallet, explorerUrl);

    if (__DEV__) console.log(`\n📊 Transfers found: ${transfers.length}`);
    transfers.slice(0, 5).forEach((tx, idx) => {
      if (__DEV__) console.log(`${idx + 1}. Hash: ${tx.hash}`);
      if (__DEV__) console.log(`   From: ${tx.from}`);
      if (__DEV__) console.log(`   To:   ${tx.to}`);
      if (__DEV__) console.log(`   Value: ${tx.value}`);
      if (__DEV__) console.log(`   Direction: ${tx.direction}`);
      if (__DEV__) console.log(`   Type: ${tx.type}\n`);
    });
  } catch (err) {
    console.error("Test fetch failed:", err);
  }
})();
*/
