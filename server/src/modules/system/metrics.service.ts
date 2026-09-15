import { cacheService } from '../../cache/cacheService';
import { providerBudgetTracker } from '../../providers/core/ProviderBudgetTracker';
import { realtimeGateway } from '../realtime/realtimeGateway';

interface RouteStats {
  requests: number;
  errors: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
}

export class MetricsService {
  private static instance: MetricsService;

  // HTTP Request metrics
  private totalRequests = 0;
  private statusCodes: Record<string, number> = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
  };
  private routeMetrics: Map<string, RouteStats> = new Map();
  private latencySamples: number[] = [];
  private readonly MAX_SAMPLES = 500;

  // Swap metrics
  private swapStats = {
    submitted: 0,
    confirmed: 0,
    failed: 0,
    pending: 0,
  };

  // Notification metrics
  private notificationStats = {
    queued: 0,
    sent: 0,
    receipt: 0,
    retry: 0,
    invalidToken: 0,
    failed: 0,
  };

  // Price alert metrics (price_alrert.md Section 29)
  private alertStats = {
    created: 0,
    updated: 0,
    deleted: 0,
    evaluated: 0,
    triggered: 0,
    crossingDetected: 0,
    cooldownSkipped: 0,
    rearmed: 0,
  };

  // Worker run metrics
  private workerMetrics: Map<string, { runs: number; failures: number; totalDurationMs: number; lastDurationMs: number }> = new Map();

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Record HTTP request telemetry
   */
  public recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    this.totalRequests++;

    // Track status code bucket
    const bucket = `${Math.floor(statusCode / 100)}xx`;
    this.statusCodes[bucket] = (this.statusCodes[bucket] || 0) + 1;

    // Track latency sample
    if (this.latencySamples.length >= this.MAX_SAMPLES) {
      this.latencySamples.shift();
    }
    this.latencySamples.push(durationMs);

    // Track route
    const key = `${method} ${route}`;
    const existing = this.routeMetrics.get(key) || {
      requests: 0,
      errors: 0,
      totalDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
    };

    existing.requests++;
    if (statusCode >= 400) existing.errors++;
    existing.totalDurationMs += durationMs;
    existing.minDurationMs = Math.min(existing.minDurationMs, durationMs);
    existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);

    this.routeMetrics.set(key, existing);
  }

  /**
   * Record swap events
   */
  public recordSwap(event: 'submitted' | 'confirmed' | 'failed' | 'pending', count: number = 1): void {
    if (this.swapStats[event] !== undefined) {
      this.swapStats[event] += count;
    }
  }

  /**
   * Record notification delivery lifecycle
   */
  public recordNotification(
    event: 'queued' | 'sent' | 'receipt' | 'retry' | 'invalidToken' | 'failed',
    count: number = 1
  ): void {
    if (this.notificationStats[event] !== undefined) {
      this.notificationStats[event] += count;
    }
  }

  /**
   * Record price alert lifecycle events (price_alrert.md Section 29)
   */
  public recordAlert(event: 'created' | 'updated' | 'deleted' | 'evaluated' | 'triggered' | 'crossingDetected' | 'cooldownSkipped' | 'rearmed', count: number = 1): void {
    if (this.alertStats[event] !== undefined) {
      this.alertStats[event] += count;
    }
  }

  /**
   * Record background worker performance
   */
  public recordWorkerRun(worker: string, durationMs: number, success: boolean): void {
    const stats = this.workerMetrics.get(worker) || {
      runs: 0,
      failures: 0,
      totalDurationMs: 0,
      lastDurationMs: 0,
    };

    stats.runs++;
    if (!success) stats.failures++;
    stats.totalDurationMs += durationMs;
    stats.lastDurationMs = durationMs;

    this.workerMetrics.set(worker, stats);
  }

  /**
   * Calculate percentile from latency samples
   */
  private getPercentile(p: number): number {
    if (this.latencySamples.length === 0) return 0;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor((p / 100) * sorted.length))
    );
    return sorted[index];
  }

  /**
   * Returns aggregated JSON summary of all system metrics
   */
  public async getSummaryJson() {
    const cacheMetrics = cacheService.getMetrics();
    const providerMetrics = providerBudgetTracker.getAllMetrics();
    const realtimeStats = await realtimeGateway.getStats();

    const routeSummary: Record<string, any> = {};
    for (const [route, stats] of this.routeMetrics.entries()) {
      routeSummary[route] = {
        requests: stats.requests,
        errors: stats.errors,
        avgLatencyMs: Math.round(stats.totalDurationMs / (stats.requests || 1)),
        minLatencyMs: stats.minDurationMs === Infinity ? 0 : stats.minDurationMs,
        maxLatencyMs: stats.maxDurationMs,
      };
    }

    const workerSummary: Record<string, any> = {};
    for (const [worker, stats] of this.workerMetrics.entries()) {
      workerSummary[worker] = {
        runs: stats.runs,
        failures: stats.failures,
        avgDurationMs: Math.round(stats.totalDurationMs / (stats.runs || 1)),
        lastDurationMs: stats.lastDurationMs,
      };
    }

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      memoryUsageMb: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      http: {
        totalRequests: this.totalRequests,
        statusCodes: this.statusCodes,
        latency: {
          p50Ms: this.getPercentile(50),
          p95Ms: this.getPercentile(95),
          p99Ms: this.getPercentile(99),
        },
        routes: routeSummary,
      },
      cache: cacheMetrics,
      providers: providerMetrics,
      swaps: this.swapStats,
      notifications: this.notificationStats,
      alerts: this.alertStats,
      workers: workerSummary,
      realtime: realtimeStats,
    };
  }

  /**
   * Produces Prometheus-compatible plain-text metrics
   */
  public async toPrometheusText(): Promise<string> {
    const summary = await this.getSummaryJson();
    const lines: string[] = [];

    // HTTP metrics
    lines.push('# HELP crypto_http_requests_total Total HTTP requests handled');
    lines.push('# TYPE crypto_http_requests_total counter');
    lines.push(`crypto_http_requests_total ${summary.http.totalRequests}`);

    lines.push('# HELP crypto_http_status_codes_total HTTP response codes by class');
    lines.push('# TYPE crypto_http_status_codes_total counter');
    for (const [codeClass, count] of Object.entries(summary.http.statusCodes)) {
      lines.push(`crypto_http_status_codes_total{class="${codeClass}"} ${count}`);
    }

    lines.push('# HELP crypto_http_latency_ms Request latency in milliseconds');
    lines.push('# TYPE crypto_http_latency_ms gauge');
    lines.push(`crypto_http_latency_ms{quantile="0.5"} ${summary.http.latency.p50Ms}`);
    lines.push(`crypto_http_latency_ms{quantile="0.95"} ${summary.http.latency.p95Ms}`);
    lines.push(`crypto_http_latency_ms{quantile="0.99"} ${summary.http.latency.p99Ms}`);

    // Cache metrics
    lines.push('# HELP crypto_cache_hits_total Total cache hits');
    lines.push('# TYPE crypto_cache_hits_total counter');
    lines.push(`crypto_cache_hits_total{type="fresh"} ${summary.cache.hitsFresh}`);
    lines.push(`crypto_cache_hits_total{type="stale"} ${summary.cache.hitsStale}`);

    lines.push('# HELP crypto_cache_misses_total Total cache misses');
    lines.push('# TYPE crypto_cache_misses_total counter');
    lines.push(`crypto_cache_misses_total ${summary.cache.misses}`);

    lines.push('# HELP crypto_cache_hit_ratio_percent Cache hit ratio');
    lines.push('# TYPE crypto_cache_hit_ratio_percent gauge');
    lines.push(`crypto_cache_hit_ratio_percent ${summary.cache.hitRatioPercent}`);

    lines.push('# HELP crypto_cache_locks_total Distributed locks acquired and waiters');
    lines.push('# TYPE crypto_cache_locks_total counter');
    lines.push(`crypto_cache_locks_total{status="acquired"} ${summary.cache.locksAcquired}`);
    lines.push(`crypto_cache_locks_total{status="waiters"} ${summary.cache.lockWaiters}`);
    lines.push(`crypto_cache_locks_total{status="single_flight_joins"} ${summary.cache.singleFlightJoins}`);

    // Realtime metrics
    lines.push('# HELP crypto_realtime_connections Active real-time connections');
    lines.push('# TYPE crypto_realtime_connections gauge');
    lines.push(`crypto_realtime_connections{type="websocket"} ${summary.realtime.activeWebSocketConnections}`);
    lines.push(`crypto_realtime_connections{type="sse"} ${summary.realtime.activeSseConnections}`);

    lines.push('# HELP crypto_realtime_broadcasts_total Total real-time messages broadcast');
    lines.push('# TYPE crypto_realtime_broadcasts_total counter');
    lines.push(`crypto_realtime_broadcasts_total ${summary.realtime.totalMessagesBroadcast}`);

    // Swaps
    lines.push('# HELP crypto_swaps_total Total swaps by outcome');
    lines.push('# TYPE crypto_swaps_total counter');
    lines.push(`crypto_swaps_total{status="submitted"} ${summary.swaps.submitted}`);
    lines.push(`crypto_swaps_total{status="confirmed"} ${summary.swaps.confirmed}`);
    lines.push(`crypto_swaps_total{status="failed"} ${summary.swaps.failed}`);
    lines.push(`crypto_swaps_total{status="pending"} ${summary.swaps.pending}`);

    // Alerts
    lines.push('# HELP crypto_alerts_total Total price alert operations');
    lines.push('# TYPE crypto_alerts_total counter');
    lines.push(`crypto_alerts_total{status="created"} ${summary.alerts.created}`);
    lines.push(`crypto_alerts_total{status="triggered"} ${summary.alerts.triggered}`);
    lines.push(`crypto_alerts_total{status="evaluated"} ${summary.alerts.evaluated}`);
    lines.push(`crypto_alerts_total{status="rearmed"} ${summary.alerts.rearmed}`);

    // Memory
    lines.push('# HELP crypto_process_memory_bytes Node.js memory consumption');
    lines.push('# TYPE crypto_process_memory_bytes gauge');
    lines.push(`crypto_process_memory_bytes{type="rss"} ${summary.memoryUsageMb.rss * 1024 * 1024}`);
    lines.push(`crypto_process_memory_bytes{type="heap_used"} ${summary.memoryUsageMb.heapUsed * 1024 * 1024}`);

    return lines.join('\n') + '\n';
  }
}

export const metricsService = MetricsService.getInstance();
