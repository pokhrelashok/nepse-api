#!/bin/bash

# NEPSE Portfolio API - Ubuntu Server Deployment Script
# Usage: ./deploy-ubuntu.sh [domain_name]

set -e  # Exit on any error

DOMAIN=${1:-"localhost"}
APP_USER="nepse"
APP_DIR="/var/www/nepse-api"
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

# Install Node.js 18.x
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

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
cp -r . $APP_DIR/
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
cat > $NGINX_AVAILABLE << EOL
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Serve static images
    location /images/ {
        alias $APP_DIR/public/images/;
        expires 7d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }
    
    # Root redirect
    location / {
        return 301 /api/stocks/prices;
    }
    
    # Deny access to sensitive files
    location ~ /\\. {
        deny all;
    }
    
    location ~ \\.(db|log)\$ {
        deny all;
    }
}

# Rate limiting zone
http {
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
}
EOL

# Enable Nginx site
ln -sf $NGINX_AVAILABLE $NGINX_ENABLED
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t && systemctl reload nginx
echo "✅ Nginx configured and reloaded"

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
cat > /etc/systemd/system/nepse-pm2.service << EOL
[Unit]
Description=PM2 process manager for NEPSE API
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=$APP_USER
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=PM2_HOME=/home/$APP_USER/.pm2
PIDFile=/home/$APP_USER/.pm2/pm2.pid
ExecStart=/usr/bin/pm2 start $APP_DIR/ecosystem.config.js
ExecReload=/usr/bin/pm2 reload $APP_DIR/ecosystem.config.js
ExecStop=/usr/bin/pm2 kill
Restart=always
RestartSec=10
KillMode=process
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
EOL

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
cat > $APP_DIR/update.sh << EOL
#!/bin/bash
cd $APP_DIR
git pull origin main
npm ci --production
pm2 reload ecosystem.config.js
echo "✅ Application updated successfully!"
EOL
chmod +x $APP_DIR/update.sh
chown $APP_USER:$APP_USER $APP_DIR/update.sh

# Create data population script
echo "📝 Creating data population script..."
cat > $APP_DIR/populate-data.sh << EOL
#!/bin/bash
cd $APP_DIR
echo "📊 Populating stock prices..."
node src/index.js prices --save
echo "🏢 Populating company details..."
node src/index.js companies --save
echo "✅ Data population completed!"
EOL
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
cat > /etc/logrotate.d/nepse-api << EOL
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $APP_USER $APP_USER
    postrotate
        sudo -u $APP_USER pm2 reloadLogs
    endscript
}
EOL

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
