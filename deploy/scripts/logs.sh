#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

APP_DIR="/var/www/nepse-api"

echo -e "${YELLOW}📊 Streaming NEPSE API Logs... (Press Ctrl+C to exit)${NC}"
echo -e "${GREEN}Following: api-err.log and api-out.log${NC}"
echo "----------------------------------------"

# Stream both error and output logs
tail -f $APP_DIR/logs/api-err.log $APP_DIR/logs/api-out.log
