/**
 * Normalized Provider Error Hierarchy
 * Standardizes errors across CoinStats, Blockchain RPC, Li.Fi, and third-party APIs.
 */

export class ProviderError extends Error {
  public readonly provider: string;
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isRetryable: boolean;
  public readonly originalError?: any;

  constructor(
    provider: string,
    message: string,
    statusCode: number = 502,
    code: string = 'PROVIDER_ERROR',
    isRetryable: boolean = false,
    originalError?: any
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.code = code;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, timeoutMs: number, originalError?: any) {
    super(
      provider,
      `Request timed out after ${timeoutMs}ms`,
      504,
      'PROVIDER_TIMEOUT',
      true,
      originalError
    );
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  public readonly retryAfterMs?: number;

  constructor(provider: string, retryAfterMs?: number, originalError?: any) {
    super(
      provider,
      `Rate limit or quota exhausted${retryAfterMs ? ` (retry after ${retryAfterMs}ms)` : ''}`,
      429,
      'PROVIDER_RATE_LIMIT',
      false, // Handled via key rotation, not blind retry on same key
      originalError
    );
    this.name = 'ProviderRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: string, message: string = 'Invalid or expired API key', originalError?: any) {
    super(
      provider,
      message,
      401,
      'PROVIDER_AUTH_ERROR',
      false,
      originalError
    );
    this.name = 'ProviderAuthError';
  }
}

export class CircuitBreakerOpenError extends ProviderError {
  public readonly resetTimeMs: number;

  constructor(provider: string, resetTimeMs: number) {
    const waitSec = Math.ceil(resetTimeMs / 1000);
    super(
      provider,
      `Circuit breaker is OPEN. Requests temporarily halted for ~${waitSec}s to allow upstream recovery.`,
      503,
      'CIRCUIT_BREAKER_OPEN',
      false
    );
    this.name = 'CircuitBreakerOpenError';
    this.resetTimeMs = resetTimeMs;
  }
}
