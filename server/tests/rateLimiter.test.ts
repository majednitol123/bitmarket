import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/middleware/rateLimiter';

describe('Rate Limiter Middleware', () => {
  const createMockReqRes = (ip = '127.0.0.1', isSkipped = false) => {
    const headers: Record<string, any> = { 'x-forwarded-for': ip };
    const resHeaders: Record<string, any> = {};
    let statusCode = 200;
    let jsonBody: any = null;

    const req: any = {
      ip,
      headers,
      id: 'req_test123',
      path: isSkipped ? '/health' : '/api/market/overview',
    };

    const res: any = {
      setHeader(k: string, v: any) {
        resHeaders[k.toLowerCase()] = v;
      },
      getHeader(k: string) {
        return resHeaders[k.toLowerCase()];
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        jsonBody = body;
        return this;
      },
    };

    return { req, res, resHeaders, getStatusCode: () => statusCode, getJsonBody: () => jsonBody };
  };

  it('allows requests below the quota and decrements remaining', async () => {
    const limiter = createRateLimiter({
      windowMs: 10000,
      maxRequests: 3,
      bucketName: 'test-limit-1',
    });

    let nextCalled = 0;
    const next = () => {
      nextCalled++;
    };

    // 1st request
    const mock1 = createMockReqRes('10.0.0.1');
    await limiter(mock1.req, mock1.res, next);
    assert.equal(nextCalled, 1);
    assert.equal(mock1.resHeaders['ratelimit-limit'], 3);
    assert.equal(mock1.resHeaders['ratelimit-remaining'], 2);

    // 2nd request
    const mock2 = createMockReqRes('10.0.0.1');
    await limiter(mock2.req, mock2.res, next);
    assert.equal(nextCalled, 2);
    assert.equal(mock2.resHeaders['ratelimit-remaining'], 1);

    // 3rd request
    const mock3 = createMockReqRes('10.0.0.1');
    await limiter(mock3.req, mock3.res, next);
    assert.equal(nextCalled, 3);
    assert.equal(mock3.resHeaders['ratelimit-remaining'], 0);
  });

  it('blocks requests exceeding the quota with 429 and Retry-After', async () => {
    const limiter = createRateLimiter({
      windowMs: 5000,
      maxRequests: 2,
      bucketName: 'test-limit-block',
    });

    let nextCalled = 0;
    const next = () => {
      nextCalled++;
    };

    // 1st request
    await limiter(createMockReqRes('10.0.0.2').req, createMockReqRes('10.0.0.2').res, next);
    // 2nd request
    await limiter(createMockReqRes('10.0.0.2').req, createMockReqRes('10.0.0.2').res, next);
    assert.equal(nextCalled, 2);

    // 3rd request (exceeds limit)
    const mock3 = createMockReqRes('10.0.0.2');
    await limiter(mock3.req, mock3.res, next);

    // next() should NOT be called for blocked request
    assert.equal(nextCalled, 2);
    assert.equal(mock3.getStatusCode(), 429);
    assert.ok(mock3.resHeaders['retry-after'] >= 1);
    assert.equal(mock3.resHeaders['ratelimit-remaining'], 0);

    const body = mock3.getJsonBody();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(body.error.requestId, 'req_test123');
  });

  it('isolates rate limits between different IP addresses', async () => {
    const limiter = createRateLimiter({
      windowMs: 10000,
      maxRequests: 2,
      bucketName: 'test-limit-isolation',
    });

    let nextCalled = 0;
    const next = () => {
      nextCalled++;
    };

    // Exhaust client A
    await limiter(createMockReqRes('192.168.1.1').req, createMockReqRes('192.168.1.1').res, next);
    await limiter(createMockReqRes('192.168.1.1').req, createMockReqRes('192.168.1.1').res, next);
    assert.equal(nextCalled, 2);

    // Client B should still have full quota
    const mockB = createMockReqRes('192.168.1.2');
    await limiter(mockB.req, mockB.res, next);
    assert.equal(nextCalled, 3);
    assert.equal(mockB.resHeaders['ratelimit-remaining'], 1);
  });

  it('respects skip callback for whitelisted endpoints', async () => {
    const limiter = createRateLimiter({
      windowMs: 5000,
      maxRequests: 1,
      bucketName: 'test-limit-skip',
      skip: (req) => req.path === '/health',
    });

    let nextCalled = 0;
    const next = () => {
      nextCalled++;
    };

    const skippedMock = createMockReqRes('10.0.0.9', true);
    await limiter(skippedMock.req, skippedMock.res, next);
    assert.equal(nextCalled, 1);

    // Even if called again, it continues to skip and not increment or block
    await limiter(skippedMock.req, skippedMock.res, next);
    assert.equal(nextCalled, 2);
  });
});
