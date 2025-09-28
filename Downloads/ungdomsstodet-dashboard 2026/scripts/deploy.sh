#!/bin/bash

# 🚀 Ungdomsstöd V2 - Automated Deployment Script
# Version: 1.0
# Date: 2025-09-27

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ungdomsstod-v2"
BACKUP_DIR="/var/backups/ungdomsstod"
LOG_DIR="/var/log/ungdomsstod"
DEPLOYMENT_LOG="$LOG_DIR/deployment-$(date +%Y%m%d-%H%M%S).log"

# Functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}❌ $1${NC}" | tee -a "$DEPLOYMENT_LOG"
    exit 1
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        warning "Running as root. Consider using a dedicated deployment user."
    fi
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    sudo mkdir -p "$BACKUP_DIR" "$LOG_DIR"
    sudo chown -R $(whoami):$(whoami) "$BACKUP_DIR" "$LOG_DIR"
    success "Directories created"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        error "package.json not found. Are you in the project root?"
    fi
    
    # Check if git is clean
    if [[ -n $(git status --porcelain) ]]; then
        warning "Working directory is not clean. Uncommitted changes detected."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled"
        fi
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    log "Node.js version: $NODE_VERSION"
    
    # Check if required environment variables are set
    if [[ -z "$NODE_ENV" ]]; then
        export NODE_ENV="production"
        log "NODE_ENV set to production"
    fi
    
    if [[ -z "$JWT_SECRET" ]]; then
        error "JWT_SECRET environment variable is required"
    fi
    
    if [[ -z "$CLIENT_URL" ]]; then
        error "CLIENT_URL environment variable is required"
    fi
    
    success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    # Create backup directory
    mkdir -p "$BACKUP_PATH"
    
    # Backup database
    if [[ -f "data/ungdomsstod.db" ]]; then
        cp "data/ungdomsstod.db" "$BACKUP_PATH/"
        log "Database backed up"
    fi
    
    # Backup current code
    git archive --format=tar.gz --output="$BACKUP_PATH/code.tar.gz" HEAD
    log "Code backed up"
    
    # Backup environment variables
    env | grep -E "^(NODE_ENV|JWT_SECRET|CLIENT_URL|DATABASE_URL)" > "$BACKUP_PATH/env.backup"
    log "Environment variables backed up"
    
    # Create backup manifest
    cat > "$BACKUP_PATH/manifest.txt" << EOF
Backup created: $(date)
Git commit: $(git rev-parse HEAD)
Git branch: $(git branch --show-current)
Node version: $(node --version)
NPM version: $(npm --version)
EOF
    
    success "Backup created: $BACKUP_PATH"
    echo "$BACKUP_PATH" > "$BACKUP_DIR/latest"
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    # Stop API service
    if systemctl is-active --quiet ungdomsstod-api 2>/dev/null; then
        sudo systemctl stop ungdomsstod-api
        log "API service stopped"
    fi
    
    # Stop frontend service
    if systemctl is-active --quiet ungdomsstod-frontend 2>/dev/null; then
        sudo systemctl stop ungdomsstod-frontend
        log "Frontend service stopped"
    fi
    
    success "Services stopped"
}

# Update code
update_code() {
    log "Updating code..."
    
    # Pull latest changes
    git fetch origin
    git checkout main
    git pull origin main
    
    # Get current commit hash
    COMMIT_HASH=$(git rev-parse HEAD)
    log "Deploying commit: $COMMIT_HASH"
    
    success "Code updated"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install production dependencies
    npm ci --production --silent
    
    # Build frontend
    log "Building frontend..."
    npm run build
    
    # Build backend
    log "Building backend..."
    npm run build:api
    
    success "Dependencies installed and built"
}

# Database migration
run_migrations() {
    log "Running database migrations..."
    
    # Run migrations
    npm run db:migrate
    
    # Verify database
    if [[ -f "scripts/verify-db.sh" ]]; then
        ./scripts/verify-db.sh
    fi
    
    success "Database migrations completed"
}

# Security validation
run_security_tests() {
    log "Running security tests..."
    
    # Run security check script
    if [[ -f "scripts/quick-security-check.ts" ]]; then
        npx tsx scripts/quick-security-check.ts
    else
        warning "Security check script not found, skipping..."
    fi
    
    success "Security tests completed"
}

# Start services
start_services() {
    log "Starting services..."
    
    # Start API service
    if systemctl is-enabled --quiet ungdomsstod-api 2>/dev/null; then
        sudo systemctl start ungdomsstod-api
        log "API service started"
    else
        warning "API service not configured as systemd service"
    fi
    
    # Start frontend service
    if systemctl is-enabled --quiet ungdomsstod-frontend 2>/dev/null; then
        sudo systemctl start ungdomsstod-frontend
        log "Frontend service started"
    else
        warning "Frontend service not configured as systemd service"
    fi
    
    success "Services started"
}

