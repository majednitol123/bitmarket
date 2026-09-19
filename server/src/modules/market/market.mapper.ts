import {
  MarketOverview,
  MarketToken,
} from './market.types';

function parseNumber(val: any, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const num = parseFloat(val);
    if (!isNaN(num)) return num;
  }
  return fallback;
}

export function mapCoinMarketCapOverview(raw: any): MarketOverview {
  const data = raw?.data || raw;
  const quote = data?.quote?.USD || {};
  return {
    marketCapUsd: parseNumber(quote.total_market_cap, 0),
    volume24hUsd: parseNumber(quote.total_volume_24h, 0),
    btcDominancePercent: parseNumber(data?.btc_dominance, 0),
    marketCapChange24hPercent: parseNumber(quote.total_market_cap_yesterday_percentage_change, 0),
    volumeChange24hPercent: parseNumber(quote.total_volume_24h_yesterday_percentage_change, 0),
    btcDominanceChangePercent: parseNumber(data?.btc_dominance_24h_percentage_change, 0),
    updatedAt: quote.last_updated || data?.last_updated || new Date().toISOString(),
  };
}

export function mapCoinMarketCapCoin(raw: any): MarketToken | null {
  if (!raw || !raw.symbol || !raw.name) {
    return null;
  }

  const quote = raw.quote?.USD || {};
  const cmcId = typeof raw.id === 'number' ? raw.id : parseInt(raw.id, 10);
  const logoUrl = !isNaN(cmcId) && cmcId > 0
    ? `https://s2.coinmarketcap.com/static/img/coins/128x128/${cmcId}.png`
    : '';

  let contractAddress: string | undefined = undefined;
  let contractAddresses: { blockchain: string; contractAddress: string }[] | undefined = undefined;

  if (raw.platform && raw.platform.token_address) {
    contractAddress = raw.platform.token_address;
    contractAddresses = [
      {
        blockchain: raw.platform.slug || raw.platform.name || 'ethereum',
        contractAddress: raw.platform.token_address,
      },
    ];
  }

  const tags = Array.isArray(raw.tags) ? raw.tags : [];

  return {
    id: raw.slug ? String(raw.slug).toLowerCase() : String(raw.id),
    symbol: String(raw.symbol).toUpperCase(),
    name: String(raw.name),
    logoUrl,
    priceUsd: parseNumber(quote.price, 0),
    change24hPercent: parseNumber(quote.percent_change_24h, 0),
    change1hPercent: parseNumber(quote.percent_change_1h, 0),
    change1wPercent: parseNumber(quote.percent_change_7d, 0),
    marketCapUsd: parseNumber(quote.market_cap, 0),
    volume24hUsd: parseNumber(quote.volume_24h, 0),
    rank: parseNumber(raw.cmc_rank, 9999),
    contractAddress,
    contractAddresses,
    priceUpdatedAt: quote.last_updated || raw.last_updated || new Date().toISOString(),
    cmcId: !isNaN(cmcId) ? cmcId : undefined,
    tags,
  };
}

export function mapCoinMarketCapCoinList(rawList: any[]): MarketToken[] {
  if (!Array.isArray(rawList)) return [];
  const tokens: MarketToken[] = [];
  for (const raw of rawList) {
    const token = mapCoinMarketCapCoin(raw);
    if (token) {
      tokens.push(token);
    }
  }
  return tokens;
}

