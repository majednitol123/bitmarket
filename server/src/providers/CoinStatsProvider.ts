import axios, { AxiosInstance } from 'axios';
import { BaseProvider } from './core/BaseProvider';
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderError,
} from './core/ProviderErrors';
import { PortfolioDataProvider } from './PortfolioDataProvider';
import { config } from '../config/env';

export class CoinStatsProvider extends BaseProvider implements PortfolioDataProvider {
  private clients: AxiosInstance[];
  private activeKeyIndex: number = 0;
  private apiKeys: string[];

  constructor() {
    super('CoinStats', {
      defaultTimeoutMs: config.coinstats.timeoutMs || 10000,
      maxConsecutiveFailures: 5,
      circuitBreakerCooldownMs: 30000,
    });

    this.apiKeys =
      config.coinstats.apiKeys.length > 0
        ? config.coinstats.apiKeys
        : config.coinstats.apiKey
          ? [config.coinstats.apiKey]
          : [];

    if (this.apiKeys.length === 0) {
      console.warn('[CoinStatsProvider] No API keys configured!');
    } else {
      console.log(`[CoinStatsProvider] Initialized with ${this.apiKeys.length} API key(s)`);
    }

    // Create axios clients without blind 1500ms sleep interceptors
    this.clients = this.apiKeys.map((key) => {
      return axios.create({
        baseURL: config.coinstats.baseUrl,
        timeout: config.coinstats.timeoutMs,
        headers: {
          Accept: 'application/json',
          'X-API-KEY': key,
        },
      });
    });

    if (this.apiKeys.length > 0) {
      this.budgetTracker.recordKeyRotation('CoinStats', 0, this.apiKeys.length, 'key_1');
    }
  }

  private keyCooldowns: Map<number, number> = new Map();
  private lastRequestTimestamp: number = 0;
  private minInterRequestDelayMs: number = 120; // 120ms inter-request spacing eliminates burst 429s

  /**
   * Enforces a minimum delay between consecutive outbound requests to CoinStats
   * to eliminate concurrency burst rate limiting.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTimestamp;
    if (elapsed < this.minInterRequestDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minInterRequestDelayMs - elapsed));
    }
    this.lastRequestTimestamp = Date.now();
  }

  /**
   * Execute request with intelligent key quarantine, anti-burst pacing, and rotation.
   * Quarantines 406 keys for 24h, 429 keys for 60s, and skips dead keys immediately.
   */
  private async requestWithRotation<T>(
    operationName: string,
    fn: (client: AxiosInstance) => Promise<T>
  ): Promise<T> {
    const totalKeys = this.clients.length;
    if (totalKeys === 0) {
      throw new ProviderAuthError('CoinStats', 'No CoinStats API keys configured');
    }

    const now = Date.now();
    // 1. Gather all healthy keys not under active quarantine
    const candidates: number[] = [];
    for (let i = 0; i < totalKeys; i++) {
      const keyIdx = (this.activeKeyIndex + i) % totalKeys;
      const cooldownUntil = this.keyCooldowns.get(keyIdx) || 0;
      if (now >= cooldownUntil) {
        candidates.push(keyIdx);
      }
    }

    // If all keys are quarantined, check if any will unquarantine within 3 seconds
    if (candidates.length === 0) {
      let earliestIdx = 0;
      let minCooldown = Infinity;
      for (let i = 0; i < totalKeys; i++) {
        const cd = this.keyCooldowns.get(i) || 0;
        if (cd < minCooldown) {
          minCooldown = cd;
          earliestIdx = i;
        }
      }
      const waitMs = minCooldown - now;
      if (waitMs > 0 && waitMs <= 3000) {
        await new Promise((r) => setTimeout(r, waitMs));
        candidates.push(earliestIdx);
      } else {
        console.warn(
          `[CoinStatsProvider] All ${totalKeys} API keys in active quarantine (earliest reset in ${Math.max(1, Math.round(waitMs / 1000))}s)`
        );
        throw new ProviderRateLimitError('CoinStats', Math.max(1000, waitMs));
      }
    }

    let lastError: any = null;

    for (const keyIdx of candidates) {
      const client = this.clients[keyIdx];
      const keyIdentifier = `key_${keyIdx + 1}`;

      try {
        await this.throttle();

        // Execute remote call with client
        const result = await fn(client);

        this.budgetTracker.recordKeyUsage('CoinStats', keyIdentifier, true);

        // Reset failure count on provider level if circuit was half-open/open
        if (this.getCircuitState() !== 'CLOSED') {
          this.resetCircuitBreaker();
        }

        // Switch active key to this successful key
        if (keyIdx !== this.activeKeyIndex) {
          console.log(`[CoinStatsProvider] Switched primary key to #${keyIdx + 1}`);
          this.activeKeyIndex = keyIdx;
          this.budgetTracker.recordKeyRotation('CoinStats', this.activeKeyIndex, totalKeys, keyIdentifier);
        }

        return result;
      } catch (err: any) {
        this.budgetTracker.recordKeyUsage('CoinStats', keyIdentifier, false);
        const status = err.response?.status || err.statusCode;
        lastError = err;

        if (status === 406) {
          // Monthly credits exhausted! Quarantine for 24 hours
          console.warn(
            `[CoinStatsProvider] Key #${keyIdx + 1} exhausted monthly credits (406). Quarantining for 24 hours.`
          );
          this.keyCooldowns.set(keyIdx, Date.now() + 24 * 60 * 60 * 1000);
          continue;
        }

        if (status === 429) {
          // Burst or per-minute rate limit hit!
          const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '60', 10);
          const cooldownMs = Math.max(retryAfter * 1000, 60000);
          console.warn(
            `[CoinStatsProvider] Key #${keyIdx + 1} rate limited (429). Quarantining for ${cooldownMs / 1000}s.`
          );
          this.keyCooldowns.set(keyIdx, Date.now() + cooldownMs);
          continue;
        }

        // 404 is not an API error, rethrow
        if (status === 404) {
          throw err;
        }

        // For other errors (e.g. 5xx or network drop), try next candidate key
        console.warn(
          `[CoinStatsProvider] Key #${keyIdx + 1} request error (${status || err.message}). Rotating to next key...`
        );
      }
    }

