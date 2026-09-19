import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { realtimePubSub } from './realtimePubSub';
import { setProactiveRefreshInterval, getProactiveRefreshInterval } from '../market/market.proactive';
import {
  RealtimeMessage,
  RealtimeResource,
  ClientInboundMessage,
  RealtimeGatewayStats,
} from './realtime.types';

interface ClientSession {
  id: string;
  ws: WebSocket;
  ip: string;
  isAlive: boolean;
  subscriptions: Set<RealtimeResource>;
  walletAddress?: string;
  connectedAt: number;
  lastMarketPingAt?: number;
}

interface SseClient {
  id: string;
  res: Response;
  ip: string;
  subscriptions: Set<RealtimeResource>;
  walletAddress?: string;
  connectedAt: number;
}

const MAX_WEBSOCKET_CONNECTIONS = 5000;
const HEARTBEAT_INTERVAL_MS = 25000; // 25 seconds
const MARKET_VIEW_LEASE_MS = 12000; // 12 seconds proof-of-view lease

export class RealtimeGateway {
  private wss: WebSocketServer | null = null;
  private wsClients = new Map<string, ClientSession>();
  private sseClients = new Map<string, SseClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private unsubscribePubSub: (() => void) | null = null;
  private totalMessagesBroadcast = 0;
  private startedAt = Date.now();

