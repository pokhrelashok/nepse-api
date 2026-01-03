# NEPSE Portfolio API

A comprehensive API for scraping and serving Nepal Stock Exchange (NEPSE) data, including real-time stock prices, company details, logos, and market analytics.

**Now supports both Node.js and Bun runtimes for improved performance!**

## Features

- **Real-time Stock Data**: Scrape daily stock prices from NEPSE
- **Company Details**: Extract comprehensive company information including logos, financial metrics, and trading data  
- **Market Analytics**: Statistics, sector analysis, and top performers
- **RESTful API**: Clean endpoints for accessing all data
- **Automated Scheduling**: Cron-based scraping during market hours
- **Database Storage**: MySQL database with 30+ fields per company

## Architecture

The application has been designed with a clean separation of concerns:

### Core Components

- **Scraper (`src/scrapers/nepse-scraper.js`)**: Handles all web scraping operations with proper resource management
- **Scheduler (`src/scheduler.js`)**: Manages scheduled tasks independently from scraping logic  
- **Database Layer (`src/database/`)**: Handles all data persistence operations
- **API Server (`src/server.js`)**: Provides REST API endpoints for accessing scraped data
- **CLI Interface (`src/index.js`)**: Command-line interface for manual operations

### Key Features

- **Resource Management**: Automatic cleanup of browser instances and database connections
- **Graceful Shutdown**: Proper handling of SIGINT/SIGTERM signals for clean exits
- **Separation of Concerns**: Scheduler and scraper are independent components
- **Error Recovery**: Robust error handling and recovery mechanisms

## Quick Start

### With Node.js

```bash
# Install dependencies
npm install

# Start the API server
npm start

# Run scraper manually
npm run scraper

# Run tests
npm test
```

### With Bun (Recommended for 20-40x faster installs)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install dependencies (much faster!)
bun install

# Start the API server
bun run bun:start

# Run scraper manually
bun run bun:scraper

# Run tests
bun run bun:test
```

## API Specification

Detailed information about all available API endpoints, including request/response examples, can be found in the [api-spec](./api-spec) directory. We use [Bruno](https://usebruno.com) for API exploration.

## Scripts

### Node.js Scripts

```bash
# Development
npm run dev              # Start server with nodemon
npm run scheduler        # Start automated scraper

# Data Collection  
npm run scraper          # Scrape today's prices (saves to DB)
npm run scraper:details  # Scrape ALL company details (saves to DB)

# Testing
npm run test:scraper     # Test scraper functionality
npm run test:api         # Test API endpoints

# Maintenance
npm run clean           # Remove database and temp files
```

### Bun Scripts (Faster Alternative)

```bash
# Development
bun run bun:dev          # Start server with hot reload
bun run bun:scheduler    # Start automated scraper

# Data Collection
bun run bun:scraper      # Scrape today's prices
bun run bun:scraper:companies  # Scrape company details

# Testing
bun run bun:test:scraper # Test scraper functionality
bun run bun:test:api     # Test API endpoints

# Database
bun run bun:migrate      # Run database migrations
```

## Project Structure

```
src/
├── database/
│   ├── database.js      # Database connection and core operations
│   └── queries.js       # Database query functions
├── scrapers/
│   └── nepse-scraper.js # Web scraping logic (NepseScraper class)
├── utils/
│   └── formatter.js     # Response formatting utilities
├── scheduler.js         # Cron-based scheduling service
├── index.js             # CLI interface for manual operations
└── server.js            # Express API server

tests/
├── scraper.test.js      # Scraper functionality tests
└── api.test.js          # API endpoint tests

nepse.js                 # CLI entry point
package.json
README.md
```

## Requirements

- **Runtime**: Node.js >= 16.0.0 OR Bun >= 1.0.0
- MySQL 8.0+
- Chrome/Chromium (for Puppeteer)

### Why Bun?

- **20-40x faster** package installation
- **35-50% less** memory usage
- **2-3x faster** startup time
- Built-in TypeScript support
- Drop-in replacement for Node.js

## Docker Development

The project is configured to run easily with Docker, especially for Apple Silicon (M1/M2/M3) users.

### Prerequisites
- Docker Desktop installed

### Running with Docker

1. **Start the application and database:**
   ```bash
   docker compose up -d
   ```
   This will start:
   - MySQL 8.0 container on port `3306`
   - Application container on port `3000`

2. **Run tests inside Docker:**
   ```bash
   docker compose run --rm app npm test
   ```

3. **Database Connection (DBeaver/DataGrip):**
   You can connect to the Docker database from your host machine using:
   - **Host**: `localhost` (or `127.0.0.1`)
   - **Port**: `3306`
   - **Database**: `nepse_db`
   - **Username**: `nepse` (or `root`)
   - **Password**: `nepse_password` (or `nepse_root_password`)

4. **Stop everything:**
   ```bash
   docker compose down
   ```

## Environment Variables

Configure your MySQL connection using these environment variables:

```bash
DB_HOST=localhost        # MySQL host
DB_PORT=3306            # MySQL port
DB_USER=nepse           # MySQL username
DB_PASSWORD=your_pass   # MySQL password
DB_NAME=nepse_db        # Database name
DB_POOL_SIZE=10         # Connection pool size
```
