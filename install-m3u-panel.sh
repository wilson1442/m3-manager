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

# Ask about Cloudflare Tunnel
print_header "CLOUDFLARE TUNNEL CONFIGURATION"
read -p "Are you using Cloudflare Tunnel? (y/n): " USE_CLOUDFLARE
USE_CLOUDFLARE=${USE_CLOUDFLARE:-n}

CLOUDFLARE_URL=""
if [ "$USE_CLOUDFLARE" = "y" ]; then
    read -p "Enter your Cloudflare Tunnel URL (e.g., https://app.example.com): " CLOUDFLARE_URL
    if [ -z "$CLOUDFLARE_URL" ]; then
        print_error "Cloudflare URL cannot be empty"
        exit 1
    fi
    print_info "Cloudflare Tunnel URL: $CLOUDFLARE_URL"
    print_info "Note: Make sure your Cloudflare tunnel routes /api/* to localhost:8001 and / to localhost:3000"
fi

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
apt install -y curl wget git build-essential software-properties-common ffmpeg gnupg nginx python3-venv python3-full
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
# STEP 5: CREATE APPLICATION DIRECTORY
# ============================================
print_header "STEP 5: CREATING APPLICATION DIRECTORY"
print_step "Creating directory: $INSTALL_DIR"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR
print_success "Directory created"

# ============================================
# STEP 6: DOWNLOAD APPLICATION FILES
# ============================================
print_header "STEP 6: DOWNLOADING APPLICATION FILES"
print_info "This script assumes you have the application files ready."
print_info "Please provide the application files in one of these ways:"
echo ""
echo "Option 1: Place files in $INSTALL_DIR before running this script"
echo "Option 2: Provide a Git repository URL"
echo "Option 3: Exit now and manually copy files, then re-run this script"
echo ""
read -p "Do you have a Git repository URL? (y/n): " HAS_GIT_REPO

