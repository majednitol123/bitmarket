import fs from 'fs';
import path from 'path';
import { getDbPool, isDatabaseConnected } from '../config/database';

export async function runMigrations(): Promise<void> {
  if (!isDatabaseConnected()) {
    console.log('[Migrations] Database not connected. Skipping migrations.');
    return;
  }

  const pool = getDbPool();
  if (!pool) return;

  try {
    const migrationFile = path.join(__dirname, 'migrations/001_create_portfolio_tables.sql');
    if (!fs.existsSync(migrationFile)) {
      console.warn(`[Migrations] Migration file not found: ${migrationFile}`);
      return;
    }

    const sql = fs.readFileSync(migrationFile, 'utf-8');
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log('[Migrations] Portfolio tables migration executed successfully.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Migrations] Error executing migrations:', err.message);
  }
}
