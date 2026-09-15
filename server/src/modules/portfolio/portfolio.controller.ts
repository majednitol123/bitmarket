import { Request, Response, NextFunction } from 'express';
import { portfolioService } from './portfolio.service';
import { AppError } from '../../middleware/errorHandler';

function extractParams(req: Request): { chain: string; address: string } {
  const rawChain = req.params.chain;
  const rawAddress = req.params.address;

  const chain = Array.isArray(rawChain) ? rawChain[0] : rawChain;
  const address = Array.isArray(rawAddress) ? rawAddress[0] : rawAddress;

  if (!chain || !address) {
    throw new AppError('Chain and address are required path parameters', 400, 'INVALID_PARAMS');
  }

  return { chain: chain.trim(), address: address.trim() };
}

export class PortfolioController {
  async getPortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
      const data = await portfolioService.getPortfolio(chain, address, forceRefresh);
      res.json({
        success: true,
        data,
      });
    } catch (err: any) {
      const status = err.response?.status || err.statusCode;
      if (status === 429 || status === 406) {
        res.status(429).json({
          success: false,
          error: {
            code: 'PROVIDER_RATE_LIMITED',
            message: 'Data provider rate limit reached. Portfolio data will be available shortly — please try again in a few minutes.',
          },
        });
        return;
      }
      next(err);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
      const data = await portfolioService.getSummary(chain, address, forceRefresh);
      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async getHoldings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
      const data = await portfolioService.getHoldings(chain, address, forceRefresh);
      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async getChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const timeframe = String(req.query.range || req.query.timeframe || '1D');
      const data = await portfolioService.getChart(chain, address, timeframe);
      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));

      const result = await portfolioService.getTransactions(chain, address, page, limit);
      res.json({
        success: true,
        data: result.transactions,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async getDefi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const data = await portfolioService.getDefi(chain, address);
      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSwapHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));

      const result = await portfolioService.getSwapHistory(chain, address, page, limit);
      res.json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }

  async recordSwap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      const swapData = req.body;
      const result = await portfolioService.recordSwap(chain, address, swapData);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async refreshPortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { chain, address } = extractParams(req);
      await portfolioService.invalidateCache(chain, address);
      const freshData = await portfolioService.getPortfolio(chain, address, true);
      res.json({
        success: true,
        data: freshData,
        message: 'Portfolio refreshed successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const portfolioController = new PortfolioController();
