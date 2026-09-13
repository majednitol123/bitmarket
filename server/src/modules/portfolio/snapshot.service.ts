import { getDbPool, isDatabaseConnected } from '../../config/database';

export class SnapshotService {
  /**
   * Helper to ensure wallet exists and get its ID
   */
  private async getOrCreateWalletId(chain: string, address: string): Promise<number | null> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return null;

    const normChain = chain.toLowerCase();
    const normAddress = address.toLowerCase();

    try {
      const selectRes = await pool.query(
        'SELECT id FROM wallets WHERE LOWER(chain) = $1 AND LOWER(address) = $2',
        [normChain, normAddress]
      );
      if (selectRes.rows.length > 0) {
        return selectRes.rows[0].id;
      }

      const insertRes = await pool.query(
        'INSERT INTO wallets (chain, address) VALUES ($1, $2) ON CONFLICT (chain, address) DO UPDATE SET updated_at = NOW() RETURNING id',
        [normChain, normAddress]
      );
      return insertRes.rows[0]?.id || null;
    } catch (err: any) {
      console.warn('[SnapshotService] Error in getOrCreateWalletId:', err.message);
      return null;
    }
  }

  /**
   * Creates a new portfolio snapshot if minimum interval (15 min) has passed
   */
  async createSnapshot(chain: string, address: string, totalValueUsd: number): Promise<void> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected() || totalValueUsd <= 0) return;

    try {
      const walletId = await this.getOrCreateWalletId(chain, address);
      if (!walletId) return;

      const normChain = chain.toLowerCase();

      // Check time of last snapshot
      const lastSnapshot = await pool.query(
        'SELECT timestamp FROM portfolio_snapshots WHERE wallet_id = $1 AND chain = $2 ORDER BY timestamp DESC LIMIT 1',
        [walletId, normChain]
      );

      if (lastSnapshot.rows.length > 0) {
        const lastTime = new Date(lastSnapshot.rows[0].timestamp).getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        if (Date.now() - lastTime < fifteenMinutes) {
          // Too soon for another snapshot
          return;
        }
      }

      await pool.query(
        'INSERT INTO portfolio_snapshots (wallet_id, chain, total_value_usd, timestamp) VALUES ($1, $2, $3, NOW())',
        [walletId, normChain, totalValueUsd]
      );
    } catch (err: any) {
      console.warn('[SnapshotService] Error creating snapshot:', err.message);
    }
  }

  /**
   * Gets historical snapshots for a wallet
   */
  async getSnapshots(
    chain: string,
    address: string,
    fromDate?: Date
  ): Promise<{ timestamp: number; value: number }[]> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return [];

    try {
      const since = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const query = `
        SELECT s.total_value_usd, s.timestamp
        FROM portfolio_snapshots s
        JOIN wallets w ON s.wallet_id = w.id
        WHERE LOWER(w.chain) = $1 AND LOWER(w.address) = $2 AND s.timestamp >= $3
        ORDER BY s.timestamp ASC
      `;

      const res = await pool.query(query, [chain.toLowerCase(), address.toLowerCase(), since]);
      return res.rows.map((r) => ({
        timestamp: new Date(r.timestamp).getTime(),
        value: Number(r.total_value_usd),
      }));
    } catch (err: any) {
      console.warn('[SnapshotService] Error getting snapshots:', err.message);
      return [];
    }
  }
}

export const snapshotService = new SnapshotService();
