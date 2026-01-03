
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const scheduler = require('./scheduler-instance');
const apiRoutes = require('./routes/api');
const { formatError } = require('./utils/formatter');

const app = express();
const PORT = process.env.PORT || 3000;

let isShuttingDown = false;

// Graceful shutdown handling
const cleanup = async (signal) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down server...`);

  try {
    if (scheduler) {
      await scheduler.stopAllSchedules();
    }
    logger.info('Server shutdown completed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }

  process.exit(0);
};

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  await cleanup('uncaughtException');
});
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  await cleanup('unhandledRejection');
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for base64 images

// Serve static assets from public folder (images, icons, etc.)
app.use(express.static('public'));
// Serve React app build files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const apiKeyAuth = require('./middleware/apiKeyAuth');

// API Routes
app.use('/api', (req, res, next) => {
  // Paths to exclude from API Key requirement (public endpoints)
  const excludedPaths = ['/health', '/admin/login', '/auth/google', '/feedback'];
  if (excludedPaths.includes(req.path)) {
    return next();
  }
  return apiKeyAuth(req, res, next);
});

app.use('/api', apiRoutes);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portfolios', require('./routes/portfolio'));
app.use('/api/feedback', require('./routes/feedback'));

// All non-API routes serve the React app (SPA fallback)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json(formatError('Not Found', 404));
  }
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// Only listen if run directly, not when imported for tests
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`API running at http://localhost:${PORT}`);

    // Auto-start the scheduler
    try {
      await scheduler.startPriceUpdateSchedule();
      logger.info('Scheduler auto-started on server boot');
    } catch (error) {
      logger.error('Failed to auto-start scheduler:', error);
    }
  });
}

module.exports = app;