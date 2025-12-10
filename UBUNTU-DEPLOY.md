# 🚀 Ubuntu Server Deployment - Quick Start

Deploy your NEPSE Portfolio API on Ubuntu server with a single command!

## ⚡ One-Command Deployment

```bash
# Download and run deployment script
sudo deploy/deploy-ubuntu.sh yourdomain.com

# OR for localhost (no SSL)
sudo deploy/deploy-ubuntu.sh localhost
```

## 📋 What This Does

✅ **Installs everything needed:**

- Node.js 18.x + PM2
- Nginx with security config
- SSL certificate (Let's Encrypt)
- Firewall setup (UFW)

✅ **Creates production setup:**

- Application user (`nepse`)
- Directory structure (`/var/www/nepse-api/`)
- Systemd services for auto-restart
- Log rotation and monitoring

✅ **Security configured:**

- Firewall rules
- SSL/HTTPS redirect
- Rate limiting
- Security headers

## 🎯 After Deployment

### 1. Populate Data

```bash
sudo -u nepse /var/www/nepse-api/populate-data.sh
```

### 2. Check Status

```bash
nepse-status              # Overall system status
./monitor.sh             # Detailed monitoring
curl http://yourdomain.com/api/market/status  # Test API
```

## 🔧 Management Commands

```bash
# Status and monitoring
nepse-status                    # System overview
nepse-logs                      # View logs
./monitor.sh --watch           # Live monitoring

# Application management
sudo -u nepse pm2 status        # PM2 processes
sudo -u nepse pm2 restart all   # Restart apps
/var/www/nepse-api/update.sh    # Update code

# Data updates
sudo -u nepse npm run update:prices     # Update stock prices
sudo -u nepse npm run update:companies  # Update company data
```

## 🌐 Your API Endpoints

After deployment, these will be available at `https://yourdomain.com`:

- `/api/market/status` - Market open/closed
- `/api/stocks/prices` - Latest stock prices  
- `/api/stocks/search?q=NABIL` - Search stocks
- `/api/companies/top` - Top companies
- `/images/NABIL.png` - Company logos

## 📊 Monitoring Dashboard

```bash
./monitor.sh --watch
```

Shows real-time:

- ✅ Service status (Nginx, PM2, API)
- 💾 Resource usage (disk, memory)
- 🔄 Process health
- 📊 Database stats
- ⚠️ Recent errors

## 🔄 Automatic Features

- **Auto-restart** - Services restart on failure
- **Auto-updates** - Scheduled data scraping
- **Auto-SSL** - Certificate renewal
- **Log rotation** - Prevents disk filling

## 🆘 Troubleshooting

**API not working?**

```bash
sudo -u nepse pm2 restart ecosystem.config.js
sudo systemctl restart nginx
```

**Database issues?**

```bash
sudo -u nepse node /var/www/nepse-api/src/database/database.js
```

**SSL problems?**

```bash
sudo certbot renew
```

---

**That's it! Your production NEPSE API is ready! 🎉**

For detailed documentation, see [DEPLOYMENT.md](DEPLOYMENT.md)
