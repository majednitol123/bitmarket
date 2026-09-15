import {
  MarketOverview,
  MarketToken,
  ChartPoint,
  ChartResponse,
} from './market.types';

function parseNumber(val: any, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const num = parseFloat(val);
    if (!isNaN(num)) return num;
  }
  return fallback;
}

export function mapCoinStatsOverview(raw: any): MarketOverview {
  return {
    marketCapUsd: parseNumber(raw?.marketCap, 0),
    volume24hUsd: parseNumber(raw?.volume, 0),
    btcDominancePercent: parseNumber(raw?.btcDominance, 0),
    marketCapChange24hPercent: parseNumber(raw?.marketCapChange, 0),
    volumeChange24hPercent: parseNumber(raw?.volumeChange, 0),
    btcDominanceChangePercent: parseNumber(raw?.btcDominanceChange, 0),
    updatedAt: new Date().toISOString(),
  };
}

export function mapCoinStatsCoin(raw: any): MarketToken | null {
  if (!raw || !raw.id || !raw.symbol || !raw.name) {
    return null;
  }

  // Normalize contract addresses if present
  let contractAddress: string | undefined = raw.contractAddress;
  let contractAddresses: { blockchain: string; contractAddress: string }[] | undefined = undefined;

  if (Array.isArray(raw.contractAddresses)) {
    const addresses = raw.contractAddresses
      .filter((c: any) => c && c.blockchain && c.contractAddress)
      .map((c: any) => ({
        blockchain: String(c.blockchain),
        contractAddress: String(c.contractAddress),
      }));
    if (addresses.length > 0) {
      contractAddresses = addresses;
      if (!contractAddress) {
        contractAddress = addresses[0].contractAddress;
      }
    }
  }

  // Parse sparkline if available
  const sparkline = Array.isArray(raw.sparkline)
    ? raw.sparkline.filter((val: any) => typeof val === 'number')
    : undefined;

  return {
    id: String(raw.id),
    symbol: String(raw.symbol).toUpperCase(),
    name: String(raw.name),
    logoUrl: raw.icon || '',
    priceUsd: parseNumber(raw.price, 0),
    change24hPercent: parseNumber(raw.priceChange1d, 0),
    change1hPercent: parseNumber(raw.priceChange1h, 0),
    change1wPercent: parseNumber(raw.priceChange1w, 0),
    marketCapUsd: parseNumber(raw.marketCap, 0),
    volume24hUsd: parseNumber(raw.volume, 0),
    rank: parseNumber(raw.rank, 9999),
    contractAddress,
    contractAddresses,
    priceUpdatedAt: new Date().toISOString(),
    sparkline,
  };
}

export function mapCoinStatsCoinList(rawList: any[]): MarketToken[] {
  if (!Array.isArray(rawList)) return [];
  const tokens: MarketToken[] = [];
  for (const raw of rawList) {
    const token = mapCoinStatsCoin(raw);
    if (token) {
      tokens.push(token);
    }
  }
  return tokens;
}

export function mapCoinStatsChart(coinId: string, period: string, rawChart: any): ChartResponse {
  let pointsRaw: any[] = [];

  if (Array.isArray(rawChart)) {
    pointsRaw = rawChart;
  } else if (rawChart && Array.isArray(rawChart.chart)) {
    pointsRaw = rawChart.chart;
  } else if (rawChart && Array.isArray(rawChart.result)) {
    pointsRaw = rawChart.result;
  }

  // CoinStats chart items are typically: [timestamp, price, btcPrice, volume]
  const points: ChartPoint[] = [];

  for (const item of pointsRaw) {
    if (Array.isArray(item) && item.length >= 2) {
      // timestamp may be in seconds or milliseconds
      let ts = Number(item[0]);
      if (ts < 1e11) {
        ts = ts * 1000; // convert to milliseconds
      }
      const price = Number(item[1]);
      const volume = item.length >= 4 ? Number(item[3]) : undefined;
      if (!isNaN(ts) && !isNaN(price)) {
        points.push({ timestamp: ts, priceUsd: price, volume });
      }
    } else if (item && typeof item === 'object') {
      let ts = Number(item.timestamp || item.time || item.t);
      if (ts < 1e11) {
        ts = ts * 1000;
      }
      const price = Number(item.price || item.p || item.val || item.value);
      if (!isNaN(ts) && !isNaN(price)) {
        points.push({ timestamp: ts, priceUsd: price, volume: item.volume });
      }
    }
  }

  return {
    tokenId: coinId,
    period,
    points,
    updatedAt: new Date().toISOString(),
  };
}
