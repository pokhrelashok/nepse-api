# NEPSE Portfolio API

A comprehensive API for scraping and serving Nepal Stock Exchange (NEPSE) data with real-time updates, push notifications, and portfolio tracking.

## Features

- **Real-time Market Data** - Redis-backed live prices and market status
- **Automated Scraping** - Scheduled updates for stocks, IPOs, dividends, and company details
- **Portfolio Management** - Track holdings, transactions, and performance
- **Push Notifications** - Price alerts, IPO announcements, dividend notifications
- **Admin Dashboard** - User management, API keys, system monitoring
- **RESTful API** - Clean, standardized endpoints with API key authentication

## Quick Start

### Local Development

```bash
# Install Bun (recommended for 20-40x faster installs)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
bun run migrate

# Start server
bun start

# Start scheduler (in another terminal)
bun run scheduler
```

### Docker Development

```bash
# Start MySQL and application
docker compose up -d

# Run tests
docker compose run --rm app bun test

# View logs
docker logs -f nepse-backend

# Stop
docker compose down
```

## API Documentation

### Authentication

All endpoints require either an API key or JWT token (except `/api/health` and `/api/admin/login`).

**API Key Header:**

```bash
x-api-key: npt_your_api_key_here
```

**JWT Token Header:**

```bash
Authorization: Bearer your_jwt_token_here
```

**How to Get API Key:**

1. Log in to the Admin Panel
2. Navigate to API Keys section
3. Click "Generate New Key"
4. Copy the key immediately

### Response Format

All endpoints return standardized responses:

```json
{
  "success": true,
  "status": "success",
  "message": "Description",
  "data": {...}
}
```

**Error Response:**

```json
{
  "success": false,
  "status": "error",
  "message": "Error description",
  "code": 401
}
```

### Key Endpoints

**Market Data:**

- `GET /api/market/status` - Current market status and index
- `GET /api/today-prices` - All stock prices for today
- `GET /api/scripts/:symbol` - Single stock details
- `GET /api/market/indices/history?range=1M&index_id=58` - Historical index data
- `GET /api/market/stats` - Market statistics and top performers

**Company Information:**

- `GET /api/companies` - All companies with details
- `GET /api/scripts/:symbol/history?range=1M` - Historical price data
- `GET /api/sectors` - Sector analysis

**Portfolio (requires JWT):**

- `GET /api/portfolio` - User's portfolios
- `POST /api/portfolio` - Create portfolio
- `POST /api/portfolio/sync` - Sync portfolio with latest prices
- `POST /api/transactions` - Record buy/sell/bonus transactions
- `GET /api/holdings/:portfolioId` - Portfolio holdings with gains/losses

**Notifications (requires JWT):**

- `POST /api/alerts/price` - Create price alert
- `GET /api/alerts/price` - Get user's price alerts
- `PUT /api/alerts/price/:id` - Update alert

**Admin (requires admin JWT):**

- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/api-keys` - Manage API keys
- `GET /api/admin/users` - User management
- `GET /api/admin/stats` - System statistics

See [api-spec](./api-spec) directory for complete Bruno API collection.

## Architecture

### Refactored Structure

Successfully refactored from 5 monolithic files (6,063 lines) into 35 focused modules:

```
src/
├── config/                    # Firebase, Redis configuration
├── controllers/               # Request handlers
├── database/
│   └── queries/              # 9 modules: market, price, company, portfolio, etc.
├── middleware/               # Authentication, validation
├── routes/
│   ├── portfolio/            # 5 modules: CRUD, transactions, sync
│   ├── alerts.js
│   ├── auth.js
│   └── api.js
├── scrapers/
│   ├── nepse/                # 7 modules: browser, market, price, company, history
│   ├── ipo-scraper.js
│   ├── fpo-scraper.js
│   └── dividend-scraper.js
├── scheduler/                # 7 modules: market jobs, data jobs, maintenance
├── services/
│   ├── notifications/        # 6 modules: price alerts, IPO, dividends, messaging
│   └── translation-service.js
├── utils/                    # Formatters, logger, image handler
├── index.js                  # CLI interface
└── server.js                 # Express server
```

### Key Components

- **Browser Manager** - Puppeteer instance pooling for efficient scraping
- **Redis Cache** - Sub-second latency for live market data
- **MySQL Database** - Persistent storage for historical data, portfolios, transactions
- **Firebase Admin** - Push notifications via FCM
- **PM2/Bun** - Process management and high-performance runtime

## Scheduled Jobs

The scheduler runs 13 automated jobs:

```
Market Index Update:  Every 20s (11 AM-3 PM, Sun-Thu) - During market hours only
Price Updates:        Every 2 min (with automatic price alert checks)
Company Details:      Daily at 2:00 AM (incremental updates)
IPO Scraping:         Daily at 2:00 AM
FPO Scraping:         Daily at 2:15 AM
Dividend Scraping:    Daily at 2:30 AM
Daily Archive:        Daily at 3:05 PM (save daily snapshots)
System Cleanup:       Daily at 4:30 AM (remove temp files, old CSVs)
Database Backup:      Daily at 5:00 AM
Notifications:        Daily at 9:00 AM (price alerts, IPO, dividends)
```

## Deployment

### Ubuntu Server (One-Command Deploy)

```bash
# Deploy with domain and SSL
sudo ./deploy/deploy-ubuntu.sh yourdomain.com

# Deploy on localhost (development)
sudo ./deploy/deploy-ubuntu.sh localhost
```

**What Gets Installed:**

- Bun runtime
- Node.js 20.x (for PM2)
- PM2 process manager
- Nginx reverse proxy
- MySQL 8.0
- Redis 6.0
- UFW firewall
- Certbot (for SSL certificates)

**Application Location:** `/var/www/nepse-api/`

### Post-Deployment Setup

```bash
# 1. Populate initial data
sudo -u nepse /var/www/nepse-api/populate-data.sh

# 2. Check system status
nepse-status

# 3. View application logs
nepse-logs

# 4. Monitor in real-time
/var/www/nepse-api/monitor.sh --watch

# 5. Test API
curl http://localhost/api/market/status
```

### Maintenance Commands

```bash
# Service Management
sudo systemctl restart nepse-pm2    # Restart application
sudo systemctl restart nginx         # Restart web server
sudo systemctl status nepse-pm2      # Check service status

# Application Updates
sudo -u nepse /var/www/nepse-api/update.sh

# PM2 Process Management
sudo -u nepse pm2 list               # List processes
sudo -u nepse pm2 logs               # View logs
sudo -u nepse pm2 restart all        # Restart all processes
sudo -u nepse pm2 monit              # Real-time monitoring

# Database
mysqldump -u nepse -p nepse_db > backup_$(date +%Y%m%d).sql  # Backup
mysql -u nepse -p nepse_db < backup.sql                      # Restore
mysql -u nepse -p nepse_db -e "SELECT COUNT(*) FROM stock_prices;"  # Stats

# Manual Data Updates
sudo -u nepse bun src/index.js prices --save              # Update prices
sudo -u nepse bun src/index.js companies --missing --save # Update companies
sudo -u nepse bun src/index.js companies --all --save     # Full refresh

# SSL Certificate Renewal
sudo certbot renew
```

### Monitoring

Built-in monitoring dashboard shows:

- System services status
- API health checks
- Disk space and memory usage
- PM2 process status
- Database statistics
- Recent error logs

```bash
# Launch monitoring dashboard
./monitor.sh --watch
```

### Log Files

- Application: `/var/www/nepse-api/logs/`
- Nginx: `/var/log/nginx/`
- System: `journalctl -u nepse-pm2`

## Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=nepse
DB_PASSWORD=your_password
DB_NAME=nepse_db
DB_POOL_SIZE=10

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional

# API Configuration
PORT=3000
NODE_ENV=production
JWT_SECRET=your_jwt_secret

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your_project_id
# Place serviceAccountKey.json in project root
```

## Testing

```bash
# Run all tests
bun test

# Test specific module
bun test tests/queries.test.js

# Test in Docker (recommended)
docker compose run --rm app bun test
```

