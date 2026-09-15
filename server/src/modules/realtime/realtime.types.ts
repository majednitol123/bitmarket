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
  | 'unsubscribed';

export interface RealtimeMessage {
  resource: RealtimeResource;
  eventType: RealtimeEventType;
  snapshotVersion: number;
  timestamp: number;
  instanceId: string;
  metadata?: Record<string, any>;
}

export interface ClientInboundMessage {
  action: 'subscribe' | 'unsubscribe' | 'ping';
  resources?: RealtimeResource[];
  walletAddress?: string;
}

export interface RealtimeGatewayStats {
  instanceId: string;
  activeWebSocketConnections: number;
  activeSseConnections: number;
  totalMessagesBroadcast: number;
  snapshotVersions: Record<string, number>;
  uptimeSeconds: number;
}
