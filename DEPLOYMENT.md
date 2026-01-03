# NEPSE Portfolio API - Ubuntu Server Deployment Guide

Complete guide for deploying the NEPSE Portfolio API on Ubuntu server with Nginx, PM2, SSL, and monitoring.

## 🚀 Quick Deployment

### Prerequisites

- Ubuntu 18.04+ server
- Root access or sudo privileges
- Domain name pointed to your server (optional, for SSL)

### One-Command Deployment

```bash
# For domain deployment with SSL
sudo ./deploy-ubuntu.sh yourdomain.com

# For localhost deployment
sudo ./deploy-ubuntu.sh localhost
```

This script will automatically:

- ✅ Install Node.js, Nginx, PM2, and dependencies
- ✅ Create application user and directories
- ✅ Configure Nginx with security headers
- ✅ Setup SSL with Let's Encrypt (if domain provided)
- ✅ Configure firewall (UFW)
- ✅ Setup PM2 with systemd service
- ✅ Create monitoring and maintenance scripts

## 📋 What Gets Installed

### System Components

- **Bun** - JavaScript runtime (replaces Node.js)
- **Node.js 20.x** - Installed for PM2/System compatibility
- **PM2** - Process manager
- **Nginx** - Web server and reverse proxy
- **MySQL 8.0** - Database engine
- **UFW** - Firewall
- **Certbot** - SSL certificate management

### Application Structure

```
/var/www/nepse-api/          # Main application directory
├── src/                     # Source code
├── public/images/           # Company logos
├── logs/                    # Application logs
├── .env                     # Database credentials (auto-generated)
├── ecosystem.config.js      # PM2 configuration
├── update.sh               # Update script
└── populate-data.sh        # Data population script
```

### Services Created

- **nepse-pm2** - Systemd service for PM2
- **nginx** - Web server
- **PM2 processes:**
  - `nepse-api` - Main API server (port 3000)
  - `nepse-scheduler` - Background data updates (auto-started)

## 🔧 Post-Deployment Setup

### 1. Populate Initial Data

```bash
# Run as the nepse user
sudo -u nepse /var/www/nepse-api/populate-data.sh
```

### 2. Verify Installation

```bash
# Check system status
nepse-status

# View logs
nepse-logs

# Test API
curl http://localhost/api/market/status
```

### 3. Monitor the Application

```bash
# Real-time monitoring
./monitor.sh --watch

# One-time status check
./monitor.sh
```

## API Specification

Refer to the [api-spec](./api-spec) directory for full documentation of all available endpoints.


## 🔄 Maintenance Commands

### Application Management

```bash
# Check status
nepse-status

# View logs
nepse-logs
sudo -u nepse pm2 logs

# Restart application
sudo -u nepse pm2 restart ecosystem.config.js

# Update application
sudo -u nepse /var/www/nepse-api/update.sh
```

### Data Updates

```bash
# Update stock prices
# Update stock prices
sudo -u nepse /root/.bun/bin/bun /var/www/nepse-api/src/index.js prices --save

# Update company details for new companies
sudo -u nepse /root/.bun/bin/bun /var/www/nepse-api/src/index.js companies --missing --save

# Full data refresh
sudo -u nepse /var/www/nepse-api/populate-data.sh
```

### Database Management

```bash
# Create backup
mysqldump -u nepse -p nepse_db > /var/www/nepse-api/backup_$(date +%Y%m%d_%H%M%S).sql

# Check database stats
/root/.bun/bin/bun src/database/scripts/check-stats.js # or mysql query
mysql -u nepse -p nepse_db -e "SELECT COUNT(*) FROM stock_prices;"

# Database shell access
mysql -u nepse -p nepse_db

# Restore from backup
mysql -u nepse -p nepse_db < backup.sql
```

### System Management

```bash
# Restart services
sudo systemctl restart nepse-pm2
sudo systemctl restart nginx

# Check service status
sudo systemctl status nepse-pm2
sudo systemctl status nginx

# Renew SSL certificate
sudo certbot renew
```

## 📊 Monitoring & Alerts

### Built-in Monitoring

The deployment includes a comprehensive monitoring script:

```bash
# Run monitoring dashboard
./monitor.sh --watch
```

Monitors:

- ✅ System services status
- ✅ API health checks
- ✅ Disk space usage
- ✅ Memory consumption
- ✅ PM2 process status
- ✅ Database statistics
- ✅ Recent error logs

### Log Files

- API logs: `/var/www/nepse-api/logs/api-*.log`
- Scheduler logs: `/var/www/nepse-api/logs/scheduler-*.log`
- Nginx logs: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- System logs: `journalctl -u nepse-pm2`

## 🔒 Security Features

### Firewall Configuration

- SSH (port 22) - allowed
- HTTP (port 80) - allowed
- HTTPS (port 443) - allowed
- All other ports - blocked

### Nginx Security

- Security headers enabled
- Rate limiting (10 requests/second per IP)
- GZIP compression
- Static file caching
- Access to sensitive files blocked

### SSL/TLS

- Automatic SSL certificate from Let's Encrypt
- Auto-renewal configured
- HTTPS redirect enabled

### Application Security

- Non-root user execution
- File permission restrictions
- Environment variable protection

## 🔥 Bun Runtime (Recommended)

For improved performance, you can run the application with Bun instead of Node.js:

### Installing Bun on Ubuntu

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH (if not already added)
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify installation
bun --version
```

### Running with Bun

```bash
# Install dependencies (20-40x faster than npm!)
cd /var/www/nepse-api
bun install

# Start the API server
bun run bun:start

# Or with PM2
pm2 start ecosystem.config.js --interpreter ~/.bun/bin/bun
```

### Performance Benefits

- **Package Installation**: 1-2 seconds vs 30-60 seconds with npm
- **Memory Usage**: 35-50% less than Node.js
- **Startup Time**: 2-3x faster
- **API Response**: Similar or better performance

### Docker with Bun (Default)

```bash
# Build Bun-based Docker image
docker-compose build backend

# Run Bun backend on port 3000
docker-compose up -d backend
```

## 🐳 Docker Alternative


If you prefer Docker deployment:

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

## 🔧 Troubleshooting

### Common Issues

1. **API not responding**

   ```bash
   sudo -u nepse pm2 restart ecosystem.config.js
   sudo systemctl restart nginx
   ```

2. **Database errors**

   ```bash
   # Check MySQL service status
   sudo systemctl status mysql
   
   # Test database connection
   mysql -u nepse -p nepse_db -e "SELECT 1;"
   
   # Reinitialize schema if needed
   sudo -u nepse node /var/www/nepse-api/src/database/database.js
   ```

3. **SSL certificate issues**

   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

4. **High memory usage**

   ```bash
   sudo -u nepse pm2 restart ecosystem.config.js
   # Check for memory leaks in logs
   ```

### Getting Help

- Check logs: `nepse-logs`
- System status: `nepse-status`
- PM2 status: `sudo -u nepse pm2 status`
- Nginx status: `sudo systemctl status nginx`

## 📈 Performance Tuning

### For High Traffic

1. Increase PM2 instances in `ecosystem.config.js`
2. Adjust Nginx worker processes
3. Enable database connection pooling
4. Configure Redis for caching

### For Low Resources

1. Reduce PM2 memory limits
2. Adjust scraping frequency
3. Implement data archiving
4. Optimize database queries

---

**Your NEPSE Portfolio API is now ready for production! 🚀**
