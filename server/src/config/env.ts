import dotenv from 'dotenv';
import path from 'path';

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  coinstats: {
    apiKey: process.env.COINSTATS_API_KEY || '9e04cc50d68c0cb7602cd663432857ea339f5b737e62',
    baseUrl: process.env.COINSTATS_BASE_URL || 'https://openapiv1.coinstats.app',
    timeoutMs: 10000,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/agregator',
  },
  cacheTtl: {
    overview: parseInt(process.env.CACHE_TTL_OVERVIEW || '30', 10),
    tokens: parseInt(process.env.CACHE_TTL_TOKENS || '30', 10),
    price: parseInt(process.env.CACHE_TTL_PRICE || '15', 10),
    chart: parseInt(process.env.CACHE_TTL_CHART || '300', 10),
    search: parseInt(process.env.CACHE_TTL_SEARCH || '60', 10),
  },
};
