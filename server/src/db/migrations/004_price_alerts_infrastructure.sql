

CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(128) NOT NULL,
    chain VARCHAR(64) NOT NULL DEFAULT 'ethereum',
    token_address VARCHAR(128),
    token_id VARCHAR(128) NOT NULL,
    token_symbol VARCHAR(32) NOT NULL,
    token_name VARCHAR(128),
    condition VARCHAR(32) NOT NULL, -- 'above', 'below', 'pct_increase', 'pct_decrease'
    target_price NUMERIC(36, 18) NOT NULL,
    base_price NUMERIC(36, 18),
    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    cooldown_minutes INTEGER NOT NULL DEFAULT 360, -- 0 for one-shot/once, or cooldown in minutes (e.g. 60, 360, 1440)
    cooldown_until TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(32) NOT NULL DEFAULT 'ARMED', -- 'ARMED', 'TRIGGERED', 'DISABLED'
    last_evaluated_price NUMERIC(36, 18),
    last_evaluated_at TIMESTAMPTZ,
    triggered_at TIMESTAMPTZ,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


ALTER TABLE price_alerts 
ADD COLUMN IF NOT EXISTS chain VARCHAR(64) NOT NULL DEFAULT 'ethereum',
ADD COLUMN IF NOT EXISTS token_address VARCHAR(128),
ADD COLUMN IF NOT EXISTS currency VARCHAR(16) NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ARMED',
ADD COLUMN IF NOT EXISTS last_evaluated_price NUMERIC(36, 18),
ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

-- Backfill status for existing rows
UPDATE price_alerts
SET status = 'TRIGGERED'
WHERE triggered_at IS NOT NULL AND status = 'ARMED';

UPDATE price_alerts
SET status = 'DISABLED'
WHERE enabled = FALSE AND status = 'ARMED';

-- Optimization indices for asset-scoped high-frequency batch evaluation
CREATE INDEX IF NOT EXISTS idx_price_alerts_eval ON price_alerts (token_id, enabled, status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON price_alerts (token_symbol, enabled, status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_chain_token ON price_alerts (chain, LOWER(token_address)) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_alerts_wallet ON price_alerts (LOWER(wallet_address), status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts (enabled, status) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_alerts_cooldown ON price_alerts (cooldown_until) WHERE cooldown_until IS NOT NULL;


DELETE FROM price_alerts a
USING price_alerts b
WHERE a.id < b.id
  AND LOWER(a.wallet_address) = LOWER(b.wallet_address)
  AND LOWER(a.token_id) = LOWER(b.token_id)
  AND a.condition = b.condition
  AND a.target_price = b.target_price
  AND a.enabled = TRUE
  AND b.enabled = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_alerts_active_target
ON price_alerts (LOWER(wallet_address), LOWER(token_id), condition, target_price)
WHERE enabled = TRUE;
