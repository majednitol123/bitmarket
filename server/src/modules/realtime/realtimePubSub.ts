import crypto from 'crypto';
import { EventEmitter } from 'events';
import { getRedisClient, isRedisConnected } from '../../config/redis';
import { RealtimeResource, RealtimeEventType, RealtimeMessage } from './realtime.types';
import type { RedisClientType } from 'redis';

const REDIS_CHANNEL = 'crypto:realtime:events';

export class RealtimePubSubManager {
  public readonly instanceId: string;
  private emitter = new EventEmitter();
  private subscriberClient: RedisClientType | null = null;
  private isSubscribed = false;
  private memoryVersions = new Map<string, number>();

  constructor() {
    this.instanceId = `inst-${crypto.randomUUID().slice(0, 8)}`;
    this.emitter.setMaxListeners(100);
  }

  /**
   * Initializes Redis subscriber for multi-instance event fan-out
   */
  public async start(): Promise<void> {
    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        this.subscriberClient = client.duplicate() as RedisClientType;
        await this.subscriberClient.connect();

        await this.subscriberClient.subscribe(REDIS_CHANNEL, (messageStr: string) => {
          try {
            const parsed = JSON.parse(messageStr) as RealtimeMessage;
            // Emit locally to all gateways on this instance
            this.emitter.emit('message', parsed);
          } catch (err: any) {
            console.error('[RealtimePubSub] Error parsing pub/sub message:', err.message);
          }
        });

        this.isSubscribed = true;
        console.log(`[RealtimePubSub] Subscribed to Redis channel "${REDIS_CHANNEL}" on ${this.instanceId}`);
      } catch (err: any) {
        console.warn(`[RealtimePubSub] Failed to start Redis subscriber (${err.message}). Using in-memory fallback.`);
        this.isSubscribed = false;
      }
    } else {
      console.log('[RealtimePubSub] Redis not available on startup. Running in-memory pub/sub mode.');
    }
  }

  /**
   * Stops the subscriber client cleanly
   */
  public async stop(): Promise<void> {
    if (this.subscriberClient && this.isSubscribed) {
      try {
        await this.subscriberClient.unsubscribe(REDIS_CHANNEL);
        await this.subscriberClient.quit();
        this.isSubscribed = false;
        console.log('[RealtimePubSub] Cleaned up Redis subscriber');
      } catch (err: any) {
        console.error('[RealtimePubSub] Error closing subscriber:', err.message);
      }
    }
    this.emitter.removeAllListeners();
  }

  /**
   * Increments and retrieves monotonic snapshot version
   * Stored in Redis so all cluster instances share the exact same version sequence
   */
  public async getNextSnapshotVersion(resource: RealtimeResource): Promise<number> {
    const client = getRedisClient();
    const versionKey = `snapshot_version:${resource}`;

    if (client && isRedisConnected()) {
      try {
        const next = await client.incr(versionKey);
        return next;
      } catch (err: any) {
        console.warn(`[RealtimePubSub] Error incrementing snapshot version in Redis:`, err.message);
      }
    }

    const curr = this.memoryVersions.get(resource) || 0;
    const next = curr + 1;
    this.memoryVersions.set(resource, next);
    return next;
  }

  /**
   * Retrieves current snapshot version without incrementing
   */
  public async getSnapshotVersion(resource: RealtimeResource): Promise<number> {
    const client = getRedisClient();
    const versionKey = `snapshot_version:${resource}`;

    if (client && isRedisConnected()) {
      try {
        const val = await client.get(versionKey);
        return val ? parseInt(val, 10) : 0;
      } catch (err: any) {
        console.warn(`[RealtimePubSub] Error fetching version for ${resource}:`, err.message);
      }
    }

    return this.memoryVersions.get(resource) || 0;
  }

  /**
   * Publishes a real-time event.
   * Mandate (Section 38): Publishes metadata only! Never large payloads.
   */
  public async publish(
    resource: RealtimeResource,
    eventType: RealtimeEventType,
    metadata?: Record<string, any>
  ): Promise<RealtimeMessage> {
    const snapshotVersion = await this.getNextSnapshotVersion(resource);
    const message: RealtimeMessage = {
      resource,
      eventType,
      snapshotVersion,
      timestamp: Date.now(),
      instanceId: this.instanceId,
      metadata,
    };

    const payloadStr = JSON.stringify(message);

    // Section 38 Payload Protection: Prevent huge payloads (>4KB) over pub/sub
    if (payloadStr.length > 4096) {
      console.warn(
        `[RealtimePubSub] Warning: Large payload (${payloadStr.length} bytes) published for ${resource}. Section 38 requires metadata-only.`
      );
    }

    const client = getRedisClient();
    if (client && isRedisConnected()) {
      try {
        await client.publish(REDIS_CHANNEL, payloadStr);
      } catch (err: any) {
        console.warn(`[RealtimePubSub] Redis publish failed (${err.message}). Emitting locally.`);
        this.emitter.emit('message', message);
      }
    } else {
      // In-memory local emit
      this.emitter.emit('message', message);
    }

    return message;
  }

  /**
   * Registers a listener for real-time messages received on this instance
   */
  public onMessage(listener: (msg: RealtimeMessage) => void): () => void {
    this.emitter.on('message', listener);
    return () => {
      this.emitter.off('message', listener);
    };
  }

  /**
   * Snapshot versions summary for all key resources
   */
  public async getAllSnapshotVersions(): Promise<Record<string, number>> {
    const resources: RealtimeResource[] = [
      'market:tokens',
      'market:overview',
      'portfolio',
      'price_alert',
    ];

    const result: Record<string, number> = {};
    for (const res of resources) {
      result[res] = await this.getSnapshotVersion(res);
    }
    return result;
  }
}

export const realtimePubSub = new RealtimePubSubManager();
