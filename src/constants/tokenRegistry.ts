// ═══════════════════════════════════════════════════════════
// PRODUCTION TOKEN & CHAIN REGISTRY
// All icons sourced from TrustWallet verified assets CDN
// ═══════════════════════════════════════════════════════════

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  color: string;
  icon: string;
}

export interface Token {
  symbol: string;
  name: string;
  color: string;
  icon: string;
  address: string; // contract address (or "native" for gas token)
}

// ─── Helper to build TrustWallet chain logo URL ───
const twChain = (chain: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;

// ─── Helper to build TrustWallet token logo URL ───
const twToken = (chain: string, address: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${address}/logo.png`;

// ═══════════════════════════════════════════════════════════
// CHAINS
// ═══════════════════════════════════════════════════════════

export const CHAINS: Chain[] = [
  // ─── Layer 1 ───
  { id: "1", name: "Ethereum", symbol: "ETH", color: "#627EEA", icon: twChain("ethereum") },
  { id: "56", name: "BNB Chain", symbol: "BNB", color: "#F3BA2F", icon: twChain("smartchain") },
  { id: "43114", name: "Avalanche", symbol: "AVAX", color: "#E84142", icon: twChain("avalanchec") },
  { id: "250", name: "Fantom", symbol: "FTM", color: "#1969FF", icon: twChain("fantom") },
  { id: "25", name: "Cronos", symbol: "CRO", color: "#002D74", icon: twChain("cronos") },
  { id: "100", name: "Gnosis", symbol: "xDAI", color: "#04795B", icon: twChain("xdai") },
  { id: "42220", name: "Celo", symbol: "CELO", color: "#35D07F", icon: twChain("celo") },
  { id: "1284", name: "Moonbeam", symbol: "GLMR", color: "#53CBC8", icon: twChain("moonbeam") },
  { id: "1285", name: "Moonriver", symbol: "MOVR", color: "#F2B705", icon: twChain("moonriver") },

  // ─── Layer 2 / Rollups ───
  { id: "137", name: "Polygon", symbol: "MATIC", color: "#8247E5", icon: twChain("polygon") },
  { id: "42161", name: "Arbitrum", symbol: "ETH", color: "#28A0F0", icon: twChain("arbitrum") },
  { id: "10", name: "Optimism", symbol: "ETH", color: "#FF0420", icon: twChain("optimism") },
  { id: "8453", name: "Base", symbol: "ETH", color: "#0052FF", icon: twChain("base") },
  { id: "324", name: "zkSync Era", symbol: "ETH", color: "#8C8DFC", icon: twChain("zksync") },
  { id: "59144", name: "Linea", symbol: "ETH", color: "#61DFFF", icon: twChain("linea") },
  { id: "534352", name: "Scroll", symbol: "ETH", color: "#FFDBB0", icon: twChain("scroll") },
  { id: "5000", name: "Mantle", symbol: "MNT", color: "#000000", icon: twChain("mantle") },
  { id: "81457", name: "Blast", symbol: "ETH", color: "#FCFC03", icon: twChain("blast") },
  { id: "1101", name: "Polygon zkEVM", symbol: "ETH", color: "#7B3FE4", icon: twChain("polygonzkevm") },

  // ─── Non-EVM ───
  { id: "sol", name: "Solana", symbol: "SOL", color: "#9945FF", icon: twChain("solana") },
];

// ═══════════════════════════════════════════════════════════
// TOKENS BY CHAIN
// ═══════════════════════════════════════════════════════════

export const TOKENS_BY_CHAIN: Record<string, Token[]> = {

  // ─── Ethereum Mainnet ───
  "1": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", icon: twToken("ethereum", "0xdAC17F958D2ee523a2206206994597C13D831ec7") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", icon: twToken("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", icon: twToken("ethereum", "0x6B175474E89094C44Da98b954EedeAC495271d0F") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", icon: twToken("ethereum", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", icon: twToken("ethereum", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") },
    { symbol: "UNI", name: "Uniswap", color: "#FF007A", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", icon: twToken("ethereum", "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984") },
    { symbol: "LINK", name: "Chainlink", color: "#2A5ADA", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", icon: twToken("ethereum", "0x514910771AF9Ca656af840dff83E8264EcF986CA") },
    { symbol: "AAVE", name: "Aave", color: "#B6509E", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", icon: twToken("ethereum", "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9") },
    { symbol: "MKR", name: "Maker", color: "#1AAB9B", address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2", icon: twToken("ethereum", "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2") },
    { symbol: "SHIB", name: "Shiba Inu", color: "#FFA409", address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", icon: twToken("ethereum", "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE") },
    { symbol: "LDO", name: "Lido DAO", color: "#00A3FF", address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", icon: twToken("ethereum", "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32") },
    { symbol: "stETH", name: "Lido Staked ETH", color: "#00A3FF", address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", icon: twToken("ethereum", "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84") },
    { symbol: "CRV", name: "Curve DAO", color: "#F2E308", address: "0xD533a949740bb3306d119CC777fa900bA034cd52", icon: twToken("ethereum", "0xD533a949740bb3306d119CC777fa900bA034cd52") },
    { symbol: "PEPE", name: "Pepe", color: "#479F47", address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", icon: twToken("ethereum", "0x6982508145454Ce325dDbE47a25d4ec3d2311933") },
    { symbol: "APE", name: "ApeCoin", color: "#0054F6", address: "0x4d224452801ACEd8B2F0aebE155379bb5D594381", icon: twToken("ethereum", "0x4d224452801ACEd8B2F0aebE155379bb5D594381") },
    { symbol: "SNX", name: "Synthetix", color: "#00D1FF", address: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F", icon: twToken("ethereum", "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F") },
    { symbol: "COMP", name: "Compound", color: "#00D395", address: "0xc00e94Cb662C3520282E6f5717214004A7f26888", icon: twToken("ethereum", "0xc00e94Cb662C3520282E6f5717214004A7f26888") },
    { symbol: "ENS", name: "Ethereum Name Service", color: "#5298FF", address: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72", icon: twToken("ethereum", "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72") },
    { symbol: "GRT", name: "The Graph", color: "#6747ED", address: "0xc944E90C64B2c07662A292be6244BDf05Cda44a7", icon: twToken("ethereum", "0xc944E90C64B2c07662A292be6244BDf05Cda44a7") },
    { symbol: "1INCH", name: "1inch", color: "#94A6C3", address: "0x111111111117dC0aa78b770fA6A738034120C302", icon: twToken("ethereum", "0x111111111117dC0aa78b770fA6A738034120C302") },
    { symbol: "SUSHI", name: "SushiSwap", color: "#FA52A0", address: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2", icon: twToken("ethereum", "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2") },
    { symbol: "FXS", name: "Frax Share", color: "#000000", address: "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0", icon: twToken("ethereum", "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0") },
    { symbol: "RPL", name: "Rocket Pool", color: "#E87532", address: "0xD33526068D116cE69F19A9ee46F0bd304F21A51f", icon: twToken("ethereum", "0xD33526068D116cE69F19A9ee46F0bd304F21A51f") },
    { symbol: "BAL", name: "Balancer", color: "#1E1E1E", address: "0xba100000625a3754423978a60c9317c58a424e3D", icon: twToken("ethereum", "0xba100000625a3754423978a60c9317c58a424e3D") },
  ],

  // ─── BNB Smart Chain ───
  "56": [
    { symbol: "BNB", name: "BNB", color: "#F3BA2F", address: "native", icon: twChain("smartchain") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x55d398326f99059fF775485246999027B3197955", icon: twToken("smartchain", "0x55d398326f99059fF775485246999027B3197955") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", icon: twToken("smartchain", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d") },
    { symbol: "BUSD", name: "Binance USD", color: "#F0B90B", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", icon: twToken("smartchain", "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56") },
    { symbol: "WBNB", name: "Wrapped BNB", color: "#F3BA2F", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", icon: twToken("smartchain", "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c") },
    { symbol: "CAKE", name: "PancakeSwap", color: "#D1884F", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", icon: twToken("smartchain", "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82") },
    { symbol: "ETH", name: "Ethereum (BSC)", color: "#627EEA", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", icon: twToken("smartchain", "0x2170Ed0880ac9A755fd29B2688956BD959F933F8") },
    { symbol: "BTCB", name: "Bitcoin (BSC)", color: "#F7931A", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", icon: twToken("smartchain", "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c") },
    { symbol: "XVS", name: "Venus", color: "#1DB9A6", address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", icon: twToken("smartchain", "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63") },
    { symbol: "DOGE", name: "Dogecoin (BSC)", color: "#C3A634", address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", icon: twToken("smartchain", "0xbA2aE424d960c26247Dd6c32edC70B295c744C43") },
    { symbol: "DOT", name: "Polkadot (BSC)", color: "#E6007A", address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402", icon: twToken("smartchain", "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402") },
    { symbol: "ADA", name: "Cardano (BSC)", color: "#0D1E30", address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47", icon: twToken("smartchain", "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47") },
    { symbol: "LINK", name: "Chainlink (BSC)", color: "#2A5ADA", address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", icon: twToken("smartchain", "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD") },
    { symbol: "UNI", name: "Uniswap (BSC)", color: "#FF007A", address: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1", icon: twToken("smartchain", "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1") },
  ],

  // ─── Polygon ───
  "137": [
    { symbol: "MATIC", name: "Polygon", color: "#8247E5", address: "native", icon: twChain("polygon") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", icon: twToken("polygon", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", icon: twToken("polygon", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") },
    { symbol: "USDC.e", name: "USD Coin (Bridged)", color: "#2775CA", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", icon: twToken("polygon", "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", icon: twToken("polygon", "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063") },
    { symbol: "WMATIC", name: "Wrapped MATIC", color: "#8247E5", address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", icon: twToken("polygon", "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", icon: twToken("polygon", "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", icon: twToken("polygon", "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6") },
    { symbol: "AAVE", name: "Aave", color: "#B6509E", address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B", icon: twToken("polygon", "0xD6DF932A45C0f255f85145f286eA0b292B21C90B") },
    { symbol: "LINK", name: "Chainlink", color: "#2A5ADA", address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", icon: twToken("polygon", "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39") },
    { symbol: "UNI", name: "Uniswap", color: "#FF007A", address: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f", icon: twToken("polygon", "0xb33EaAd8d922B1083446DC23f610c2567fB5180f") },
    { symbol: "SUSHI", name: "SushiSwap", color: "#FA52A0", address: "0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a", icon: twToken("polygon", "0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a") },
    { symbol: "CRV", name: "Curve DAO", color: "#F2E308", address: "0x172370d5Cd63279eFa6d502DAB29171933a610AF", icon: twToken("polygon", "0x172370d5Cd63279eFa6d502DAB29171933a610AF") },
    { symbol: "BAL", name: "Balancer", color: "#1E1E1E", address: "0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3", icon: twToken("polygon", "0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3") },
    { symbol: "GRT", name: "The Graph", color: "#6747ED", address: "0x5fe2B58c013d7601147DcdD68C143A77499f5531", icon: twToken("polygon", "0x5fe2B58c013d7601147DcdD68C143A77499f5531") },
  ],

  // ─── Arbitrum One ───
  "42161": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", icon: twToken("arbitrum", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", icon: twToken("arbitrum", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831") },
    { symbol: "USDC.e", name: "USD Coin (Bridged)", color: "#2775CA", address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", icon: twToken("arbitrum", "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", icon: twToken("arbitrum", "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", icon: twToken("arbitrum", "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", icon: twToken("arbitrum", "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1") },
    { symbol: "ARB", name: "Arbitrum", color: "#28A0F0", address: "0x912CE59144191C1204E64559FE8253a0e49E6548", icon: twToken("arbitrum", "0x912CE59144191C1204E64559FE8253a0e49E6548") },
    { symbol: "GMX", name: "GMX", color: "#2D42FC", address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", icon: twToken("arbitrum", "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a") },
    { symbol: "LINK", name: "Chainlink", color: "#2A5ADA", address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", icon: twToken("arbitrum", "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4") },
    { symbol: "UNI", name: "Uniswap", color: "#FF007A", address: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", icon: twToken("arbitrum", "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0") },
    { symbol: "RDNT", name: "Radiant Capital", color: "#004CFF", address: "0x3082CC23568eA640225c2467653dB90e9250AaA0", icon: twToken("arbitrum", "0x3082CC23568eA640225c2467653dB90e9250AaA0") },
    { symbol: "MAGIC", name: "Magic", color: "#DC2626", address: "0x539bdE0d7Dbd336b79148AA742883198BBF60342", icon: twToken("arbitrum", "0x539bdE0d7Dbd336b79148AA742883198BBF60342") },
    { symbol: "GRT", name: "The Graph", color: "#6747ED", address: "0x9623063377AD1B27544C965cCd7342f7EA7e88C7", icon: twToken("arbitrum", "0x9623063377AD1B27544C965cCd7342f7EA7e88C7") },
  ],

  // ─── Optimism ───
  "10": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", icon: twToken("optimism", "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", icon: twToken("optimism", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85") },
    { symbol: "USDC.e", name: "USD Coin (Bridged)", color: "#2775CA", address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", icon: twToken("optimism", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", icon: twToken("optimism", "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", icon: twToken("optimism", "0x68f180fcCe6836688e9084f035309E29Bf0A2095") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x4200000000000000000000000000000000000006", icon: twToken("optimism", "0x4200000000000000000000000000000000000006") },
    { symbol: "OP", name: "Optimism", color: "#FF0420", address: "0x4200000000000000000000000000000000000042", icon: twToken("optimism", "0x4200000000000000000000000000000000000042") },
    { symbol: "SNX", name: "Synthetix", color: "#00D1FF", address: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4", icon: twToken("optimism", "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4") },
    { symbol: "LINK", name: "Chainlink", color: "#2A5ADA", address: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6", icon: twToken("optimism", "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6") },
    { symbol: "AAVE", name: "Aave", color: "#B6509E", address: "0x76FB31fb4af56892A25e32cFC43De717950c9278", icon: twToken("optimism", "0x76FB31fb4af56892A25e32cFC43De717950c9278") },
    { symbol: "VELO", name: "Velodrome", color: "#FF6B6B", address: "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db", icon: twToken("optimism", "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db") },
  ],

  // ─── Avalanche C-Chain ───
  "43114": [
    { symbol: "AVAX", name: "Avalanche", color: "#E84142", address: "native", icon: twChain("avalanchec") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", icon: twToken("avalanchec", "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", icon: twToken("avalanchec", "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E") },
    { symbol: "DAI.e", name: "Dai (Bridged)", color: "#F5AC37", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", icon: twToken("avalanchec", "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70") },
    { symbol: "WAVAX", name: "Wrapped AVAX", color: "#E84142", address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", icon: twToken("avalanchec", "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7") },
    { symbol: "WETH.e", name: "Wrapped ETH", color: "#627EEA", address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", icon: twToken("avalanchec", "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB") },
    { symbol: "WBTC.e", name: "Wrapped BTC", color: "#F7931A", address: "0x50b7545627a5162F82A992c33b87aDc75187B218", icon: twToken("avalanchec", "0x50b7545627a5162F82A992c33b87aDc75187B218") },
    { symbol: "JOE", name: "Trader Joe", color: "#E84142", address: "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd", icon: twToken("avalanchec", "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd") },
    { symbol: "LINK.e", name: "Chainlink", color: "#2A5ADA", address: "0x5947BB275c521040051D82396192181b413227A3", icon: twToken("avalanchec", "0x5947BB275c521040051D82396192181b413227A3") },
    { symbol: "AAVE.e", name: "Aave", color: "#B6509E", address: "0x63a72806098Bd3D9520cC43356dD78afe5D386D9", icon: twToken("avalanchec", "0x63a72806098Bd3D9520cC43356dD78afe5D386D9") },
    { symbol: "sAVAX", name: "Staked AVAX", color: "#E84142", address: "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE", icon: twToken("avalanchec", "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE") },
  ],

  // ─── Base ───
  "8453": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", icon: twToken("base", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") },
    { symbol: "USDbC", name: "USD Base Coin", color: "#2775CA", address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", icon: twToken("base", "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", icon: twToken("base", "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x4200000000000000000000000000000000000006", icon: twToken("base", "0x4200000000000000000000000000000000000006") },
    { symbol: "cbETH", name: "Coinbase Staked ETH", color: "#0052FF", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", icon: twToken("base", "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22") },
    { symbol: "AERO", name: "Aerodrome", color: "#0052FF", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", icon: twToken("base", "0x940181a94A35A4569E4529A3CDfB74e38FD98631") },
    { symbol: "COMP", name: "Compound", color: "#00D395", address: "0x9e1028F5F1D5eDE59748FFceE5532509976840E0", icon: twToken("base", "0x9e1028F5F1D5eDE59748FFceE5532509976840E0") },
    { symbol: "rETH", name: "Rocket Pool ETH", color: "#E87532", address: "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c", icon: twToken("base", "0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c") },
  ],

  // ─── Fantom ───
  "250": [
    { symbol: "FTM", name: "Fantom", color: "#1969FF", address: "native", icon: twChain("fantom") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75", icon: twToken("fantom", "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E", icon: twToken("fantom", "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E") },
    { symbol: "WFTM", name: "Wrapped FTM", color: "#1969FF", address: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83", icon: twToken("fantom", "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x74b23882a30290451A17c44f4F05243b6b58C76d", icon: twToken("fantom", "0x74b23882a30290451A17c44f4F05243b6b58C76d") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0x321162Cd933E2Be498Cd2267a90534A804051b11", icon: twToken("fantom", "0x321162Cd933E2Be498Cd2267a90534A804051b11") },
    { symbol: "BOO", name: "SpookySwap", color: "#6665DD", address: "0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE", icon: twToken("fantom", "0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE") },
    { symbol: "LINK", name: "Chainlink", color: "#2A5ADA", address: "0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8", icon: twToken("fantom", "0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8") },
    { symbol: "AAVE", name: "Aave", color: "#B6509E", address: "0x6a07A792ab2965C72a5B8088d3a069A7aC3a993B", icon: twToken("fantom", "0x6a07A792ab2965C72a5B8088d3a069A7aC3a993B") },
  ],

  // ─── Cronos ───
  "25": [
    { symbol: "CRO", name: "Cronos", color: "#002D74", address: "native", icon: twChain("cronos") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59", icon: twToken("cronos", "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x66e428c3f67a68878562e79A0234c1F83c208770", icon: twToken("cronos", "0x66e428c3f67a68878562e79A0234c1F83c208770") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0xe44Fd7fCb2b1581822D0c862B68222998a0c299a", icon: twToken("cronos", "0xe44Fd7fCb2b1581822D0c862B68222998a0c299a") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0x062E66477Faf219F25D27dCED647BF57C3107d52", icon: twToken("cronos", "0x062E66477Faf219F25D27dCED647BF57C3107d52") },
    { symbol: "WCRO", name: "Wrapped CRO", color: "#002D74", address: "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23", icon: twToken("cronos", "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23") },
  ],

  // ─── Gnosis (xDai) ───
  "100": [
    { symbol: "xDAI", name: "xDai", color: "#04795B", address: "native", icon: twChain("xdai") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xDDAfBB505ad214D7b80b1f830fcCc89B60fb7A83", icon: twToken("xdai", "0xDDAfBB505ad214D7b80b1f830fcCc89B60fb7A83") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x4ECaBa5870353805a9F068101A40E0f32ed605C6", icon: twToken("xdai", "0x4ECaBa5870353805a9F068101A40E0f32ed605C6") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1", icon: twToken("xdai", "0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1") },
    { symbol: "GNO", name: "Gnosis", color: "#04795B", address: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb", icon: twToken("xdai", "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb") },
  ],

  // ─── Celo ───
  "42220": [
    { symbol: "CELO", name: "Celo", color: "#35D07F", address: "native", icon: twChain("celo") },
    { symbol: "cUSD", name: "Celo Dollar", color: "#35D07F", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", icon: twToken("celo", "0x765DE816845861e75A25fCA122bb6898B8B1282a") },
    { symbol: "cEUR", name: "Celo Euro", color: "#35D07F", address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", icon: twToken("celo", "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", icon: twToken("celo", "0xcebA9300f2b948710d2653dD7B07f33A8B32118C") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", icon: twToken("celo", "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e") },
  ],

  // ─── Moonbeam ───
  "1284": [
    { symbol: "GLMR", name: "Moonbeam", color: "#53CBC8", address: "native", icon: twChain("moonbeam") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x931715FEE2d06333043d11F658C8CE934aC61D0c", icon: twToken("moonbeam", "0x931715FEE2d06333043d11F658C8CE934aC61D0c") },
    { symbol: "WGLMR", name: "Wrapped GLMR", color: "#53CBC8", address: "0xAcc15dC74880C9944775448304B263D191c6077F", icon: twToken("moonbeam", "0xAcc15dC74880C9944775448304B263D191c6077F") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0xab3f0245B83feB11d15AAffeFD7AD465a59817eD", icon: twToken("moonbeam", "0xab3f0245B83feB11d15AAffeFD7AD465a59817eD") },
  ],

  // ─── Moonriver ───
  "1285": [
    { symbol: "MOVR", name: "Moonriver", color: "#F2B705", address: "native", icon: twChain("moonriver") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D", icon: twToken("moonriver", "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D") },
    { symbol: "WMOVR", name: "Wrapped MOVR", color: "#F2B705", address: "0x98878B06940aE243284CA214f92Bb71a2b032B8A", icon: twToken("moonriver", "0x98878B06940aE243284CA214f92Bb71a2b032B8A") },
  ],

  // ─── zkSync Era ───
  "324": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4", icon: twToken("zksync", "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C", icon: twToken("zksync", "0x493257fD37EDB34451f62EDf8D2a0C418852bA4C") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0xBBeB516fb02a01611cBBE0453Fe3c580D7281011", icon: twToken("zksync", "0xBBeB516fb02a01611cBBE0453Fe3c580D7281011") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91", icon: twToken("zksync", "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91") },
  ],

  // ─── Linea ───
  "59144": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", icon: twToken("linea", "0x176211869cA2b568f2A7D4EE941E073a821EE1ff") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0xA219439258ca9da29E9Cc4cE5596924745e12B93", icon: twToken("linea", "0xA219439258ca9da29E9Cc4cE5596924745e12B93") },
    { symbol: "WBTC", name: "Wrapped BTC", color: "#F7931A", address: "0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4", icon: twToken("linea", "0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", icon: twToken("linea", "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5", icon: twToken("linea", "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5") },
  ],

  // ─── Scroll ───
  "534352": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", icon: twToken("scroll", "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df", icon: twToken("scroll", "0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x5300000000000000000000000000000000000004", icon: twToken("scroll", "0x5300000000000000000000000000000000000004") },
  ],

  // ─── Mantle ───
  "5000": [
    { symbol: "MNT", name: "Mantle", color: "#000000", address: "native", icon: twChain("mantle") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0x09Bc4E0D10E52d373F16e7d80ea7A3DB3acDa571", icon: twToken("mantle", "0x09Bc4E0D10E52d373F16e7d80ea7A3DB3acDa571") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE", icon: twToken("mantle", "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111", icon: twToken("mantle", "0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111") },
    { symbol: "WMNT", name: "Wrapped MNT", color: "#000000", address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8", icon: twToken("mantle", "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8") },
  ],

  // ─── Blast ───
  "81457": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDB", name: "USDB", color: "#FCFC03", address: "0x4300000000000000000000000000000000000003", icon: twToken("blast", "0x4300000000000000000000000000000000000003") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x4300000000000000000000000000000000000004", icon: twToken("blast", "0x4300000000000000000000000000000000000004") },
  ],

  // ─── Polygon zkEVM ───
  "1101": [
    { symbol: "ETH", name: "Ethereum", color: "#627EEA", address: "native", icon: twChain("ethereum") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035", icon: twToken("polygonzkevm", "0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d", icon: twToken("polygonzkevm", "0x1E4a5963aBFD975d8c9021ce480b42188849D41d") },
    { symbol: "WETH", name: "Wrapped ETH", color: "#627EEA", address: "0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9", icon: twToken("polygonzkevm", "0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9") },
    { symbol: "DAI", name: "Dai Stablecoin", color: "#F5AC37", address: "0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4", icon: twToken("polygonzkevm", "0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4") },
  ],

  // ─── Solana ───
  "sol": [
    { symbol: "SOL", name: "Solana", color: "#9945FF", address: "native", icon: twChain("solana") },
    { symbol: "USDC", name: "USD Coin", color: "#2775CA", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", icon: twToken("solana", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") },
    { symbol: "USDT", name: "Tether USD", color: "#50AF95", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", icon: twToken("solana", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB") },
    { symbol: "RAY", name: "Raydium", color: "#8C52FF", address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", icon: twToken("solana", "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R") },
    { symbol: "BONK", name: "Bonk", color: "#F5A623", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", icon: twToken("solana", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263") },
    { symbol: "JTO", name: "Jito", color: "#88C870", address: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", icon: twToken("solana", "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL") },
    { symbol: "JUP", name: "Jupiter", color: "#00BFA5", address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", icon: twToken("solana", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN") },
    { symbol: "WIF", name: "dogwifhat", color: "#9B6D4A", address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", icon: twToken("solana", "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm") },
    { symbol: "PYTH", name: "Pyth Network", color: "#E6DAFE", address: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", icon: twToken("solana", "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3") },
    { symbol: "mSOL", name: "Marinade SOL", color: "#326464", address: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", icon: twToken("solana", "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So") },
  ],
};

// Default tokens fallback
export const DEFAULT_TOKENS: Token[] = TOKENS_BY_CHAIN["1"];
