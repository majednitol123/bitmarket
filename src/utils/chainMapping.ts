/**
 * Maps application chain IDs and names to CoinStats API blockchain identifiers.
 */
export const CHAIN_ID_TO_COINSTATS: Record<string, string> = {
  '1': 'ethereum',
  '56': 'binance-smart-chain',
  '43114': 'avalanche',
  '250': 'fantom',
  '137': 'polygon',
  '42161': 'arbitrum',
  '10': 'optimism',
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
  'bnb chain': 'binance-smart-chain',
  bsc: 'binance-smart-chain',
  avalanche: 'avalanche',
  fantom: 'fantom',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base: 'base',
  zksync: 'zksync',
  'zksync era': 'zksync',
  solana: 'solana',
  gnosis: 'xdai',
  celo: 'celo',
  cronos: 'cronos',
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
