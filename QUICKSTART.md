# M3U Management Panel - Quick Start Guide

## 🚀 Quick Installation (Ubuntu 24.04)

### Step 1: Download the Installer
```bash
wget https://raw.githubusercontent.com/YOUR_REPO/install-m3u-panel.sh
# OR copy the install-m3u-panel.sh file to your server
```

### Step 2: Run the Installer
```bash
chmod +x install-m3u-panel.sh
sudo ./install-m3u-panel.sh
```

### Step 3: Follow the Prompts
The installer will ask for:
- Installation directory (default: `/opt/m3u-panel`)
- Domain name or IP address
- Admin username (default: `admin`)
- Admin password (default: `admin123`)

### Step 4: Wait for Installation
The script will automatically:
- ✓ Update system packages
- ✓ Install MongoDB 7.0
- ✓ Install Node.js 20.x and Yarn
- ✓ Install Python 3 and dependencies
- ✓ Install FFmpeg for stream probing
- ✓ Configure Nginx reverse proxy
- ✓ Create systemd services
- ✓ Set up firewall rules
- ✓ Create admin user

Installation typically takes 10-15 minutes.

### Step 5: Access Your Panel
Open your browser:
```
http://YOUR_DOMAIN_OR_IP
```

Login with your admin credentials!

---

## 📋 What Gets Installed

| Component | Version | Purpose |
|-----------|---------|---------|
| MongoDB | 7.0 | Database |
| Node.js | 20.x | Frontend runtime |
| Python | 3.x | Backend runtime |
| Nginx | Latest | Web server / reverse proxy |
| FFmpeg | Latest | Stream probing |
| Yarn | Latest | Package manager |

---

## 🔧 Post-Installation Tasks

### 1. Change Admin Password
```
Profile → Change Password
```

### 2. Create Your First Tenant
```
Tenants → Add New Tenant
```

### 3. Add M3U Playlist
```
M3U Playlists → Add Playlist
```

### 4. Configure Scheduled Backups
```
Settings → Scheduled Backups → New Schedule
```

### 5. Enable HTTPS (Recommended)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

---

## 🛠️ Useful Commands

### Check Service Status
```bash
sudo systemctl status m3u-backend m3u-frontend
```

### View Logs
```bash
# Backend logs
sudo journalctl -u m3u-backend -f

# Frontend logs
sudo journalctl -u m3u-frontend -f
```

### Restart Services
```bash
sudo systemctl restart m3u-backend m3u-frontend
```

### Check MongoDB
```bash
sudo systemctl status mongod
```

---

## 🆘 Troubleshooting

### Services Won't Start
```bash
# Check detailed status
sudo systemctl status m3u-backend --no-pager -l

# View recent logs
sudo journalctl -u m3u-backend -n 50
```

### Can't Access Web Interface
1. Check if services are running:
   ```bash
   sudo systemctl status nginx m3u-backend m3u-frontend
   ```

2. Check firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   ```

3. Verify nginx configuration:
   ```bash
   sudo nginx -t
   ```

### Database Issues
```bash
# Restart MongoDB
sudo systemctl restart mongod

# Check MongoDB status
sudo systemctl status mongod
```

---

## 🔐 Security Checklist

- [ ] Changed default admin password
- [ ] Enabled HTTPS with SSL certificate
- [ ] Configured firewall (UFW)
- [ ] Set up scheduled backups
- [ ] Updated all system packages
- [ ] Configured strong passwords for all users
- [ ] Enabled MongoDB authentication (optional but recommended)

---

## 📁 File Locations

| Item | Location |
|------|----------|
| Application | `/opt/m3u-panel/` |
| Backend Code | `/opt/m3u-panel/backend/` |
| Frontend Code | `/opt/m3u-panel/frontend/` |
| Backups | `/opt/m3u-panel/backend/backups/` |
| Backend Logs | `journalctl -u m3u-backend` |
| Frontend Logs | `journalctl -u m3u-frontend` |
| Nginx Config | `/etc/nginx/sites-available/m3u-panel` |
| Service Files | `/etc/systemd/system/m3u-*.service` |

---

## 🔄 Update Process

```bash
# Stop services
sudo systemctl stop m3u-backend m3u-frontend

# Backup current installation
sudo cp -r /opt/m3u-panel /opt/m3u-panel.backup

# Update files (copy new version)
# ... copy updated files ...

# Rebuild frontend
cd /opt/m3u-panel/frontend
yarn install
yarn build

# Restart services
sudo systemctl start m3u-backend m3u-frontend
```

---

## 💾 Backup & Restore

### Manual Backup
Use the Settings page:
```
Settings → Backup & Restore → Download Backup
```

### Scheduled Backups
Configure automatic backups:
```
Settings → Scheduled Backups → New Schedule
- Frequency: Daily or Weekly
- Retention: Number of days to keep backups
- Type: Full database or per-tenant
```

### MongoDB Manual Backup
```bash
sudo mongodump --db m3u_panel --out /backup/$(date +%Y%m%d)
```

---

## 📞 Support

### Check Logs First
```bash
# All service statuses
sudo systemctl status m3u-backend m3u-frontend nginx mongod

# Recent backend errors
sudo journalctl -u m3u-backend -n 100 --no-pager | grep -i error

# Nginx errors
sudo tail -n 50 /var/log/nginx/error.log
```

### Common Issues

**Issue:** Frontend shows "Connection Failed"
**Solution:** Check if backend is running and REACT_APP_BACKEND_URL is correct

**Issue:** "User must belong to a tenant" error
**Solution:** Super admin can't search channels. Create a tenant owner or regular user.

**Issue:** Streams won't play
**Solution:** Check FFmpeg probe first. Some streams require external players (VLC, Kodi).

---

## 🎯 Next Steps

1. ✓ Install the application
2. ✓ Login as admin
3. ➜ Create a tenant
4. ➜ Create a tenant owner
5. ➜ Add M3U playlists
6. ➜ Search and manage channels
7. ➜ Configure scheduled backups
8. ➜ Set up HTTPS

---

## 📊 Features Overview

### Multi-Tenant Support
- Super Admin: Manages all tenants and users
- Tenant Owner: Manages users and content within their tenant
- User: Views and streams content from their tenant

### M3U Management
- Add playlists from URLs
- Auto-refresh hourly
- Manual refresh option
- Player API integration for account monitoring

### Channel Features
- Search across all playlists
- FFmpeg stream probing (detailed metadata)
- HLS player for in-browser streaming
- Export selected channels to M3U

### Administration
- Backup & restore (full or per-tenant)
- Scheduled backups with retention policies
- User profile image uploads
- Dark/Light theme support

---

## ✅ Verification Checklist

After installation, verify:

- [ ] Can access web interface
- [ ] Can login with admin credentials
- [ ] Backend service is running
- [ ] Frontend service is running
- [ ] MongoDB is running
- [ ] Nginx is running
- [ ] Can create a tenant
- [ ] Can create a user
- [ ] Can add an M3U playlist

If all items are checked, your installation is successful! 🎉

---

For detailed documentation, see `INSTALLATION.md`
