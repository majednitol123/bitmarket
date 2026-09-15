import { Router } from 'express';
import { systemController } from './system.controller';

const router = Router();

// System health, readiness, and metrics
router.get('/health', systemController.getLiveness);
router.get('/readiness', systemController.getReadiness);
router.get('/metrics', systemController.getMetrics);

// Provider health diagnostics and budget metrics
router.get('/providers', systemController.getProviderHealth);
router.get('/cache', systemController.getCacheHealth);

// On-chain RPC endpoints
router.get('/rpc-balance', systemController.getRpcBalance);
router.get('/rpc-block', systemController.getRpcBlock);
router.get('/rpc-tx/:txHash', systemController.getRpcTransaction);

export default router;
