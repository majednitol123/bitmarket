import { realtimeGateway } from '../realtime/realtimeGateway';

/**
 * Tracks whether there is active user demand for real-time market data.
 * The proactive cache warmer ONLY runs when there are active WebSocket / SSE subscribers
 * currently viewing the Market screen.
 * When 0 subscribers are watching, external API calls are paused immediately.
 */
class MarketDemandTracker {
  /**
   * Checks if anyone is actively showing or watching market data.
   * Directly reflects real-time client connection and screen subscription state.
   */
  public async hasActiveDemand(): Promise<boolean> {
    return realtimeGateway.hasActiveMarketSubscribers();
  }

  /**
   * Legacy shim for controller endpoints
   */
  public recordDemand(): void {
    // No-op: Demand is strictly governed by active real-time viewer subscriptions
  }

  public getActiveSubscriberCount(): number {
    return realtimeGateway.getActiveMarketSubscriberCount();
  }
}

export const marketDemandTracker = new MarketDemandTracker();
