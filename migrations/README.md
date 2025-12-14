# Database Migrations

This directory contains SQL migration scripts for updating the database schema.

## How to Apply Migrations

### Using Docker Compose

If you're using Docker Compose, you can apply migrations by executing SQL files in the MySQL container:

```bash
# Copy the migration file to the container
docker cp migrations/fix-financial-columns.sql nepse-portfolio-api-db-1:/tmp/

# Execute the migration
docker exec -i nepse-portfolio-api-db-1 mysql -unepse -pnepse_password nepse_db < /tmp/fix-financial-columns.sql
```

Or execute directly:

```bash
docker exec -i nepse-portfolio-api-db-1 mysql -unepse -pnepse_password nepse_db < migrations/fix-financial-columns.sql
```

### Using Local MySQL

If you're running MySQL locally:

```bash
mysql -u nepse -p nepse_db < migrations/fix-financial-columns.sql
```

## Available Migrations

### fix-financial-columns.sql

**Purpose:** Fixes "Out of range value" errors for financial data columns.

**Changes:**
- Increases `earnings_per_share` from DECIMAL(10,2) to DECIMAL(20,2)
- Increases `net_worth_per_share` from DECIMAL(10,2) to DECIMAL(20,2)
- Increases `price_earnings_ratio` precision from DECIMAL(20,2) to DECIMAL(20,4)

**When to apply:** If you're getting errors like "Out of range value for column 'net_worth_per_share'" when scraping financial data.

**Safe to run:** Yes, this migration only modifies column types to allow larger values. Existing data will be preserved.
