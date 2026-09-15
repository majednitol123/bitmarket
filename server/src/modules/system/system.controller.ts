import { Request, Response, NextFunction } from 'express';
import { providerBudgetTracker } from '../../providers/core/ProviderBudgetTracker';
import { blockchainRpcProvider } from '../../providers/BlockchainRpcProvider';
import { cacheService } from '../../cache/cacheService';
import { metricsService } from './metrics.service';
import { getDbPool } from '../../config/database';
import { getRedisClient, isRedisConnected } from '../../config/redis';
import { realtimePubSub } from '../realtime/realtimePubSub';
import { AppError } from '../../middleware/errorHandler';

export class SystemController {

  public getLiveness = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      status: 'ok',
      service: 'crypto-aggregator-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      instanceId: realtimePubSub.instanceId,
      memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  };


  public getReadiness = async (req: Request, res: Response): Promise<void> => {
    const checks: {
      database: { status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string };
      redis: { status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string };
    } = {
      database: { status: 'unhealthy' },
      redis: { status: 'unhealthy' },
    };

    let isReady = true;

    // Check Database
    const pool = getDbPool();
    if (pool) {
      const dbStart = Date.now();
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        checks.database = {
          status: 'healthy',
          latencyMs: Date.now() - dbStart,
        };
      } catch (err: any) {
        checks.database = {
          status: 'unhealthy',
          error: err.message,
        };
        isReady = false;
      }
    } else {
      checks.database = {
        status: 'unhealthy',
        error: 'Database pool not initialized',
      };
      isReady = false;
    }

    // Check Redis
    const redisClient = getRedisClient();
    if (redisClient && isRedisConnected()) {
      const redisStart = Date.now();
      try {
        await redisClient.ping();
        checks.redis = {
          status: 'healthy',
          latencyMs: Date.now() - redisStart,
        };
      } catch (err: any) {
        checks.redis = {
          status: 'unhealthy',
          error: err.message,
        };
        isReady = false;
      }
    } else {
      checks.redis = {
        status: 'unhealthy',
        error: 'Redis client not connected',
      };
      isReady = false;
    }

    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      instanceId: realtimePubSub.instanceId,
      checks,
    });
  };

  /**
   * GET /api/system/metrics
   * Structured JSON metrics report
   */
  public getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await metricsService.getSummaryJson();
      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /metrics
   * Prometheus standard plain-text exposition format
   */
  public getPrometheusMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prometheusText = await metricsService.toPrometheusText();
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(prometheusText);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /health/cache or GET /api/system/cache
   * Returns live cache metrics: hit ratios, single-flight joins, distributed locks, and SWR revalidations
   */
  public getCacheHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = cacheService.getMetrics();
      res.json({
        status: metrics.redisConnected ? 'healthy' : 'degraded_memory_fallback',
        timestamp: new Date().toISOString(),
        metrics,
      });
    } catch (err) {
      next(err);
    }
  };
  /**
   * GET /health/providers or GET /api/system/providers
   * Returns live diagnostic metrics, circuit breaker states, and API budget tracking
   */
  public getProviderHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const allMetrics = providerBudgetTracker.getAllMetrics();
      const providerList = Object.values(allMetrics);

      let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (providerList.some((p) => p.status === 'outage' || p.status === 'exhausted')) {
        overallStatus = 'critical';
      } else if (providerList.some((p) => p.status === 'degraded')) {
        overallStatus = 'degraded';
      }

      res.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        providers: allMetrics,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/system/rpc-balance
   * Queries real on-chain balance directly via BlockchainRpcProvider (Alchemy / Fallback RPCs)
   */
  public getRpcBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { chain, address, tokenAddress, decimals } = req.query;

      if (!address || typeof address !== 'string') {
        throw new AppError('Wallet address is required', 400, 'INVALID_ADDRESS');
      }

      const chainIdOrName = (chain as string) || '1';

      if (tokenAddress && typeof tokenAddress === 'string') {
        const tokenDecimals = decimals ? parseInt(decimals as string, 10) : 18;
        const result = await blockchainRpcProvider.getTokenBalance(
          chainIdOrName,
          tokenAddress,
          address,
          tokenDecimals
        );
        res.json({ success: true, data: result });
        return;
      }

      const result = await blockchainRpcProvider.getNativeBalance(chainIdOrName, address);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/system/rpc-block
   * Queries latest mined block number for a chain
   */
  public getRpcBlock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const chain = (req.query.chain as string) || '1';
      const blockNumber = await blockchainRpcProvider.getBlockNumber(chain);
      res.json({ success: true, data: { chain, blockNumber } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/system/rpc-tx/:txHash
   * Queries transaction confirmation and receipt status on-chain
   */
  public getRpcTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const txHash = String(req.params.txHash || '').trim();
      const chain = (req.query.chain as string) || '1';

      if (!txHash) {
        throw new AppError('Transaction hash is required', 400, 'INVALID_TX_HASH');
      }

      const receipt = await blockchainRpcProvider.getTransactionReceipt(chain, txHash);
      res.json({ success: true, data: receipt });
    } catch (err) {
      next(err);
    }
  };
}

export const systemController = new SystemController();
