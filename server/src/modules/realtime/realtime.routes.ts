import { Router, Request, Response } from 'express';
import { realtimeGateway } from './realtimeGateway';
import { realtimePubSub } from './realtimePubSub';
import { RealtimeResource, RealtimeEventType } from './realtime.types';

const router = Router();

/**
 * GET /api/realtime/sse
 * Server-Sent Events stream for web or fallback clients
 */
router.get('/sse', (req: Request, res: Response) => {
  realtimeGateway.handleSseConnection(req, res);
});

/**
 * GET /api/realtime/stats
 * Gateway operational metrics, connection counts, and snapshot versions
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await realtimeGateway.getStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/realtime/reset
 * Disconnects existing WebSocket connections and forces them to reconnect with default topics
 */
router.post('/reset', (_req: Request, res: Response) => {
  realtimeGateway.disconnectAllClients();
  res.json({ success: true, message: 'All clients disconnected and forced to reconnect fresh' });
});

/**
 * POST /api/realtime/publish-test
 * Trigger a real-time message through the multi-instance Redis Pub/Sub engine
 */
router.post('/publish-test', async (req: Request, res: Response) => {
  try {
    const { resource = 'market:tokens', eventType = 'snapshot_updated', metadata } = req.body;

    const message = await realtimePubSub.publish(
      resource as RealtimeResource,
      eventType as RealtimeEventType,
      metadata || { test: true }
    );

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export const realtimeRoutes = router;
export default router;
