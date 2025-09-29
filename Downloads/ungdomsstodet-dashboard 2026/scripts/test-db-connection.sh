#!/bin/bash

# 🔌 Database Connection Test Script
# Tests database connectivity and basic operations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "🔌 Testing database connection..."

# Test if we can start the server and connect to database
if [[ -f "server/index.ts" ]]; then
    # Start server in background for testing
    log "Starting server for connection test..."
    
    # Use tsx to start server temporarily
    timeout 30s npx tsx server/index.ts &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Test health endpoint
    if curl -f -s http://localhost:3001/api/health > /dev/null; then
        success "Database connection test passed"
    else
        error "Database connection test failed"
    fi
    
    # Stop test server
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    
else
    warning "Server file not found, skipping connection test"
fi

success "Database connection test completed"
