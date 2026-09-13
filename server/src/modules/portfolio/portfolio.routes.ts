import { Router } from 'express';
import { portfolioController } from './portfolio.controller';

const router = Router();

// Full portfolio (summary, holdings, defi)
router.get('/:chain/:address', portfolioController.getPortfolio.bind(portfolioController));

// Section-specific endpoints
router.get('/:chain/:address/summary', portfolioController.getSummary.bind(portfolioController));
router.get('/:chain/:address/holdings', portfolioController.getHoldings.bind(portfolioController));
router.get('/:chain/:address/chart', portfolioController.getChart.bind(portfolioController));
router.get('/:chain/:address/transactions', portfolioController.getTransactions.bind(portfolioController));
router.get('/:chain/:address/defi', portfolioController.getDefi.bind(portfolioController));

// App-owned swap history
router.get('/:chain/:address/swap-history', portfolioController.getSwapHistory.bind(portfolioController));
router.post('/:chain/:address/swap-history', portfolioController.recordSwap.bind(portfolioController));

// Invalidate cache and fetch fresh
router.post('/:chain/:address/refresh', portfolioController.refreshPortfolio.bind(portfolioController));

export default router;
