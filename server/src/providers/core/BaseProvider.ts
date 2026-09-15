import {
  ProviderError,
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderAuthError,
  CircuitBreakerOpenError,
} from './ProviderErrors';
import { providerBudgetTracker, ProviderBudgetTracker } from './ProviderBudgetTracker';

export interface ResilienceOptions {
  timeoutMs?: number;
  retries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  jitter?: boolean;
  isRetryable?: (error: any) => boolean;
}

export abstract class BaseProvider {
  protected readonly providerName: string;
  protected defaultTimeoutMs: number;
  protected maxConsecutiveFailures: number;
  protected circuitBreakerCooldownMs: number;

  private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private consecutiveFailures: number = 0;
  private openedAt: number = 0;
  protected budgetTracker: ProviderBudgetTracker;

  constructor(
    providerName: string,
    options: {
      defaultTimeoutMs?: number;
      maxConsecutiveFailures?: number;
      circuitBreakerCooldownMs?: number;
      budgetTracker?: ProviderBudgetTracker;
    } = {}
  ) {
    this.providerName = providerName;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 8000;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || 5;
    this.circuitBreakerCooldownMs = options.circuitBreakerCooldownMs || 30000; // 30s
    this.budgetTracker = options.budgetTracker || providerBudgetTracker;

    this.budgetTracker.setCircuitBreakerState(this.providerName, 'CLOSED');
  }

  /**
   * Current circuit breaker status
   */
  public getCircuitState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.circuitState;
  }

  /**
   * Resets circuit breaker manually (e.g. for testing or administrative recovery)
   */
  public resetCircuitBreaker(): void {
    this.circuitState = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    this.budgetTracker.setCircuitBreakerState(this.providerName, 'CLOSED');
  }

  /**
   * Executes a remote operation wrapped with timeout, retries, jitter, and circuit breaker.
   */
  public async executeWithResilience<T>(
    operationName: string,
    requestFn: () => Promise<T>,
    options: ResilienceOptions = {}
  ): Promise<T> {
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const retries = options.retries ?? 2;
    const initialDelayMs = options.initialDelayMs || 200;
    const backoffFactor = options.backoffFactor || 2;
    const withJitter = options.jitter ?? true;

    // 1. Check Circuit Breaker Gate
    const now = Date.now();
    if (this.circuitState === 'OPEN') {
      const elapsed = now - this.openedAt;
      if (elapsed > this.circuitBreakerCooldownMs) {
        console.warn(`[${this.providerName}] Cooldown elapsed (${elapsed}ms). Probing HALF_OPEN state.`);
        this.circuitState = 'HALF_OPEN';
        this.budgetTracker.setCircuitBreakerState(this.providerName, 'HALF_OPEN');
      } else {
        const remaining = this.circuitBreakerCooldownMs - elapsed;
        throw new CircuitBreakerOpenError(this.providerName, remaining);
      }
    }

    let lastError: any = null;
    const totalAttempts = retries + 1;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      const startTime = Date.now();
      try {
        const result = await this.executeWithTimeout(requestFn, timeoutMs);
        const latencyMs = Date.now() - startTime;

        // Success - update circuit breaker state
        if (this.circuitState === 'HALF_OPEN') {
          console.log(`[${this.providerName}] Probe successful. Circuit CLOSED.`);
          this.circuitState = 'CLOSED';
          this.budgetTracker.setCircuitBreakerState(this.providerName, 'CLOSED');
        }
        this.consecutiveFailures = 0;

        // Record metrics
        this.budgetTracker.recordRequest(this.providerName, latencyMs, true, 200);

        return result;
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        const normalized = this.normalizeError(err, timeoutMs);
        lastError = normalized;

        const isLastAttempt = attempt === totalAttempts - 1;
        const retryable = options.isRetryable
          ? options.isRetryable(normalized)
          : this.isDefaultRetryable(normalized);

        // If not retryable or final attempt, fail and update circuit breaker
        if (!retryable || isLastAttempt) {
          this.consecutiveFailures += 1;
          if (
            this.consecutiveFailures >= this.maxConsecutiveFailures ||
            this.circuitState === 'HALF_OPEN'
          ) {
            this.circuitState = 'OPEN';
            this.openedAt = Date.now();
            this.budgetTracker.setCircuitBreakerState(this.providerName, 'OPEN');
            console.error(
              `[${this.providerName}] Circuit breaker TRIPPED to OPEN after ${this.consecutiveFailures} failures.`
            );
          }

          this.budgetTracker.recordRequest(
            this.providerName,
            latencyMs,
            false,
            normalized.statusCode,
            normalized
          );

          throw normalized;
        }

        // Retryable: backoff with jitter
        const delay =
          initialDelayMs * Math.pow(backoffFactor, attempt) +
          (withJitter ? Math.floor(Math.random() * 150) : 0);

        console.warn(
          `[${this.providerName}] ${operationName} failed (attempt ${attempt + 1}/${totalAttempts}): ${normalized.message}. Retrying in ${delay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Enforces a hard deadline on asynchronous operations
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new ProviderTimeoutError(this.providerName, timeoutMs));
      }, timeoutMs);
    });

    return Promise.race([
      fn(),
      timeoutPromise,
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  /**
   * Normalizes arbitrary upstream/axios/network errors into ProviderError hierarchy
   */
  protected normalizeError(err: any, timeoutMs: number): ProviderError {
    if (err instanceof ProviderError) {
      return err;
    }

    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || 'Unknown upstream provider error';

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err instanceof ProviderTimeoutError) {
      return new ProviderTimeoutError(this.providerName, timeoutMs, err);
    }

    if (status === 429 || status === 406 || message?.includes('quota') || message?.includes('rate limit')) {
      const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0', 10) * 1000 || undefined;
      return new ProviderRateLimitError(this.providerName, retryAfter, err);
    }

    if (status === 401 || status === 403) {
      return new ProviderAuthError(this.providerName, message, err);
    }

    const isNetwork =
      err.code === 'ENOTFOUND' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT';

    const is5xx = status >= 500 && status < 600;
    const isRetryable = isNetwork || is5xx;

    return new ProviderError(
      this.providerName,
      message,
      status || (isNetwork ? 503 : 502),
      err.code || (is5xx ? 'PROVIDER_SERVER_ERROR' : 'PROVIDER_REQUEST_FAILED'),
      isRetryable,
      err
    );
  }

  /**
   * Default retry criteria:
   * Retries network dropouts, 502/503/504, and timeouts.
   * NEVER retries 400 (Bad Request), 401/403 (Auth), 429 (Quota - requires key rotation).
   */
  private isDefaultRetryable(err: ProviderError): boolean {
    if (err.statusCode === 400 || err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 429) {
      return false;
    }
    return err.isRetryable;
  }
}
