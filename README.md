# M3U Manager

**Version 1.0.0**

A powerful multi-tenant IPTV playlist management system with advanced features for managing, monitoring, and streaming M3U playlists.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Node](https://img.shields.io/badge/node-20.x-brightgreen.svg)
![Python](https://img.shields.io/badge/python-3.x-blue.svg)

---

## 🌟 Features

### Multi-Tenant Architecture
- **Super Admin**: Manage all tenants, users, and system settings
- **Tenant Owner**: Manage users and content within their tenant
- **User**: Access and stream content from their assigned tenant

### M3U Playlist Management
- ✅ Add playlists from URLs
- ✅ Auto-refresh every hour
- ✅ Manual refresh option
- ✅ Player API integration for account monitoring (max connections, expiration dates)
- ✅ Export selected channels to M3U

### Channel Features
- ✅ Search across all playlists
- ✅ FFmpeg-based stream probing (detailed metadata)
- ✅ HLS player for in-browser streaming
- ✅ Stream quality and codec information
- ✅ Online/offline status detection

### Category Management
- ✅ View all categories from playlists
- ✅ Monitor specific categories
- ✅ Event tracking for monitored categories
- ✅ Export channels by category

### Administration & Backup
- ✅ Full database backup & restore
- ✅ Per-tenant backup & restore
- ✅ Scheduled backups (daily/weekly)
- ✅ Configurable retention policies
- ✅ System update management (pull from GitHub)
- ✅ User profile images (PNG, 2MB max)

### User Experience
- ✅ Dark/Light theme support
- ✅ Responsive design
- ✅ User-friendly interface
- ✅ Real-time status indicators

---

## 📦 Installation

### Quick Install (Ubuntu 24.04)

```bash
# Download the installer
wget https://raw.githubusercontent.com/wilson1442/m3-manager/main/install-m3u-panel.sh

# Make executable
chmod +x install-m3u-panel.sh

# Run installer
sudo ./install-m3u-panel.sh
```

The installer will prompt you for:
- Installation directory (default: `/opt/m3u-panel`)
- Domain name or IP address
- **Cloudflare Tunnel configuration** (optional)
- Admin username and password

### Cloudflare Tunnel Support

The installer now supports Cloudflare Tunnel out of the box:

1. When prompted, answer "yes" to using Cloudflare Tunnel
2. Enter your Cloudflare tunnel URL (e.g., `https://app.example.com`)
3. The installer automatically configures:
   - Backend CORS for Cloudflare domain
   - Frontend to use Cloudflare URL
   - Proper routing instructions

**Example Cloudflare Tunnel Config:**
```yaml
tunnel: your-tunnel-id
credentials-file: ~/.cloudflared/credentials.json

ingress:
  - hostname: app.example.com
    path: /api/*
    service: http://localhost:8001
  - hostname: app.example.com
    service: http://localhost:3000
  - service: http_status:404
```

For detailed installation instructions, see [INSTALLATION.md](INSTALLATION.md)

---

## 🚀 Quick Start

### Default Credentials
- **Username**: `admin`
- **Password**: `admin123` (or what you set during installation)

### First Steps
1. Login to the panel
2. **Settings → System Updates**: Configure your GitHub repository URLs
3. Create your first tenant
4. Add a tenant owner
5. Add M3U playlists
6. Start streaming!

---

## 🔄 Updating Your Installation

### Using Web Interface (Recommended)
1. Navigate to **Settings → System Updates**
2. Configure repository URLs (one-time setup)
3. Click **Pull Production Updates** or **Pull Beta Updates**
4. Click **Deploy Changes** to apply updates
5. Page will reload automatically

### Manual Update
```bash
cd /opt/m3u-panel
sudo ./update.sh
```

See [Update Guide](INSTALLATION.md#update-process) for details.

---

## 🏗️ Architecture

- **Frontend**: React.js with Tailwind CSS and shadcn/ui components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB 7.0
- **Web Server**: Nginx (reverse proxy)
- **Process Manager**: systemd
- **Stream Analysis**: FFmpeg
- **Media Playback**: HLS.js

---

## 📋 System Requirements

- **OS**: Ubuntu 24.04 LTS (also compatible with 22.04, 20.04)
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk**: Minimum 20GB
- **CPU**: 2 cores recommended
- **Network**: Ports 80 (HTTP) and 443 (HTTPS)

---

## 🔧 Configuration

### Environment Variables

**Backend** (`/opt/m3u-panel/backend/.env`):
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=m3u_panel
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
```

**Frontend** (`/opt/m3u-panel/frontend/.env`):
```env
REACT_APP_BACKEND_URL=https://your-domain.com
WDS_SOCKET_PORT=443
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
```

---

## 🛠️ Management Commands

### Service Control
```bash
# Restart services
sudo systemctl restart m3u-backend m3u-frontend

# Check status
sudo systemctl status m3u-backend m3u-frontend

# View logs
sudo journalctl -u m3u-backend -f
sudo journalctl -u m3u-frontend -f
```

### Database Backup
```bash
# Manual backup
sudo mongodump --db m3u_panel --out /backup/$(date +%Y%m%d)

# Or use the built-in backup feature in Settings
```

---

## 📖 Documentation

- [Installation Guide](INSTALLATION.md) - Detailed installation instructions
- [Quick Start Guide](QUICKSTART.md) - Fast setup and common commands
- [Troubleshooting](#troubleshooting) - Common issues and solutions

---

## 🔐 Security

### Recommendations
1. Change default admin password immediately
2. Enable HTTPS using Let's Encrypt
3. Configure firewall (UFW) to only allow necessary ports
4. Use scheduled backups
5. Keep system updated: `sudo apt update && sudo apt upgrade`
6. Use strong passwords for all users

### Enable HTTPS
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 🐛 Troubleshooting

### Services Won't Start
```bash
sudo systemctl status m3u-backend --no-pager -l
sudo journalctl -u m3u-backend -n 50
```

### Can't Access Web Interface
```bash
# Check services
sudo systemctl status nginx m3u-backend m3u-frontend

# Check firewall
sudo ufw status
sudo ufw allow 80/tcp
```

### Database Issues
```bash
sudo systemctl restart mongod
sudo journalctl -u mongod -n 50
```

### Cloudflare Tunnel Login Issues
If you can access locally but not through Cloudflare:
1. Verify `REACT_APP_BACKEND_URL` in frontend .env matches Cloudflare URL
2. Rebuild frontend: `cd /opt/m3u-panel/frontend && sudo yarn build`
3. Restart services: `sudo systemctl restart m3u-frontend`

---

## 📝 Version History

### Version 1.0.0 (Current) - January 2025

**Initial Release**

**Core Features:**
- Multi-tenant architecture with role-based access control
- M3U playlist management with auto-refresh
- Channel search and streaming capabilities
- FFmpeg-based stream probing
- HLS player for in-browser playback
- Profile image uploads (PNG, 2MB max)
- Dark/Light theme support

**Administration:**
- Full database and per-tenant backup/restore
- Scheduled backups with retention policies
- System update management (GitHub integration)
- User management with tenant assignment

**User Experience:**
- Create user + tenant in one action
- Responsive design
- Comprehensive settings page
- Version display in sidebar

**Infrastructure:**
- Cloudflare Tunnel support in installer
- Virtual environment for Python dependencies
- Systemd service integration
- Nginx reverse proxy configuration
- MongoDB 7.0 with proper serialization

**Bug Fixes:**
- Fixed dropdown transparent backgrounds
- Fixed MongoDB service name in systemd
- Fixed CORS configuration for Cloudflare
- Fixed HLS player initialization and error handling
- Fixed CSS variable interpretation (HSL vs RGB)
- Fixed nested JSON parsing for Player API

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup
```bash
# Clone repository
git clone https://github.com/wilson1442/m3-manager.git
cd m3-manager

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
yarn install
yarn start
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Video playback via [HLS.js](https://github.com/video-dev/hls.js/)

---

## 📞 Support

For issues, questions, or feature requests:
- Open an issue on [GitHub](https://github.com/wilson1442/m3-manager/issues)
- Check the [Documentation](INSTALLATION.md)
- Review [Common Issues](#troubleshooting)

---

## 🗺️ Roadmap

Future planned features:
- [ ] EPG (Electronic Program Guide) support
- [ ] Advanced playlist editor
- [ ] Advanced analytics and usage statistics
- [ ] API key management for external access
- [ ] Webhook notifications
- [ ] Custom branding per tenant

---

**Made with ❤️ for the IPTV community**

⭐ Star this repo if you find it useful!
