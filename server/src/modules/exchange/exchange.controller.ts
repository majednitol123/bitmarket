import { Request, Response, NextFunction } from 'express';
import { exchangeService } from './exchange.service';
import { AppError } from '../../middleware/errorHandler';
import { isValidTxHash, isValidEvmAddress, isValidSolanaAddress } from '../../middleware/validation.middleware';

export class ExchangeController {
  /**
   * GET /api/exchange/quote
   */
  async getQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        fromChain = '1',
        toChain = '1',
        fromToken = 'native',
        toToken = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // default USDC
        fromAmount = '1.0',
        fromAddress,
        slippage = '0.5',
      } = req.query;

      const amountNum = parseFloat(String(fromAmount));
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new AppError('fromAmount must be a positive number', 400, 'INVALID_AMOUNT');
      }

      const quote = await exchangeService.getQuote({
        fromChain: String(fromChain),
        toChain: String(toChain),
        fromToken: String(fromToken),
        toToken: String(toToken),
        fromAmount: String(fromAmount),
        fromAddress: fromAddress ? String(fromAddress) : undefined,
        slippage: String(slippage),
      });

      res.json({
        success: true,
        data: quote,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/exchange/build-tx
   */
  async buildTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        fromChain = '1',
        toChain = '1',
        fromToken,
        toToken,
        fromAmount,
        fromAddress,
        slippage = '0.5',
        quoteId,
      } = req.body;

      if (!fromToken || !toToken) {
        throw new AppError('fromToken and toToken are required', 400, 'MISSING_TOKENS');
      }

      if (!fromAddress) {
        throw new AppError('fromAddress (user wallet address) is required to build transaction', 400, 'MISSING_ADDRESS');
      }

      const amountNum = parseFloat(String(fromAmount));
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new AppError('fromAmount must be a positive number', 400, 'INVALID_AMOUNT');
      }

      const txResult = await exchangeService.buildTransaction({
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAmount: String(fromAmount),
        fromAddress,
        slippage: String(slippage),
        quoteId,
      });

      res.json({
        success: true,
        data: txResult,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/exchange/confirm
   */
  async confirmSwap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        swapId,
        txHash,
        walletAddress,
        chain = '1',
        chainId,
        fromTokenAddress,
        fromTokenSymbol,
        toTokenAddress,
        toTokenSymbol,
        fromAmount,
        toAmount,
        router,
        idempotencyKey,
      } = req.body;

      if (!txHash || !walletAddress) {
        throw new AppError('txHash and walletAddress are required', 400, 'MISSING_CONFIRMATION_DATA');
      }

      if (!isValidTxHash(String(txHash))) {
        throw new AppError('Invalid transaction hash format', 400, 'INVALID_TX_HASH');
      }

      if (!isValidEvmAddress(String(walletAddress)) && !isValidSolanaAddress(String(walletAddress))) {
        throw new AppError('Invalid wallet address format', 400, 'INVALID_WALLET_ADDRESS');
      }

      const recorded = await exchangeService.confirmSwap({
        swapId,
        txHash,
        walletAddress,
        chain,
        chainId: chainId ? Number(chainId) : undefined,
        fromTokenAddress,
        fromTokenSymbol,
        toTokenAddress,
        toTokenSymbol,
        fromAmount,
        toAmount,
        router,
        idempotencyKey,
      });

      res.json({
        success: true,
        data: recorded,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/exchange/status/:txHash
   */
  async getSwapStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const txHash = String(req.params.txHash || '');
      if (!txHash) {
        throw new AppError('txHash is required', 400, 'MISSING_TX_HASH');
      }

      const checkNow = req.query.checkNow === 'true' || req.query.force === 'true';
      const status = await exchangeService.getSwapStatus(txHash, checkNow);
      if (!status) {
        throw new AppError('Swap transaction not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const exchangeController = new ExchangeController();
