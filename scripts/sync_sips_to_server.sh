#!/bin/bash

# Configuration
REMOTE_HOST="root@nepse-api"
REMOTE_APP_DIR="/var/www/nepse-api" # Update this if your app is elsewhere
LOCAL_EXPORT_FILE="sips_export.json"

echo "🚀 Starting SIP Sync Process..."

# 1. Export Local Data
echo "--------------------------------"
echo "📦 Step 1: Exporting local SIP data..."
bun scripts/export-sips.js
if [ $? -ne 0 ]; then
    echo "❌ Export failed."
    exit 1
fi

# 2. Transfer to Server
echo "--------------------------------"
echo "✈️ Step 2: Uploading data and script to server..."
scp $LOCAL_EXPORT_FILE $REMOTE_HOST:$REMOTE_APP_DIR/
scp scripts/import-sips.js $REMOTE_HOST:$REMOTE_APP_DIR/scripts/

if [ $? -ne 0 ]; then
    echo "❌ Upload failed."
    exit 1
fi

# 3. Run Import on Server
echo "--------------------------------"
echo "🔄 Step 3: Running import on server..."
ssh $REMOTE_HOST "cd $REMOTE_APP_DIR && bun scripts/import-sips.js"
# OR if using node:
# ssh $REMOTE_HOST "cd $REMOTE_APP_DIR && node scripts/import-sips.js"

echo "--------------------------------"
echo "✅ Sync Completed!"
