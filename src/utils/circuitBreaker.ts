/**
 * Lightweight in-memory circuit-breaker for RPC endpoints.
 *
 * Tracks consecutive failures per chain key (e.g. "evm-34", "solana-devnet").
 * When a chain exceeds FAILURE_THRESHOLD consecutive failures, the circuit
 * "opens" and all calls to that chain are skipped for RECOVERY_MS.
 * After the recovery window, the circuit "half-opens" — allowing one probe
 * request. If it succeeds, the circuit closes; if it fails, it re-opens.
 *
 * This prevents dead RPCs (like SecureChain during outages) from blocking
 * the entire app with 10s timeouts × retry loops.
 */

/** Number of consecutive failures before the circuit opens */
const FAILURE_THRESHOLD = 2;

/** How long (ms) to keep the circuit open before allowing a probe */
const RECOVERY_MS = 5 * 60 * 1000; // 5 minutes

interface CircuitState {
  /** Consecutive failure count */
  failures: number;
  /** Timestamp when the circuit was opened (undefined = closed) */
  openedAt?: number;
}

class RpcCircuitBreaker {
  private circuits = new Map<string, CircuitState>();

  /**
   * Returns true if the circuit for `chainKey` is open (should be skipped).
   * If the recovery window has elapsed, returns false to allow a probe.
   */
  isOpen(chainKey: string): boolean {
    const state = this.circuits.get(chainKey);
    if (!state || state.failures < FAILURE_THRESHOLD) return false;

    // Circuit is tripped — check if recovery window has passed
    if (state.openedAt && Date.now() - state.openedAt >= RECOVERY_MS) {
      // Half-open: allow one probe request. Reset openedAt to Date.now()
      // to lock out other concurrent probes during the recovery window.
      state.openedAt = Date.now();
      this.circuits.set(chainKey, state);
      return false;
    }

    return true;
  }

  /** Record a successful RPC call — resets the circuit to closed. */
  recordSuccess(chainKey: string): void {
    this.circuits.delete(chainKey);
  }

  /** Record a failed RPC call — increments counter and may open the circuit. */
  recordFailure(chainKey: string): void {
    const state = this.circuits.get(chainKey) || { failures: 0 };
    state.failures += 1;

    if (state.failures >= FAILURE_THRESHOLD && !state.openedAt) {
      state.openedAt = Date.now();
      if (__DEV__) {
        console.warn(
          `[CircuitBreaker] Circuit OPENED for "${chainKey}" after ${state.failures} consecutive failures. ` +
          `Will retry in ${RECOVERY_MS / 1000}s.`
        );
      }
    } else if (state.failures >= FAILURE_THRESHOLD && state.openedAt) {
      // Probe failed — re-open the circuit with a fresh timer
      state.openedAt = Date.now();
      if (__DEV__) {
        console.warn(`[CircuitBreaker] Probe failed for "${chainKey}". Circuit re-opened.`);
      }
    }

    this.circuits.set(chainKey, state);
  }

  /** Returns an array of chain keys that currently have open circuits. */
  getFailedChains(): string[] {
    const failed: string[] = [];
    for (const [key, state] of this.circuits.entries()) {
      if (state.failures >= FAILURE_THRESHOLD) {
        // Include if still within recovery window
        if (state.openedAt && Date.now() - state.openedAt < RECOVERY_MS) {
          failed.push(key);
        }
      }
    }
    return failed;
  }

  /** Returns true if any circuit is currently open. */
  hasOpenCircuits(): boolean {
    return this.getFailedChains().length > 0;
  }

  /** Reset all circuits — useful for testing or manual recovery. */
  resetAll(): void {
    this.circuits.clear();
  }
}

/** Singleton instance shared across the app */
export const rpcCircuitBreaker = new RpcCircuitBreaker();
