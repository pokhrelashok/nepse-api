#!/bin/bash

set -e  # Exit on any error

DOMAIN=${1:-"localhost"}
APP_USER="nepse"
APP_DIR="/var/www/nepse-api"
DEPLOY_DIR="$(dirname "$(realpath "$0")")"
NGINX_AVAILABLE="/etc/nginx/sites-available/nepse-api"
NGINX_ENABLED="/etc/nginx/sites-enabled/nepse-api"

# Detect public IPv4 (best-effort)
SERVER_IP=$(curl -4 -s https://ifconfig.co || curl -4 -s https://api.ipify.org || dig +short myip.opendns.com @resolver1.opendns.com || hostname -I | awk '{print $1}')
SERVER_IP=${SERVER_IP:-127.0.0.1}
echo "🌐 Detected server IPv4: $SERVER_IP"

echo "🚀 Starting NEPSE Portfolio API deployment on Ubuntu..."
echo "📍 Domain: $DOMAIN"
echo "👤 App User: $APP_USER"
echo "📁 App Directory: $APP_DIR"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run this script as root (use sudo)"
    exit 1
fi

echo "🕐 Setting timezone to Nepal (Asia/Kathmandu)..."
timedatectl set-timezone Asia/Kathmandu
echo "✅ Timezone set to: $(timedatectl show --property=Timezone --value)"
echo "🕐 Current server time: $(date)"

echo "📦 Updating system packages..."
apt update && apt upgrade -y

echo "📦 Installing required packages..."
apt install -y curl wget git nginx mysql-server certbot python3-certbot-nginx ufw jq

echo "📦 Installing Chrome dependencies for Puppeteer..."
apt install -y ca-certificates fonts-liberation libatk-bridge2.0-0 libatk1.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libgtk-3-0 libasound2-dev xdg-utils

echo "📦 Checking Node.js..."
if command -v node >/dev/null 2>&1 && node -v | grep -q '^v20\.'; then
    echo "✅ Node.js already present"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs build-essential
fi
node --version
npm --version

# Install Google Chrome for Puppeteer
echo "📦 Checking Google Chrome..."
if command -v google-chrome-stable >/dev/null 2>&1; then
    echo "✅ Google Chrome already present"
else
    echo "📦 Installing Google Chrome..."

    echo "🔍 Checking system resources..."
    df -h /var/cache/apt/archives
    free -h

    apt clean
    apt autoremove -y

    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
    apt update

    echo "📦 Attempting Chrome installation..."
    if ! apt install -y google-chrome-stable; then
        echo "🔧 Chrome installation failed, trying alternative approaches..."
        apt --fix-broken install -y
        apt clean
        cd /tmp
        wget -O chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
        if dpkg -i chrome.deb; then
            echo "✅ Chrome installed successfully via dpkg"
        else
            echo "🔧 Fixing Chrome dependencies..."
            apt --fix-broken install -y
            dpkg -i chrome.deb || apt install -f -y
        fi
        rm -f chrome.deb
        if which google-chrome-stable >/dev/null 2>&1; then
            echo "✅ Chrome installation verified"
        else
            echo "❌ Chrome installation failed completely"
            echo "⚠️ Will try to use Puppeteer's bundled Chromium instead"
            export SKIP_CHROME_INSTALL=true
        fi
    fi
fi

# Install PM2 globally
echo "📦 Checking PM2..."
if command -v pm2 >/dev/null 2>&1; then
    echo "✅ PM2 already present"
else
    npm install -g pm2
fi

# Create application user
echo "👤 Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash $APP_USER
    echo "✅ Created user: $APP_USER"
    # Set password: use APP_USER_PASSWORD if provided, otherwise generate a secure random password
    if [ -n "$APP_USER_PASSWORD" ]; then
        echo "$APP_USER:$APP_USER_PASSWORD" | chpasswd
        echo "🔑 Password set from APP_USER_PASSWORD environment variable"
    else
        GENERATED_PW=$(openssl rand -base64 18)
        echo "$APP_USER:$GENERATED_PW" | chpasswd
        CRED_FILE="/root/${APP_USER}_credentials.txt"
        echo "username: $APP_USER" > "$CRED_FILE"
        echo "password: $GENERATED_PW" >> "$CRED_FILE"
        chmod 600 "$CRED_FILE"
        echo "🔑 Generated password saved to $CRED_FILE (permission 600)"
    fi
else
    echo "✅ User $APP_USER already exists"
fi

echo "📁 Setting up application directory..."
mkdir -p $APP_DIR
chown $APP_USER:$APP_USER $APP_DIR

# Copy application files
echo "📋 Copying application files..."
rsync -av --exclude='deploy/' --exclude='.git/' --exclude='node_modules/' --exclude='*.log' --exclude='.DS_Store' --exclude='*.db' . $APP_DIR/
# Remove any existing symlink and copy ecosystem config directly
rm -f $APP_DIR/ecosystem.config.js
cp $DEPLOY_DIR/ecosystem.config.js $APP_DIR/

if [ "$SKIP_CHROME_INSTALL" = "true" ]; then
    echo "🔧 Configuring for Puppeteer's bundled Chromium..."
    sed -i '/PUPPETEER_EXECUTABLE_PATH/d' $APP_DIR/ecosystem.config.js
fi

chown -R $APP_USER:$APP_USER $APP_DIR

echo "📦 Installing Node.js dependencies..."
sudo -u $APP_USER bash << DEPS_EOF
set -e
cd "$APP_DIR"
if [ -d node_modules ]; then
    echo "Dependencies already installed, skipping"
else
    if [ -f package-lock.json ]; then
        echo "ℹ️ Attempting npm ci..."
        if npm ci --omit=dev; then
            echo "✅ Dependencies installed with npm ci"
        else
            echo "⚠️ npm ci failed (lockfile may be out of sync), falling back to npm install"
            rm -rf node_modules package-lock.json
            npm install --omit=dev
        fi
    else
        echo "ℹ️ package-lock.json not found, using npm install --omit=dev"
        npm install --omit=dev
    fi
fi
mkdir -p logs public/storage/images/logos
DEPS_EOF

# Setup MySQL Database
echo "🗃️ Setting up MySQL database..."

# MySQL credentials file location
MYSQL_CRED_FILE="/root/nepse_mysql_credentials.txt"

# Determine MySQL password: env var > existing credentials file > generate new
if [ -n "$MYSQL_NEPSE_PASSWORD" ]; then
    echo "🔑 Using MySQL password from environment variable"
elif [ -f "$MYSQL_CRED_FILE" ]; then
    # Read existing password from credentials file
    EXISTING_PASSWORD=$(grep "^Password:" "$MYSQL_CRED_FILE" 2>/dev/null | cut -d' ' -f2-)
    if [ -n "$EXISTING_PASSWORD" ]; then
        MYSQL_NEPSE_PASSWORD="$EXISTING_PASSWORD"
        echo "🔑 Using existing MySQL password from $MYSQL_CRED_FILE"
    fi
fi

# Generate new password if still not set
if [ -z "$MYSQL_NEPSE_PASSWORD" ]; then
    MYSQL_NEPSE_PASSWORD=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 24)
    echo "🔑 Generated new MySQL password for nepse user"
