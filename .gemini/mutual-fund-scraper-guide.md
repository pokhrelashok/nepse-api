# Mutual Fund Scraper - Manual Execution Guide

## Overview
The mutual fund scraper fetches NAV (Net Asset Value) data from ShareSansar for all mutual funds and updates the database with:
- Weekly NAV prices and dates
- Monthly NAV prices and dates
- Maturity dates and periods
- Fund status (Active/Matured)

## Available Scripts

### 1. **Scrape Mutual Fund NAVs** (Recommended)
Scrapes NAV data from ShareSansar and updates the `mutual_fund_navs` table.

```bash
# Local
bun scripts/scrape-mutual-funds.js

# Docker
docker-compose exec backend bun scripts/scrape-mutual-funds.js
```

**What it does:**
- ✅ Fetches NAV data from ShareSansar for all mutual fund types (Close End, Matured, Open End)
- ✅ Updates `mutual_fund_navs` table with weekly/monthly NAV prices
- ✅ Updates `company_details` table with maturity dates and status
- ✅ Handles pagination to get all records

**Data Source:** https://www.sharesansar.com/mutual-fund-navs

---

### 2. **Cleanup Mutual Fund Company Names**
Re-scrapes company details from NEPSE to fix company names and sectors.

```bash
# Local
bun scripts/cleanup-mutual-funds.js

# Docker
docker-compose exec backend bun scripts/cleanup-mutual-funds.js
```

**What it does:**
- ✅ Identifies all mutual funds in the database
- ✅ Re-scrapes company details from NEPSE
- ✅ Fixes company names (e.g., "Nabil Bank Limited" → "NABIL BALANCED FUND-2")
- ✅ Sets sector to "Mutual Funds"
- ✅ Updates all company detail fields

**Data Source:** https://www.nepalstock.com/company/detail/{security_id}

---

## Scheduled Execution

The mutual fund scraper runs automatically via the scheduler:

**Schedule:** Daily at **3:00 AM** (Nepal Time)
**Job Key:** `mutual_fund_update`
**Location:** `src/scheduler/data-jobs.js` → `runMutualFundScrape()`

### View Scheduler Status
You can check the scheduler status in the admin panel:
```
http://localhost:3000/admin
```

---

## Database Tables Updated

### 1. `mutual_fund_navs`
Stores NAV price data:
```sql
- security_id (FK to company_details)
- weekly_nav (decimal)
- weekly_nav_date (date)
- monthly_nav (decimal)
- monthly_nav_date (date)
- updated_at (timestamp)
```

### 2. `company_details`
Updates mutual fund specific fields:
```sql
- maturity_date (varchar)
- maturity_period (varchar)
- status ('A' = Active, 'M' = Matured)
```

---

## API Endpoints

### Get Mutual Fund Data
```http
POST /api/mutual-funds
Content-Type: application/json

{
  "symbols": ["SEF", "NBF2", "KEF"]
}
```

**Response includes:**
- Company details
- Latest NAV prices
- Maturity information
- Price history

---

## Troubleshooting

### Issue: "Column count doesn't match value count"
**Solution:** This was fixed in the recent update. Make sure you have:
- ✅ Updated `src/utils/formatter.js` with `maturity_date` and `maturity_period` fields
- ✅ Updated `src/database/database.js` with correct number of placeholders (39 `?` + NOW())

### Issue: "No mutual fund data captured"
**Possible causes:**
- ShareSansar website is down or changed structure
- Network connectivity issues
- Pagination not working correctly

**Debug:**
- Check browser console logs
- Verify the URL: https://www.sharesansar.com/mutual-fund-navs
- Check if the API endpoint changed

### Issue: Scraper times out
**Solution:**
- Increase timeout in browser manager
- Check if the website is loading slowly
- Verify network connectivity in Docker container

---

## Example Output

### Successful Run:
```
🚀 Starting Manual Mutual Fund NAV Scrape...

✅ Browser initialized

📈 Starting Mutual Fund NAV scrape from ShareSansar (via interception)...
🔗 Navigating to ShareSansar...
📡 Intercepted 15 records from ... (Type: -1)
📡 Intercepted 12 records from ... (Type: 1)
📡 Intercepted 13 records from ... (Type: 2)
✅ Total fetched 40 records.
✅ Unique records: 40
📋 Captured Symbols: SEF, NBF2, SIGS2, CMF2, NICBF, ...
📊 Scrape Stats: Matched: 40, Skipped: 0
💾 Successfully updated 40 mutual funds.

🎉 Mutual Fund scrape completed successfully!
📊 Total records processed: 40

🔒 Browser closed
```

---

## Notes

1. **Holiday Check:** The scheduled scraper skips execution on market holidays
2. **Browser:** Uses Puppeteer with Chromium in Docker
3. **Data Freshness:** NAV data is typically updated weekly/monthly by fund managers
4. **Deduplication:** The scraper handles duplicate symbols by preferring Matured status
5. **Symbol Matching:** Matches scraped symbols with existing `company_details` records

---

## Related Files

- **Scraper:** `src/scrapers/nepse/mutual-fund-scraper.js`
- **Database:** `src/database/database.js` → `saveMutualFundNavs()`
- **Scheduler:** `src/scheduler/data-jobs.js` → `runMutualFundScrape()`
- **API:** `src/controllers/mutual-fund-controller.js`
- **Manual Scripts:**
  - `scripts/scrape-mutual-funds.js` (NAV data)
  - `scripts/cleanup-mutual-funds.js` (Company details)
