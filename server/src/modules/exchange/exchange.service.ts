import {
  ExchangeQuoteRequest,
  ExchangeQuoteResponse,
  BuildTxRequest,
  BuildTxResponse,
  ConfirmSwapRequest,
  SwapTransactionRecord,
  SwapStatusResponse,
} from './exchange.types';
import { exchangeProvider } from './exchange.provider';
import { swapHistoryService } from '../portfolio/swapHistory.service';
import { swapConfirmationWorker } from './swapConfirmation.worker';
import { cacheService } from '../../cache/cacheService';
import { cacheKeys } from '../../cache/cacheKeys';
import { getDbPool, isDatabaseConnected } from '../../config/database';
import { invalidatePortfolioCache } from '../portfolio/portfolio.cache';
import { blockchainRpcProvider } from '../../providers/BlockchainRpcProvider';

export class ExchangeService {
  /**
   * Generates or retrieves a live quote for single-chain swap or cross-chain bridge
   */
  async getQuote(params: ExchangeQuoteRequest): Promise<ExchangeQuoteResponse> {
    const fromChain = String(params.fromChain || '1').toLowerCase();
    const toChain = String(params.toChain || '1').toLowerCase();
    const fromToken = String(params.fromToken || 'ETH').toUpperCase();
    const toToken = String(params.toToken || 'USDC').toUpperCase();
    const amount = String(params.fromAmount || '1.0');
    const slippage = String(params.slippage || '0.5');

    const cacheKey = cacheKeys.swapQuote(fromChain, toChain, fromToken, toToken, `${amount}:${slippage}`);

    // Cache quote for 10 seconds with 20s stale window to avoid API spam during user typing
    return cacheService.getOrFetch(
      cacheKey,
      { freshSeconds: 10, staleSeconds: 20 },
      async () => exchangeProvider.getQuote(params),
      { source: 'lifi' }
    );
  }

  /**
   * Builds the unsigned blockchain transaction calldata for user wallet signature
   * Strictly avoids generating synthetic dummy hashes per Critical Rule #4
   */
  async buildTransaction(params: BuildTxRequest): Promise<BuildTxResponse> {
    return exchangeProvider.buildTransaction(params);
  }

  /**
   * Registers a real broadcasted transaction hash from user's wallet with idempotency
   */
  async confirmSwap(params: ConfirmSwapRequest): Promise<SwapTransactionRecord | null> {
    if (!params.txHash || !params.walletAddress) {
      throw new Error('txHash and walletAddress are required to confirm swap');
    }

    const cleanHash = params.txHash.trim();
    const cleanAddress = params.walletAddress.trim();
    const chain = params.chain || 'ethereum';

    // 1. Record swap in durable database with idempotency guarantee
    const recorded = await swapHistoryService.recordSwap(
      chain,
      cleanAddress,
      {
        txHash: cleanHash,
        chainId: params.chainId,
        fromTokenAddress: params.fromTokenAddress,
        fromTokenSymbol: params.fromTokenSymbol,
        toTokenAddress: params.toTokenAddress,
        toTokenSymbol: params.toTokenSymbol,
        fromAmount: params.fromAmount,
        toAmount: params.toAmount,
        router: params.router,
        status: 'pending',
        idempotencyKey: params.idempotencyKey,
      }
    );

    // 2. Perform an immediate single receipt probe in case fast L2/DEX has already mined it
    if (recorded) {
      swapConfirmationWorker.checkSwapTransaction({
        txHash: cleanHash,
        chain,
        chainId: params.chainId,
        createdAt: recorded.createdAt,
      }).catch((err) => {
        console.warn('[ExchangeService] Immediate check non-critical error:', err.message);
      });
    }

    return recorded;
  }

  /**
   * Retrieves status of a swap transaction from database with optional live RPC probe
   */
  async getSwapStatus(txHash: string, checkNow: boolean = false): Promise<SwapStatusResponse | null> {
    const pool = getDbPool();
    if (!pool || !isDatabaseConnected()) return null;

    try {
      const cleanHash = txHash.trim();

      // If on-demand check requested, trigger receipt probe first
      if (checkNow) {
        const checkRes = await pool.query(
          'SELECT * FROM swap_transactions WHERE LOWER(tx_hash) = LOWER($1)',
          [cleanHash]
        );
        if (checkRes.rows.length > 0 && checkRes.rows[0].status === 'pending') {
          const row = checkRes.rows[0];
          await swapConfirmationWorker.checkSwapTransaction({
            txHash: row.tx_hash,
            chain: row.chain,
            chainId: row.chain_id,
            createdAt: row.created_at,
            checkAttempts: row.check_attempts,
          });
        }
      }

      const res = await pool.query(
        'SELECT * FROM swap_transactions WHERE LOWER(tx_hash) = LOWER($1)',
        [cleanHash]
      );

      if (res.rows.length === 0) return null;
      const row = res.rows[0];

      let confirmations = 0;
      if (row.block_number) {
        try {
          const currentBlock = await blockchainRpcProvider.getBlockNumber(row.chain || row.chain_id || 1);
          confirmations = Math.max(0, currentBlock - Number(row.block_number) + 1);
        } catch {
          confirmations = 1;
        }
      }

      return {
        id: row.id,
        txHash: row.tx_hash,
        status: row.status,
        chain: row.chain,
        chainId: row.chain_id ? Number(row.chain_id) : undefined,
        blockNumber: row.block_number ? Number(row.block_number) : undefined,
        gasUsed: row.gas_used,
        confirmations,
        errorMessage: row.error_message,
        confirmedAt: row.confirmed_at,
        createdAt: row.created_at,
      };
    } catch (err: any) {
      console.error('[ExchangeService] Error getting swap status:', err.message);
      return null;
    }
  }
}

export const exchangeService = new ExchangeService();
