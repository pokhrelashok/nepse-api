#!/bin/bash

# NEPSE Portfolio API - Ubuntu Server Deployment Script
# Usage: ./deploy-ubuntu.sh [domain_name]

set -e  # Exit on any error

DOMAIN=${1:-"localhost"}
APP_USER="nepse"
APP_DIR="/var/www/nepse-api"
DEPLOY_DIR="$(dirname "$(realpath "$0")")"
NGINX_AVAILABLE="/etc/nginx/sites-available/nepse-api"
NGINX_ENABLED="/etc/nginx/sites-enabled/nepse-api"

echo "🚀 Starting NEPSE Portfolio API deployment on Ubuntu..."
echo "📍 Domain: $DOMAIN"
echo "👤 App User: $APP_USER"
echo "📁 App Directory: $APP_DIR"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script as root (use sudo)"
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "📦 Installing required packages..."
apt install -y curl wget git nginx sqlite3 certbot python3-certbot-nginx ufw

# Install Chrome/Puppeteer dependencies
echo "📦 Installing Chrome dependencies for Puppeteer..."
apt install -y \
    ca-certificates \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libgtk-3-0 \
    libasound2-dev \
    xdg-utils

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Google Chrome for Puppeteer
echo "📦 Installing Google Chrome..."

# Check available disk space and memory
echo "🔍 Checking system resources..."
df -h /var/cache/apt/archives
free -h

# Clean up package cache to free space
apt clean
apt autoremove -y

# Download Chrome GPG key
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt update

# Try installing Chrome with better error handling
echo "📦 Attempting Chrome installation..."
if ! apt install -y google-chrome-stable; then
    echo "🔧 Chrome installation failed, trying alternative approaches..."
    
    # Clean up any partial installation
    apt --fix-broken install -y
    apt clean
    
    # Try downloading and installing manually with more space
    cd /tmp
    wget -O chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    
    # Install with dpkg and fix dependencies
    if dpkg -i chrome.deb; then
        echo "✅ Chrome installed successfully via dpkg"
    else
        echo "🔧 Fixing Chrome dependencies..."
        apt --fix-broken install -y
        dpkg -i chrome.deb || apt install -f -y
    fi
    
    # Clean up
    rm -f chrome.deb
    
    # Verify installation
    if which google-chrome-stable >/dev/null 2>&1; then
        echo "✅ Chrome installation verified"
    else
        echo "❌ Chrome installation failed completely"
        echo "⚠️ Will try to use Puppeteer's bundled Chromium instead"
        # Remove the Chrome executable path requirement
        export SKIP_CHROME_INSTALL=true
    fi
fi

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Create application user
echo "👤 Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash $APP_USER
    echo "✅ Created user: $APP_USER"
else
    echo "✅ User $APP_USER already exists"
fi

# Create application directory
echo "📁 Setting up application directory..."
mkdir -p $APP_DIR
chown $APP_USER:$APP_USER $APP_DIR

# Copy application files
echo "📋 Copying application files..."
# Copy main application (excluding unnecessary directories and files)
rsync -av --exclude='deploy/' --exclude='.git/' --exclude='node_modules/' --exclude='*.log' --exclude='.DS_Store' --exclude='*.db' . $APP_DIR/
# Remove any existing symlink and copy ecosystem config directly
rm -f $APP_DIR/ecosystem.config.js
cp $DEPLOY_DIR/ecosystem.config.js $APP_DIR/

# Update ecosystem config based on Chrome installation status
if [ "$SKIP_CHROME_INSTALL" = "true" ]; then
    echo "🔧 Configuring for Puppeteer's bundled Chromium..."
    # Remove Chrome executable path from ecosystem config
    sed -i '/PUPPETEER_EXECUTABLE_PATH/d' $APP_DIR/ecosystem.config.js
fi

chown -R $APP_USER:$APP_USER $APP_DIR

# Switch to app user for Node.js operations
echo "📦 Installing Node.js dependencies..."
sudo -u $APP_USER bash << EOF
cd $APP_DIR
npm ci --production
mkdir -p logs public/images
EOF

# Initialize database
echo "🗃️ Initializing database..."
sudo -u $APP_USER bash << EOF
cd $APP_DIR
node src/database/database.js
EOF

# Setup Nginx
echo "🔧 Configuring Nginx..."

# Create site configuration from template
cp $DEPLOY_DIR/templates/nginx-site.conf $NGINX_AVAILABLE
# Replace placeholders in the nginx configuration
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" $NGINX_AVAILABLE
sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" $NGINX_AVAILABLE