if [ "$HAS_GIT_REPO" = "y" ]; then
    read -p "Enter Git repository URL: " GIT_REPO_URL
    print_step "Cloning repository..."
    if [ -d "backend" ] || [ -d "frontend" ]; then
        print_error "Backend or frontend directory already exists. Please remove them first."
        exit 1
    fi
    git clone "$GIT_REPO_URL" temp_clone
    mv temp_clone/* .
    mv temp_clone/.* . 2>/dev/null || true
    rm -rf temp_clone
    print_success "Repository cloned"
else
    # Check if files exist
    if [ ! -d "backend" ] || [ ! -f "backend/server.py" ]; then
        print_error "Backend files not found!"
        echo ""
        echo "Please copy your application files to $INSTALL_DIR with this structure:"
        echo "  $INSTALL_DIR/backend/server.py"
        echo "  $INSTALL_DIR/backend/requirements.txt"
        echo "  $INSTALL_DIR/frontend/package.json"
        echo "  $INSTALL_DIR/frontend/src/"
        echo "  $INSTALL_DIR/frontend/public/"
        echo ""
        echo "After copying files, run this script again."
        exit 1
    fi
    print_success "Application files found"
fi

# ============================================
# STEP 7: SETUP BACKEND WITH VIRTUAL ENVIRONMENT
# ============================================
print_header "STEP 7: SETTING UP BACKEND WITH VIRTUAL ENVIRONMENT"
cd $INSTALL_DIR/backend

# Create virtual environment
print_step "Creating Python virtual environment..."
python3 -m venv venv
print_success "Virtual environment created"

# Activate venv and install dependencies
print_step "Installing Python dependencies in virtual environment..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
print_success "Python dependencies installed in virtual environment"

# Create .env file
print_step "Creating backend environment configuration..."
if [ "$USE_CLOUDFLARE" = "y" ]; then
    CORS_ORIGINS="http://localhost:3000,http://$DOMAIN,https://$DOMAIN,$CLOUDFLARE_URL"
else
    CORS_ORIGINS="http://localhost:3000,http://$DOMAIN,https://$DOMAIN"
fi

cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=m3u_panel
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=$CORS_ORIGINS
EOF
print_success "Backend environment configured"

# ============================================
# STEP 8: SETUP FRONTEND
# ============================================
print_header "STEP 8: SETTING UP FRONTEND"
cd $INSTALL_DIR/frontend

if [ ! -f "package.json" ]; then
    print_error "package.json not found in $INSTALL_DIR/frontend"
    exit 1
fi

print_step "Installing Node.js dependencies with Yarn..."
yarn install
print_success "Frontend dependencies installed"

# Update frontend .env
print_step "Configuring frontend environment..."
if [ "$USE_CLOUDFLARE" = "y" ]; then
    BACKEND_URL="$CLOUDFLARE_URL"
else
    BACKEND_URL="http://$DOMAIN"
fi

cat > .env << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
WDS_SOCKET_PORT=443
REACT_APP_ENABLE_VISUAL_EDITS=false
ENABLE_HEALTH_CHECK=false
EOF
print_success "Frontend environment configured (Backend URL: $BACKEND_URL)"

# Build frontend
print_step "Building React application (this may take a few minutes)..."
yarn build
print_success "Frontend built successfully"

# ============================================
# STEP 9: CREATE SYSTEMD SERVICES
# ============================================
print_header "STEP 9: CREATING SYSTEMD SERVICES"

# Backend service
print_step "Creating backend systemd service..."
cat > /etc/systemd/system/m3u-backend.service << EOF
[Unit]
Description=M3U Management Panel - Backend API
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/backend
Environment="PATH=$INSTALL_DIR/backend/venv/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=$INSTALL_DIR/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (serve build with npx serve)
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
# STEP 10: CONFIGURE NGINX
# ============================================
print_header "STEP 10: CONFIGURING NGINX REVERSE PROXY"
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
# STEP 11: START SERVICES
# ============================================
print_header "STEP 11: STARTING ALL SERVICES"

# Verify MongoDB is running first
print_step "Verifying MongoDB is running..."
if systemctl is-active --quiet mongod; then
    print_success "MongoDB is running"
else
    print_error "MongoDB is not running. Attempting to start..."
    systemctl start mongod
    sleep 3
    if systemctl is-active --quiet mongod; then
        print_success "MongoDB started successfully"
    else
        print_error "Failed to start MongoDB. Check logs: journalctl -u mongod -n 50"
        exit 1
    fi
fi

print_step "Starting backend service..."
systemctl start m3u-backend
systemctl enable m3u-backend
sleep 5

print_step "Starting frontend service..."
systemctl start m3u-frontend
systemctl enable m3u-frontend
sleep 5

# Check service status
print_step "Checking service status..."
if systemctl is-active --quiet m3u-backend; then
    print_success "Backend service is running"
else
    print_error "Backend service failed to start"
    echo "Checking logs:"
    journalctl -u m3u-backend -n 20 --no-pager
fi

if systemctl is-active --quiet m3u-frontend; then
    print_success "Frontend service is running"
else
    print_error "Frontend service failed to start"
    echo "Checking logs:"
    journalctl -u m3u-frontend -n 20 --no-pager
fi

# ============================================
# STEP 12: CREATE DEFAULT ADMIN USER
# ============================================
print_header "STEP 12: CREATING DEFAULT ADMIN USER"
print_step "Waiting for backend to be fully ready..."
sleep 10

print_step "Creating admin user via API..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\",\"role\":\"super_admin\"}")

if echo "$REGISTER_RESPONSE" | grep -q "access_token"; then
    print_success "Admin user created successfully"
elif echo "$REGISTER_RESPONSE" | grep -q "already exists"; then
    print_info "Admin user already exists"
else
    print_info "Admin user creation status unknown - check manually"
fi

# ============================================
# STEP 13: FIREWALL CONFIGURATION
# ============================================
print_header "STEP 13: CONFIGURING FIREWALL"
print_step "Checking if UFW is installed..."
if command -v ufw &> /dev/null; then
    print_step "Allowing HTTP (port 80) through firewall..."
    ufw allow 80/tcp
    print_step "Allowing HTTPS (port 443) through firewall..."
    ufw allow 443/tcp
    print_step "Allowing SSH (port 22) through firewall..."
    ufw allow 22/tcp
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
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$USE_CLOUDFLARE" = "y" ]; then
    echo "Web Interface:     $CLOUDFLARE_URL"
    echo "Local Access:      http://$DOMAIN"
else
    echo "Web Interface:     http://$DOMAIN"
fi
echo "Admin Username:    $ADMIN_USER"
echo "Admin Password:    $ADMIN_PASS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_header "SYSTEM INFORMATION"
echo ""
echo "Installation Directory:  $INSTALL_DIR"
echo "Backend Service:         m3u-backend"
echo "Frontend Service:        m3u-frontend"
echo "MongoDB Service:         mongod"
echo "Nginx Service:           nginx"
echo ""
if [ "$USE_CLOUDFLARE" = "y" ]; then
    echo "Cloudflare Tunnel:       CONFIGURED"
    echo "Cloudflare URL:          $CLOUDFLARE_URL"
    echo "Backend URL (Frontend):  $CLOUDFLARE_URL"
    echo "CORS Origins:            $CORS_ORIGINS"
    echo ""
fi
echo "Python Virtual Environment: $INSTALL_DIR/backend/venv"
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
if [ "$USE_CLOUDFLARE" = "y" ]; then
    echo "CLOUDFLARE TUNNEL SETUP:"
    echo "1. Ensure your Cloudflare tunnel is running"
    echo "2. Configure tunnel to route:"
    echo "   - /api/* → http://localhost:8001 (backend)"
    echo "   - /* → http://localhost:3000 (frontend)"
    echo ""
    echo "Example Cloudflare config.yml:"
    echo "ingress:"
    echo "  - hostname: $(echo $CLOUDFLARE_URL | sed 's|https\?://||')"
    echo "    path: /api/*"
    echo "    service: http://localhost:8001"
    echo "  - hostname: $(echo $CLOUDFLARE_URL | sed 's|https\?://||')"
    echo "    service: http://localhost:3000"
    echo "  - service: http_status:404"
    echo ""
    echo "3. Open your browser and navigate to: $CLOUDFLARE_URL"
else
    echo "1. Open your browser and navigate to: http://$DOMAIN"
fi
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
echo "Backend Python environment:"
echo "- Activate venv: source $INSTALL_DIR/backend/venv/bin/activate"
echo "- Install packages: $INSTALL_DIR/backend/venv/bin/pip install package_name"
echo ""
print_success "Installation script completed successfully!"
echo ""