fi

# Start MySQL service
systemctl start mysql
systemctl enable mysql

# Create database and user (handles both new and existing users)
echo "📦 Configuring MySQL database and user..."
mysql -u root << MYSQL_SETUP
CREATE DATABASE IF NOT EXISTS nepse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Create user if not exists, then always update password to ensure sync
CREATE USER IF NOT EXISTS 'nepse'@'localhost' IDENTIFIED BY '${MYSQL_NEPSE_PASSWORD}';
ALTER USER 'nepse'@'localhost' IDENTIFIED BY '${MYSQL_NEPSE_PASSWORD}';
GRANT ALL PRIVILEGES ON nepse_db.* TO 'nepse'@'localhost';
FLUSH PRIVILEGES;
MYSQL_SETUP

# Verify database connection
echo "🧪 Verifying MySQL connection..."
if mysql -u nepse -p"${MYSQL_NEPSE_PASSWORD}" -e "SELECT 1;" nepse_db >/dev/null 2>&1; then
    echo "✅ MySQL connection verified successfully"
else
    echo "❌ MySQL connection failed, attempting to fix..."
    # Force reset the user password
    mysql -u root << MYSQL_FIX
DROP USER IF EXISTS 'nepse'@'localhost';
CREATE USER 'nepse'@'localhost' IDENTIFIED BY '${MYSQL_NEPSE_PASSWORD}';
GRANT ALL PRIVILEGES ON nepse_db.* TO 'nepse'@'localhost';
FLUSH PRIVILEGES;
MYSQL_FIX
    
    # Verify again
    if mysql -u nepse -p"${MYSQL_NEPSE_PASSWORD}" -e "SELECT 1;" nepse_db >/dev/null 2>&1; then
        echo "✅ MySQL connection fixed and verified"
    else
        echo "❌ MySQL connection still failing. Please check MySQL installation."
        exit 1
    fi
