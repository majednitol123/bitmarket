import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { initRedis, closeRedis, isRedisConnected } from './config/redis';
import { initDatabase, closeDatabase, isDatabaseConnected } from './config/database';
import { runMigrations } from './db/runMigrations';
import marketRoutes from './modules/market/market.routes';
import portfolioRoutes from './modules/portfolio/portfolio.routes';
import exchangeRoutes from './modules/exchange/exchange.routes';
import systemRoutes from './modules/system/system.routes';
import { notificationRoutes } from './modules/notification/notification.routes';
import alertRoutes from './modules/alert/alert.routes';
import realtimeRoutes from './modules/realtime/realtime.routes';
import { systemController } from './modules/system/system.controller';
import { startMarketProactiveRefresher, stopMarketProactiveRefresher } from './modules/market/market.proactive';
import { swapConfirmationWorker } from './modules/exchange/swapConfirmation.worker';
import { notificationDeliveryWorker } from './modules/notification/notificationDelivery.worker';
import { priceAlertWorker } from './modules/alert/priceAlert.worker';
import { realtimePubSub } from './modules/realtime/realtimePubSub';
import { realtimeGateway } from './modules/realtime/realtimeGateway';
import { securityHeaders, sanitizeRequestInputs, getCorsOptions } from './middleware/security.middleware';
import { requestIdMiddleware } from './middleware/requestId';
import { globalRateLimiter, refreshRateLimiter, mutationRateLimiter } from './middleware/rateLimiter';
import { metricsService } from './modules/system/metrics.service';
import { errorHandler, AppError } from './middleware/errorHandler';

const app = express();

// Trust reverse proxy (for rate limiting client IP extraction behind load balancers)
app.set('trust proxy', 1);

// 1. Security Headers & CORS
app.use(securityHeaders);
app.use(cors(getCorsOptions()));

// 2. Request ID Tracing
app.use(requestIdMiddleware);

// 3. Body parsing with strict payload limit & sanitization
app.use(express.json({ limit: '512kb' }));
app.use(sanitizeRequestInputs);

// 4. Request Logging & Metrics Recording
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const routePattern = (req.baseUrl || '') + (req.route?.path || req.path);
    metricsService.recordHttpRequest(req.method, routePattern, res.statusCode, duration);

    if (req.originalUrl !== '/health' && req.originalUrl !== '/metrics' && req.originalUrl !== '/readiness') {
      console.log(`[HTTP] [${req.id || 'system'}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// 5. System Health, Readiness & Telemetry (No rate limits on probes)
app.get('/health', systemController.getLiveness);
app.get('/readiness', systemController.getReadiness);
app.get('/metrics', systemController.getPrometheusMetrics);
app.get('/health/providers', systemController.getProviderHealth);
app.get('/health/cache', systemController.getCacheHealth);

// 6. Global Rate Limiter for all API routes
app.use('/api', globalRateLimiter);

// 7. API Routes with tiered rate limiters
app.use('/api/market', refreshRateLimiter, marketRoutes);
app.use('/api/portfolio', refreshRateLimiter, portfolioRoutes);
app.use('/api/exchange', mutationRateLimiter, exchangeRoutes);
app.use('/api/notifications', mutationRateLimiter, notificationRoutes);
app.use('/api/alerts', mutationRateLimiter, alertRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/system', systemRoutes);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
});

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  console.log('--- Starting Crypto Aggregator Backend ---');
  console.log(`Environment: Node ${process.version}`);
  console.log(`Port: ${config.port}`);

  // Initialize infrastructure services (non-blocking)
  await initRedis();
  await initDatabase();
  await runMigrations();
  await realtimePubSub.start();

  const host = config.host;
  const server = app.listen(config.port, host, () => {
    console.log(` Crypto Aggregator API Server running on http://${host}:${config.port}`);
    console.log(` Local loopback: http://localhost:${config.port}`);

    // Attach real-time WebSocket server to HTTP server
    realtimeGateway.attach(server);

    // Start background proactive cache warming & workers
    startMarketProactiveRefresher();
    swapConfirmationWorker.start();
    notificationDeliveryWorker.start();
    priceAlertWorker.start();
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    realtimeGateway.stop();
    await realtimePubSub.stop();
    stopMarketProactiveRefresher();
    swapConfirmationWorker.stop();
    notificationDeliveryWorker.stop();
    priceAlertWorker.stop();
    server.close(async () => {
      console.log('HTTP server closed.');
      await closeRedis();
      await closeDatabase();
      console.log('All resources cleaned up. Exiting process.');
      process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      console.error('Forced shutdown after 10s timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
