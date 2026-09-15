import { Router } from 'express';
import { exchangeController } from './exchange.controller';

const router = Router();

// GET /api/exchange/quote - Calculates exchange rate, expected output, gas fee, and routing
router.get('/quote', (req, res, next) => exchangeController.getQuote(req, res, next));

// POST /api/exchange/build-tx - Builds executable blockchain transaction and checks approvals
router.post('/build-tx', (req, res, next) => exchangeController.buildTransaction(req, res, next));

// POST /api/exchange/confirm - Confirms and tracks on-chain broadcast hash
router.post('/confirm', (req, res, next) => exchangeController.confirmSwap(req, res, next));

// GET /api/exchange/status/:txHash - Retrieves status of a swap
router.get('/status/:txHash', (req, res, next) => exchangeController.getSwapStatus(req, res, next));

export default router;
