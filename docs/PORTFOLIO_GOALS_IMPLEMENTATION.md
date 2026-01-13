# Portfolio-Specific Goals Implementation

## Overview

Goals now support portfolio-specific tracking, allowing users to:
- Set goals that track across **all portfolios** (default behavior)
- Set goals that track **only a specific portfolio**
- Switch a goal between portfolio scopes

## Database Changes

### Migration: `2026_01_13_000002_add_portfolio_to_goals.sql`

Added `portfolio_id` column to `user_goals` table:
- **NULL value** = Goal tracks all portfolios
- **Specific ID** = Goal tracks only that portfolio
- Foreign key constraint to `portfolios` table (CASCADE on delete)
- New indexes for efficient querying

```sql
ALTER TABLE user_goals 
ADD COLUMN portfolio_id VARCHAR(36) NULL AFTER user_id,
ADD FOREIGN KEY fk_goals_portfolio (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE;
```

## API Changes

### Create Goal

**New Field:** `portfolio_id` (optional)

```json
{
  "type": "yearly_investment",
  "target_value": 100000,
  "portfolio_id": null,  // ← NULL or omit = all portfolios
  "metadata": { "year": 2026 }
}
```

Or for specific portfolio:
```json
{
  "type": "dividend_income",
  "target_value": 50000,
  "portfolio_id": "abc-123-portfolio-id",  // ← Specific portfolio
  "metadata": { "year": 2026 }
}
```

### Update Goal

Can now change portfolio scope:

```json
{
  "portfolio_id": null  // Change to track all portfolios
}
```

Or:

```json
{
  "portfolio_id": "portfolio-id-here"  // Change to track specific portfolio
}
```

## Calculation Functions Updated

All goal calculation functions now filter by `portfolio_id` when specified:

1. **`getYearlyInvestment()`** - Filters transactions by portfolio
2. **`getYearlyProfit()`** - Portfolio-specific profit calculation
3. **`getStockHoldings()`** - Holdings in specific portfolio only
4. **`getTotalPortfolioValue()`** - Value of specific portfolio
5. **`getSectorCount()`** - Sectors in specific portfolio
6. **`getDividendIncome()`** - Dividends from specific portfolio

### SQL Filtering Logic

```sql
-- When portfolio_id is NULL (all portfolios)
WHERE p.user_id = ?

-- When portfolio_id is specified
WHERE p.user_id = ? AND t.portfolio_id = ?
```

## Use Cases

### 1. Overall Goals (All Portfolios)
```json
{
  "type": "yearly_investment",
  "target_value": 500000,
  "portfolio_id": null,
  "metadata": { "year": 2026 }
}
```
→ Tracks total investment across all user's portfolios

### 2. Retirement Portfolio Goal
```json
{
  "type": "yearly_investment",
  "target_value": 200000,
  "portfolio_id": "retirement-portfolio-id",
  "metadata": { "year": 2026 }
}
```
→ Tracks only retirement portfolio investments

### 3. Trading Account Dividend Goal
```json
{
  "type": "dividend_income",
  "target_value": 25000,
  "portfolio_id": "trading-account-id",
  "metadata": { "year": 2026 }
}
```
→ Tracks dividends from trading account only

### 4. Portfolio Diversification
```json
{
  "type": "diversification",
  "target_value": 5,
  "portfolio_id": "long-term-portfolio-id",
  "metadata": { "min_sectors": 5 }
}
```
→ Ensures specific portfolio has at least 5 sectors

## Validation

- If `portfolio_id` is provided, system verifies:
  - Portfolio exists
  - Portfolio belongs to the user
  - Returns 400 error if validation fails

## Testing

### Test Suite: `test-portfolio-specific-goals.js`

Tests comprehensive scenarios:
- ✅ All portfolios investment tracking (300k across 2 portfolios)
- ✅ Portfolio A only tracking (100k)
- ✅ Portfolio B only tracking (200k)
- ✅ All portfolios dividend tracking (10k total)
- ✅ Portfolio A dividend tracking (3k)

**All tests passing!**

## Migration Instructions

Run the migration:
```bash
node scripts/run-migration-add-portfolio-to-goals.js
```

Or restart the application (migrations run automatically on startup).

## Backwards Compatibility

- Existing goals without `portfolio_id` will have NULL value
- NULL = tracks all portfolios (same behavior as before)
- No breaking changes to existing functionality
