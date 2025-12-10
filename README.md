# Nepal Stock Exchange (NEPSE) Scraper

A robust backend service that scrapes Nepal Stock Exchange prices using Node.js and Puppeteer. It handles dynamic authentication automatically and stores data in a local SQLite database.

## Prerequisites

- Node.js (v16 or higher recommended)
- npm

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

## Usage Commands

### 1. Run Manually (Force Fetch)
To run the scraper immediately (e.g., for testing or manual update), use the `--force` flag. This runs once and then enters the scheduler mode (or you can Ctrl+C after it finishes).

```bash
node index.js --force
```

### 2. Run Scheduler (Background Service)
To start the scheduler that runs automatically during market hours:

```bash
node index.js
```

**Schedule:**
- Runs every 5 minutes (`*/5`)
- Days: Sunday to Thursday (`0-4`)
- Hours: 10:00 AM to 3:00 PM Nepal Time (`10-15` NPT)

### 3. Check Database
You can query the SQLite database using the command line:

```bash
# Verify table creation
sqlite3 nepse.db ".schema stock_prices"

# Check latest data
sqlite3 nepse.db "SELECT business_date, symbol, close_price, created_at FROM stock_prices ORDER BY created_at DESC LIMIT 5;"
```

## detailed Architecture

- **`index.js`**: Entry point. Manages the `node-cron` schedule and force execution.
- **`scraper.js`**: Uses Puppeteer (Headless Chrome) to:
  - Navigate to NEPSE website.
  - Authenticate dynamically (retrieve access token).
  - Fetch price data using internal APIs with correct headers (`Salter <token>`).
- **`db.js`**: Manages SQLite connection and `stock_prices` table upserts.

## Troubleshooting

- **Market Closed**: If the market is closed, `node index.js --force` will log `[Scraper] Manual fetch result length: 0` and `No prices found`. This is normal.
- **Puppeteer Issues**: If Puppeteer fails to launch, try installing libraries: `sudo apt-get install -y libnss3 libxss1 ...` (on Linux) or ensure Chrome is installed.
