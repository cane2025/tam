#!/bin/bash

# 🔄 Database Backup Script for Ungdomsstöd V2
# Creates comprehensive backups of database and configuration

set -e

# Configuration
BACKUP_DIR="/var/backups/ungdomsstod"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="backup-$TIMESTAMP"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Create backup directory
mkdir -p "$BACKUP_PATH"

log "Creating backup: $BACKUP_NAME"

# Backup database
if [[ -f "data/ungdomsstod.db" ]]; then
    cp "data/ungdomsstod.db" "$BACKUP_PATH/"
    log "Database backed up"
else
    log "No database file found"
fi

# Backup environment variables
env | grep -E "^(NODE_ENV|JWT_SECRET|CLIENT_URL|DATABASE_URL)" > "$BACKUP_PATH/env.backup" 2>/dev/null || true

# Create backup manifest
cat > "$BACKUP_PATH/manifest.txt" << EOF
Backup created: $(date)
Git commit: $(git rev-parse HEAD 2>/dev/null || echo "N/A")
Git branch: $(git branch --show-current 2>/dev/null || echo "N/A")
Node version: $(node --version 2>/dev/null || echo "N/A")
NPM version: $(npm --version 2>/dev/null || echo "N/A")
Database size: $(du -h data/ungdomsstod.db 2>/dev/null | cut -f1 || echo "N/A")
EOF

success "Backup created: $BACKUP_PATH"
echo "$BACKUP_PATH"
