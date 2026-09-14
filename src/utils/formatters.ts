export function formatCompactNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '$0.00';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e12) {
    return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  }
  if (abs >= 1e9) {
    return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

export function formatUsd(
  val: number | undefined | null,
  options?: { compactThreshold?: number; decimals?: number }
): string {
  if (val === undefined || val === null || isNaN(val)) return '$0.00';

  const abs = Math.abs(val);
  const sign = val < 0 ? '-$' : '$';
  const threshold = options?.compactThreshold ?? 100_000_000; // compact at 100M by default

  if (abs >= threshold) {
    return formatCompactNumber(val);
  }

  const decimals = options?.decimals ?? 2;
  return `${sign}${abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatTokenBalance(
  amount: number | string | undefined | null,
  symbol?: string
): string {
  if (amount === undefined || amount === null) return `0 ${symbol || ''}`.trim();
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `0 ${symbol || ''}`.trim();

  let formatted: string;
  const abs = Math.abs(num);

  if (abs >= 1e9) {
    formatted = `${(num / 1e9).toFixed(2)}B`;
  } else if (abs >= 1e6) {
    formatted = `${(num / 1e6).toFixed(2)}M`;
  } else if (abs >= 1_000) {
    formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (abs >= 1) {
    formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else if (abs >= 0.0001) {
    formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  } else if (abs === 0) {
    formatted = '0';
  } else {
    formatted = num.toPrecision(4);
  }

  return symbol ? `${formatted} ${symbol}` : formatted;
}

export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || isNaN(price)) return '$0.00';

  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  }
  if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  }
  return `$${price.toFixed(8)}`;
}

export function formatPercent(percent: number | undefined | null): string {
  if (percent === undefined || percent === null || isNaN(percent)) return '0.00%';

  const prefix = percent > 0 ? '+' : '';
  return `${prefix}${percent.toFixed(2)}%`;
}

