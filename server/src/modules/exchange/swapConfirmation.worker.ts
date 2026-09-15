import { swapHistoryService } from '../portfolio/swapHistory.service';
import { blockchainRpcProvider } from '../../providers/BlockchainRpcProvider';
import { redisLock } from '../../cache/redisLock';
import { notificationService } from '../notification/notification.service';
import { getDbPool } from '../../config/database';

export class SwapConfirmationWorker {
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private isProcessing: boolean = false;

  constructor(intervalMs: number = 10000) {
    this.intervalMs = intervalMs;
  }

  /**
   * Starts the background confirmation loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[SwapConfirmationWorker] Started worker loop (interval: ${this.intervalMs}ms)`);

    // Run first check after 2 seconds
    this.timer = setTimeout(() => this.tick(), 2000);
  }

  /**
   * Stops the background confirmation loop cleanly
   */
  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[SwapConfirmationWorker] Worker stopped');
  }

  /**
   * Main poll cycle protected by Redis distributed lock
   */
  private async tick(): Promise<void> {
    if (!this.isRunning) return;

    if (!this.isProcessing) {
      this.isProcessing = true;
      try {
        await this.processPendingSwaps();
      } catch (err: any) {
        console.error('[SwapConfirmationWorker] Error in tick cycle:', err.message);
      } finally {
        this.isProcessing = false;
      }
    }

    if (this.isRunning) {
      this.timer = setTimeout(() => this.tick(), this.intervalMs);
    }
  }

  /**
   * Processes a batch of pending swaps
   */
  public async processPendingSwaps(): Promise<void> {
    // Acquire distributed lock to prevent multi-instance / cluster race conditions
    const ownerToken = redisLock.generateOwnerToken();
    const lockAcquired = await redisLock.acquireLock('locks:swap_worker', 8, ownerToken);
    if (!lockAcquired) {
      return;
    }

    try {
      const pendingSwaps = await swapHistoryService.getPendingSwaps(25);
      if (pendingSwaps.length === 0) {
        return;
      }

      console.log(`[SwapConfirmationWorker] Checking ${pendingSwaps.length} pending swap(s)...`);

      for (const swap of pendingSwaps) {
        await this.checkSwapTransaction(swap);
      }
    } finally {
      await redisLock.releaseLock('locks:swap_worker', ownerToken);
    }
  }

  /**
   * Probes blockchain receipt for a single swap transaction
   */
  public async checkSwapTransaction(swap: any): Promise<'confirmed' | 'failed' | 'pending'> {
    const txHash = swap.txHash;
    if (!txHash || !txHash.startsWith('0x') || txHash.length < 32) {
      console.warn(`[SwapConfirmationWorker] Invalid txHash format: ${txHash}. Marking failed.`);
      await swapHistoryService.updateSwapStatus(txHash, 'failed', {
        errorMessage: 'Invalid transaction hash format',
      });
      return 'failed';
    }

    const chain = swap.chain || swap.chainId || '1';

    let walletAddress = swap.walletAddress;
    if (!walletAddress) {
      try {
        const pool = getDbPool();
        if (pool) {
          const wRes = await pool.query(
            `SELECT w.address, s.from_amount, s.from_token_symbol, s.to_amount, s.to_token_symbol
             FROM swap_transactions s
             JOIN wallets w ON s.wallet_id = w.id
             WHERE LOWER(s.tx_hash) = LOWER($1)`,
            [txHash]
          );
          if (wRes.rows.length > 0) {
            walletAddress = wRes.rows[0].address;
            swap.fromAmount = swap.fromAmount || wRes.rows[0].from_amount;
            swap.fromTokenSymbol = swap.fromTokenSymbol || wRes.rows[0].from_token_symbol;
            swap.toAmount = swap.toAmount || wRes.rows[0].to_amount;
            swap.toTokenSymbol = swap.toTokenSymbol || wRes.rows[0].to_token_symbol;
          }
        }
      } catch (e: any) {
        // non-critical
      }
    }

    try {
      const receipt = await blockchainRpcProvider.getTransactionReceipt(chain, txHash);

      if (receipt) {
        if (receipt.status === 'success') {
          console.log(
            `[SwapConfirmationWorker] Swap ${txHash} CONFIRMED in block ${receipt.blockNumber} (gasUsed: ${receipt.gasUsed})`
          );
          await swapHistoryService.updateSwapStatus(txHash, 'confirmed', {
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
          });

          // Dispatch durable notification event for active devices
          if (walletAddress) {
            notificationService
              .createNotificationEvent({
                walletAddress,
                eventType: 'swap_confirmed',
                title: 'Swap Confirmed!',
                body: `Successfully swapped ${swap.fromAmount || ''} ${swap.fromTokenSymbol || ''} for ${swap.toAmount || ''} ${swap.toTokenSymbol || ''} on ${chain}.`,
                data: {
                  txHash,
                  chain,
                  blockNumber: receipt.blockNumber,
                  gasUsed: receipt.gasUsed,
                },
                idempotencyKey: `swap:confirmed:${txHash}`,
              })
              .catch((e) =>
                console.warn('[SwapConfirmationWorker] Notification error:', e.message)
              );
          }

          return 'confirmed';
        } else {
          console.warn(`[SwapConfirmationWorker] Swap ${txHash} REVERTED on-chain`);
          await swapHistoryService.updateSwapStatus(txHash, 'failed', {
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            errorMessage: 'Transaction reverted on-chain',
          });

          // Dispatch durable notification event for active devices
          if (walletAddress) {
            notificationService
              .createNotificationEvent({
                walletAddress,
                eventType: 'swap_failed',
                title: 'Swap Reverted',
                body: `Swap transaction on ${chain} was reverted on-chain.`,
                data: {
                  txHash,
                  chain,
                  errorMessage: 'Transaction reverted on-chain',
                },
                idempotencyKey: `swap:failed:${txHash}`,
              })
              .catch((e) =>
                console.warn('[SwapConfirmationWorker] Notification error:', e.message)
              );
          }

          return 'failed';
        }
      } else {
        // No receipt yet — transaction is pending in mempool
        const createdAtTime = swap.createdAt ? new Date(swap.createdAt).getTime() : Date.now();
        const elapsedMinutes = (Date.now() - createdAtTime) / (60 * 1000);

        if (elapsedMinutes > 45 && (swap.checkAttempts || 0) >= 30) {
          console.warn(
            `[SwapConfirmationWorker] Swap ${txHash} timed out after ${elapsedMinutes.toFixed(1)} mins and ${swap.checkAttempts} attempts.`
          );
          await swapHistoryService.updateSwapStatus(txHash, 'failed', {
            errorMessage: 'Transaction expired or dropped from mempool',
          });
          return 'failed';
        }

        await swapHistoryService.touchSwapCheck(txHash);
        return 'pending';
      }
    } catch (err: any) {
      console.warn(`[SwapConfirmationWorker] RPC error checking ${txHash}: ${err.message}`);
      await swapHistoryService.touchSwapCheck(txHash);
      return 'pending';
    }
  }
}

export const swapConfirmationWorker = new SwapConfirmationWorker(10000);
