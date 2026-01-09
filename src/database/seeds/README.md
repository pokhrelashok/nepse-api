# Database Seeds

This directory contains database seed files that populate the database with initial data.

## Usage

### Run all seeds
```bash
npm run db:seed
```

### Run migrate:fresh (includes seeding)
The `migrate:fresh` command will automatically run all seeds after dropping tables and running migrations:
```bash
npm run migrate:fresh
```

## Seed Files

Seed files are executed in alphabetical order. Use numeric prefixes to control execution order:

- `01_api_keys.js` - Creates a default API key for development

## Creating New Seeds

1. Create a new file in this directory with a numeric prefix (e.g., `02_users.js`)
2. Export a `seed` function that performs the seeding:

```javascript
const { pool } = require('../database');
const logger = require('../../utils/logger');

async function seed() {
  try {
    logger.info('Seeding users...');
    
    // Your seeding logic here
    await pool.execute('INSERT INTO users ...');
    
    logger.info('✓ Users seeded successfully');
  } catch (error) {
    logger.error('Failed to seed users:', error);
    throw error;
  }
}

module.exports = { seed };
```

## Default API Key

The default API key created by the seed is:
```
npt_82bc05f3a46fa9d92bf92f7213f1d18245f4445b62ecfabdc0357074f4fd60f1
```

This key is automatically created when running `migrate:fresh` or `db:seed`.
