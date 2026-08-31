// Since we are running real network requests to verify live Devnet data, we increase timeout to 20 seconds
jest.setTimeout(20000);

const heliusRpc = "https://devnet.helius-rpc.com/?api-key=800c9b64-37ba-4cd3-a7e9-807406f383a9";
const walletAddress = "B9hBF4uGunmyFU3R8Wuiq2kQVudofVuTqoYc6PzkV85s";

interface WalletNFT {
  mint: string;
  name?: string;
  uri?: string;
  image?: string;
}

async function testGetWalletNFTs(wallet: string): Promise<WalletNFT[]> {
  const res = await fetch(heliusRpc, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
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

  const json = await res.json() as any;

  if (!json?.result?.items) return [];

  return json.result.items.map((nft: any) => ({
    mint: nft.id,
    name: nft.content?.metadata?.name || nft.content?.metadata?.symbol || "Unnamed NFT",
    uri: nft.content?.json_uri,
    image: nft.content?.links?.image || nft.content?.files?.[0]?.uri || undefined,
  }));
}

describe("Solana Devnet NFT Fetch & Metadata Resolution Tests", () => {
  test("Should fetch NFTs successfully from Solana Devnet using Helius DAS API", async () => {
    const nfts = await testGetWalletNFTs(walletAddress);
    
    console.log(`Fetched ${nfts.length} NFTs for wallet ${walletAddress}`);
    expect(nfts).toBeDefined();
    expect(Array.isArray(nfts)).toBe(true);
    expect(nfts.length).toBeGreaterThanOrEqual(3);

    // Find our astronaut NFT
    const astronaut = nfts.find(
      (n) => n.name === "Elite Cyber Crypto Astronaut" || n.mint === "EAua2UDq6HsQMVScVep9h9a8xya2chBJFXVdK1LLupbE"
    );
    expect(astronaut).toBeDefined();
    console.log("Astronaut NFT metadata URI:", astronaut?.uri);

    // Verify presence of Orca position
    const orcaPosition = nfts.find((n) => n.name?.startsWith("OWP") || n.mint === "D2L7ddT1X73RjZkyV8PGKa2ZRWH4wVon2Mbi2CYPcLVG");
    expect(orcaPosition).toBeDefined();
    expect(orcaPosition?.uri).toBeDefined();
  });

  test("Should successfully resolve a working NFT's metadata JSON using browser headers", async () => {
    const nfts = await testGetWalletNFTs(walletAddress);
    
    // Find an NFT that has a working, non-expired URL (like one of the Orca positions)
    let workingNft: WalletNFT | undefined;
    let metadata: any = null;

    for (const nft of nfts) {
      if (nft.uri && nft.uri.startsWith("http") && !nft.uri.includes("tmpfiles.org")) {
        try {
          const response = await fetch(nft.uri, {
            headers: {
              "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
              "Accept": "application/json"
            }
          });
          if (response.ok) {
            metadata = await response.json();
            if (metadata && metadata.image) {
              workingNft = nft;
              break;
            }
          }
        } catch (e) {
          // ignore and check next
        }
      }
    }

    expect(workingNft).toBeDefined();
    expect(metadata).toBeDefined();
    console.log(`Successfully resolved metadata for NFT ${workingNft!.name}:`, JSON.stringify(metadata, null, 2));

    expect(metadata.name).toBeDefined();
    expect(metadata.image).toBeDefined();
    expect(metadata.image.startsWith("http")).toBe(true);
  });
});
