import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsService } from '../src/modules/system/metrics.service';

describe('MetricsService & Prometheus Exposition', () => {
  it('records HTTP requests, status code buckets, and computes latency percentiles', async () => {
    const metrics = new MetricsService();

    // Record sample requests with known durations
    metrics.recordHttpRequest('GET', '/api/market/overview', 200, 25);
    metrics.recordHttpRequest('GET', '/api/market/overview', 200, 50);
    metrics.recordHttpRequest('GET', '/api/market/overview', 200, 75);
    metrics.recordHttpRequest('GET', '/api/market/tokens', 404, 30);
    metrics.recordHttpRequest('POST', '/api/exchange/swap', 500, 150);

    const summary = await metrics.getSummaryJson();

    assert.equal(summary.http.totalRequests, 5);
    assert.equal(summary.http.statusCodes['2xx'], 3);
    assert.equal(summary.http.statusCodes['4xx'], 1);
    assert.equal(summary.http.statusCodes['5xx'], 1);

    // Latency percentiles should be positive numbers
    assert.ok(summary.http.latency.p50Ms > 0);
    assert.ok(summary.http.latency.p95Ms >= summary.http.latency.p50Ms);
    assert.ok(summary.http.latency.p99Ms >= summary.http.latency.p95Ms);

    // Route breakdown
    assert.ok(summary.http.routes['GET /api/market/overview']);
    assert.equal(summary.http.routes['GET /api/market/overview'].requests, 3);
    assert.equal(summary.http.routes['GET /api/market/overview'].errors, 0);
  });

  it('tracks swap operations, notifications, and worker executions', async () => {
    const metrics = new MetricsService();

    metrics.recordSwap('submitted');
    metrics.recordSwap('confirmed');
    metrics.recordSwap('failed');

    metrics.recordNotification('sent', 3);
    metrics.recordNotification('failed', 1);

    metrics.recordWorkerRun('priceAlertWorker', 150, true);
    metrics.recordWorkerRun('priceAlertWorker', 200, false);

    const summary = await metrics.getSummaryJson();

    assert.equal(summary.swaps.submitted, 1);
    assert.equal(summary.swaps.confirmed, 1);
    assert.equal(summary.swaps.failed, 1);

    assert.equal(summary.notifications.sent, 3);
    assert.equal(summary.notifications.failed, 1);

    assert.ok(summary.workers['priceAlertWorker']);
    assert.equal(summary.workers['priceAlertWorker'].runs, 2);
    assert.equal(summary.workers['priceAlertWorker'].failures, 1);
  });

  it('generates valid Prometheus plain-text exposition output', async () => {
    const metrics = new MetricsService();

    metrics.recordHttpRequest('GET', '/api/test', 200, 42);
    metrics.recordSwap('confirmed', 1);

    const prometheusText = await metrics.toPrometheusText();

    assert.ok(typeof prometheusText === 'string');
    assert.ok(prometheusText.includes('# HELP crypto_http_requests_total Total HTTP requests handled'));
    assert.ok(prometheusText.includes('# TYPE crypto_http_requests_total counter'));
    assert.ok(prometheusText.includes('crypto_http_requests_total 1'));
    assert.ok(prometheusText.includes('# HELP crypto_http_latency_ms Request latency in milliseconds'));
    assert.ok(prometheusText.includes('crypto_http_latency_ms{quantile="0.5"}'));
    assert.ok(prometheusText.includes('crypto_swaps_total{status="confirmed"} 1'));
    assert.ok(prometheusText.includes('crypto_cache_hits_total'));
  });
});
