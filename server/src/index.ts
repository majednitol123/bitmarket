import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { initRedis, closeRedis, isRedisConnected } from './config/redis';
import { initDatabase, closeDatabase, isDatabaseConnected } from './config/database';
import marketRoutes from './modules/market/market.routes';
import { errorHandler, AppError } from './middleware/errorHandler';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl !== '/health') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: isRedisConnected(),
    database: isDatabaseConnected(),
  });
});

// Market API Routes
app.use('/api/market', marketRoutes);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
});

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  console.log('--- Starting Market Data Backend ---');
  console.log(`Environment: Node ${process.version}`);
  console.log(`Port: ${config.port}`);

  // Initialize infrastructure services (non-blocking)
  await initRedis();
  await initDatabase();

  const server = app.listen(config.port, () => {
    console.log(`🚀 Market Data API Server running on http://localhost:${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`Market overview: http://localhost:${config.port}/api/market/overview`);
    console.log(`Market tokens: http://localhost:${config.port}/api/market/tokens`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
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