  /**
   * Attaches the WebSocket server to the existing HTTP server and hooks into Redis Pub/Sub
   */
  public attach(server: http.Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 16 * 1024, // 16KB max inbound payload
    });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleWsConnection(ws, req);
    });

    // Start listening to the shared Redis Pub/Sub channel
    this.unsubscribePubSub = realtimePubSub.onMessage((msg: RealtimeMessage) => {
      this.broadcast(msg);
    });

    // Start 25s heartbeat loop
    this.heartbeatTimer = setInterval(() => {
      this.runHeartbeatCycle();
    }, HEARTBEAT_INTERVAL_MS);

    console.log(
      `[RealtimeGateway] WebSocket server attached at /ws (Instance: ${realtimePubSub.instanceId})`
    );
  }

  /**
   * Handles incoming WebSocket connection
   */
  private handleWsConnection(ws: WebSocket, req: http.IncomingMessage): void {
    if (this.wsClients.size >= MAX_WEBSOCKET_CONNECTIONS) {
      console.warn('[RealtimeGateway] Max connections reached. Rejecting client.');
      ws.close(1013, 'Max connections reached');
      return;
    }

    const socketId = `ws-${crypto.randomUUID().slice(0, 8)}`;
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';

    // Prune existing duplicate connections from the same client IP (eliminates Fast Refresh zombies)
    if (ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
      this.wsClients.forEach((existingSession, existingId) => {
        if (existingSession.ip === ip) {
          try {
            existingSession.ws.close(4001, 'Superseded by newer connection from same client');
          } catch {}
          this.wsClients.delete(existingId);
        }
      });
    }

    // Default subscriptions: system messages only (market topics subscribed on-demand by viewing screens)
    const defaultSubs = new Set<RealtimeResource>(['system']);

    const session: ClientSession = {
      id: socketId,
      ws,
      ip,
      isAlive: true,
      subscriptions: defaultSubs,
      connectedAt: Date.now(),
    };

    this.wsClients.set(socketId, session);

    // Initial greeting handshake with instance metadata
    ws.send(
      JSON.stringify({
        resource: 'system',
        eventType: 'subscribed',
        snapshotVersion: 0,
        timestamp: Date.now(),
        instanceId: realtimePubSub.instanceId,
        metadata: {
          socketId,
          subscriptions: Array.from(defaultSubs),
          heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
          intervalSeconds: getProactiveRefreshInterval(),
        },
      })
    );

    // Setup ping-pong response
    ws.on('pong', () => {
      session.isAlive = true;
    });

    // Handle inbound client action messages
    ws.on('message', (raw: string | Buffer) => {
      session.isAlive = true;
      try {
        const msg = JSON.parse(raw.toString()) as ClientInboundMessage;
        this.handleClientMessage(session, msg);
      } catch {
        // Ignore malformed client frames
      }
    });

    ws.on('close', () => {
      this.wsClients.delete(socketId);
    });

    ws.on('error', (err) => {
      console.warn(`[RealtimeGateway] Socket ${socketId} error:`, err.message);
      this.wsClients.delete(socketId);
    });
  }

  /**
   * Processes client subscription / ping requests
   */
  private handleClientMessage(session: ClientSession, msg: ClientInboundMessage): void {
    if (msg.action === 'ping') {
      session.ws.send(
        JSON.stringify({
          resource: 'system',
          eventType: 'heartbeat',
          snapshotVersion: 0,
          timestamp: Date.now(),
          instanceId: realtimePubSub.instanceId,
        })
      );
      return;
    }

    if (msg.action === 'market_ping') {
      session.lastMarketPingAt = Date.now();
      return;
    }

    if (msg.action === 'set_interval' && typeof msg.intervalSeconds === 'number') {
      setProactiveRefreshInterval(msg.intervalSeconds).catch(() => {});
      session.ws.send(
        JSON.stringify({
          resource: 'system',
          eventType: 'interval_updated',
          snapshotVersion: 0,
          timestamp: Date.now(),
          instanceId: realtimePubSub.instanceId,
          metadata: {
            intervalSeconds: msg.intervalSeconds,
          },
        })
      );
      return;
    }

    if (msg.action === 'subscribe' && Array.isArray(msg.resources)) {
      if (typeof msg.intervalSeconds === 'number' && msg.intervalSeconds >= 5) {
        setProactiveRefreshInterval(msg.intervalSeconds).catch(() => {});
      }
      for (const r of msg.resources) {
        session.subscriptions.add(r);
      }
      if (msg.resources.includes('market:tokens') || msg.resources.includes('market:overview')) {
        session.lastMarketPingAt = Date.now();
      }
      if (msg.walletAddress) {
        session.walletAddress = msg.walletAddress.toLowerCase().trim();
      }

      console.log(
        `[RealtimeGateway] Client ${session.id} subscribed to [${msg.resources.join(', ')}] (Active market subscribers: ${this.getActiveMarketSubscriberCount()})`
      );

      session.ws.send(
        JSON.stringify({
          resource: 'system',
          eventType: 'subscribed',
          snapshotVersion: 0,
          timestamp: Date.now(),
          instanceId: realtimePubSub.instanceId,
          metadata: {
            activeSubscriptions: Array.from(session.subscriptions),
            intervalSeconds: getProactiveRefreshInterval(),
          },
        })
      );
    } else if (msg.action === 'unsubscribe' && Array.isArray(msg.resources)) {
      for (const r of msg.resources) {
        session.subscriptions.delete(r);
      }
      if (!session.subscriptions.has('market:tokens') && !session.subscriptions.has('market:overview')) {
        session.lastMarketPingAt = undefined;
      }
      console.log(
        `[RealtimeGateway] Client ${session.id} unsubscribed from [${msg.resources.join(', ')}] (Active market subscribers: ${this.getActiveMarketSubscriberCount()})`
      );
    }
  }

  /**
   * Heartbeat cycle: pings all connected sockets and cleans up dead ones
   */
  private runHeartbeatCycle(): void {
    const deadSocketIds: string[] = [];

    this.wsClients.forEach((session, id) => {
      if (!session.isAlive) {
        session.ws.terminate();
        deadSocketIds.push(id);
        return;
      }

      session.isAlive = false;
      try {
        session.ws.ping();
      } catch {
        deadSocketIds.push(id);
      }
    });

    deadSocketIds.forEach((id) => this.wsClients.delete(id));

    // Keep SSE connections alive by sending a comment
    this.sseClients.forEach((client) => {
      try {
        client.res.write(': heartbeat\n\n');
      } catch {
        this.sseClients.delete(client.id);
      }
    });
  }

  /**
   * Broadcasts a real-time event to local WebSocket clients and SSE streams
   */
  public broadcast(msg: RealtimeMessage): void {
    this.totalMessagesBroadcast++;
    const payloadStr = JSON.stringify(msg);

    // 1. WebSocket delivery
    this.wsClients.forEach((session) => {
      if (session.ws.readyState !== WebSocket.OPEN) return;

      // Check if client is subscribed to this resource
      if (!session.subscriptions.has(msg.resource) && msg.resource !== 'system') {
        return;
      }

      // If alert event, check wallet isolation
      if (msg.resource === 'price_alert' && msg.metadata?.walletAddress && session.walletAddress) {
        if (session.walletAddress !== msg.metadata.walletAddress.toLowerCase()) {
          return;
        }
      }

      try {
        session.ws.send(payloadStr);
      } catch (err: any) {
        console.warn(`[RealtimeGateway] Error sending to ${session.id}:`, err.message);
      }
    });

    // 2. Server-Sent Events (SSE) delivery
    const sseEventStr = `data: ${payloadStr}\n\n`;
    this.sseClients.forEach((client) => {
      if (!client.subscriptions.has(msg.resource) && msg.resource !== 'system') {
        return;
      }

      try {
        client.res.write(sseEventStr);
      } catch {
        this.sseClients.delete(client.id);
      }
    });
  }

  /**
   * Handles incoming Server-Sent Events (SSE) stream request
   */
  public handleSseConnection(req: Request, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if proxied
    res.flushHeaders();

    const clientId = `sse-${crypto.randomUUID().slice(0, 8)}`;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const walletAddress = (req.query.walletAddress as string)?.toLowerCase().trim();

    // Parse requested topics or default to system only
    const requestedTopics = req.query.topics
      ? (req.query.topics as string).split(',').map((t) => t.trim() as RealtimeResource)
      : (['system'] as RealtimeResource[]);

    const client: SseClient = {
      id: clientId,
      res,
      ip,
      subscriptions: new Set<RealtimeResource>(requestedTopics),
      walletAddress,
      connectedAt: Date.now(),
    };

    this.sseClients.set(clientId, client);

    // Send initial greeting
    res.write(
      `data: ${JSON.stringify({
        resource: 'system',
        eventType: 'subscribed',
        snapshotVersion: 0,
        timestamp: Date.now(),
        instanceId: realtimePubSub.instanceId,
        metadata: { clientId, transport: 'sse' },
      })}\n\n`
    );

    req.on('close', () => {
      this.sseClients.delete(clientId);
    });
  }

  /**
   * Returns the count of active WebSocket and SSE clients subscribed to market updates
   */
  public getActiveMarketSubscriberCount(): number {
    const now = Date.now();
    let count = 0;
    this.wsClients.forEach((session) => {
      if (!session.isAlive) return;
      const hasMarket =
        session.subscriptions.has('market:tokens') || session.subscriptions.has('market:overview');
      if (!hasMarket) return;

      // Active view lease: must have proved active view within last 12 seconds
      if (session.lastMarketPingAt && now - session.lastMarketPingAt < MARKET_VIEW_LEASE_MS) {
        count++;
      } else {
        // Auto-expire lease when client stops confirming active market screen view
        session.subscriptions.delete('market:tokens');
        session.subscriptions.delete('market:overview');
        session.lastMarketPingAt = undefined;
      }
    });
    this.sseClients.forEach((client) => {
      if (
        client.subscriptions.has('market:tokens') ||
        client.subscriptions.has('market:overview')
      ) {
        count++;
      }
    });
    return count;
  }

  /**
   * Checks whether there are active subscribers currently watching market data
   */
  public hasActiveMarketSubscribers(): boolean {
    return this.getActiveMarketSubscriberCount() > 0;
  }

  /**
   * Retrieves gateway statistics
   */
  public async getStats(): Promise<RealtimeGatewayStats> {
    const snapshotVersions = await realtimePubSub.getAllSnapshotVersions();
    return {
      instanceId: realtimePubSub.instanceId,
      activeWebSocketConnections: this.wsClients.size,
      activeMarketSubscribers: this.getActiveMarketSubscriberCount(),
      activeSseConnections: this.sseClients.size,
      totalMessagesBroadcast: this.totalMessagesBroadcast,
      snapshotVersions,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      clients: Array.from(this.wsClients.values()).map((s) => ({
        id: s.id,
        ip: s.ip,
        subscriptions: Array.from(s.subscriptions),
        walletAddress: s.walletAddress,
      })),
    };
  }

  /**
   * Forces all connected sockets to disconnect and reconnect fresh with updated defaults
   */
  public disconnectAllClients(): void {
    this.wsClients.forEach((session) => {
      try {
        session.ws.close(4000, 'Session reset');
      } catch {}
    });
    this.wsClients.clear();
    console.log('[RealtimeGateway] Forced all existing sockets to reconnect fresh');
  }

  /**
   * Graceful shutdown of gateway
   */
  public stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.unsubscribePubSub) {
      this.unsubscribePubSub();
      this.unsubscribePubSub = null;
    }

    this.wsClients.forEach((session) => {
      try {
        session.ws.close(1001, 'Server shutting down');
      } catch {}
    });
    this.wsClients.clear();

    this.sseClients.forEach((client) => {
      try {
        client.res.end();
      } catch {}
    });
    this.sseClients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    console.log('[RealtimeGateway] Gateway stopped cleanly');
  }
}

export const realtimeGateway = new RealtimeGateway();
