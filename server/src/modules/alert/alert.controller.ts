import { Request, Response } from 'express';
import { alertService } from './alert.service';
import { CreateAlertRequest, UpdateAlertRequest, AlertStatus } from './alert.types';
import { isValidEvmAddress, isValidSolanaAddress } from '../../middleware/validation.middleware';
import { metricsService } from '../system/metrics.service';

export class AlertController {
  /**
   * POST /api/alerts
   * Creates a new price alert
   * Section 6 & 7: Reuses shared Redis snapshot price, validates inputs, enforces limits
   */
  public async createAlert(req: Request, res: Response): Promise<void> {
    try {
      const {
        walletAddress,
        chain,
        tokenAddress,
        tokenId,
        tokenSymbol,
        tokenName,
        condition,
        targetPrice,
        basePrice,
        currency,
        cooldownMinutes,
      } = req.body as CreateAlertRequest;

      if (!walletAddress || !tokenId || !tokenSymbol) {
        res.status(400).json({
          success: false,
          error: 'walletAddress, tokenId, and tokenSymbol are required',
        });
        return;
      }

      if (!isValidEvmAddress(walletAddress) && !isValidSolanaAddress(walletAddress)) {
        res.status(400).json({
          success: false,
          error: 'Invalid walletAddress format. Must be a valid EVM (0x...) or Solana address.',
        });
        return;
      }

      if (targetPrice === undefined || isNaN(Number(targetPrice)) || Number(targetPrice) <= 0) {
        res.status(400).json({
          success: false,
          error: 'targetPrice must be a positive number',
        });
        return;
      }

      const normalizedCond = String(condition || '').toLowerCase();
      if (!['above', 'below', 'pct_increase', 'pct_decrease'].includes(normalizedCond)) {
        res.status(400).json({
          success: false,
          error: 'condition must be one of: above, below, pct_increase, pct_decrease',
        });
        return;
      }

      const alert = await alertService.createAlert({
        walletAddress,
        chain,
        tokenAddress,
        tokenId,
        tokenSymbol,
        tokenName,
        condition: normalizedCond as any,
        targetPrice: Number(targetPrice),
        basePrice: basePrice !== undefined ? Number(basePrice) : undefined,
        currency,
        cooldownMinutes: cooldownMinutes !== undefined ? Number(cooldownMinutes) : 360,
      });

      metricsService.recordAlert('created');

      res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (err: any) {
      console.error('[AlertController] createAlert error:', err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * GET /api/alerts
   * Retrieves all alerts for a wallet address, with optional tokenId and status filters
   */
  public async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = (req.query.walletAddress as string)?.trim();
      const tokenId = (req.query.tokenId as string)?.trim();
      const status = (req.query.status as string)?.trim() as AlertStatus | undefined;

      if (!walletAddress) {
        res.status(400).json({
          success: false,
          error: 'walletAddress query parameter is required',
        });
        return;
      }

      if (!isValidEvmAddress(walletAddress) && !isValidSolanaAddress(walletAddress)) {
        res.status(400).json({
          success: false,
          error: 'Invalid walletAddress format. Must be a valid EVM (0x...) or Solana address.',
        });
        return;
      }

      const alerts = await alertService.getAlertsForWallet(walletAddress, tokenId, status);

      res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (err: any) {
      console.error('[AlertController] getAlerts error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * GET /api/alerts/:id
   * Retrieves a single alert by ID with ownership check
   */
  public async getAlertById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const walletAddress = (req.query.walletAddress as string)?.trim();

      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid alert ID' });
        return;
      }

      const alert = await alertService.getAlertById(id, walletAddress);
      if (!alert) {
        res.status(404).json({ success: false, error: 'Alert not found or unauthorized' });
        return;
      }

      res.status(200).json({
        success: true,
        data: alert,
      });
    } catch (err: any) {
      console.error('[AlertController] getAlertById error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * PATCH /api/alerts/:id
   * Updates an alert
   */
  public async updateAlert(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { walletAddress, targetPrice, condition, cooldownMinutes, enabled, status } =
        req.body as UpdateAlertRequest & { walletAddress: string };

      if (isNaN(id) || !walletAddress) {
        res.status(400).json({
          success: false,
          error: 'Valid alert ID and walletAddress are required',
        });
        return;
      }

      const updated = await alertService.updateAlert(id, walletAddress, {
        targetPrice,
        condition,
        cooldownMinutes,
        enabled,
        status,
      });

      if (!updated) {
        res.status(404).json({ success: false, error: 'Alert not found or unauthorized' });
        return;
      }

      metricsService.recordAlert('updated');

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      console.error('[AlertController] updateAlert error:', err.message);
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * POST /api/alerts/:id/rearm
   * Re-arms a triggered or disabled alert (Section 11 & 35)
   */
  public async rearmAlert(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const walletAddress = (req.body?.walletAddress || req.query?.walletAddress) as string;

      if (isNaN(id) || !walletAddress) {
        res.status(400).json({
          success: false,
          error: 'Valid alert ID and walletAddress are required',
        });
        return;
      }

      const rearmed = await alertService.rearmAlert(id, walletAddress);
      if (!rearmed) {
        res.status(404).json({ success: false, error: 'Alert not found or unauthorized' });
        return;
      }

      metricsService.recordAlert('rearmed');

      res.status(200).json({
        success: true,
        data: rearmed,
      });
    } catch (err: any) {
      console.error('[AlertController] rearmAlert error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }

  /**
   * DELETE /api/alerts/:id
   * Deletes an alert
   */
  public async deleteAlert(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id as string, 10);
      const walletAddress = (req.body?.walletAddress || req.query?.walletAddress) as string;

      if (isNaN(id) || !walletAddress) {
        res.status(400).json({
          success: false,
          error: 'Valid alert ID and walletAddress are required',
        });
        return;
      }

      const deleted = await alertService.deleteAlert(id, walletAddress);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Alert not found or already deleted' });
        return;
      }

      metricsService.recordAlert('deleted');

      res.status(200).json({
        success: true,
        message: 'Alert deleted successfully',
      });
    } catch (err: any) {
      console.error('[AlertController] deleteAlert error:', err.message);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  }
}

export const alertController = new AlertController();
