import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SystemController } from '../src/modules/system/system.controller';

describe('Health & Readiness Diagnostics', () => {
  const systemController = new SystemController();

  const createMockReqRes = () => {
    let statusCode = 200;
    let jsonBody: any = null;
    let headers: Record<string, any> = {};

    const req: any = { headers: {} };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonBody = data;
        return this;
      },
      setHeader(k: string, v: any) {
        headers[k.toLowerCase()] = v;
      },
    };

    return {
      req,
      res,
      getStatusCode: () => statusCode,
      getJsonBody: () => jsonBody,
    };
  };

  it('liveness probe returns 200 OK with runtime diagnostics', async () => {
    const mock = createMockReqRes();
    await systemController.getLiveness(mock.req, mock.res);

    assert.equal(mock.getStatusCode(), 200);
    const body = mock.getJsonBody();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'crypto-aggregator-api');
    assert.ok(typeof body.uptimeSeconds === 'number');
    assert.ok(typeof body.memoryUsageMb === 'number');
    assert.ok(body.instanceId);
  });

  it('cache health probe returns status and metrics telemetry', async () => {
    const mock = createMockReqRes();
    const next = (err?: any) => {
      if (err) throw err;
    };

    await systemController.getCacheHealth(mock.req, mock.res, next);

    assert.equal(mock.getStatusCode(), 200);
    const body = mock.getJsonBody();
    assert.ok(['healthy', 'degraded_memory_fallback'].includes(body.status));
    assert.ok(body.metrics);
    assert.ok(typeof body.metrics.hitsFresh === 'number');
    assert.ok(typeof body.metrics.misses === 'number');
  });

  it('provider health probe returns diagnostic budget breakdown without throwing', async () => {
    const mock = createMockReqRes();
    const next = (err?: any) => {
      if (err) throw err;
    };

    await systemController.getProviderHealth(mock.req, mock.res, next);

    assert.equal(mock.getStatusCode(), 200);
    const body = mock.getJsonBody();
    assert.ok(['healthy', 'degraded', 'critical'].includes(body.status));
    assert.ok(body.providers);
  });

  it('readiness probe returns check details for database and redis', async () => {
    const mock = createMockReqRes();
    await systemController.getReadiness(mock.req, mock.res);

    // May return 200 if connected or 503 if disconnected in test runner environment
    const code = mock.getStatusCode();
    assert.ok([200, 503].includes(code));

    const body = mock.getJsonBody();
    assert.ok('ready' in body);
    assert.ok(body.checks);
    assert.ok('database' in body.checks);
    assert.ok('redis' in body.checks);
    assert.ok(['healthy', 'unhealthy'].includes(body.checks.database.status));
    assert.ok(['healthy', 'unhealthy'].includes(body.checks.redis.status));
  });
});