fi

echo "✅ MySQL database 'nepse_db' configured"

# Create .env file with database credentials
cat > $APP_DIR/.env << ENV_EOF
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=nepse
DB_PASSWORD=${MYSQL_NEPSE_PASSWORD}
DB_NAME=nepse_db
DB_POOL_SIZE=10
ENV_EOF
chown $APP_USER:$APP_USER $APP_DIR/.env
chmod 600 $APP_DIR/.env

# Save MySQL credentials securely
echo "MySQL Database Credentials" > "$MYSQL_CRED_FILE"
echo "=========================" >> "$MYSQL_CRED_FILE"
echo "Database: nepse_db" >> "$MYSQL_CRED_FILE"
echo "Username: nepse" >> "$MYSQL_CRED_FILE"
echo "Password: ${MYSQL_NEPSE_PASSWORD}" >> "$MYSQL_CRED_FILE"
echo "Host: localhost" >> "$MYSQL_CRED_FILE"
echo "Port: 3306" >> "$MYSQL_CRED_FILE"
chmod 600 "$MYSQL_CRED_FILE"
echo "🔑 MySQL credentials saved to $MYSQL_CRED_FILE"

# Initialize database schema
echo "📊 Initializing database schema..."
sudo -u $APP_USER bash << DB_INIT_EOF
set -e
cd "$APP_DIR"
source .env
node -e "require('./src/database/database.js'); setTimeout(() => process.exit(0), 3000);"
DB_INIT_EOF
echo "✅ Database schema initialized"

# Setup Nginx
echo "🔧 Configuring Nginx..."

# Create site configuration from template
cp $DEPLOY_DIR/templates/nginx-site.conf $NGINX_AVAILABLE
# Replace placeholders in the nginx configuration
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" $NGINX_AVAILABLE
sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" $NGINX_AVAILABLE
sed -i "s/IPV4_PLACEHOLDER/$SERVER_IP/g" $NGINX_AVAILABLE

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
# Remove Nginx HTTP since we'll enforce HTTPS
ufw delete allow 'Nginx HTTP' 2>/dev/null || true
ufw --force enable
echo "✅ Firewall configured (HTTPS enforced)"

# Create systemd service for PM2
echo "⚙️ Setting up PM2 systemd service..."

# Create systemd service from template
cp $DEPLOY_DIR/templates/nepse-pm2.service /etc/systemd/system/nepse-pm2.service
# Replace placeholders in the service file
sed -i "s/APP_USER_PLACEHOLDER/$APP_USER/g" /etc/systemd/system/nepse-pm2.service
sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" /etc/systemd/system/nepse-pm2.service

# Initialize PM2 for the app user and start services
echo "🚀 Starting PM2 services..."
sudo -u $APP_USER bash << PM2_START_EOF
set -e
cd "$APP_DIR"
export PM2_HOME="/home/$APP_USER/.pm2"

# Stop and delete any existing processes first to avoid conflicts
pm2 delete all 2>/dev/null || true

# Start fresh from ecosystem config
pm2 start ecosystem.config.js
pm2 save
PM2_START_EOF

# Configure PM2 to auto-start on boot (must run as root)
echo "🔄 Configuring PM2 auto-start on boot..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
systemctl enable pm2-$APP_USER

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
    echo "🔒 Setting up enhanced SSL with Let's Encrypt..."
    
    # Check if domain is reachable
    echo "🔍 Verifying domain accessibility..."
    if ! curl -s --connect-timeout 10 "http://$DOMAIN" > /dev/null; then
        echo "⚠️ Warning: Domain $DOMAIN may not be accessible. Continuing anyway..."
    fi
    
    # Request SSL certificate with enhanced options
    if certbot --nginx -d $DOMAIN -d www.$DOMAIN \
        --non-interactive \
        --agree-tos \
        --email admin@$DOMAIN \
        --redirect \
        --hsts \
        --staple-ocsp \
        --must-staple; then
        
        echo "✅ SSL certificate configured successfully"
        
        # Add additional security headers to the HTTPS server block
        echo "🔧 Adding enhanced security headers..."
        
        # Create enhanced SSL configuration
        cat > /etc/nginx/conf.d/ssl-security.conf << 'SSL_CONF_EOF'
