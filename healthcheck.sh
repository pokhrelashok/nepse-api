#!/bin/bash

# Health Check Script for NEPSE API
# Returns 0 for healthy, 1 for unhealthy

API_URL="http://localhost:3000"
MAX_RESPONSE_TIME=10
DB_PATH="/var/www/nepse-api/nepse.db"

# Function to check if API responds within timeout
check_api() {
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $MAX_RESPONSE_TIME $API_URL/health)
    if [ "$response_code" = "200" ]; then
        return 0
    else
        echo "API health check failed: HTTP $response_code"
        return 1
    fi
}

# Function to check if database is accessible
check_database() {
    if [ -f "$DB_PATH" ]; then
        local count=$(sqlite3 $DB_PATH "SELECT COUNT(*) FROM stock_prices LIMIT 1;" 2>/dev/null)
        if [ $? -eq 0 ]; then
            return 0
        else
            echo "Database query failed"
            return 1
        fi
    else
        echo "Database file not found"
        return 1
    fi
}

# Function to check PM2 processes
check_pm2() {
    local api_status=$(sudo -u nepse pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="nepse-api") | .pm2_env.status' 2>/dev/null)
    if [ "$api_status" = "online" ]; then
        return 0
    else
        echo "PM2 API process not online: $api_status"
        return 1
    fi
}

# Function to check disk space
check_disk() {
    local usage=$(df /var/www/nepse-api 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%//' 2>/dev/null)
    if [ -n "$usage" ] && [ "$usage" -lt 95 ]; then
        return 0
    else
        echo "Disk space critical: ${usage}% used"
        return 1
    fi
}

# Run all checks
ERROR_COUNT=0

if ! check_api; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

if ! check_database; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

if ! check_pm2; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

if ! check_disk; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi

# Return appropriate exit code
if [ $ERROR_COUNT -eq 0 ]; then
    echo "All health checks passed"
    exit 0
else
    echo "$ERROR_COUNT health check(s) failed"
    exit 1
fi
