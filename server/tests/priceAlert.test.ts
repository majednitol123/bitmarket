import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, closeDatabase, getDbPool } from '../src/config/database';
import { alertService } from '../src/modules/alert/alert.service';
import { AlertStatus } from '../src/modules/alert/alert.types';

describe('Enterprise Price Alert Engine & Evaluation', () => {
  const testWallet = '0x1234567890abcdef1234567890abcdef12345678';
  const otherWallet = '0x9999999990abcdef1234567890abcdef99999999';

  before(async () => {
    await initDatabase();
    const pool = getDbPool();
    if (pool) {
      // Clean test data
      await pool.query(
        `DELETE FROM price_alerts WHERE LOWER(wallet_address) IN ($1, $2)`,
        [testWallet.toLowerCase(), otherWallet.toLowerCase()]
      );
      await pool.query(
        `DELETE FROM notification_events WHERE LOWER(wallet_address) IN ($1, $2)`,
        [testWallet.toLowerCase(), otherWallet.toLowerCase()]
      );
    }
  });

  after(async () => {
    const pool = getDbPool();
    if (pool) {
      await pool.query(
        `DELETE FROM price_alerts WHERE LOWER(wallet_address) IN ($1, $2)`,
        [testWallet.toLowerCase(), otherWallet.toLowerCase()]
      );
      await pool.query(
        `DELETE FROM notification_events WHERE LOWER(wallet_address) IN ($1, $2)`,
        [testWallet.toLowerCase(), otherWallet.toLowerCase()]
      );
    }
    await closeDatabase();
  });

  it('creates an armed price alert with validated defaults and snapshot pricing', async () => {
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      chain: 'ethereum',
      tokenAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      tokenId: 'weth',
      tokenSymbol: 'ETH',
      tokenName: 'Ethereum',
      condition: 'above',
      targetPrice: 3500,
      basePrice: 3000,
      currency: 'USD',
      cooldownMinutes: 60,
    });

    assert.ok(alert.id > 0);
    assert.equal(alert.status, 'ARMED');
    assert.equal(alert.enabled, true);
    assert.equal(alert.condition, 'above');
    assert.equal(alert.targetPrice, 3500);
    assert.equal(alert.currency, 'USD');
    assert.equal(alert.cooldownMinutes, 60);
    assert.equal(alert.triggerCount, 0);
  });

  it('rejects creation when target price is invalid or non-positive', async () => {
    await assert.rejects(
      async () => {
        await alertService.createAlert({
          walletAddress: testWallet,
          tokenId: 'btc',
          tokenSymbol: 'BTC',
          condition: 'above',
          targetPrice: -100,
        });
      },
      { name: 'AppError', message: 'targetPrice must be a positive number' }
    );
  });

  it('detects true upward threshold crossing (ABOVE) and creates durable notification', async () => {
    // 1. Create alert: ETH above $3000, currently at $2800
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'eth-upward-test',
      tokenSymbol: 'ETH',
      condition: 'above',
      targetPrice: 3000,
      basePrice: 2800,
      cooldownMinutes: 10,
    });

    const now = Date.now();

    // 2. Evaluation 1: price rises to 2950 (below target) => should NOT trigger
    const eval1 = await alertService.evaluateAndTriggerAtomic(alert.id, 2950, now);
    assert.equal(eval1.triggered, false);
    assert.equal(eval1.rearmed, false);
    assert.equal(eval1.status, 'ARMED');

    // 3. Evaluation 2: price rises to 3000 (threshold reached) => TRUE CROSSING => TRIGGERS!
    const eval2 = await alertService.evaluateAndTriggerAtomic(alert.id, 3000, now);
    assert.equal(eval2.triggered, true);
    assert.equal(eval2.rearmed, false);
    assert.equal(eval2.status, 'TRIGGERED');

    // Verify DB updated
    const updated = await alertService.getAlertById(alert.id, testWallet);
    assert.ok(updated);
    assert.equal(updated.status, 'TRIGGERED');
    assert.equal(updated.triggerCount, 1);
    assert.ok(updated.triggeredAt);
    assert.ok(updated.cooldownUntil);

    // Verify durable notification event was created
    const pool = getDbPool();
    const notifRes = await pool?.query(
      `SELECT * FROM notification_events WHERE LOWER(wallet_address) = $1 AND event_type = 'price_alert'`,
      [testWallet.toLowerCase()]
    );
    assert.ok(notifRes && notifRes.rows.length > 0);
  });

  it('anti-spam hysteresis: price staying on triggered side does NOT re-trigger', async () => {
    // Alert was triggered in previous test at $3000.
    // Price continues rising to $3050 and $3100.
    const pool = getDbPool();
    const alerts = await pool?.query(
      `SELECT id FROM price_alerts WHERE LOWER(token_id) = 'eth-upward-test' AND LOWER(wallet_address) = $1`,
      [testWallet.toLowerCase()]
    );
    const alertId = alerts?.rows[0].id;
    assert.ok(alertId);

    const now = Date.now();
    const evalStaying = await alertService.evaluateAndTriggerAtomic(alertId, 3100, now);
    assert.equal(evalStaying.triggered, false, 'Must not re-trigger while price stays above target');
    assert.equal(evalStaying.rearmed, false);
  });

  it('automatic re-arm: price returning to safe side after cooldown auto-rearms to ARMED', async () => {
    const pool = getDbPool();
    const alerts = await pool?.query(
      `SELECT id FROM price_alerts WHERE LOWER(token_id) = 'eth-upward-test' AND LOWER(wallet_address) = $1`,
      [testWallet.toLowerCase()]
    );
    const alertId = alerts?.rows[0].id;

    // Simulate cooldown expiration in DB
    await pool?.query(
      `UPDATE price_alerts SET cooldown_until = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [alertId]
    );

    // Price drops back below threshold (safe side): $2850 < $3000
    const now = Date.now();
    const evalSafe = await alertService.evaluateAndTriggerAtomic(alertId, 2850, now);

    assert.equal(evalSafe.triggered, false);
    assert.equal(evalSafe.rearmed, true, 'Alert must auto-rearm when returning to safe side after cooldown');
    assert.equal(evalSafe.status, 'ARMED');

    // Verify alert in DB is now ARMED
    const rearmedAlert = await alertService.getAlertById(alertId, testWallet);
    assert.equal(rearmedAlert?.status, 'ARMED');
    assert.equal(rearmedAlert?.cooldownUntil, null);

    // Now price crosses above target again ($3050) => TRIGGERS A SECOND TIME
    const evalSecondCross = await alertService.evaluateAndTriggerAtomic(alertId, 3050, now);
    assert.equal(evalSecondCross.triggered, true, 'Must trigger again upon second crossing');
    assert.equal(evalSecondCross.status, 'TRIGGERED');
  });

  it('detects true downward threshold crossing (BELOW)', async () => {
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'btc-downward-test',
      tokenSymbol: 'BTC',
      condition: 'below',
      targetPrice: 60000,
      basePrice: 62000,
      cooldownMinutes: 15,
    });

    const now = Date.now();

    // 1. Price is 60500 (above target) => no trigger
    const eval1 = await alertService.evaluateAndTriggerAtomic(alert.id, 60500, now);
    assert.equal(eval1.triggered, false);
    assert.equal(eval1.status, 'ARMED');

    // 2. Price drops to 59900 (crosses below 60000) => TRIGGERS!
    const eval2 = await alertService.evaluateAndTriggerAtomic(alert.id, 59900, now);
    assert.equal(eval2.triggered, true);
    assert.equal(eval2.status, 'TRIGGERED');

    // 3. Price stays at 59500 => no trigger
    const eval3 = await alertService.evaluateAndTriggerAtomic(alert.id, 59500, now);
    assert.equal(eval3.triggered, false);
  });

  it('one-shot alert disables immediately upon trigger', async () => {
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'sol-oneshot-test',
      tokenSymbol: 'SOL',
      condition: 'above',
      targetPrice: 150,
      basePrice: 140,
      cooldownMinutes: 0, // One-shot
    });

    const now = Date.now();
    const evalRes = await alertService.evaluateAndTriggerAtomic(alert.id, 155, now);
    assert.equal(evalRes.triggered, true);
    assert.equal(evalRes.status, 'DISABLED');

    const check = await alertService.getAlertById(alert.id, testWallet);
    assert.equal(check?.enabled, false);
    assert.equal(check?.status, 'DISABLED');
  });

  it('manual re-arm resets status to ARMED and clears cooldown', async () => {
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'rearm-test',
      tokenSymbol: 'TEST',
      condition: 'above',
      targetPrice: 10,
      basePrice: 5,
      cooldownMinutes: 60,
    });

    // Trigger it
    await alertService.evaluateAndTriggerAtomic(alert.id, 12, Date.now());

    // Manually rearm
    const rearmed = await alertService.rearmAlert(alert.id, testWallet);
    assert.ok(rearmed);
    assert.equal(rearmed.status, 'ARMED');
    assert.equal(rearmed.enabled, true);
    assert.equal(rearmed.triggeredAt, null);
    assert.equal(rearmed.cooldownUntil, null);
  });

  it('enforces wallet ownership on updates, re-arm, and deletion', async () => {
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'owner-test',
      tokenSymbol: 'OWN',
      condition: 'above',
      targetPrice: 50,
      basePrice: 40,
    });

    // Other wallet cannot update
    const updateOther = await alertService.updateAlert(alert.id, otherWallet, { targetPrice: 60 });
    assert.equal(updateOther, null, 'Cannot update another user alert');

    // Other wallet cannot re-arm
    const rearmOther = await alertService.rearmAlert(alert.id, otherWallet);
    assert.equal(rearmOther, null, 'Cannot rearm another user alert');

    // Other wallet cannot delete
    const deleteOther = await alertService.deleteAlert(alert.id, otherWallet);
    assert.equal(deleteOther, false, 'Cannot delete another user alert');

    // Owner CAN delete
    const deleteOwner = await alertService.deleteAlert(alert.id, testWallet);
    assert.equal(deleteOwner, true);
  });

  it('rejects stale market snapshot (>120s old) to protect against false triggers', async () => {
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'stale-test',
      tokenSymbol: 'STL',
      condition: 'above',
      targetPrice: 100,
      basePrice: 90,
    });

    const ancientTimestamp = Date.now() - 150000; // 150 seconds ago (>120s limit)
    const evalRes = await alertService.evaluateAndTriggerAtomic(alert.id, 105, ancientTimestamp);

    assert.equal(evalRes.triggered, false);
    assert.equal(evalRes.reason, 'Stale or invalid market price skipped');
  });

  it('concurrency safety: simultaneous evaluations on same alert never double-trigger', async () => {
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'race-test',
      tokenSymbol: 'RACE',
      condition: 'above',
      targetPrice: 100,
      basePrice: 90,
      cooldownMinutes: 60,
    });

    const now = Date.now();

    // Fire 5 concurrent evaluations with crossing price simultaneously
    const results = await Promise.all([
      alertService.evaluateAndTriggerAtomic(alert.id, 105, now),
      alertService.evaluateAndTriggerAtomic(alert.id, 105, now),
      alertService.evaluateAndTriggerAtomic(alert.id, 105, now),
      alertService.evaluateAndTriggerAtomic(alert.id, 105, now),
      alertService.evaluateAndTriggerAtomic(alert.id, 105, now),
    ]);

    const triggeredCount = results.filter((r) => r.triggered).length;
    assert.equal(
      triggeredCount,
      1,
      `Exactly 1 crossing must trigger across concurrent workers; got ${triggeredCount}`
    );
  });

  it('rejects duplicate creation when an identical active price alert already exists', async () => {
    // 1. Create first active alert
    const firstAlert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'dup-test',
      tokenSymbol: 'DUP',
      condition: 'above',
      targetPrice: 250,
      basePrice: 200,
    });
    assert.ok(firstAlert.id > 0);

    // 2. Attempt to create exact duplicate active alert
    await assert.rejects(
      async () => {
        await alertService.createAlert({
          walletAddress: testWallet,
          tokenId: 'dup-test',
          tokenSymbol: 'DUP',
          condition: 'above',
          targetPrice: 250,
          basePrice: 200,
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'DUPLICATE_ALERT');
        assert.match(err.message, /already exists/);
        return true;
      }
    );
  });

  it('re-arms existing disabled alert when creating matching target price instead of duplicating', async () => {
    // 1. Create alert
    const alert = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'rearm-dup-test',
      tokenSymbol: 'RARM',
      condition: 'below',
      targetPrice: 50,
      basePrice: 60,
    });

    // 2. Disable it
    await alertService.updateAlert(alert.id, testWallet, { enabled: false });
    const disabled = await alertService.getAlertById(alert.id, testWallet);
    assert.equal(disabled?.enabled, false);

    // 3. User attempts to create the same alert again: should re-arm rather than duplicate
    const rearmed = await alertService.createAlert({
      walletAddress: testWallet,
      tokenId: 'rearm-dup-test',
      tokenSymbol: 'RARM',
      condition: 'below',
      targetPrice: 50,
      basePrice: 60,
    });

    assert.equal(rearmed.id, alert.id, 'Must reuse the existing alert row');
    assert.equal(rearmed.enabled, true, 'Alert must be re-armed to enabled = true');
    assert.equal(rearmed.status, 'ARMED');

    // 4. Verify in DB only 1 alert exists for this token
    const alerts = await alertService.getAlertsForWallet(testWallet, 'rearm-dup-test');
    assert.equal(alerts.length, 1, 'There must be exactly 1 alert row in DB, not duplicates');
  });
});
