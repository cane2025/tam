#!/bin/bash

# ⚙️ Systemd Services Setup Script
# Installs and configures systemd services for Ungdomsstöd V2

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
fi

log "Setting up systemd services for Ungdomsstöd V2"

# Create application directory
APP_DIR="/var/www/ungdomsstod"
log "Creating application directory: $APP_DIR"
mkdir -p "$APP_DIR"
chown -R www-data:www-data "$APP_DIR"

# Create log directory
LOG_DIR="/var/log/ungdomsstod"
log "Creating log directory: $LOG_DIR"
mkdir -p "$LOG_DIR"
chown -R www-data:www-data "$LOG_DIR"

# Create environment file
ENV_FILE="/etc/ungdomsstod/env"
log "Creating environment file: $ENV_FILE"
mkdir -p "$(dirname "$ENV_FILE")"

# Copy service files
log "Installing systemd service files"
cp scripts/ungdomsstod-api.service /etc/systemd/system/
cp scripts/ungdomsstod-frontend.service /etc/systemd/system/

# Reload systemd
log "Reloading systemd daemon"
systemctl daemon-reload

# Enable services
log "Enabling services"
systemctl enable ungdomsstod-api
systemctl enable ungdomsstod-frontend

success "Systemd services installed and enabled"

echo
echo "📋 Next steps:"
echo "1. Copy your application files to $APP_DIR"
echo "2. Create environment file at $ENV_FILE with your configuration:"
echo "   NODE_ENV=production"
echo "   JWT_SECRET=your-secret-key"
echo "   CLIENT_URL=https://your-domain.com"
echo "   DATABASE_URL=your-database-url"
echo "3. Start services:"
echo "   sudo systemctl start ungdomsstod-api"
echo "   sudo systemctl start ungdomsstod-frontend"
echo "4. Check status:"
echo "   sudo systemctl status ungdomsstod-api"
echo "   sudo systemctl status ungdomsstod-frontend"
echo
echo "📊 Useful commands:"
echo "   sudo systemctl restart ungdomsstod-api"
echo "   sudo systemctl stop ungdomsstod-api"
echo "   sudo journalctl -u ungdomsstod-api -f"
echo "   sudo journalctl -u ungdomsstod-frontend -f"
