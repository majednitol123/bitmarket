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
  | 'interval_updated';

export interface RealtimeMessage {
  resource: RealtimeResource;
  eventType: RealtimeEventType;
  snapshotVersion: number;
  timestamp: number;
  instanceId: string;
  metadata?: Record<string, any>;
}

export interface ClientInboundMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping' | 'set_interval' | 'market_ping';
  resources?: RealtimeResource[];
  walletAddress?: string;
  intervalSeconds?: number;
}

export interface RealtimeGatewayStats {
  instanceId: string;
  activeWebSocketConnections: number;
  activeMarketSubscribers: number;
  activeSseConnections: number;
  totalMessagesBroadcast: number;
  snapshotVersions: Record<string, number>;
  uptimeSeconds: number;
  clients?: Array<{
    id: string;
    ip: string;
    subscriptions: RealtimeResource[];
    walletAddress?: string;
  }>;
}
