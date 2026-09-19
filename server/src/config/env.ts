import dotenv from 'dotenv';
import path from 'path';

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  coinstats: {
    apiKey: process.env.COINSTATS_API_KEY || '',
    apiKeys: (process.env.COINSTATS_API_KEYS || process.env.COINSTATS_API_KEY || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    baseUrl: process.env.COINSTATS_BASE_URL || 'https://openapiv1.coinstats.app',
    timeoutMs: 10000,
  },
  coinmarketcap: {
    baseUrl: process.env.COINMARKETCAP_BASE_URL || 'https://pro-api.coinmarketcap.com/public-api/v1',
    timeoutMs: 10000,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agregator',
  },
  cacheTtl: {
    overview: parseInt(process.env.CACHE_TTL_OVERVIEW || '7', 10),
    tokens: parseInt(process.env.CACHE_TTL_TOKENS || '7', 10),
    price: parseInt(process.env.CACHE_TTL_PRICE || '7', 10),
    chart: parseInt(process.env.CACHE_TTL_CHART || '300', 10),
    search: parseInt(process.env.CACHE_TTL_SEARCH || '60', 10),
    portfolio: parseInt(process.env.CACHE_TTL_PORTFOLIO || '30', 10),
    holdings: parseInt(process.env.CACHE_TTL_HOLDINGS || '30', 10),
    portfolioChart: parseInt(process.env.CACHE_TTL_PORTFOLIO_CHART || '120', 10),
    transactions: parseInt(process.env.CACHE_TTL_TRANSACTIONS || '60', 10),
    defi: parseInt(process.env.CACHE_TTL_DEFI || '120', 10),
  },
  rateLimit: {
    globalMax: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '120', 10),
    refreshMax: parseInt(process.env.RATE_LIMIT_REFRESH_MAX || '15', 10),
    mutationMax: parseInt(process.env.RATE_LIMIT_MUTATION_MAX || '30', 10),
  },
  marketRefreshInterval: parseInt(process.env.MARKET_REFRESH_INTERVAL_SECONDS || '5', 10),
};

/**
 * Mask secret string for safe logging
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '(empty)';
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
