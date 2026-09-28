/**
 * Shared chain normalization utility.
 * Maps any chain identifier (numeric ID, display name, alias) to a canonical CoinStats blockchain name.
 */

// Numeric chain ID → canonical name
const CHAIN_ID_MAP: Record<string, string> = {
  '1': 'ethereum',
  '56': 'bsc',
  '137': 'polygon',
  '42161': 'arbitrum',
  '10': 'optimism',
  '8453': 'base',
  '43114': 'avalanche',
  '250': 'fantom',
  '324': 'zksync',
  '59144': 'linea',
  '534352': 'scroll',
  '5000': 'mantle',
  '81457': 'blast',
  '1101': 'polygon-zkevm',
  '100': 'xdai',
  '42220': 'celo',
  '25': 'cronos',
  '1284': 'moonbeam',
  '1285': 'moonriver',
  sol: 'solana',
};

// Name aliases → canonical name
const CHAIN_ALIAS_MAP: Record<string, string> = {
  eth: 'ethereum',
  ethereum: 'ethereum',
  matic: 'polygon',
  pol: 'polygon',
  polygon: 'polygon',
  'polygon-pos': 'polygon',
  'polygon pos': 'polygon',
  bnb: 'bsc',
  bsc: 'bsc',
  binance: 'bsc',
  binance_smart: 'bsc',
  'binance-smart-chain': 'bsc',
  'bnb chain': 'bsc',
  arb: 'arbitrum',
  arbitrum: 'arbitrum',
  'arbitrum-one': 'arbitrum',
  'arbitrum one': 'arbitrum',
  opt: 'optimism',
  optimism: 'optimism',
  'optimistic-ethereum': 'optimism',
  base: 'base',
  avalanche: 'avalanche',
  fantom: 'fantom',
  solana: 'solana',
  zksync: 'zksync',
  'zksync era': 'zksync',
  linea: 'linea',
  scroll: 'scroll',
  mantle: 'mantle',
  blast: 'blast',
  'polygon zkevm': 'polygon-zkevm',
  gnosis: 'xdai',
  xdai: 'xdai',
  celo: 'celo',
  cronos: 'cronos',
  moonbeam: 'moonbeam',
  moonriver: 'moonriver',
};

/**
 * Normalizes any chain identifier to a canonical blockchain name.
 * Accepts numeric chain IDs ("56"), display names ("BNB Chain"), or aliases ("bsc").
 * Returns 'ethereum' for unknown/empty input.
 */
export function normalizeChain(chain: string): string {
  if (!chain) return 'ethereum';
  const lower = chain.trim().toLowerCase();

  if (CHAIN_ID_MAP[lower]) return CHAIN_ID_MAP[lower];
  if (CHAIN_ALIAS_MAP[lower]) return CHAIN_ALIAS_MAP[lower];

  return lower;
}
