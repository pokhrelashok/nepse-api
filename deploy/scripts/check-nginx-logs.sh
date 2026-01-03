#!/bin/bash

# Define colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking Nginx Error Log (Last 50 lines)${NC}"
echo "----------------------------------------"
sudo tail -n 50 /var/log/nginx/error.log

echo ""
echo -e "${YELLOW}🔍 Checking Nginx Access Log (Last 20 lines)${NC}"
echo "----------------------------------------"
sudo tail -n 20 /var/log/nginx/access.log
