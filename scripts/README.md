# Scripts Directory

Utility scripts for testing and maintenance.

## AI & Financial Metrics Scripts

### Test AI Summary Generation
Generate AI-powered stock performance summary for a specific stock.

```bash
# Test with default stock (NABIL)
bun scripts/test-ai-summary.js

# Test with specific stock
bun scripts/test-ai-summary.js NICA
```

**What it does:**
- Fetches stock details including financial metrics
- Generates AI summary using DeepSeek
- Saves summary to database
- Verifies the save was successful

**Requirements:** `DEEPSEEK_API_KEY` must be set in environment

---

### Test Financial Metrics Calculation
Calculate and update financial metrics (PE, PB, dividend yield, market cap).

```bash
# Calculate metrics for a single stock
bun scripts/test-financial-metrics.js NABIL

# Calculate metrics for ALL stocks
bun scripts/test-financial-metrics.js
```

**What it does:**
- Fetches company details, financials, and dividends
- Calculates PE ratio, PB ratio, dividend yield, market cap
- Updates database with calculated metrics
- Shows summary of results

---

### Backfill Financial Metrics
One-time script to populate metrics for all existing companies.

```bash
bun scripts/backfill-financial-metrics.js
```

**When to use:**
- After adding new companies to the database
- After database restore
- To recalculate all metrics from scratch

**What it does:**
- Processes all companies with price data
- Calculates all financial metrics
- Updates database in batch
- Shows success/failure summary

---

## Other Scripts

### Backfill Market History
```bash
bun scripts/backfill-market-history.js
```

Backfills historical market index data from NEPSE API.

---

## Notes

- All scripts use `bun` runtime
- Scripts automatically connect to the database
- Check logs for detailed execution information
- Scripts exit with code 0 on success, 1 on failure
