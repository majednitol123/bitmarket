import { Request, Response, NextFunction } from 'express';
import { marketService } from './market.service';
import { marketDemandTracker } from './marketDemand';
import { getProactiveRefreshInterval, setProactiveRefreshInterval } from './market.proactive';
import { AppError } from '../../middleware/errorHandler';

export class MarketController {
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      marketDemandTracker.recordDemand();
      const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
      const overview = await marketService.getOverview(forceRefresh);
      res.json({
        success: true,
        data: overview,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      marketDemandTracker.recordDemand();
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));
      const category = String(req.query.category || 'all');
      const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';

      const result = await marketService.getTokens(page, limit, category, forceRefresh);
      res.json({
        success: true,
        data: result.tokens,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTokenById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawCoinId = req.params.coinId;
      const coinId = Array.isArray(rawCoinId) ? rawCoinId[0] : rawCoinId;
      if (!coinId) {
        throw new AppError('Coin ID is required', 400, 'INVALID_PARAM');
      }

      const token = await marketService.getTokenById(String(coinId));
      if (!token) {
        throw new AppError(`Token "${coinId}" not found`, 404, 'TOKEN_NOT_FOUND');
      }

      res.json({
        success: true,
        data: token,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTokenChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawCoinId = req.params.coinId;
      const coinId = Array.isArray(rawCoinId) ? rawCoinId[0] : rawCoinId;
      const period = String(req.query.period || '1w');

      if (!coinId) {
        throw new AppError('Coin ID is required', 400, 'INVALID_PARAM');
      }

      const chart = await marketService.getTokenChart(String(coinId), period);
      res.json({
        success: true,
        data: chart,
      });
    } catch (err) {
      next(err);
    }
  }

  async searchTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || req.query.query || '');
      const tokens = await marketService.searchTokens(q);
      res.json({
        success: true,
        data: tokens,
      });
    } catch (err) {
      next(err);
    }
  }

  async getGainers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
      const gainers = await marketService.getGainers(limit);
      res.json({
        success: true,
        data: gainers,
      });
    } catch (err) {
      next(err);
    }
  }

  async getInterval(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          intervalSeconds: getProactiveRefreshInterval(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async setInterval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intervalSeconds = parseInt(String(req.body.intervalSeconds || req.query.intervalSeconds || '5'), 10);
      const updated = await setProactiveRefreshInterval(intervalSeconds);
      res.json({
        success: true,
        data: {
          intervalSeconds: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const marketController = new MarketController();
