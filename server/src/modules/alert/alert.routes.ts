import { Router } from 'express';
import { alertController } from './alert.controller';

const router = Router();

router.post('/', (req, res) => alertController.createAlert(req, res));
router.get('/', (req, res) => alertController.getAlerts(req, res));
router.get('/:id', (req, res) => alertController.getAlertById(req, res));
router.patch('/:id', (req, res) => alertController.updateAlert(req, res));
router.post('/:id/rearm', (req, res) => alertController.rearmAlert(req, res));
router.delete('/:id', (req, res) => alertController.deleteAlert(req, res));

export const alertRoutes = router;
export default router;
