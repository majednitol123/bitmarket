import { Pool } from 'pg';
import { config } from './env';

let pool: Pool | null = null;
let isDbConnected = false;

export function getDbPool(): Pool | null {
  return pool;
}

export function isDatabaseConnected(): boolean {
  return isDbConnected;
}

export async function initDatabase(): Promise<Pool | null> {
  try {
    pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.warn('[PostgreSQL] Unexpected error on idle client:', err.message);
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isDbConnected = true;
    console.log('[PostgreSQL] Connected successfully');
    return pool;
  } catch (err: any) {
    console.warn('[PostgreSQL] Could not connect to database on startup:', err.message);
    isDbConnected = false;
    return null;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      console.log('[PostgreSQL] Pool closed');
    } catch (err: any) {
      console.error('[PostgreSQL] Error closing pool:', err.message);
    }
  }
}