# Health checks
run_health_checks() {
    log "Running health checks..."
    
    # Wait for services to start
    sleep 10
    
    # Check API health
    if [[ -n "$CLIENT_URL" ]]; then
        API_URL="${CLIENT_URL/api/}"
        if curl -f -s "$API_URL/api/health" > /dev/null; then
            success "API health check passed"
        else
            error "API health check failed"
        fi
    else
        warning "CLIENT_URL not set, skipping API health check"
    fi
    
    # Check if services are running
    if systemctl is-active --quiet ungdomsstod-api 2>/dev/null; then
        success "API service is running"
    else
        error "API service is not running"
    fi
    
    if systemctl is-active --quiet ungdomsstod-frontend 2>/dev/null; then
        success "Frontend service is running"
    else
        error "Frontend service is not running"
    fi
    
    success "Health checks passed"
}

# Post-deployment tasks
post_deployment_tasks() {
    log "Running post-deployment tasks..."
    
    # Update deployment log
    cat >> "$LOG_DIR/deployments.log" << EOF
$(date): Deployment successful
Commit: $(git rev-parse HEAD)
Branch: $(git branch --show-current)
Backup: $(cat "$BACKUP_DIR/latest" 2>/dev/null || echo "N/A")
EOF
    
    # Clean up old backups (keep last 7 days)
    find "$BACKUP_DIR" -name "backup-*" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
    
    # Clean up old logs (keep last 30 days)
    find "$LOG_DIR" -name "deployment-*.log" -mtime +30 -delete 2>/dev/null || true
    
    success "Post-deployment tasks completed"
}

# Rollback function
rollback() {
    error "Deployment failed. Starting rollback..."
    
    if [[ -f "$BACKUP_DIR/latest" ]]; then
        BACKUP_PATH=$(cat "$BACKUP_DIR/latest")
        log "Rolling back to: $BACKUP_PATH"
        
        # Stop services
        stop_services
        
        # Restore code
        if [[ -f "$BACKUP_PATH/code.tar.gz" ]]; then
            tar -xzf "$BACKUP_PATH/code.tar.gz"
            log "Code restored"
        fi
        
        # Restore database
        if [[ -f "$BACKUP_PATH/ungdomsstod.db" ]]; then
            cp "$BACKUP_PATH/ungdomsstod.db" "data/"
            log "Database restored"
        fi
        
        # Restore environment variables
        if [[ -f "$BACKUP_PATH/env.backup" ]]; then
            source "$BACKUP_PATH/env.backup"
            log "Environment variables restored"
        fi
        
        # Start services
        start_services
        
        # Run health checks
        run_health_checks
        
        success "Rollback completed successfully"
    else
        error "No backup found for rollback"
    fi
}

# Main deployment function
main() {
    log "Starting deployment of $PROJECT_NAME"
    log "Deployment log: $DEPLOYMENT_LOG"
    
    # Set up error handling
    trap rollback ERR
    
    # Run deployment steps
    check_permissions
    setup_directories
    pre_deployment_checks
    create_backup
    stop_services
    update_code
    install_dependencies
    run_migrations
    run_security_tests
    start_services
    run_health_checks
    post_deployment_tasks
    
    success "Deployment completed successfully!"
    log "Deployment log saved to: $DEPLOYMENT_LOG"
    
    # Display deployment summary
    echo
    echo "🎉 Deployment Summary:"
    echo "====================="
    echo "Project: $PROJECT_NAME"
    echo "Commit: $(git rev-parse HEAD)"
    echo "Branch: $(git branch --show-current)"
    echo "Backup: $(cat "$BACKUP_DIR/latest" 2>/dev/null || echo "N/A")"
    echo "Log: $DEPLOYMENT_LOG"
    echo
    echo "Next steps:"
    echo "- Monitor application for 24 hours"
    echo "- Check security logs"
    echo "- Verify all functionality"
    echo "- Update team on deployment status"
}

# Help function
show_help() {
    echo "Ungdomsstöd V2 - Deployment Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --version  Show version information"
    echo "  --dry-run      Show what would be done without executing"
    echo "  --rollback     Rollback to previous deployment"
    echo
    echo "Environment Variables:"
    echo "  NODE_ENV       Node environment (default: production)"
    echo "  JWT_SECRET     JWT secret key (required)"
    echo "  CLIENT_URL     Client URL (required)"
    echo "  DATABASE_URL   Database URL (optional)"
    echo
    echo "Examples:"
    echo "  $0                    # Deploy to production"
    echo "  $0 --dry-run          # Show deployment plan"
    echo "  $0 --rollback         # Rollback to previous version"
}

# Version function
show_version() {
    echo "Ungdomsstöd V2 Deployment Script v1.0"
    echo "Built: 2025-09-27"
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -v|--version)
        show_version
        exit 0
        ;;
    --dry-run)
        echo "Dry run mode - showing deployment plan:"
        echo "1. Pre-deployment checks"
        echo "2. Create backup"
        echo "3. Stop services"
        echo "4. Update code"
        echo "5. Install dependencies"
        echo "6. Run migrations"
        echo "7. Security tests"
        echo "8. Start services"
        echo "9. Health checks"
        echo "10. Post-deployment tasks"
        exit 0
        ;;
    --rollback)
        rollback
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
