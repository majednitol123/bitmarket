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
    let migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      migrationsDir = path.join(__dirname, '../../src/db/migrations');
    }
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[Migrations] Migrations directory not found: ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const client = await pool.connect();
    try {
      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        await client.query(sql);
        console.log(`[Migrations] Executed migration: ${file}`);
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Migrations] Error executing migrations:', err.message);
  }
}
