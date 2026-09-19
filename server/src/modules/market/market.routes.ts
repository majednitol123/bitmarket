import { Router } from 'express';
import { marketController } from './market.controller';

const router = Router();

router.get('/overview', (req, res, next) => marketController.getOverview(req, res, next));
router.get('/tokens', (req, res, next) => marketController.getTokens(req, res, next));
router.get('/gainers', (req, res, next) => marketController.getGainers(req, res, next));
router.get('/search', (req, res, next) => marketController.searchTokens(req, res, next));
router.get('/interval', (req, res, next) => marketController.getInterval(req, res, next));
router.post('/interval', (req, res, next) => marketController.setInterval(req, res, next));
router.get('/tokens/:coinId/chart', (req, res, next) => marketController.getTokenChart(req, res, next));
router.get('/tokens/:coinId', (req, res, next) => marketController.getTokenById(req, res, next));

export default router;
