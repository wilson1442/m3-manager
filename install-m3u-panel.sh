#!/bin/bash

# M3U Management Panel - Installation Script for Ubuntu 24.04
# This script will install and configure the M3U Management Panel on a fresh Ubuntu 24.04 server

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_step() {
    echo -e "${GREEN}► $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ ERROR: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run this script as root or with sudo"
    exit 1
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

print_header "M3U MANAGEMENT PANEL - INSTALLATION SCRIPT"
echo "This script will install and configure the M3U Management Panel"
echo "Estimated installation time: 10-15 minutes"
echo ""
echo "Server IP detected: $SERVER_IP"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Ask for installation directory
print_header "INSTALLATION DIRECTORY"
read -p "Enter installation directory [/opt/m3u-panel]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/opt/m3u-panel}
print_info "Will install to: $INSTALL_DIR"

# Ask for domain or use IP
print_header "DOMAIN CONFIGURATION"
read -p "Enter your domain name (or press Enter to use IP: $SERVER_IP): " DOMAIN
DOMAIN=${DOMAIN:-$SERVER_IP}
print_info "Will use: $DOMAIN"

# Ask for admin credentials
print_header "ADMIN CREDENTIALS"
read -p "Enter admin username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}
read -s -p "Enter admin password [admin123]: " ADMIN_PASS
echo ""
ADMIN_PASS=${ADMIN_PASS:-admin123}
print_success "Credentials configured"

# ============================================
# STEP 1: SYSTEM UPDATE
# ============================================
print_header "STEP 1: UPDATING SYSTEM PACKAGES"
print_step "Running apt update and upgrade..."
apt update -y
apt upgrade -y
print_success "System packages updated"

# ============================================
# STEP 2: INSTALL SYSTEM DEPENDENCIES
# ============================================
print_header "STEP 2: INSTALLING SYSTEM DEPENDENCIES"
print_step "Installing curl, wget, git, build-essential, and ffmpeg..."
apt install -y curl wget git build-essential software-properties-common ffmpeg gnupg nginx
print_success "System dependencies installed"

# ============================================
# STEP 3: INSTALL MONGODB
# ============================================
print_header "STEP 3: INSTALLING MONGODB"
print_step "Adding MongoDB repository..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

print_step "Installing MongoDB 7.0..."
apt update -y
apt install -y mongodb-org

print_step "Starting and enabling MongoDB service..."
systemctl start mongod
systemctl enable mongod
print_success "MongoDB installed and running"

# ============================================
# STEP 4: INSTALL NODE.JS AND YARN
# ============================================
print_header "STEP 4: INSTALLING NODE.JS AND YARN"
print_step "Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

print_step "Installing Yarn package manager..."
npm install -g yarn
print_success "Node.js $(node -v) and Yarn $(yarn -v) installed"

# ============================================
# STEP 5: INSTALL PYTHON AND PIP
# ============================================
print_header "STEP 5: INSTALLING PYTHON 3 AND PIP"
print_step "Installing Python 3 and pip..."
apt install -y python3 python3-pip python3-venv
print_success "Python $(python3 --version) installed"

# ============================================
# STEP 6: CREATE APPLICATION DIRECTORY
# ============================================
print_header "STEP 6: CREATING APPLICATION DIRECTORY"
print_step "Creating directory: $INSTALL_DIR"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR
print_success "Directory created"

# ============================================
# STEP 7: CREATE BACKEND APPLICATION
# ============================================
print_header "STEP 7: SETTING UP BACKEND"
print_step "Creating backend directory and files..."
mkdir -p backend

# Create requirements.txt
cat > backend/requirements.txt << 'EOF'
fastapi==0.110.1
uvicorn==0.25.0
motor==3.3.1
python-dotenv==1.1.1
passlib==1.7.4
bcrypt==4.1.3
PyJWT==2.10.1
aiohttp==3.13.1
apscheduler==3.11.0
python-multipart==0.0.20
EOF

print_step "Installing Python dependencies..."
pip3 install -r backend/requirements.txt
print_success "Python dependencies installed"

# Create .env file
print_step "Creating backend environment configuration..."
cat > backend/.env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=m3u_panel
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=http://localhost:3000,http://$DOMAIN,https://$DOMAIN
EOF
print_success "Backend environment configured"

print_info "Backend will be configured after file extraction..."

# ============================================
# STEP 8: CREATE FRONTEND APPLICATION
# ============================================
print_header "STEP 8: SETTING UP FRONTEND"
print_step "Creating frontend directory..."
mkdir -p frontend

print_info "Frontend will be configured after file extraction..."

# ============================================
# STEP 9: EXTRACT APPLICATION FILES
# ============================================
print_header "STEP 9: APPLICATION FILES"
echo ""
print_error "APPLICATION FILES MISSING"
echo ""
echo "This installation script needs the application source code files."
echo "Please follow these steps:"
echo ""
echo "1. Download or clone the M3U Management Panel source code"
echo "2. Copy the following directories to $INSTALL_DIR:"
echo "   - backend/server.py (and all backend Python files)"
echo "   - frontend/src/ (all React source files)"
echo "   - frontend/public/ (public assets)"
echo "   - frontend/package.json"
echo "   - frontend/tailwind.config.js"
echo "   - frontend/postcss.config.js"
echo ""
echo "3. After copying files, re-run this script or continue manually"
echo ""
read -p "Have you copied the application files? (y/n): " FILES_COPIED

if [ "$FILES_COPIED" != "y" ]; then
    print_info "Installation paused. Copy files and run: $0"
    exit 0
fi

# ============================================
# STEP 10: INSTALL FRONTEND DEPENDENCIES
# ============================================
print_header "STEP 10: INSTALLING FRONTEND DEPENDENCIES"
cd $INSTALL_DIR/frontend

if [ ! -f "package.json" ]; then
    print_error "package.json not found in $INSTALL_DIR/frontend"
    print_info "Please copy frontend files and run: cd $INSTALL_DIR/frontend && yarn install"
    exit 1
fi

print_step "Installing Node.js dependencies with Yarn..."
yarn install
print_success "Frontend dependencies installed"

# Update frontend .env
print_step "Configuring frontend environment..."
cat > .env << EOF
REACT_APP_BACKEND_URL=http://$DOMAIN
WDS_SOCKET_PORT=443
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
EOF
print_success "Frontend environment configured"

# Build frontend
print_step "Building React application (this may take a few minutes)..."
yarn build
print_success "Frontend built successfully"

# ============================================
# STEP 11: CREATE SYSTEMD SERVICES
# ============================================
print_header "STEP 11: CREATING SYSTEMD SERVICES"

# Backend service
print_step "Creating backend systemd service..."
cat > /etc/systemd/system/m3u-backend.service << EOF
[Unit]
Description=M3U Management Panel - Backend API
After=network.target mongodb.service
Requires=mongodb.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (serve build)
print_step "Creating frontend systemd service..."
cat > /etc/systemd/system/m3u-frontend.service << EOF
[Unit]
Description=M3U Management Panel - Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/frontend
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/npx serve -s build -l 3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

print_step "Reloading systemd daemon..."
systemctl daemon-reload
print_success "Systemd services created"

# ============================================
# STEP 12: CONFIGURE NGINX
# ============================================
print_header "STEP 12: CONFIGURING NGINX REVERSE PROXY"
print_step "Creating nginx configuration..."

cat > /etc/nginx/sites-available/m3u-panel << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 100M;
}
EOF

