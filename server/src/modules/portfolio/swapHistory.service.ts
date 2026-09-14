import { getDbPool, isDatabaseConnected } from '../../config/database';
import { SwapTransactionRecord } from './portfolio.types';
import { invalidatePortfolioCache } from './portfolio.cache';

export class SwapHistoryService {

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
      console.warn('[SwapHistoryService] Error in getOrCreateWalletId:', err.message);
      return null;
    }
  }


  async recordSwap(
    chain: string,
    address: string,
    data: Partial<SwapTransactionRecord>
  ): Promise<SwapTransactionRecord | null> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return null;

    try {
      const walletId = await this.getOrCreateWalletId(chain, address);
      if (!walletId) return null;

      const normChain = chain.toLowerCase();
      const txHash = data.txHash || '';

      const query = `
        INSERT INTO swap_transactions (
          wallet_id, chain, tx_hash,
          from_token_address, from_token_symbol, from_amount,
          to_token_address, to_token_symbol, to_amount,
          router, status, gas_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (wallet_id, chain, tx_hash) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING *
      `;

      const res = await pool.query(query, [
        walletId,
        normChain,
        txHash,
        data.fromTokenAddress || null,
        data.fromTokenSymbol || null,
        data.fromAmount || null,
        data.toTokenAddress || null,
        data.toTokenSymbol || null,
        data.toAmount || null,
        data.router || null,
        data.status || 'pending',
        data.gasUsed || null,
      ]);

      // Invalidate portfolio cache so frontend refreshes
      await invalidatePortfolioCache(chain, address);

      const row = res.rows[0];
      return {
        id: row.id,
        walletId: row.wallet_id,
        chain: row.chain,
        txHash: row.tx_hash,
        fromTokenAddress: row.from_token_address,
        fromTokenSymbol: row.from_token_symbol,
        fromAmount: row.from_amount,
        toTokenAddress: row.to_token_address,
        toTokenSymbol: row.to_token_symbol,
        toAmount: row.to_amount,
        router: row.router,
        status: row.status,
        gasUsed: row.gas_used,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
      };
    } catch (err: any) {
      console.error('[SwapHistoryService] Error recording swap:', err.message);
      return null;
    }
  }

  /**
   * Retrieves swap history for a wallet
   */
  async getSwapHistory(
    chain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ items: SwapTransactionRecord[]; meta: { page: number; limit: number; hasMore: boolean } }> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) {
      return { items: [], meta: { page, limit, hasMore: false } };
    }

    try {
      const offset = (page - 1) * limit;
      const normChain = chain.toLowerCase();
      const query = `
        SELECT s.*
        FROM swap_transactions s
        JOIN wallets w ON s.wallet_id = w.id
        WHERE (
          LOWER(w.chain) = $1 OR LOWER(s.chain) = $1
          OR ($1 = 'binance_smart' AND (LOWER(s.chain) IN ('56', 'binance-smart-chain', 'bsc') OR LOWER(w.chain) IN ('56', 'binance-smart-chain', 'bsc')))
          OR ($1 = 'polygon-pos' AND (LOWER(s.chain) IN ('137', 'polygon', 'matic') OR LOWER(w.chain) IN ('137', 'polygon', 'matic')))
          OR ($1 = 'arbitrum-one' AND (LOWER(s.chain) IN ('42161', 'arbitrum') OR LOWER(w.chain) IN ('42161', 'arbitrum')))
          OR ($1 = 'optimistic-ethereum' AND (LOWER(s.chain) IN ('10', 'optimism') OR LOWER(w.chain) IN ('10', 'optimism')))
          OR ($1 = 'ethereum' AND (LOWER(s.chain) = '1' OR LOWER(w.chain) = '1'))
        ) AND LOWER(w.address) = $2
        ORDER BY s.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const res = await pool.query(query, [
        normChain,
        address.toLowerCase(),
        limit + 1,
        offset,
      ]);

      const hasMore = res.rows.length > limit;
      const rows = res.rows.slice(0, limit);

      const items: SwapTransactionRecord[] = rows.map((row) => ({
        id: row.id,
        walletId: row.wallet_id,
        chain: row.chain,
        txHash: row.tx_hash,
        fromTokenAddress: row.from_token_address,
        fromTokenSymbol: row.from_token_symbol,
        fromAmount: row.from_amount,
        toTokenAddress: row.to_token_address,
        toTokenSymbol: row.to_token_symbol,
        toAmount: row.to_amount,
        router: row.router,
        status: row.status,
        gasUsed: row.gas_used,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
      }));

      return {
        items,
        meta: { page, limit, hasMore },
      };
    } catch (err: any) {
      console.error('[SwapHistoryService] Error fetching swap history:', err.message);
      return { items: [], meta: { page, limit, hasMore: false } };
    }
  }

  /**
   * Updates swap status upon confirmation
   */
  async updateSwapStatus(
    txHash: string,
    status: 'completed' | 'failed'
  ): Promise<boolean> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return false;

    try {
      await pool.query(
        `UPDATE swap_transactions
         SET status = $1, confirmed_at = NOW(), updated_at = NOW()
         WHERE tx_hash = $2`,
        [status, txHash]
      );
      return true;
    } catch (err: any) {
      console.error('[SwapHistoryService] Error updating swap status:', err.message);
      return false;
    }
  }
}

export const swapHistoryService = new SwapHistoryService();
