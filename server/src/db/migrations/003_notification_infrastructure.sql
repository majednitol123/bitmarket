-- 003_notification_infrastructure.sql


-- 1. Notification Devices table: Stores user push tokens, device IDs, and active status
CREATE TABLE IF NOT EXISTS notification_devices (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(128) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    expo_push_token TEXT NOT NULL,
    platform VARCHAR(32) NOT NULL DEFAULT 'android',
    app_version VARCHAR(32),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notification_devices_token UNIQUE (expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_wallet ON notification_devices(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_notification_devices_enabled ON notification_devices(enabled);

-- 2. Notification Events table: Durable business/transaction events to be delivered
CREATE TABLE IF NOT EXISTS notification_events (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL, -- 'swap_confirmed', 'swap_failed', 'price_alert', 'wallet_connected', 'system_test'
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    idempotency_key VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_events_idempotency 
ON notification_events(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_events_wallet ON notification_events(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_notification_events_status ON notification_events(status);

-- 3. Notification Deliveries table: Delivery state machine, Expo tickets, receipts, retries
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
    device_id INTEGER NOT NULL REFERENCES notification_devices(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    ticket_id VARCHAR(128),
    ticket_status VARCHAR(32), -- 'ok', 'error'
    ticket_error VARCHAR(128), -- 'DeviceNotRegistered', 'InvalidCredentials', etc.
    receipt_id VARCHAR(128),
    receipt_status VARCHAR(32), -- 'ok', 'error'
    receipt_error VARCHAR(128),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'queued', -- 'queued', 'sent', 'confirmed', 'failed', 'invalid_token'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_polling 
ON notification_deliveries(status, next_attempt_at) 
WHERE status IN ('queued', 'retry');

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_receipts 
ON notification_deliveries(status, updated_at) 
WHERE status = 'sent';