print_step "Enabling site configuration..."
ln -sf /etc/nginx/sites-available/m3u-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

print_step "Testing nginx configuration..."
nginx -t

print_step "Restarting nginx..."
systemctl restart nginx
systemctl enable nginx
print_success "Nginx configured and running"

# ============================================
# STEP 13: CREATE DEFAULT ADMIN USER
# ============================================
print_header "STEP 13: CREATING DEFAULT ADMIN USER"
print_step "Starting backend temporarily to initialize database..."

# Start backend
cd $INSTALL_DIR/backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
sleep 5

print_step "Creating admin user via API..."
curl -X POST http://localhost:8001/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\",\"role\":\"super_admin\"}" \
    > /dev/null 2>&1 || print_info "Admin user may already exist or API not ready"

kill $BACKEND_PID 2>/dev/null || true
sleep 2
print_success "Admin user configured"

# ============================================
# STEP 14: START SERVICES
# ============================================
print_header "STEP 14: STARTING ALL SERVICES"
print_step "Starting backend service..."
systemctl start m3u-backend
systemctl enable m3u-backend
sleep 3

print_step "Starting frontend service..."
systemctl start m3u-frontend
systemctl enable m3u-frontend
sleep 3

# Check service status
print_step "Checking service status..."
if systemctl is-active --quiet m3u-backend; then
    print_success "Backend service is running"
