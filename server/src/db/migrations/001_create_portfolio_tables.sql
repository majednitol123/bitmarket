CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  address VARCHAR(128) NOT NULL,
  chain VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chain, address)
);

CREATE INDEX IF NOT EXISTS idx_wallets_chain_address ON wallets(chain, address);

CREATE TABLE IF NOT EXISTS swap_transactions (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
  chain VARCHAR(32) NOT NULL,
  tx_hash VARCHAR(128) NOT NULL,
  from_token_address VARCHAR(128),
  from_token_symbol VARCHAR(32),
  from_amount VARCHAR(64),
  to_token_address VARCHAR(128),
  to_token_symbol VARCHAR(32),
  to_amount VARCHAR(64),
  router VARCHAR(64),
  status VARCHAR(20) DEFAULT 'pending',
  gas_used VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_id, chain, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_swaps_wallet_chain ON swap_transactions(wallet_id, chain, created_at DESC);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER REFERENCES wallets(id) ON DELETE CASCADE,
  chain VARCHAR(32) NOT NULL,
  total_value_usd NUMERIC(18,2) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_wallet_chain ON portfolio_snapshots(wallet_id, chain, timestamp DESC);
