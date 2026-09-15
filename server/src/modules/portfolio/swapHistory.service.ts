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

  /**
   * Idempotent swap registration with deduplication on idempotency_key and (chain, tx_hash)
   */
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
      const txHash = data.txHash?.trim() || '';

      // 1. Idempotency Check via idempotency_key
      if (data.idempotencyKey) {
        const existingKeyRes = await pool.query(
          'SELECT * FROM swap_transactions WHERE idempotency_key = $1',
          [data.idempotencyKey]
        );
        if (existingKeyRes.rows.length > 0) {
          return this.mapRowToRecord(existingKeyRes.rows[0]);
        }
      }

      // 2. Check existing record by tx_hash
      if (txHash) {
        const existingTxRes = await pool.query(
          'SELECT * FROM swap_transactions WHERE LOWER(chain) = $1 AND LOWER(tx_hash) = $2',
          [normChain, txHash.toLowerCase()]
        );
        if (existingTxRes.rows.length > 0) {
          return this.mapRowToRecord(existingTxRes.rows[0]);
        }
      }

      // 3. Insert new swap transaction
      const query = `
        INSERT INTO swap_transactions (
          wallet_id, chain, chain_id, tx_hash,
          from_token_address, from_token_symbol, from_amount,
          to_token_address, to_token_symbol, to_amount,
          router, status, gas_used, block_number, idempotency_key,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        ON CONFLICT (wallet_id, chain, tx_hash) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING *
      `;

      const res = await pool.query(query, [
        walletId,
        normChain,
        data.chainId || null,
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
        data.blockNumber || null,
        data.idempotencyKey || null,
      ]);

      const row = res.rows[0];
      return this.mapRowToRecord(row);
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
      const items = rows.map((row) => this.mapRowToRecord(row));

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
   * Updates swap status upon confirmation or failure
   */
  async updateSwapStatus(
    txHash: string,
    status: 'pending' | 'confirmed' | 'completed' | 'failed',
    details?: {
      blockNumber?: number;
      gasUsed?: string;
      errorMessage?: string;
    }
  ): Promise<boolean> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return false;

    try {
      const isConfirmed = status === 'confirmed' || status === 'completed';
      const res = await pool.query(
        `UPDATE swap_transactions
         SET status = $1,
             block_number = COALESCE($2, block_number),
             gas_used = COALESCE($3, gas_used),
             error_message = COALESCE($4, error_message),
             confirmed_at = CASE WHEN $5::boolean THEN NOW() ELSE confirmed_at END,
             updated_at = NOW()
         WHERE LOWER(tx_hash) = LOWER($6)
         RETURNING wallet_id, chain`,
        [status, details?.blockNumber || null, details?.gasUsed || null, details?.errorMessage || null, isConfirmed, txHash]
      );

      if (res.rows.length > 0 && isConfirmed) {
        const { wallet_id, chain } = res.rows[0];
        const walletRes = await pool.query('SELECT address FROM wallets WHERE id = $1', [wallet_id]);
        if (walletRes.rows.length > 0) {
          const address = walletRes.rows[0].address;
          await invalidatePortfolioCache(chain, address);
        }
      }

      return res.rowCount !== null && res.rowCount > 0;
    } catch (err: any) {
      console.error('[SwapHistoryService] Error updating swap status:', err.message);
      return false;
    }
  }

  /**
   * Retrieves pending swaps for background confirmation worker
   */
  async getPendingSwaps(limit: number = 25): Promise<(SwapTransactionRecord & { walletAddress: string })[]> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return [];

    try {
      const query = `
        SELECT s.*, w.address as wallet_address
        FROM swap_transactions s
        JOIN wallets w ON s.wallet_id = w.id
        WHERE s.status = 'pending'
        ORDER BY COALESCE(s.last_checked_at, s.created_at) ASC
        LIMIT $1
      `;

      const res = await pool.query(query, [limit]);
      return res.rows.map((r) => ({
        ...this.mapRowToRecord(r),
        walletAddress: r.wallet_address,
      }));
    } catch (err: any) {
      console.error('[SwapHistoryService] Error querying pending swaps:', err.message);
      return [];
    }
  }

  /**
   * Updates last_checked_at and check_attempts for a transaction
   */
  async touchSwapCheck(txHash: string): Promise<void> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return;

    try {
      await pool.query(
        `UPDATE swap_transactions
         SET last_checked_at = NOW(),
             check_attempts = COALESCE(check_attempts, 0) + 1,
             updated_at = NOW()
         WHERE LOWER(tx_hash) = LOWER($1)`,
        [txHash]
      );
    } catch (err: any) {
      console.warn('[SwapHistoryService] Error touching swap check:', err.message);
    }
  }

  private mapRowToRecord(row: any): SwapTransactionRecord {
    return {
      id: row.id,
      walletId: row.wallet_id,
      chain: row.chain,
      chainId: row.chain_id ? Number(row.chain_id) : undefined,
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
      blockNumber: row.block_number ? Number(row.block_number) : undefined,
      errorMessage: row.error_message,
      lastCheckedAt: row.last_checked_at,
      checkAttempts: row.check_attempts ? Number(row.check_attempts) : 0,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      updatedAt: row.updated_at,
    };
  }
}

export const swapHistoryService = new SwapHistoryService();