else
    print_error "Backend service failed to start"
    systemctl status m3u-backend --no-pager
fi

if systemctl is-active --quiet m3u-frontend; then
    print_success "Frontend service is running"
else
    print_error "Frontend service failed to start"
    systemctl status m3u-frontend --no-pager
fi

# ============================================
# STEP 15: FIREWALL CONFIGURATION
# ============================================
print_header "STEP 15: CONFIGURING FIREWALL"
print_step "Checking if UFW is installed..."
if command -v ufw &> /dev/null; then
    print_step "Allowing HTTP (port 80) through firewall..."
    ufw allow 80/tcp
    print_step "Allowing HTTPS (port 443) through firewall..."
    ufw allow 443/tcp
    print_success "Firewall rules configured"
else
    print_info "UFW not installed, skipping firewall configuration"
fi

# ============================================
# INSTALLATION COMPLETE
# ============================================
print_header "INSTALLATION COMPLETE!"
echo ""
echo -e "${GREEN}✓ M3U Management Panel has been successfully installed!${NC}"
echo ""
print_header "ACCESS INFORMATION"
echo ""
echo "Web Interface:     http://$DOMAIN"
echo "Admin Username:    $ADMIN_USER"
echo "Admin Password:    $ADMIN_PASS"
echo ""
print_header "SYSTEM INFORMATION"
echo ""
echo "Installation Directory:  $INSTALL_DIR"
echo "Backend Service:         m3u-backend"
echo "Frontend Service:        m3u-frontend"
echo "MongoDB Service:         mongod"
echo "Nginx Service:           nginx"
echo ""
print_header "USEFUL COMMANDS"
echo ""
echo "View Backend Logs:     journalctl -u m3u-backend -f"
echo "View Frontend Logs:    journalctl -u m3u-frontend -f"
echo "Restart Backend:       systemctl restart m3u-backend"
echo "Restart Frontend:      systemctl restart m3u-frontend"
echo "Check Service Status:  systemctl status m3u-backend m3u-frontend"
echo ""
print_header "NEXT STEPS"
echo ""
echo "1. Open your browser and navigate to: http://$DOMAIN"
echo "2. Login with the admin credentials above"
echo "3. Create a tenant and tenant owner"
echo "4. Start adding M3U playlists"
echo ""
echo "Optional: Configure SSL/HTTPS with Let's Encrypt"
echo "Run: apt install certbot python3-certbot-nginx"
echo "Then: certbot --nginx -d $DOMAIN"
echo ""
print_header "SUPPORT & DOCUMENTATION"
echo ""
echo "For issues or questions:"
echo "- Check logs: journalctl -u m3u-backend -n 100"
echo "- Verify services: systemctl status m3u-backend m3u-frontend"
echo "- Restart services: systemctl restart m3u-backend m3u-frontend"
echo ""
print_success "Installation script completed successfully!"
echo ""
