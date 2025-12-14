# Database Migrations

This directory contains SQL migration scripts for updating the database schema. The migration system automatically tracks which migrations have been executed and only runs new ones.

## Quick Start

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Preview what would be migrated (dry run)
npm run migrate:dry-run
```

## How It Works

The migration system works similar to Laravel's Artisan migrate:

1. **Tracks executed migrations** in a `migrations` table
2. **Runs only new migrations** that haven't been executed yet
3. **Maintains execution order** using timestamp-based filenames
4. **Supports both Docker and VPS** environments automatically

## Migration File Naming Convention

Migration files must follow this format:

```
YYYY_MM_DD_HHMMSS_description.sql
```

**Examples:**
- `2025_12_14_000001_fix_financial_columns.sql`
- `2025_12_15_120000_add_user_preferences.sql`

The timestamp prefix ensures migrations run in the correct order.

## Creating New Migrations

1. Create a new `.sql` file in the `migrations/` directory
2. Use the timestamp naming convention
3. Write your SQL statements
4. Run `npm run migrate`

**Example migration file:**

```sql
-- migrations/2025_12_15_120000_add_user_preferences.sql

CREATE TABLE IF NOT EXISTS user_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  theme VARCHAR(20) DEFAULT 'light',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;
```

## Commands

### `npm run migrate`
Executes all pending migrations that haven't been run yet.

**Output example:**
```
Connected to database.
Migrations table ready.
Found 2 pending migration(s):
  - 2025_12_14_000001_fix_financial_columns.sql
  - 2025_12_15_120000_add_user_preferences.sql

✓ Migrated: 2025_12_14_000001_fix_financial_columns.sql
✓ Migrated: 2025_12_15_120000_add_user_preferences.sql

✓ Migrated 2 file(s) successfully.
```

### `npm run migrate:status`
Shows which migrations have been executed and which are pending.

**Output example:**
```
=== Migration Status ===

Executed migrations:
  ✓ 2025_12_14_000001_fix_financial_columns.sql

Pending migrations:
  ○ 2025_12_15_120000_add_user_preferences.sql

Total: 2 | Executed: 1 | Pending: 1
```

### `npm run migrate:dry-run`
Preview which migrations would be executed without actually running them.

## Environment Support

### Docker (Automatic)
The migration system reads database credentials from your `.env` file and connects automatically:

```bash
npm run migrate
```

### VPS / Production
Same command works on VPS! Just ensure your `.env` file has the correct database credentials:

```bash
npm run migrate
```

## Available Migrations

### 2025_12_14_000001_fix_financial_columns.sql

**Purpose:** Fixes "Out of range value" errors for financial data columns.

**Changes:**
- Increases `earnings_per_share` from DECIMAL(10,2) to DECIMAL(20,2)
- Increases `net_worth_per_share` from DECIMAL(10,2) to DECIMAL(20,2)
- Increases `price_earnings_ratio` precision from DECIMAL(20,2) to DECIMAL(20,4)

**Safe to run:** Yes, this migration only modifies column types to allow larger values. Existing data will be preserved.

## Troubleshooting

### "Nothing to migrate"
All migrations have already been executed. Check status with `npm run migrate:status`.

### Connection errors
Verify your `.env` file has correct database credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=nepse
DB_PASSWORD=nepse_password
DB_NAME=nepse_db
```

### Migration failed mid-execution
Migrations are executed in transactions when possible. Check the error message and fix the SQL, then run `npm run migrate` again.

## Advanced Usage

### Programmatic Usage

You can also use the migration system in your code:

```javascript
const { runMigrations, showStatus } = require('./src/database/migrate');

// Run migrations
await runMigrations();

// Get status
const { executed, pending } = await showStatus();
```

### Manual Migration (Not Recommended)

If you need to run a migration manually:

**Docker:**
```bash
docker exec -i nepse-mysql mysql -unepse -pnepse_password nepse_db < migrations/2025_12_14_000001_fix_financial_columns.sql
```

**VPS:**
```bash
mysql -u nepse -p nepse_db < migrations/2025_12_14_000001_fix_financial_columns.sql
```

> [!WARNING]
> Manual migrations won't be tracked in the migrations table. Use `npm run migrate` instead.

