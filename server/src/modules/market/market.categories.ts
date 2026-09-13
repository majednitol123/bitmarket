export const CATEGORY_IDS = {
  ALL: 'all',
  TOP_GAINERS: 'gainers',
  LAYER_1: 'layer-1',
  DEFI: 'defi',
  LAYER_2: 'layer-2',
} as const;

export const LAYER_1_COIN_IDS = new Set([
  'bitcoin',
  'ethereum',
  'solana',
  'binancecoin',
  'avalanche-2',
  'cardano',
  'polkadot',
  'near',
  'cosmos',
  'tron',
  'sui',
  'aptos',
  'algorand',
  'internet-computer',
  'kaspa',
  'monero',
  'tezos',
  'hedera-hashgraph',
  'fantom',
  'sonic',
  'eos',
  'mina-protocol',
  'sei-network',
  'celestia',
  'toncoin',
]);

export const LAYER_2_COIN_IDS = new Set([
  'polygon-ecosystem-token',
  'matic-network',
  'arbitrum',
  'optimism',
  'blast',
  'mantle',
  'starknet',
  'immutable-x',
  'scroll',
  'zksync',
  'metis-token',
  'ronin',
  'loopring',
  'dymension',
  'taiko',
  'arbitrum-nova',
]);

export const DEFI_COIN_IDS = new Set([
  'uniswap',
  'aave',
  'maker',
  'lido-dao',
  'chainlink',
  'synthetix-network-token',
  'curve-dao-token',
  'pancakeswap-token',
  'thorchain',
  'jupiter',
  'raydium',
  'compound-governance-token',
  'pendle',
  'convex-finance',
  'yearn-finance',
  '1inch',
  'injective-protocol',
  'gmx',
  'aerodrome-finance',
  'ethena',
]);

export function normalizeCategory(category?: string): string {
  if (!category) return CATEGORY_IDS.ALL;
  const lower = category.toLowerCase().trim();
  if (lower === 'all') return CATEGORY_IDS.ALL;
  if (lower === 'top gainers' || lower === 'gainers' || lower === 'top_gainers') return CATEGORY_IDS.TOP_GAINERS;
  if (lower === 'layer 1' || lower === 'layer-1' || lower === 'layer1' || lower === 'l1') return CATEGORY_IDS.LAYER_1;
  if (lower === 'defi') return CATEGORY_IDS.DEFI;
  if (lower === 'layer 2' || lower === 'layer-2' || lower === 'layer2' || lower === 'l2') return CATEGORY_IDS.LAYER_2;
  return lower;
}
