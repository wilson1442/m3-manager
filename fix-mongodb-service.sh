#!/bin/bash

# Quick Fix Script for MongoDB Service Name Issue
# Run this if you got "Unit mongodb.service not found" error

echo "=========================================="
echo "M3U Panel - MongoDB Service Fix"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: Please run this script as root or with sudo"
    exit 1
fi

# Get installation directory
read -p "Enter your installation directory [/opt/m3u-panel]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/opt/m3u-panel}

echo "► Fixing backend systemd service..."

# Update the backend service file with correct MongoDB service name
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

echo "✓ Backend service file updated"

# Reload systemd
echo "► Reloading systemd daemon..."
systemctl daemon-reload
echo "✓ Systemd reloaded"

# Check MongoDB status
echo "► Checking MongoDB status..."
if systemctl is-active --quiet mongod; then
    echo "✓ MongoDB is running"
else
    echo "⚠ MongoDB is not running. Starting MongoDB..."
    systemctl start mongod
    systemctl enable mongod
    sleep 3
    if systemctl is-active --quiet mongod; then
        echo "✓ MongoDB started successfully"
    else
        echo "✗ Failed to start MongoDB"
        echo "Check logs: journalctl -u mongod -n 50"
        exit 1
    fi
fi

# Start backend service
echo "► Starting backend service..."
systemctl start m3u-backend
systemctl enable m3u-backend
sleep 5

# Check backend status
if systemctl is-active --quiet m3u-backend; then
    echo "✓ Backend service is running"
else
    echo "✗ Backend service failed to start"
    echo "Checking logs:"
    journalctl -u m3u-backend -n 30 --no-pager
    exit 1
fi

# Start frontend service (if not already running)
echo "► Ensuring frontend service is running..."
if systemctl is-active --quiet m3u-frontend; then
    echo "✓ Frontend service is already running"
else
    echo "► Starting frontend service..."
    systemctl start m3u-frontend
    systemctl enable m3u-frontend
    sleep 5
    if systemctl is-active --quiet m3u-frontend; then
        echo "✓ Frontend service is running"
    else
        echo "✗ Frontend service failed to start"
        journalctl -u m3u-frontend -n 30 --no-pager
    fi
fi

echo ""
echo "=========================================="
echo "Fix Applied Successfully!"
echo "=========================================="
echo ""
echo "Service Status:"
systemctl status m3u-backend m3u-frontend mongod --no-pager | grep -E "(Active|Loaded)"
echo ""
echo "You can now access your M3U Panel"
echo ""
