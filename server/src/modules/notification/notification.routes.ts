import { Router } from 'express';
import { notificationController } from './notification.controller';

const router = Router();

// Device push token management
router.post('/devices/register', (req, res) => notificationController.registerDevice(req, res));
router.post('/devices/unregister', (req, res) => notificationController.unregisterDevice(req, res));
router.get('/devices', (req, res) => notificationController.getDevices(req, res));

// Notification events history
router.get('/events', (req, res) => notificationController.getEvents(req, res));

// Diagnostic / test push notification trigger
router.post('/test', (req, res) => notificationController.sendTestNotification(req, res));

export const notificationRoutes = router;
