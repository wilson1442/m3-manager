# M3U Management Panel - Installation Guide

## Prerequisites

- Ubuntu 24.04 LTS server (fresh installation recommended)
- Minimum 2GB RAM
- Minimum 20GB disk space
- Root or sudo access
- A domain name (optional, can use IP address)

## Quick Installation

### Option 1: Automated Installation Script

1. **Download the installation script:**
   ```bash
   wget https://your-server.com/install-m3u-panel.sh
   # OR
   curl -O https://your-server.com/install-m3u-panel.sh
   ```

2. **Make it executable:**
   ```bash
   chmod +x install-m3u-panel.sh
   ```

3. **Run the installation script as root:**
   ```bash
   sudo ./install-m3u-panel.sh
   ```

4. **Follow the prompts:**
   - Installation directory (default: /opt/m3u-panel)
   - Domain name or IP address
   - Admin username and password

5. **Wait for installation to complete** (10-15 minutes)

6. **Access your panel:**
   - Open browser: `http://YOUR_DOMAIN_OR_IP`
   - Login with your admin credentials

### Option 2: Manual Installation

If you prefer manual installation or the script fails, follow these steps:

#### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### 2. Install Dependencies
```bash
sudo apt install -y curl wget git build-essential software-properties-common ffmpeg gnupg nginx
```

#### 3. Install MongoDB 7.0
```bash
# Add MongoDB repository
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### 4. Install Node.js 20.x and Yarn
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install Yarn
sudo npm install -g yarn
```

#### 5. Install Python 3 and Dependencies
```bash
sudo apt install -y python3 python3-pip python3-venv
```

#### 6. Create Application Directory
```bash
sudo mkdir -p /opt/m3u-panel
cd /opt/m3u-panel
```

#### 7. Copy Application Files
Copy your application files to `/opt/m3u-panel/`:
- `backend/` directory with all Python files
- `frontend/` directory with all React files

#### 8. Setup Backend
```bash
cd /opt/m3u-panel/backend

# Install Python dependencies
sudo pip3 install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=m3u_panel
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=http://localhost:3000,http://YOUR_DOMAIN
EOF
```

#### 9. Setup Frontend
```bash
cd /opt/m3u-panel/frontend

# Install dependencies
yarn install

# Create .env file
cat > .env << EOF
REACT_APP_BACKEND_URL=http://YOUR_DOMAIN
WDS_SOCKET_PORT=443
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
EOF

# Build frontend
yarn build
```

#### 10. Create Systemd Services

**Backend Service:**
```bash
sudo nano /etc/systemd/system/m3u-backend.service
```

Paste this content:
```ini
[Unit]
Description=M3U Management Panel - Backend API
After=network.target mongodb.service
Requires=mongodb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/m3u-panel/backend
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Frontend Service:**
```bash
sudo nano /etc/systemd/system/m3u-frontend.service
```

Paste this content:
```ini
[Unit]
Description=M3U Management Panel - Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/m3u-panel/frontend
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/npx serve -s build -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start services:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable m3u-backend m3u-frontend
sudo systemctl start m3u-backend m3u-frontend
```

#### 11. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/m3u-panel
```

Paste this content (replace YOUR_DOMAIN):
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 100M;
}
```

**Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/m3u-panel /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

#### 12. Create Admin User
```bash
# Wait for services to start
sleep 10

# Create admin user
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","role":"super_admin"}'
```

#### 13. Configure Firewall (Optional)
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Post-Installation

### Access the Application
Open your browser and navigate to:
- `http://YOUR_DOMAIN` or `http://YOUR_SERVER_IP`

### Default Credentials
- Username: `admin`
- Password: `admin123` (or what you set during installation)

### Change Admin Password
1. Login to the panel
2. Go to Profile
3. Change your password

## SSL/HTTPS Configuration (Recommended)

### Using Let's Encrypt (Free)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install SSL certificate
sudo certbot --nginx -d YOUR_DOMAIN

# Auto-renewal is configured automatically
```

## Maintenance Commands

### View Logs
```bash
# Backend logs
sudo journalctl -u m3u-backend -f

# Frontend logs
sudo journalctl -u m3u-frontend -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MongoDB logs
sudo journalctl -u mongod -f
```

### Restart Services
```bash
# Restart backend
sudo systemctl restart m3u-backend

# Restart frontend
sudo systemctl restart m3u-frontend

