import axios from "axios";
import { fetchTransfers } from "../services/helper";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("BscScan HTML Scraper Timestamp and Sorting Tests", () => {
  const wallet = "0x49822720a4fe7bb616752101262bCFf4aA61A1E1";

  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  test("Should parse absolute timestamps from title attribute inside relative age cells", async () => {
    // Mock V1 endpoint to return empty / deprecated to trigger HTML fallback
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("action=txlist") || url.includes("action=tokentx")) {
        return { data: { result: [] } };
      }
      
      if (url.includes(`/address/${wallet}`)) {
        // Return a mock HTML with transaction rows having title tooltips
        const mockHtml = `
          <table>
            <tr>
              <td><a href='/tx/0x1111111111111111111111111111111111111111111111111111111111111111'>Tx1</a></td>
              <td><a href='/block/1000'>1000</a></td>
              <td><span title="2026-06-07 05:00:00Z">3 mins ago</span></td>
              <td data-clipboard-text='0x49822720a4fe7bb616752101262bCFf4aA61A1E1'>From</td>
              <td data-clipboard-text='0xRecipient'>To</td>
              <td>0.5 BNB</td>
            </tr>
            <tr>
              <td><a href='/tx/0x2222222222222222222222222222222222222222222222222222222222222222'>Tx2</a></td>
              <td><a href='/block/990'>990</a></td>
              <td><span title="2026-06-07 04:00:00Z">1 hr ago</span></td>
              <td data-clipboard-text='0xRecipient'>From</td>
              <td data-clipboard-text='0x49822720a4fe7bb616752101262bCFf4aA61A1E1'>To</td>
              <td>1.2 BNB</td>
            </tr>
          </table>
        `;
        return { data: mockHtml };
      }

      return { data: "" };
    });

    const result = await fetchTransfers(56, wallet, "https://bscscan.com");

    expect(result).toHaveLength(2);

    // Verify Tx1 timestamp matches "2026-06-07 05:00:00Z" (1780818000)
    const expectedTime1 = new Date("2026-06-07 05:00:00Z").getTime() / 1000;
    expect(result[0].hash).toBe("0x1111111111111111111111111111111111111111111111111111111111111111");
    expect(result[0].timestamp).toBeCloseTo(expectedTime1, 0);

    // Verify Tx2 timestamp matches "2026-06-07 04:00:00Z" (1780814400)
    const expectedTime2 = new Date("2026-06-07 04:00:00Z").getTime() / 1000;
    expect(result[1].hash).toBe("0x2222222222222222222222222222222222222222222222222222222222222222");
    expect(result[1].timestamp).toBeCloseTo(expectedTime2, 0);
  });

  test("Should fallback to parsing relative age strings directly if title is missing", async () => {
    const nowMs = Date.now();
    // Re-mock Date.now to have stable time during testing
    const originalDateNow = Date.now;
    Date.now = () => nowMs;

    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes("action=txlist") || url.includes("action=tokentx")) {
        return { data: { result: [] } };
      }
      
      if (url.includes(`/address/${wallet}`)) {
        const mockHtml = `
          <table>
            <tr>
              <td><a href='/tx/0x1111111111111111111111111111111111111111111111111111111111111111'>Tx1</a></td>
              <td><a href='/block/1000'>1000</a></td>
              <td>10 mins ago</td>
              <td data-clipboard-text='0x49822720a4fe7bb616752101262bCFf4aA61A1E1'>From</td>
              <td data-clipboard-text='0xRecipient'>To</td>
              <td>0.5 BNB</td>
            </tr>
            <tr>
              <td><a href='/tx/0x2222222222222222222222222222222222222222222222222222222222222222'>Tx2</a></td>
              <td><a href='/block/990'>990</a></td>
              <td>2 hours ago</td>
              <td data-clipboard-text='0xRecipient'>From</td>
              <td data-clipboard-text='0x49822720a4fe7bb616752101262bCFf4aA61A1E1'>To</td>
              <td>1.2 BNB</td>
            </tr>
          </table>
        `;
        return { data: mockHtml };
      }
      return { data: "" };
    });

    try {
      const result = await fetchTransfers(56, wallet, "https://bscscan.com");
      expect(result).toHaveLength(2);

      const expectedTime1 = (nowMs - (10 * 60 * 1000)) / 1000;
      expect(result[0].timestamp).toBeCloseTo(expectedTime1, 0);

      const expectedTime2 = (nowMs - (2 * 3600 * 1000)) / 1000;
      expect(result[1].timestamp).toBeCloseTo(expectedTime2, 0);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