# Enhanced SSL Security Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# Security Headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;
SSL_CONF_EOF

        # Test and reload Nginx
        if nginx -t; then
            systemctl reload nginx
            echo "✅ Enhanced SSL security configuration applied"
            
            # Test HTTPS connectivity
            echo "🧪 Testing HTTPS connectivity..."
            sleep 5
            if curl -s --connect-timeout 10 "https://$DOMAIN" > /dev/null; then
                echo "✅ HTTPS is working correctly"
            else
                echo "⚠️ HTTPS test failed, but certificate was installed"
            fi
        else
            echo "❌ Nginx configuration test failed after SSL setup"
        fi
        
    else
        echo "❌ SSL certificate installation failed"
        echo "📋 Checking common issues..."
        
        # Diagnostic information
        echo "🔍 Domain resolution check:"
        dig +short $DOMAIN A || echo "❌ Failed to resolve $DOMAIN"
        dig +short www.$DOMAIN A || echo "❌ Failed to resolve www.$DOMAIN"
        
        echo "🔍 Port accessibility check:"
        netstat -tuln | grep -E ':(80|443)\s' || echo "❌ Ports 80/443 may not be open"
        
        echo "📋 Please check:"
        echo "   1. Domain DNS A records point to this server's IP"
        echo "   2. Firewall allows ports 80 and 443"
        echo "   3. Domain is accessible from the internet"
        echo "   4. No conflicting Nginx configurations"
        echo ""
        echo "💡 You can manually retry with: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    fi
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

# Setup SSL certificate auto-renewal verification
if [ "$DOMAIN" != "localhost" ] && [ "$DOMAIN" != "127.0.0.1" ]; then
    echo "🔄 Setting up SSL certificate auto-renewal..."
    
    # Test the renewal process
    echo "🧪 Testing SSL certificate renewal process..."
    if certbot renew --dry-run; then
        echo "✅ SSL certificate auto-renewal is working"
    else
        echo "⚠️ SSL certificate auto-renewal test failed"
    fi
    
    # Check renewal timer status
    echo "⏰ Checking certbot renewal timer..."
    systemctl status certbot.timer --no-pager || echo "⚠️ Certbot timer not active"
    
    # Create renewal notification script
    cat > /usr/local/bin/nepse-ssl-check << 'SSL_CHECK_EOF'
#!/bin/bash
echo "🔒 SSL Certificate Status for $DOMAIN"
echo "====================================="
certbot certificates
echo ""
echo "📅 Next renewal check:"
systemctl list-timers certbot.timer
echo ""
echo "🧪 Test renewal (dry run):"
echo "sudo certbot renew --dry-run"
SSL_CHECK_EOF
    chmod +x /usr/local/bin/nepse-ssl-check
fi

# Create maintenance script
echo "📝 Creating maintenance scripts..."
cat > /usr/local/bin/nepse-status << EOL
#!/bin/bash
echo "=== NEPSE API Status ==="
sudo -u $APP_USER bash -c 'export PM2_HOME="/home/$APP_USER/.pm2"; pm2 status'
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
sudo -u $APP_USER bash -c 'export PM2_HOME="/home/$APP_USER/.pm2"; pm2 logs --lines 50'
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
    echo "   https://www.$DOMAIN/api/stocks/prices"
    echo ""
    echo "🔒 SSL Security Features Enabled:"
    echo "   • HTTPS enforced (HTTP redirects to HTTPS)"
    echo "   • HTTP Strict Transport Security (HSTS)"
    echo "   • OCSP Stapling for improved performance"
    echo "   • Enhanced security headers"
    echo "   • Automatic certificate renewal"
    echo ""
    echo "🧪 Test your SSL configuration:"
    echo "   https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
else
    echo "   http://localhost/api/stocks/prices"
    echo "   http://localhost/api/market/status"
fi
echo ""
echo "📋 Useful commands:"
echo "   nepse-status          - Check application status"
echo "   nepse-logs           - View recent logs"
echo "   nepse-ssl-check      - Check SSL certificate status (if SSL enabled)"
echo "   sudo -u $APP_USER pm2 status  - PM2 status"
echo "   $APP_DIR/update.sh   - Update application"
echo "   $APP_DIR/populate-data.sh  - Populate initial data"
echo "   sudo certbot renew --dry-run - Test SSL renewal (if SSL enabled)"
echo "   sudo nginx -T | grep ssl_ - Check SSL configuration"
echo ""
echo "📁 Application directory: $APP_DIR"
echo "📋 Logs directory: $APP_DIR/logs"
echo ""
echo "🚀 To populate initial data, run:"
echo "   sudo -u $APP_USER $APP_DIR/populate-data.sh"
