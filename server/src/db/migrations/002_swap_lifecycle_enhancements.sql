-- 002_swap_lifecycle_enhancements.sql
-- Adds columns and indices to support real on-chain confirmation worker, idempotency, and reorg safety

ALTER TABLE swap_transactions ADD COLUMN IF NOT EXISTS chain_id INTEGER;
ALTER TABLE swap_transactions ADD COLUMN IF NOT EXISTS block_number BIGINT;
ALTER TABLE swap_transactions ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE swap_transactions ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE swap_transactions ADD COLUMN IF NOT EXISTS check_attempts INTEGER DEFAULT 0;
ALTER TABLE swap_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

-- Create performance index for confirmation worker to quickly find pending swaps
CREATE INDEX IF NOT EXISTS idx_swaps_pending_worker ON swap_transactions(status, last_checked_at) WHERE status = 'pending';

-- Create unique index on (chain, tx_hash) to guarantee idempotency across all swap submissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_swaps_chain_tx_hash ON swap_transactions(chain, tx_hash);

-- Create unique index on idempotency_key when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_swaps_idempotency_key ON swap_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
