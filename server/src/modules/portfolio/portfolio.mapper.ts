import {
  PortfolioHolding,
  PortfolioSummary,
  PortfolioTransaction,
  PortfolioChartPoint,
  PortfolioChartData,
} from './portfolio.types';

const EXPLORER_MAP: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  solana: 'https://solscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  'binance-smart-chain': 'https://bscscan.com/tx/',
  avalanche: 'https://snowtrace.io/tx/',
};

export function getExplorerTxUrl(chain: string, hash: string): string {
  if (!hash) return '';
  const prefix = EXPLORER_MAP[chain.toLowerCase()] || 'https://etherscan.io/tx/';
  return `${prefix}${hash}`;
}

/**
 * Maps raw CoinStats /wallet/balance array to clean, typed PortfolioHolding[]
 * and calculates total portfolio summary.
 */
export function mapCoinStatsHoldings(
  chain: string,
  rawHoldings: any[]
): { holdings: PortfolioHolding[]; summary: PortfolioSummary } {
  if (!Array.isArray(rawHoldings)) {
    return {
      holdings: [],
      summary: {
        totalValueUsd: 0,
        change24hUsd: 0,
        change24hPercent: 0,
        profitLossUsd: null,
        profitLossPercent: null,
        holdingsCount: 0,
      },
    };
  }

  // 1. Filter out spam / zero balance / zero value tokens
  const validTokens = rawHoldings.filter((item) => {
    if (!item) return false;
    const amount = Number(item.amount || 0);
    const price = Number(item.price || 0);
    const valueUsd = amount * price;

    // Filter spam: price is 0, amount is 0, or total value < $0.01
    return amount > 0 && price > 0 && valueUsd >= 0.01;
  });

  // 2. Map tokens and compute individual valueUsd
  const holdings: PortfolioHolding[] = validTokens.map((raw) => {
    const amount = Number(raw.amount || 0);
    const priceUsd = Number(raw.price || 0);
    const valueUsd = Math.round(amount * priceUsd * 100) / 100;
    const symbol = String(raw.symbol || 'UNKNOWN').toUpperCase();
    const contractAddress = raw.contractAddress || undefined;
    const id = contractAddress ? `${chain}:${contractAddress}` : `${chain}:native`;

    return {
      id,
      chain,
      coinId: raw.coinId || raw.name?.toLowerCase().replace(/\s+/g, '-') || symbol.toLowerCase(),
      symbol,
      name: raw.name || symbol,
      balance: `${amount < 0.0001 ? amount.toPrecision(4) : amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`,
      amount,
      decimals: Number(raw.decimals || 18),
      contractAddress,
      priceUsd,
      valueUsd,
      change24hPercent: Number(raw.pCh24h || 0),
      logoUrl: raw.imgUrl || raw.icon || '',
      allocationPercent: 0, // Computed in next step
    };
  });

  // 3. Sort by total value descending
  holdings.sort((a, b) => b.valueUsd - a.valueUsd);

  // 4. Calculate total portfolio value
  const totalValueUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0);

  // 5. Calculate allocations
  holdings.forEach((h) => {
    h.allocationPercent =
      totalValueUsd > 0 ? Math.round((h.valueUsd / totalValueUsd) * 10000) / 100 : 0;
  });

  // 6. Calculate 24h weighted change
  let totalPriorValue = 0;
  holdings.forEach((h) => {
    const changeFactor = 1 + h.change24hPercent / 100;
    // Guard against division by zero or extreme negatives
    const priorTokenVal = changeFactor > 0 ? h.valueUsd / changeFactor : h.valueUsd;
    totalPriorValue += priorTokenVal;
  });

  const change24hUsd =
    totalPriorValue > 0 ? Math.round((totalValueUsd - totalPriorValue) * 100) / 100 : 0;
  const change24hPercent =
    totalPriorValue > 0
      ? Math.round(((totalValueUsd - totalPriorValue) / totalPriorValue) * 10000) / 100
      : 0;

  const summary: PortfolioSummary = {
    totalValueUsd: Math.round(totalValueUsd * 100) / 100,
    change24hUsd,
    change24hPercent,
    profitLossUsd: null, // As specified in plan2.md: unreliable without cost basis
    profitLossPercent: null,
    holdingsCount: holdings.length,
  };

  return { holdings, summary };
}

/**
 * Maps raw CoinStats /wallet/transactions items to clean PortfolioTransaction[]
 */