## Available Scripts

```bash
# Development
bun run dev              # Start with hot reload
bun run scheduler        # Start background scheduler

# Data Collection
bun run scraper          # Scrape today's prices
bun run scraper:companies # Update company details
bun run scraper:ipo      # Scrape IPO data
bun run scraper:dividend # Scrape dividend announcements

# Database
bun run migrate          # Run database migrations
bun run check-stats      # Show database statistics

# Production
bun start                # Start API server
pm2 start ecosystem.config.js  # Production process management
```

## Requirements

- **Runtime:** Bun >= 1.0.0 (recommended) or Node.js >= 18.0.0
- **Database:** MySQL 8.0+
- **Cache:** Redis 6.0+ (optional but recommended for performance)
- **Browser:** Chrome/Chromium (for Puppeteer scraping)
- **OS:** Linux (Ubuntu 18.04+ recommended for production)

## Frontend Integration

### Axios Setup

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://your-api-domain.com/api',
  headers: {
    'x-api-key': 'YOUR_API_KEY_HERE'
  }
});

// Use the configured instance
const { data } = await api.get('/market/stats');
if (data.success) {
  console.log(data.data);
}
```

### Fetch API

```javascript
const response = await fetch('https://your-api-domain.com/api/market/stats', {
  headers: {
    'x-api-key': 'YOUR_API_KEY_HERE'
  }
});

const data = await response.json();
if (data.success) {
  console.log(data.data);
}
```

### Error Handling

Always check the `success` field first:

```javascript
const { data } = await api.get('/market/stats');

if (!data.success) {
  console.error('API Error:', data.message);
  // Handle error based on data.code
  if (data.code === 401) {
    // Redirect to login or refresh API key
  }
  return;
}

// Process successful response
processMarketData(data.data);
```

## Project Statistics

- **Total Code:** 6,263 lines (35 focused modules)
- **Average Module Size:** 179 lines
- **Test Coverage:** 50/50 tests passing (100%)
- **API Endpoints:** 40+
- **Scheduled Jobs:** 13
- **Database Tables:** 23
- **Notification Types:** 6

## Refactoring Project (January 2026)

Successfully completed major refactoring with zero downtime:

- **Phase 1:** Database Queries (1,627 lines → 9 modules) ✅
- **Phase 2:** NEPSE Scraper (1,886 lines → 7 modules) ✅
- **Phase 3:** Portfolio Routes (1,078 lines → 5 modules) ✅
- **Phase 4:** Scheduler (879 lines → 7 modules) ✅
- **Phase 5:** Notifications (593 lines → 6 modules) ✅

**Results:**

- 100% backward compatible
- Zero breaking changes
- All tests passing
- Production stability maintained

## Security

- API key authentication for public endpoints
- JWT token authentication for user-specific operations
- Admin-only endpoints with separate authentication
- Rate limiting (configurable per endpoint)
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS protection (sanitized outputs)

## Performance

- **Redis Caching:** Sub-second response times for live data
- **Connection Pooling:** Efficient database connection management
- **Browser Instance Reuse:** Single Puppeteer instance for all scraping
- **Scheduled Jobs:** Off-peak data updates minimize user impact
- **Bun Runtime:** 2-3x faster than Node.js

## Troubleshooting

### Server won't start

```bash
# Check logs
docker logs nepse-backend
# or
journalctl -u nepse-pm2 -n 50

# Verify database connection
mysql -u nepse -p nepse_db -e "SELECT 1"

# Check port availability
lsof -i :3000
```

### Scraper not working

```bash
# Install Chrome/Chromium
sudo apt-get install chromium-browser

# Check browser process
ps aux | grep chrome

# Test scraper manually
bun src/index.js prices
```

### Database issues

```bash
# Check MySQL status
sudo systemctl status mysql

# Verify database exists
mysql -u nepse -p -e "SHOW DATABASES;"

# Run migrations
bun run migrate
```

## License

ISC

## Support

For issues, feature requests, or contributions, please open an issue on GitHub.
