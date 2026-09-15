import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CacheService } from '../src/cache/cacheService';

describe('CacheService & Envelope Telemetry', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  it('writes and reads a versioned cache envelope', async () => {
    const key = 'test:envelope:1';
    const testData = { symbol: 'BTC', price: 95000 };

    const envelope = await cacheService.writeEnvelope(
      key,
      testData,
      { freshSeconds: 10, staleSeconds: 30 },
      'test-provider'
    );

    assert.equal(envelope.schemaVersion, 1);
    assert.deepEqual(envelope.value, testData);
    assert.equal(envelope.source, 'test-provider');
    assert.equal(envelope.version, 1);
    assert.ok(envelope.freshUntil > Date.now());
    assert.ok(envelope.staleUntil > envelope.freshUntil);

    const read = await cacheService.readEnvelope<typeof testData>(key);
    assert.ok(read !== null);
    assert.deepEqual(read?.value, testData);
  });

  it('increments version on consecutive writes', async () => {
    const key = 'test:versioning';
    const env1 = await cacheService.writeEnvelope(key, { v: 1 }, { freshSeconds: 5 });
    assert.equal(env1.version, 1);

    const env2 = await cacheService.writeEnvelope(key, { v: 2 }, { freshSeconds: 5 });
    assert.equal(env2.version, 2);
  });

  it('coalesces concurrent requests via single-flight deduplication', async () => {
    const key = 'test:single-flight';
    let fetchCount = 0;

    const slowFetcher = async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { answer: 42, count: fetchCount };
    };

    // 5 concurrent calls launched simultaneously
    const results = await Promise.all([
      cacheService.getOrFetch(key, 10, slowFetcher),
      cacheService.getOrFetch(key, 10, slowFetcher),
      cacheService.getOrFetch(key, 10, slowFetcher),
      cacheService.getOrFetch(key, 10, slowFetcher),
      cacheService.getOrFetch(key, 10, slowFetcher),
    ]);

    // Fetcher should only have been called ONCE due to single-flight coalescing
    assert.equal(fetchCount, 1);
    for (const res of results) {
      assert.equal(res.answer, 42);
      assert.equal(res.count, 1);
    }

    const metrics = cacheService.getMetrics();
    assert.ok(metrics.singleFlightJoins >= 1);
  });

  it('serves cached data directly on cache hit without re-invoking fetcher', async () => {
    const key = 'test:cache-hit';
    let fetchCount = 0;

    const fetcher = async () => {
      fetchCount++;
      return { timestamp: Date.now() };
    };

    const first = await cacheService.getOrFetch(key, 10, fetcher);
    assert.equal(fetchCount, 1);

    const second = await cacheService.getOrFetch(key, 10, fetcher);
    assert.equal(fetchCount, 1); // No new fetch
    assert.deepEqual(second, first);

    const metrics = cacheService.getMetrics();
    assert.ok(metrics.hitsFresh >= 1);
  });

  it('invalidates keys cleanly upon request', async () => {
    const key = 'test:invalidation';
    await cacheService.writeEnvelope(key, 'cached-value', { freshSeconds: 60 });

    const before = await cacheService.readEnvelope(key);
    assert.equal(before?.value, 'cached-value');

    await cacheService.delete(key);

    const after = await cacheService.readEnvelope(key);
    assert.equal(after, null);
  });

  it('invalidates patterns cleanly across memory keys', async () => {
    await cacheService.writeEnvelope('market:btc:price', 95000, { freshSeconds: 60 });
    await cacheService.writeEnvelope('market:eth:price', 2800, { freshSeconds: 60 });
    await cacheService.writeEnvelope('portfolio:user1', { total: 100 }, { freshSeconds: 60 });

    const purged = await cacheService.invalidatePattern('market:*');
    assert.equal(purged, 2);

    assert.equal(await cacheService.readEnvelope('market:btc:price'), null);
    assert.equal(await cacheService.readEnvelope('market:eth:price'), null);
    assert.ok(await cacheService.readEnvelope('portfolio:user1') !== null);
  });
});
