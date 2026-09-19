import { getWebSocketUrl } from '../api/apiConfig';

export type RealtimeResource =
  | 'market:tokens'
  | 'market:overview'
  | 'market:token'
  | 'portfolio'
  | 'price_alert'
  | 'system';

export type RealtimeEventType =
  | 'snapshot_updated'
  | 'alert_triggered'
  | 'alert_rearmed'
  | 'swap_confirmed'
  | 'swap_failed'
  | 'heartbeat'
  | 'subscribed'
  | 'unsubscribed'
  | 'reconnected';

export interface RealtimeMessage {
  resource: RealtimeResource;
  eventType: RealtimeEventType;
  snapshotVersion: number;
  timestamp: number;
  instanceId?: string;
  metadata?: Record<string, any>;
}

export type RealtimeListener = (msg: RealtimeMessage) => void;
export type ConnectionListener = (connected: boolean) => void;

class RealtimeService {
  private ws: WebSocket | null = null;
  private isExplicitlyClosed = false;
  private retryAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageListeners = new Set<RealtimeListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private lastSeenVersions = new Map<string, number>();
  private subscribedResources = new Set<RealtimeResource>(['system']);
  private activeWalletAddress: string | null = null;
  private isConnected = false;

  constructor() {
    // Singleton
  }

  /**
   * Initializes the WebSocket connection to the backend gateway
   */
  public connect(walletAddress?: string): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (walletAddress && walletAddress !== this.activeWalletAddress) {
        this.activeWalletAddress = walletAddress;
        this.sendSubscriptionPayload();
      }
      return;
    }

    this.isExplicitlyClosed = false;
    if (walletAddress) {
      this.activeWalletAddress = walletAddress;
    }

    const url = getWebSocketUrl();
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        const wasReconnecting = this.retryAttempt > 0;
        this.retryAttempt = 0;
        this.notifyConnectionState(true);

        // Send topics subscription
        this.sendSubscriptionPayload();

        // If this was a reconnection, broadcast synthetic 'reconnected' event to force fresh cache pull
        if (wasReconnecting) {
          this.notifyMessage({
            resource: 'system',
            eventType: 'reconnected',
            snapshotVersion: 0,
            timestamp: Date.now(),
          });
        }
      };

      this.ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString();
          const message = JSON.parse(raw) as RealtimeMessage;

          // Handle server heartbeat ping
          if (message.eventType === 'heartbeat') {
            return;
          }

          // Section 39 Rule: Newest Update Wins
          if (message.snapshotVersion > 0) {
            const prevVersion = this.lastSeenVersions.get(message.resource) || 0;
            if (message.snapshotVersion <= prevVersion) {
              // Discard stale out-of-order message
              return;
            }
            this.lastSeenVersions.set(message.resource, message.snapshotVersion);
          }

          this.notifyMessage(message);
        } catch {
          // Ignore malformed payloads
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notifyConnectionState(false);
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[RealtimeService] WebSocket error:', err);
        // onclose will trigger next
      };
    } catch (err) {
      console.warn('[RealtimeService] Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedules reconnection with exponential backoff and jitter (Section 39)
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isExplicitlyClosed) return;

    this.retryAttempt++;
    // Delays: 1s, 2s, 4s, 8s, max 16s with 20% random jitter
    const baseDelay = Math.min(1000 * Math.pow(2, this.retryAttempt - 1), 16000);
    const jitter = baseDelay * (0.8 + Math.random() * 0.4);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitter);
  }

  private currentIntervalSeconds = 5;

  /**
   * Sends topic subscription to the gateway
   */
  private sendSubscriptionPayload(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      action: 'subscribe',
      resources: Array.from(this.subscribedResources),
      walletAddress: this.activeWalletAddress || undefined,
      intervalSeconds: this.currentIntervalSeconds,
    };

    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err: any) {
      console.warn('[RealtimeService] Error sending subscription:', err.message);
    }
  }

  /**
   * Dynamically subscribes to additional topics (e.g. portfolio or price alerts)
   */
  public subscribe(resources: RealtimeResource[], walletAddress?: string, intervalSeconds?: number): void {
    for (const r of resources) {
      this.subscribedResources.add(r);
    }
    if (walletAddress) {
      this.activeWalletAddress = walletAddress;
    }
    if (typeof intervalSeconds === 'number' && intervalSeconds >= 5) {
      this.currentIntervalSeconds = intervalSeconds;
    }
    this.sendSubscriptionPayload();
  }

  /**
   * Dynamically updates live market update interval on the server (5s, 10s, 15s, 30s)
   */
  public setUpdateInterval(intervalSeconds: number): void {
    this.currentIntervalSeconds = Math.max(5, Math.min(60, intervalSeconds));
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            action: 'set_interval',
            intervalSeconds: this.currentIntervalSeconds,
          })
        );
      } catch (err: any) {
        console.warn('[RealtimeService] Error sending interval update:', err.message);
      }
    }
  }

  /**
   * Dynamically unsubscribes from topics (e.g. when leaving Markets screen)
   */
  public unsubscribe(resources: RealtimeResource[]): void {
    for (const r of resources) {
      this.subscribedResources.delete(r);
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            action: 'unsubscribe',
            resources,
          })
        );
      } catch (err: any) {
        console.warn('[RealtimeService] Error sending unsubscription:', err.message);
      }
    }
  }

  /**
   * Registers a message listener
   */
  public onMessage(listener: RealtimeListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  /**
   * Registers a connection status listener
   */
  public onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyMessage(msg: RealtimeMessage): void {
    this.messageListeners.forEach((l) => {
      try {
        l(msg);
      } catch (err) {
        console.error('[RealtimeService] Listener error:', err);
      }
    });
  }

  private notifyConnectionState(connected: boolean): void {
    this.connectionListeners.forEach((l) => {
      try {
        l(connected);
      } catch (err) {
        console.error('[RealtimeService] Connection listener error:', err);
      }
    });
  }

  /**
   * Checks if currently connected
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Retrieves last seen version for a resource
   */
  public getLastSeenVersion(resource: string): number {
    return this.lastSeenVersions.get(resource) || 0;
  }

  /**
   * Sends a lightweight proof-of-view pulse to keep market lease active on server
   */
  public pingMarketView(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ action: 'market_ping' }));
      } catch (err: any) {
        console.warn('[RealtimeService] Error sending market ping:', err.message);
      }
    }
  }

  /**
   * Disconnects cleanly
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
    this.notifyConnectionState(false);
  }
}

const globalForRealtime = globalThis as unknown as { __bitmarket_realtime_service__?: RealtimeService };
export const realtimeService =
  globalForRealtime.__bitmarket_realtime_service__ ?? new RealtimeService();
globalForRealtime.__bitmarket_realtime_service__ = realtimeService;

