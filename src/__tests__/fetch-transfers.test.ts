import axios from "axios";
import { fetchTransfers } from "../services/helper";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("fetchTransfers SecureChain Fix Tests", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  test("Chain 34 (SecureChain Mainnet) should NOT query Blockscout V2 and should query Etherscan V1 API directly", async () => {
    const wallet = "0xCACBc5a5AD6f46d85993efAA714a9664a2B7a069";

    // Mock response for Etherscan V1 txlist and tokentx
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("action=txlist")) {
        return {
          data: {
            status: "1",
            message: "OK",
            result: [
              {
                hash: "0x111",
                from: wallet,
                to: "0xRecipient",
                value: "2000000000000000000", // 2 ETH/SCAI
                blockNumber: "500",
                timeStamp: "1670000000",
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
            result: [],
          },
        };
      }
      return { data: { result: [] } };
    });

    const result = await fetchTransfers(34, wallet);

    const calledUrls = mockedAxios.get.mock.calls.map((call) => call[0]);

    // Verify V2 was NOT queried
    const requestedV2 = calledUrls.some((url) => url.includes("/v2/addresses/"));
    expect(requestedV2).toBe(false);

    // Verify V1 endpoints were called
    const requestedTxList = calledUrls.some((url) => url.includes("action=txlist") && url.includes("explorer.securechain.ai"));
    const requestedTokenTx = calledUrls.some((url) => url.includes("action=tokentx") && url.includes("explorer.securechain.ai"));
    expect(requestedTxList).toBe(true);
    expect(requestedTokenTx).toBe(true);

    // Verify result parse
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("0x111");
    expect(result[0].value).toBe("2.0");
    expect(result[0].category).toBe("NORMAL");
    expect(result[0].direction).toBe("sent");
  });

  test("Chain 100 (Gnosis) which is in BLOCKSCOUT_APIS should still attempt to query Blockscout V2 API", async () => {
    const wallet = "0xCACBc5a5AD6f46d85993efAA714a9664a2B7a069";

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("/v2/addresses/")) {
        return {
          data: {
            items: [
              {
                hash: "0x999",
                from: { hash: wallet },
                to: { hash: "0xRecipient" },
                value: "1000000000000000000",
                block: 12345,
                timestamp: "2026-06-07T05:00:00Z",
              },
            ],
          },
        };
      }
      return { data: { items: [] } };
    });

    const result = await fetchTransfers(100, wallet);

    const calledUrls = mockedAxios.get.mock.calls.map((call) => call[0]);

    // Verify V2 was indeed queried
    const requestedV2 = calledUrls.some((url) => url.includes("gnosis.blockscout.com/api/v2/addresses/"));
    expect(requestedV2).toBe(true);

    expect(result).toHaveLength(2); // Normal + Token (since mock returns same, it fetches both)
    expect(result[0].hash).toBe("0x999");
  });
});