    console.error(`[CoinStatsProvider] All candidate keys failed for ${operationName}`);
    throw new ProviderRateLimitError('CoinStats', 30000, lastError);
  }

  async getWalletBalance(blockchain: string, address: string): Promise<any[]> {
    if (!blockchain || !address) {
      throw new ProviderError('CoinStats', 'blockchain and address are required', 400, 'INVALID_PARAMS');
    }

    try {
      const response = await this.requestWithRotation(`getWalletBalance(${blockchain})`, (c) =>
        c.get('/wallet/balance', {
          params: {
            blockchain,
            address,
          },
        })
      );

      const raw = response.data;
      if (Array.isArray(raw)) return raw;
      if (raw?.result && Array.isArray(raw.result)) return raw.result;
      if (raw?.coins && Array.isArray(raw.coins)) return raw.coins;
      return [];
    } catch (err: any) {
      if (err.statusCode === 404 || err.response?.status === 404) {
        return [];
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        'CoinStats',
        `Failed to fetch wallet balance: ${err.message}`,
        err.statusCode || 502,
        'WALLET_BALANCE_ERROR',
        false,
        err
      );
    }
  }

  async getWalletTransactions(
    blockchain: string,
    address: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ result: any[]; meta?: any }> {
    if (!blockchain || !address) {
      throw new ProviderError('CoinStats', 'blockchain and address are required', 400, 'INVALID_PARAMS');
    }

    try {
      const response = await this.requestWithRotation(`getWalletTransactions(${blockchain})`, (c) =>
        c.get('/wallet/transactions', {
          params: {
            blockchain,
            address,
            page,
            limit,
          },
        })
      );

      const raw = response.data;
      const result = Array.isArray(raw?.result)
        ? raw.result
        : Array.isArray(raw)
        ? raw
        : [];

      return {
        result,
        meta: raw?.meta || { page, limit, hasNextPage: result.length >= limit },
      };
    } catch (err: any) {
      if (err.statusCode === 404 || err.response?.status === 404) {
        return { result: [], meta: { page, limit, hasNextPage: false } };
      }
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(
        'CoinStats',
        `Failed to fetch wallet transactions: ${err.message}`,
        err.statusCode || 502,
        'WALLET_TRANSACTIONS_ERROR',
        false,
        err
      );
    }
  }

  async getWalletDefi(blockchain: string, address: string): Promise<any> {
    if (!blockchain || !address) {
      return null;
    }

    try {
      const response = await this.requestWithRotation(`getWalletDefi(${blockchain})`, (c) =>
        c.get('/wallet/defi', {
          params: {
            blockchain,
            address,
          },
        })
      );

      return response.data;
    } catch (err: any) {
      console.warn(
        `[CoinStatsProvider] Non-critical error fetching wallet defi (${blockchain}:${address}):`,
        err.message
      );
      return null;
    }
  }
}

export const coinStatsProvider = new CoinStatsProvider();
