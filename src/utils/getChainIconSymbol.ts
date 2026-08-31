export const getChainIconSymbol = (chainName: string, defaultSymbol: string, chainId?: number | string): string => {
  const name = (chainName || '').toLowerCase();
  const symbol = (defaultSymbol || '').toLowerCase();
  const id = Number(chainId);

  // 0. Solana — must come BEFORE isEvmChain check.
  //    "Solana Mainnet" contains "mainnet" which was wrongly matching EVM.
  if (id === 101 || name.includes('solana') || symbol === 'sol') return 'sol';

  // 1. Explicit mappings for supported L2/Sidechain icons in the library
  if (name.includes('arbitrum') || id === 42161 || id === 421614) return 'arb';
  if (name.includes('optimism') || name.includes('op mainnet') || id === 10 || id === 11155420) return 'op';
  if (name.includes('polygon') || symbol === 'matic' || id === 137 || id === 80002) return 'matic';
  if (name.includes('avalanche') || symbol === 'avax' || id === 43114 || id === 43113) return 'avax';
  if (name.includes('bsc') || name.includes('binance') || symbol === 'bnb' || id === 56 || id === 97) return 'bnb';
  if (name.includes('securechain') || symbol === 'scai' || id === 34 || id === 3434) return 'scai';

  // 2. Fallback for other Ethereum-based L2s/EVMs
  // These chains often use ETH as their native asset. If the library doesn't have their specific logo,
  // we show the ETH logo instead of the "LOGO" placeholder.
  const isEvmChain = name.includes('base') || name.includes('scroll') || name.includes('blast') || 
                     name.includes('linea') || name.includes('zksync') || 
                     name.includes('celo') || name.includes('taiko') ||
                     name.includes('sepolia') || symbol === 'eth';

  if (isEvmChain) return 'eth';
  
  // 3. Known supported symbols in the library
  const supported = ['eth', 'sol', 'btc', 'usdc', 'usdt', 'dai', 'link', 'uni', 'aave'];
  if (supported.includes(symbol)) return symbol;

  // 4. Default to the provided symbol
  return defaultSymbol;
};
