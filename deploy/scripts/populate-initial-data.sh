#!/bin/bash

# NEPSE API Initial Data Population Script
cd APP_DIR_PLACEHOLDER

echo "📊 Starting initial data population..."
echo "⏱️ This may take several minutes depending on the number of companies"

# Check if database has data
STOCK_COUNT=$(sqlite3 nepse.db "SELECT COUNT(*) FROM stock_prices;" 2>/dev/null || echo "0")
COMPANY_COUNT=$(sqlite3 nepse.db "SELECT COUNT(*) FROM company_details;" 2>/dev/null || echo "0")

echo "📈 Current data: $STOCK_COUNT price records, $COMPANY_COUNT company details"

# Populate stock prices
echo "📊 Populating stock prices..."
node src/index.js prices --save
if [ $? -eq 0 ]; then
    echo "✅ Stock prices populated successfully"
else
    echo "❌ Failed to populate stock prices"
    exit 1
fi

# Populate company details
echo "🏢 Populating company details..."
node src/index.js companies --save
if [ $? -eq 0 ]; then
    echo "✅ Company details populated successfully"
else
    echo "❌ Failed to populate company details"
    exit 1
fi

# Show final stats
NEW_STOCK_COUNT=$(sqlite3 nepse.db "SELECT COUNT(*) FROM stock_prices;" 2>/dev/null || echo "0")
NEW_COMPANY_COUNT=$(sqlite3 nepse.db "SELECT COUNT(*) FROM company_details;" 2>/dev/null || echo "0")

echo "📊 Final data: $NEW_STOCK_COUNT price records, $NEW_COMPANY_COUNT company details"
echo "✅ Data population completed successfully!"
