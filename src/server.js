
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const scheduler = require('./scheduler-instance');
const apiRoutes = require('./routes/api');
const { formatError } = require('./utils/formatter');
const sitemapService = require('./services/sitemap-service');

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

const apiKeyAuth = require('./middleware/api-key-auth');

// Sitemap (Root Level - Defined early to avoid static file conflicts)
app.get('/sitemap.xml', async (req, res) => {
  try {
    const sitemap = await sitemapService.generateSitemap();
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    logger.error('Error serving sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// API Routes
app.use('/api', (req, res, next) => {
  // Paths to exclude from API Key requirement (public endpoints)
  const exactPaths = [
    '/health',
    '/admin/login',
    '/auth/google',
    '/feedback',
    '/updates',
    '/market/gainers',
    '/market/losers',
    '/market/sectors',
    '/market/status',
    '/ipos',
    '/announced-dividends',
    '/search',
    '/sitemap.xml',
    '/today-prices',
    '/market/indices/history',
    '/mutual-funds',
    '/sips',
    '/ipo/published'
  ];

  const prefixPaths = [
    '/scripts',
    '/history',
    '/ipo/scripts'
  ];

  if (exactPaths.includes(req.path) || prefixPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  return apiKeyAuth(req, res, next);
});

app.use('/api', apiRoutes);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/portfolios', require('./routes/portfolio'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/goals', require('./routes/goal'));

// Set higher timeout for IPO check-result endpoints (5 minutes)
const IPO_TIMEOUT = 300000;
app.post('/api/ipo/check-result', (req, res, next) => {
  req.setTimeout(IPO_TIMEOUT);
  next();
});
app.post('/api/ipo/check-bulk', (req, res, next) => {
  req.setTimeout(IPO_TIMEOUT);
  next();
});



// All non-API routes serve the React app (SPA fallback)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json(formatError('Not Found', 404));
  }
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// Only listen if run directly, not when imported for tests
// In Bun/PM2 environments, require.main might behave differently, so we check process.mainModule as well
const isMainModule = require.main === module || (typeof process !== 'undefined' && process.mainModule === module);

if (isMainModule || process.env.PM2_HOME) {
  const server = app.listen(PORT, '0.0.0.0', async () => {
    const addr = server.address();
    const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
    logger.info(`API running and listening on ${bind}`);

    // Auto-start the scheduler
    try {
      if (scheduler && typeof scheduler.startPriceUpdateSchedule === 'function') {
        await scheduler.startPriceUpdateSchedule();
        logger.info('Scheduler auto-started on server boot');
      }
    } catch (error) {
      logger.error('Failed to auto-start scheduler:', error);
    }
  });

  server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

    switch (error.code) {
      case 'EACCES':
        logger.error(`${bind} requires elevated privileges`);
        process.exit(1);
        break;
      case 'EADDRINUSE':
        logger.error(`${bind} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
    }
  });
}

module.exports = app;