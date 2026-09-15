-- 004_price_alerts_infrastructure.sql
-- Phase 7: Zero-Provider-Overhead Price Alerts Infrastructure

CREATE TABLE IF NOT EXISTS price_alerts (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(128) NOT NULL,
    token_id VARCHAR(128) NOT NULL,
    token_symbol VARCHAR(32) NOT NULL,
    token_name VARCHAR(128),
    condition VARCHAR(32) NOT NULL, -- 'above', 'below', 'pct_increase', 'pct_decrease'
    target_price NUMERIC(36, 18) NOT NULL,
    base_price NUMERIC(36, 18),
    cooldown_minutes INTEGER NOT NULL DEFAULT 360, -- 0 for one-shot/once, or cooldown in minutes (e.g. 60, 360, 1440)
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    triggered_at TIMESTAMPTZ,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization indices for high-frequency shared market evaluation
CREATE INDEX IF NOT EXISTS idx_price_alerts_eval ON price_alerts (token_id, enabled);
CREATE INDEX IF NOT EXISTS idx_price_alerts_symbol ON price_alerts (token_symbol, enabled);
CREATE INDEX IF NOT EXISTS idx_price_alerts_wallet ON price_alerts (LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts (enabled) WHERE enabled = TRUE;