export function mapCoinStatsTransactions(
  chain: string,
  rawTransactions: any[]
): PortfolioTransaction[] {
  if (!Array.isArray(rawTransactions)) return [];

  return rawTransactions.map((tx, index) => {
    const rawHash = tx.hash;
    const hash =
      typeof rawHash === 'object' && rawHash !== null
        ? String(rawHash.id || '')
        : String(rawHash || tx.transactionHash || `tx-${index}`);

    const explorerUrl =
      typeof rawHash === 'object' && rawHash?.explorerUrl
        ? String(rawHash.explorerUrl)
        : getExplorerTxUrl(chain, hash);

    const firstSubTx = tx.transactions?.[0]?.items?.[0] || {};
    const mainContent = tx.mainContent || {};
    const coinData = tx.coinData || {};
    const coinObj = firstSubTx.coin || {};

    let type: PortfolioTransaction['type'] = 'other';
    const rawType = String(tx.type || tx.transactions?.[0]?.action || '').toLowerCase();
    if (rawType.includes('send') || rawType.includes('out') || rawType.includes('sent')) type = 'send';
    else if (rawType.includes('receive') || rawType.includes('in') || rawType.includes('deposit') || rawType.includes('mint')) type = 'receive';
    else if (rawType.includes('swap') || rawType.includes('trade')) type = 'swap';
    else if (rawType.includes('execution') || rawType.includes('contract')) type = 'execution';

    let dateMs = Date.now();
    if (tx.date) {
      const parsed = new Date(tx.date).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        dateMs = parsed;
      }
    }

    const symbol = String(coinData.symbol || coinObj.symbol || tx.coinSymbol || 'TOKEN').trim();
    const countVal = firstSubTx.count != null ? firstSubTx.count : coinData.count != null ? coinData.count : tx.amount || 0;
    const valueUsd = Number(firstSubTx.totalWorth ?? coinData.currentValue ?? tx.valueUsd ?? 0);
    const coinIcon =
      (mainContent.coinIcons && mainContent.coinIcons[0]) ||
      coinData.iconUrl ||
      coinData.icon ||
      '';

    return {
      id: hash || `tx-${index}`,
      type,
      date: dateMs,
      hash,
      explorerUrl,
      fromAddress: firstSubTx.fromAddress || mainContent.from || tx.from || '',
      toAddress: firstSubTx.toAddress || mainContent.to || tx.to || '',
      coinSymbol: symbol.toUpperCase(),
      coinName: coinObj.name || coinData.name || symbol,
      coinIcon,
      amount: `${Number(countVal).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol.toUpperCase()}`,
      valueUsd: Math.round(valueUsd * 100) / 100,
      profitLoss: tx.profitLoss?.profit != null ? Number(tx.profitLoss.profit) : null,
    };
  });
}

/**
 * Builds candlestick/line points and summary metadata for portfolio chart
 */
export function buildPortfolioChartData(
  timeframe: string,
  rawPoints: { timestamp: number; value: number }[]
): PortfolioChartData {
  if (!rawPoints || rawPoints.length === 0) {
    return {
      timeframe,
      points: [],
      pnl: '$0.00',
      pnlPercent: '0.00%',
      isPositive: true,
      high: '$0.00',
      low: '$0.00',
      volume24h: '$0.00',
    };
  }

  // Sort chronologically
  const sorted = [...rawPoints].sort((a, b) => a.timestamp - b.timestamp);

  // Group into candles (approx 24-30 points)
  const targetPoints = Math.min(24, sorted.length);
  const chunkSize = Math.max(1, Math.floor(sorted.length / targetPoints));

  const points: PortfolioChartPoint[] = [];
  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let i = 0; i < sorted.length; i += chunkSize) {
    const chunk = sorted.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const open = chunk[0].value;
    const close = chunk[chunk.length - 1].value;
    let high = -Infinity;
    let low = Infinity;

    chunk.forEach((p) => {
      if (p.value > high) high = p.value;
      if (p.value < low) low = p.value;
      if (p.value > maxVal) maxVal = p.value;
      if (p.value < minVal) minVal = p.value;
    });

    const dateObj = new Date(chunk[chunk.length - 1].timestamp);
    let timeLabel = `${dateObj.getHours().toString().padStart(2, '0')}:00`;
    if (timeframe === '1W' || timeframe === '1M') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      timeLabel = `${days[dateObj.getDay()]} ${dateObj.getHours().toString().padStart(2, '0')}:00`;
    } else if (timeframe === '1Y' || timeframe === 'ALL') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      timeLabel = `${months[dateObj.getMonth()]} ${dateObj.getDate()}`;
    }

    points.push({
      time: timeLabel,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(open * 0.05), // Synthetic volume estimate for chart display
    });
  }

  if (points.length > 0) {
    points[points.length - 1].time = 'Now';
  }

  const firstVal = points[0]?.open || 0;
  const lastVal = points[points.length - 1]?.close || 0;
  const pnlVal = lastVal - firstVal;
  const pnlPercentVal = firstVal > 0 ? (pnlVal / firstVal) * 100 : 0;
  const isPositive = pnlVal >= 0;

  return {
    timeframe,
    points,
    pnl: `${isPositive ? '+' : ''}$${Math.abs(pnlVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pnlPercent: `${isPositive ? '+' : ''}${pnlPercentVal.toFixed(2)}%`,
    isPositive,
    high: `$${maxVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    low: `$${minVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    volume24h: `$${(lastVal * 0.15).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  };
}
