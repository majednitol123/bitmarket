/**
 * Provider Budget & Metrics Tracker
 * Observes API request budgets, sliding window latencies, error distributions,
 * and key usage health across all external providers.
 */

export interface ProviderMetrics {
  provider: string;
  status: 'healthy' | 'degraded' | 'outage' | 'exhausted';
  totalRequests: number;
  requestsLastMinute: number;
  requestsLastHour: number;
  requestsToday: number;
  successfulRequests: number;
  failedRequests: number;
  errorRatePercent: number;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  latency: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    lastMs: number;
  };
  keyUsage?: {
    activeKeyIndex: number;
    totalKeys: number;
    rotationsCount: number;
    keyStats: Record<string, { requests: number; errors: number; lastUsed: string }>;
  };
  lastError?: {
    message: string;
    code?: string;
    timestamp: string;
  };
}

interface RequestRecord {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  statusCode?: number;
}

export class ProviderBudgetTracker {
  private requestsByProvider: Map<string, RequestRecord[]> = new Map();
  private circuitStates: Map<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'> = new Map();
  private lastErrors: Map<string, { message: string; code?: string; timestamp: string }> = new Map();
  private keyMetrics: Map<string, {
    activeKeyIndex: number;
    totalKeys: number;
    rotationsCount: number;
    keyStats: Record<string, { requests: number; errors: number; lastUsed: string }>;
  }> = new Map();

  private readonly RETENTION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_LATENCY_SAMPLES = 200;

  /**
   * Record a completed provider request
   */
  public recordRequest(
    provider: string,
    latencyMs: number,
    success: boolean,
    statusCode?: number,
    error?: Error
  ): void {
    const now = Date.now();
    let records = this.requestsByProvider.get(provider);
    if (!records) {
      records = [];
      this.requestsByProvider.set(provider, records);
    }

    records.push({
      timestamp: now,
      latencyMs: Math.max(0, latencyMs),
      success,
      statusCode,
    });

    // Prune records older than 24 hours or if array gets too large
    if (records.length > 5000) {
      const cutoff = now - this.RETENTION_WINDOW_MS;
      this.requestsByProvider.set(
        provider,
        records.filter((r) => r.timestamp > cutoff)
      );
    }

    if (!success && error) {
      this.lastErrors.set(provider, {
        message: error.message,
        code: (error as any).code,
        timestamp: new Date(now).toISOString(),
      });
    }
  }

  /**
   * Update circuit breaker state for a provider
   */
  public setCircuitBreakerState(provider: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    this.circuitStates.set(provider, state);
  }

  /**
   * Register key rotation event
   */
  public recordKeyRotation(
    provider: string,
    activeKeyIndex: number,
    totalKeys: number,
    keyIdentifier: string
  ): void {
    let stats = this.keyMetrics.get(provider);
    if (!stats) {
      stats = {
        activeKeyIndex,
        totalKeys,
        rotationsCount: 0,
        keyStats: {},
      };
      this.keyMetrics.set(provider, stats);
    }

    stats.activeKeyIndex = activeKeyIndex;
    stats.totalKeys = totalKeys;
    stats.rotationsCount += 1;

    if (!stats.keyStats[keyIdentifier]) {
      stats.keyStats[keyIdentifier] = { requests: 0, errors: 0, lastUsed: new Date().toISOString() };
    }
    stats.keyStats[keyIdentifier].lastUsed = new Date().toISOString();
  }

  /**
   * Track specific key execution
   */
  public recordKeyUsage(provider: string, keyIdentifier: string, success: boolean): void {
    const stats = this.keyMetrics.get(provider);
    if (stats) {
      if (!stats.keyStats[keyIdentifier]) {
        stats.keyStats[keyIdentifier] = { requests: 0, errors: 0, lastUsed: new Date().toISOString() };
      }
      stats.keyStats[keyIdentifier].requests += 1;
      if (!success) {
        stats.keyStats[keyIdentifier].errors += 1;
      }
      stats.keyStats[keyIdentifier].lastUsed = new Date().toISOString();
    }
  }

  /**
   * Generates metrics snapshot for a specific provider
   */
  public getMetrics(provider: string): ProviderMetrics {
    const records = this.requestsByProvider.get(provider) || [];
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    let requestsLastMinute = 0;
    let requestsLastHour = 0;
    let requestsToday = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const latencies: number[] = [];

    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i];
      if (r.timestamp >= oneMinuteAgo) requestsLastMinute++;
      if (r.timestamp >= oneHourAgo) requestsLastHour++;
      if (r.timestamp >= startOfToday) requestsToday++;

      if (r.success) successfulRequests++;
      else failedRequests++;

      if (latencies.length < this.MAX_LATENCY_SAMPLES) {
        latencies.push(r.latencyMs);
      }
    }

    const totalRequests = records.length;
    const errorRatePercent =
      totalRequests > 0 ? Math.round((failedRequests / totalRequests) * 10000) / 100 : 0;

    // Latency calculations
    latencies.sort((a, b) => a - b);
    const avgMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;
    const p50Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95Ms = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const lastMs = records.length > 0 ? records[records.length - 1].latencyMs : 0;

    const circuitBreakerState = this.circuitStates.get(provider) || 'CLOSED';

    // Status evaluation
    let status: 'healthy' | 'degraded' | 'outage' | 'exhausted' = 'healthy';
    if (circuitBreakerState === 'OPEN') {
      status = 'outage';
    } else if (circuitBreakerState === 'HALF_OPEN' || errorRatePercent > 10) {
      status = 'degraded';
    }

    const keyMetrics = this.keyMetrics.get(provider);

    return {
      provider,
      status,
      totalRequests,
      requestsLastMinute,
      requestsLastHour,
      requestsToday,
      successfulRequests,
      failedRequests,
      errorRatePercent,
      circuitBreakerState,
      latency: {
        avgMs,
        p50Ms,
        p95Ms,
        lastMs,
      },
      keyUsage: keyMetrics,
      lastError: this.lastErrors.get(provider),
    };
  }

  /**
   * Retrieves metrics snapshot for all registered providers
   */
  public getAllMetrics(): Record<string, ProviderMetrics> {
    const allProviders = new Set([
      ...Array.from(this.requestsByProvider.keys()),
      ...Array.from(this.circuitStates.keys()),
      ...Array.from(this.keyMetrics.keys()),
    ]);

    const result: Record<string, ProviderMetrics> = {};
    for (const provider of allProviders) {
      result[provider] = this.getMetrics(provider);
    }
    return result;
  }
}

export const providerBudgetTracker = new ProviderBudgetTracker();
