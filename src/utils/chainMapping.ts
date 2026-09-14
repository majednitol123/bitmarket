/**
 * Maps application chain IDs and names to CoinStats API blockchain identifiers.
 */
export const CHAIN_ID_TO_COINSTATS: Record<string, string> = {
  '1': 'ethereum',
  '56': 'binance_smart',
  '43114': 'avalanche',
  '250': 'fantom',
  '137': 'polygon-pos',
  '42161': 'arbitrum-one',
  '10': 'optimistic-ethereum',
  '8453': 'base',
  '324': 'zksync',
  '59144': 'linea',
  '534352': 'scroll',
  '5000': 'mantle',
  '81457': 'blast',
  '1101': 'polygon-zkevm',
  '100': 'xdai',
  '42220': 'celo',
  '1284': 'moonbeam',
  '1285': 'moonriver',
  '25': 'cronos',
  sol: 'solana',
};

export const CHAIN_NAME_TO_COINSTATS: Record<string, string> = {
  ethereum: 'ethereum',
  'bnb chain': 'binance_smart',
  'binance-smart-chain': 'binance_smart',
  bsc: 'binance_smart',
  avalanche: 'avalanche',
  fantom: 'fantom',
  polygon: 'polygon-pos',
  'polygon pos': 'polygon-pos',
  matic: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  'arbitrum one': 'arbitrum-one',
  optimism: 'optimistic-ethereum',
  'optimistic-ethereum': 'optimistic-ethereum',
  base: 'base',
  zksync: 'zksync',
  'zksync era': 'zksync',
  linea: 'linea',
  scroll: 'scroll',
  mantle: 'mantle',
  blast: 'blast',
  'polygon zkevm': 'polygon-zkevm',
  solana: 'solana',
  gnosis: 'xdai',
  xdai: 'xdai',
  celo: 'celo',
  cronos: 'cronos',
  moonbeam: 'moonbeam',
  moonriver: 'moonriver',
};

/**
 * Returns the CoinStats blockchain identifier for a given chain ID or chain name.
 * Defaults to 'ethereum' if unmapped.
 */
export function getCoinStatsBlockchain(chainIdOrName: string): string {
  if (!chainIdOrName) return 'ethereum';

  const lower = chainIdOrName.trim().toLowerCase();

  // Try direct ID lookup
  if (CHAIN_ID_TO_COINSTATS[lower]) {
    return CHAIN_ID_TO_COINSTATS[lower];
  }

  // Try name lookup
  if (CHAIN_NAME_TO_COINSTATS[lower]) {
    return CHAIN_NAME_TO_COINSTATS[lower];
  }

  return 'ethereum';
}

/**
 * Block explorer base transaction URLs by chain identifier.
 */
export const EXPLORER_TX_BASE_URLS: Record<string, string> = {
  '1': 'https://etherscan.io/tx/',
  ethereum: 'https://etherscan.io/tx/',
  '56': 'https://bscscan.com/tx/',
  binance_smart: 'https://bscscan.com/tx/',
  'binance-smart-chain': 'https://bscscan.com/tx/',
  bsc: 'https://bscscan.com/tx/',
  '137': 'https://polygonscan.com/tx/',
  'polygon-pos': 'https://polygonscan.com/tx/',
  polygon: 'https://polygonscan.com/tx/',
  '42161': 'https://arbiscan.io/tx/',
  'arbitrum-one': 'https://arbiscan.io/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  '10': 'https://optimistic.etherscan.io/tx/',
  'optimistic-ethereum': 'https://optimistic.etherscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
  '8453': 'https://basescan.org/tx/',
  base: 'https://basescan.org/tx/',
  '43114': 'https://snowtrace.io/tx/',
  avalanche: 'https://snowtrace.io/tx/',
  '250': 'https://ftmscan.com/tx/',
  fantom: 'https://ftmscan.com/tx/',
  '324': 'https://explorer.zksync.io/tx/',
  zksync: 'https://explorer.zksync.io/tx/',
  '59144': 'https://lineascan.build/tx/',
  linea: 'https://lineascan.build/tx/',
  '534352': 'https://scrollscan.com/tx/',
  scroll: 'https://scrollscan.com/tx/',
  '5000': 'https://mantlescan.xyz/tx/',
  mantle: 'https://mantlescan.xyz/tx/',
  '81457': 'https://blastscan.io/tx/',
  blast: 'https://blastscan.io/tx/',
  '1101': 'https://zkevm.polygonscan.com/tx/',
  'polygon-zkevm': 'https://zkevm.polygonscan.com/tx/',
  '100': 'https://gnosisscan.io/tx/',
  xdai: 'https://gnosisscan.io/tx/',
  gnosis: 'https://gnosisscan.io/tx/',
  '42220': 'https://celoscan.io/tx/',
  celo: 'https://celoscan.io/tx/',
  '25': 'https://cronoscan.com/tx/',
  cronos: 'https://cronoscan.com/tx/',
  '1284': 'https://moonscan.io/tx/',
  moonbeam: 'https://moonscan.io/tx/',
  '1285': 'https://moonriver.moonscan.io/tx/',
  moonriver: 'https://moonriver.moonscan.io/tx/',
  sol: 'https://solscan.io/tx/',
  solana: 'https://solscan.io/tx/',
};

export function getChainExplorerTxUrl(chainIdOrName: string, txHash: string): string {
  if (!txHash) return '';
  const lower = (chainIdOrName || '').trim().toLowerCase();
  const base = EXPLORER_TX_BASE_URLS[lower] || 'https://etherscan.io/tx/';
  return `${base}${txHash}`;
}