# Enable Nginx site
ln -sf $NGINX_AVAILABLE $NGINX_ENABLED
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
if nginx -t; then
    systemctl reload nginx
    echo "✅ Nginx configured and reloaded"
else
    echo "❌ Nginx configuration test failed"
    echo "Check the configuration file: $NGINX_AVAILABLE"
    exit 1
fi

# Setup UFW firewall
echo "🔥 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
echo "✅ Firewall configured"

# Create systemd service for PM2
echo "⚙️ Setting up PM2 systemd service..."

# Create systemd service from template
cp $DEPLOY_DIR/templates/nepse-pm2.service /etc/systemd/system/nepse-pm2.service
# Replace placeholders in the service file
sed -i "s/APP_USER_PLACEHOLDER/$APP_USER/g" /etc/systemd/system/nepse-pm2.service
sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" /etc/systemd/system/nepse-pm2.service

# Initialize PM2 for the app user and start services
echo "🚀 Starting PM2 services..."
sudo -u $APP_USER bash << EOF
cd $APP_DIR
export PM2_HOME=/home/$APP_USER/.pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
EOF

# Enable and start the systemd service
systemctl daemon-reload
systemctl enable nepse-pm2
systemctl start nepse-pm2

# Create update script
echo "📝 Creating update script..."
cp $DEPLOY_DIR/scripts/update-app.sh $APP_DIR/update.sh
sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" $APP_DIR/update.sh
chmod +x $APP_DIR/update.sh
chown $APP_USER:$APP_USER $APP_DIR/update.sh

# Create data population script
echo "📝 Creating data population script..."
cp $DEPLOY_DIR/scripts/populate-initial-data.sh $APP_DIR/populate-data.sh
sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" $APP_DIR/populate-data.sh
chmod +x $APP_DIR/populate-data.sh
chown $APP_USER:$APP_USER $APP_DIR/populate-data.sh

# Setup SSL with Let's Encrypt (if domain is not localhost)
if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
    echo "🔒 Setting up SSL certificate..."
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    echo "✅ SSL certificate configured"
else
    echo "⚠️ Skipping SSL setup for localhost"
fi

# Setup log rotation
echo "📋 Setting up log rotation..."

# Create logrotate configuration from template
cp $DEPLOY_DIR/templates/nepse-logrotate.conf /etc/logrotate.d/nepse-api
# Replace placeholders in logrotate config
sed -i "s/APP_USER_PLACEHOLDER/$APP_USER/g" /etc/logrotate.d/nepse-api
sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" /etc/logrotate.d/nepse-api

# Create maintenance script
echo "📝 Creating maintenance scripts..."
cat > /usr/local/bin/nepse-status << EOL
#!/bin/bash
echo "=== NEPSE API Status ==="
sudo -u $APP_USER pm2 status
echo ""
echo "=== Nginx Status ==="
systemctl status nginx --no-pager -l
echo ""
echo "=== Disk Usage ==="
df -h $APP_DIR
echo ""
echo "=== API Health Check ==="
curl -s http://localhost:3000/health | jq . || echo "API not responding"
EOL
chmod +x /usr/local/bin/nepse-status

cat > /usr/local/bin/nepse-logs << EOL
#!/bin/bash
echo "=== Recent API Logs ==="
sudo -u $APP_USER pm2 logs --lines 50
EOL
chmod +x /usr/local/bin/nepse-logs

echo ""
echo "🎉 NEPSE Portfolio API deployment completed successfully!"
echo ""
echo "📊 API Status: $(systemctl is-active nepse-pm2)"
echo "🌐 Nginx Status: $(systemctl is-active nginx)"
echo "🔒 Firewall Status: $(ufw status | head -1)"
echo ""
echo "🔗 Your API is available at:"
if [ "$DOMAIN" != "localhost" ]; then
    echo "   https://$DOMAIN/api/stocks/prices"
    echo "   https://$DOMAIN/api/market/status"
else
    echo "   http://localhost/api/stocks/prices"
    echo "   http://localhost/api/market/status"
fi
echo ""
echo "📋 Useful commands:"
echo "   nepse-status          - Check application status"
echo "   nepse-logs           - View recent logs"
echo "   sudo -u $APP_USER pm2 status  - PM2 status"
echo "   $APP_DIR/update.sh   - Update application"
echo "   $APP_DIR/populate-data.sh  - Populate initial data"
echo ""
echo "📁 Application directory: $APP_DIR"
echo "📋 Logs directory: $APP_DIR/logs"
echo ""
echo "🚀 To populate initial data, run:"
echo "   sudo -u $APP_USER $APP_DIR/populate-data.sh"
