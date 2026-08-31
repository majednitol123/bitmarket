import axios from "axios";
import { fetchTransfers } from "../services/helper";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Celo Native Token Deduplication Tests", () => {
  const wallet = "0x49822720a4fe7bb616752101262bCFf4aA61A1E1";

  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  test("Should deduplicate native token transfers (CELO/Celo native asset) on Blockscout V2 path", async () => {
    mockedAxios.get.mockImplementation(async (url: string) => {
      // Mock transactions API (normal transaction)
      if (url.includes("/v2/addresses/") && url.includes("/transactions")) {
        return {
          data: {
            items: [
              {
                hash: "0x1234567890abcdef",
                from: { hash: "0xSender" },
                to: { hash: wallet },
                value: "1000000000000000000", // 1 CELO
                block: 100,
                timestamp: "2026-06-07T05:00:00Z",
              },
            ],
          },
        };
      }

      // Mock token-transfers API (token transfers)
      if (url.includes("/v2/addresses/") && url.includes("/token-transfers")) {
        return {
          data: {
            items: [
              {
                transaction_hash: "0x1234567890abcdef", // Same hash as normal transaction
                from: { hash: "0xSender" },
                to: { hash: wallet },
                value: "1000000000000000000",
                token: {
                  decimals: "18",
                  symbol: "Celo native asset", // Native token symbol
                },
                block_number: 100,
                timestamp: "2026-06-07T05:00:00Z",
              },
              {
                transaction_hash: "0xDifferentTxHash", // Different ERC20 transfer
                from: { hash: "0xSender" },
                to: { hash: wallet },
                value: "5000000", // 5 USDC
                token: {
                  decimals: "6",
                  symbol: "USDC",
                },
                block_number: 101,
                timestamp: "2026-06-07T05:01:00Z",
              },
            ],
          },
        };
      }

      return { data: { items: [] } };
    });

    const result = await fetchTransfers(11142220, wallet); // Celo Sepolia

    expect(result).toHaveLength(2);

    const normalTx = result.find(tx => tx.hash === "0x1234567890abcdef");
    expect(normalTx).toBeDefined();
    expect(normalTx?.category).toBe("NORMAL");

    const usdcTx = result.find(tx => tx.hash === "0xDifferentTxHash");
    expect(usdcTx).toBeDefined();
    expect(usdcTx?.category).toBe("USDC");
  });

  test("Should deduplicate native token transfers (CELO/Celo native asset) on Explorer V1 Fallback path", async () => {
    // Force fallback by making Blockscout V2 throw an error
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("/v2/addresses/")) {
        throw new Error("Blockscout V2 Offline");
      }

      // Mock Explorer V1 txlist and tokentx
      if (url.includes("action=txlist")) {
        return {
          data: {
            status: "1",
            message: "OK",
            result: [
              {
                hash: "0x1234567890abcdef",
                from: "0xSender",
                to: wallet,
                value: "1000000000000000000", // 1 CELO
                blockNumber: "100",
                timeStamp: "1780808400",
              },
            ],
          },
        };
      }

      if (url.includes("action=tokentx")) {
        return {
          data: {
            status: "1",
            message: "OK",
            result: [
              {
                hash: "0x1234567890abcdef", // Same hash (duplicate Celo transfer)
                from: "0xSender",
                to: wallet,
                value: "1000000000000000000",
                tokenDecimal: "18",
                tokenName: "Celo native asset",
                blockNumber: "100",
                timeStamp: "1780808400",
              },
              {
                hash: "0xDifferentTxHash", // Different ERC20 transfer
                from: "0xSender",
                to: wallet,
                value: "5000000",
                tokenDecimal: "6",
                tokenName: "USDC",
                blockNumber: "101",
                timeStamp: "1780808460",
              },
            ],
          },
        };
      }

      return { data: { result: [] } };
    });

    const result = await fetchTransfers(11142220, wallet); // Celo Sepolia

    expect(result).toHaveLength(2);

    const normalTx = result.find(tx => tx.hash === "0x1234567890abcdef");
    expect(normalTx).toBeDefined();
    expect(normalTx?.category).toBe("NORMAL");

    const usdcTx = result.find(tx => tx.hash === "0xDifferentTxHash");
    expect(usdcTx).toBeDefined();
    expect(usdcTx?.category).toBe("USDC");
  });
});
