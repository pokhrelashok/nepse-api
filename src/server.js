require('dotenv').config();
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
app.use(bodyParser.json());

// Serve static files
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portfolios', require('./routes/portfolio'));

// React Fallback
app.get(/(.*)/, (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  } else {
    res.status(404).json(formatError('Not Found', 404));
  }
});

// Only listen if run directly, not when imported for tests
if (require.main === module) {
  app.listen(PORT, async () => {
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