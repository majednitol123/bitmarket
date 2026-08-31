import { getChainIconSymbol } from "./getChainIconSymbol";

describe("getChainIconSymbol Mappings Tests", () => {
  test("Should verify Solana mainnet maps to sol and not eth", () => {
    // Solana Mainnet (101)
    expect(getChainIconSymbol("Solana Mainnet", "SOL", 101)).toBe("sol");
    expect(getChainIconSymbol("Solana Mainnet", "SOL")).toBe("sol");
  });

  test("Should verify Solana devnet maps to sol", () => {
    expect(getChainIconSymbol("Solana devnet", "SOL", 101)).toBe("sol");
  });

  test("Should verify Ethereum Mainnet maps to eth", () => {
    expect(getChainIconSymbol("Ethereum Mainnet", "ETH", 1)).toBe("eth");
    expect(getChainIconSymbol("Ethereum Mainnet", "ETH")).toBe("eth");
  });

  test("Should verify L2s map to their respective symbols", () => {
    expect(getChainIconSymbol("Arbitrum One", "ETH", 42161)).toBe("arb");
    expect(getChainIconSymbol("OP Mainnet", "ETH", 10)).toBe("op");
    expect(getChainIconSymbol("Polygon Mainnet", "MATIC", 137)).toBe("matic");
    expect(getChainIconSymbol("Avalanche C-Chain", "AVAX", 43114)).toBe("avax");
    expect(getChainIconSymbol("Binance Smart Chain", "BNB", 56)).toBe("bnb");
    expect(getChainIconSymbol("SecureChain Mainnet", "SCAI", 34)).toBe("scai");
  });

  test("Should verify fallbacks return default symbol if unsupported", () => {
    expect(getChainIconSymbol("Unknown Chain", "DUMMY", 9999)).toBe("DUMMY");
    expect(getChainIconSymbol("Unknown Chain", "LINK", 9999)).toBe("link"); // Known symbol
  });
});