# Restart all services
sudo systemctl restart m3u-backend m3u-frontend nginx mongod
```

### Check Service Status
```bash
sudo systemctl status m3u-backend m3u-frontend nginx mongod
```

### Update Application
```bash
# Stop services
sudo systemctl stop m3u-backend m3u-frontend

# Backup current installation
sudo cp -r /opt/m3u-panel /opt/m3u-panel.backup

# Update backend
cd /opt/m3u-panel/backend
sudo git pull  # or copy new files
sudo pip3 install -r requirements.txt

# Update frontend
cd /opt/m3u-panel/frontend
yarn install
yarn build

# Start services
sudo systemctl start m3u-backend m3u-frontend
```

### Backup Database
```bash
# Manual MongoDB backup
sudo mongodump --db m3u_panel --out /backup/mongodb/$(date +%Y%m%d)

# Or use the built-in backup feature in Settings page
```

### Restore Database
```bash
# Manual MongoDB restore
sudo mongorestore --db m3u_panel /backup/mongodb/BACKUP_DATE/m3u_panel

# Or use the built-in restore feature in Settings page
```

## Troubleshooting

### Services Won't Start
```bash
# Check service status
sudo systemctl status m3u-backend
sudo systemctl status m3u-frontend

# Check logs for errors
sudo journalctl -u m3u-backend -n 100 --no-pager
sudo journalctl -u m3u-frontend -n 100 --no-pager
```

### Can't Access Web Interface
```bash
# Check if services are running
sudo systemctl status nginx m3u-backend m3u-frontend

# Check if ports are listening
sudo netstat -tulpn | grep -E ':(80|3000|8001)'

# Check firewall
sudo ufw status
```

### Database Connection Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo journalctl -u mongod -n 100 --no-pager

# Restart MongoDB
sudo systemctl restart mongod
```

### Frontend Build Fails
```bash
# Clear node modules and cache
cd /opt/m3u-panel/frontend
rm -rf node_modules yarn.lock
yarn install
yarn build
```

## Uninstallation

To completely remove the application:

```bash
# Stop and disable services
sudo systemctl stop m3u-backend m3u-frontend
sudo systemctl disable m3u-backend m3u-frontend

# Remove service files
sudo rm /etc/systemd/system/m3u-backend.service
sudo rm /etc/systemd/system/m3u-frontend.service
sudo systemctl daemon-reload

# Remove application files
sudo rm -rf /opt/m3u-panel

# Remove nginx configuration
sudo rm /etc/nginx/sites-enabled/m3u-panel
sudo rm /etc/nginx/sites-available/m3u-panel
sudo systemctl restart nginx

# Optional: Remove MongoDB and data
sudo systemctl stop mongod
sudo apt remove -y mongodb-org
sudo rm -rf /var/lib/mongodb
```

## Support

For issues or questions:
1. Check the logs (see Maintenance Commands above)
2. Verify all services are running
3. Check firewall settings
4. Review nginx configuration

## System Requirements

- **OS:** Ubuntu 24.04 LTS (also works on Ubuntu 22.04, 20.04)
- **RAM:** Minimum 2GB (4GB recommended)
- **Disk:** Minimum 20GB
- **CPU:** 2 cores recommended
- **Network:** Open ports 80 (HTTP) and 443 (HTTPS)

## Architecture

- **Frontend:** React.js with Tailwind CSS and shadcn/ui
- **Backend:** FastAPI (Python)
- **Database:** MongoDB 7.0
- **Web Server:** Nginx
- **Process Manager:** systemd

## Features

- Multi-tenant architecture
- Role-based access control (Super Admin, Tenant Owner, User)
- M3U playlist management with auto-refresh
- Channel search and streaming
- FFmpeg-based stream probing
- Profile image upload
- Scheduled backups (full database and per-tenant)
- Dark/Light theme support
- HLS stream player

## Security Recommendations

1. **Change default credentials** immediately after installation
2. **Enable HTTPS** using Let's Encrypt
3. **Configure firewall** to only allow necessary ports
4. **Regular backups** using the scheduled backup feature
5. **Keep system updated**: `sudo apt update && sudo apt upgrade`
6. **Monitor logs** regularly for suspicious activity
7. **Use strong passwords** for all users

## License

[Your License Here]

## Version

Current Version: 1.0.0
Last Updated: 2025
